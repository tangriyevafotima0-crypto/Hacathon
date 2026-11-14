import { SCHEMA_VERSION, trialKey, stable, clone, freeze } from './contract.js';
import { previewImport, extractRow, reviewRecord } from './import.js';

export const STORE_KEY = 'skyforge.atlas.v1';
export const emptyDatabase = () => ({ schema_version:SCHEMA_VERSION, generation:0, trials:[] });

/** Reject corrupt or future-version stores; never turn a failed read into an empty write. */
export function validateDatabase(db) {
  if (!db || db.schema_version !== SCHEMA_VERSION || !Number.isSafeInteger(db.generation) || db.generation < 0 || !Array.isArray(db.trials)) throw new Error('STORE_SCHEMA_INVALID');
  const keys = new Set(), revisions = new Set();
  for (const trial of db.trials) {
    const key = trialKey(trial.study_id, trial.trial_id);
    if (keys.has(key) || !Array.isArray(trial.revisions) || !trial.revisions.length) throw new Error('STORE_TRIAL_INVALID');
    keys.add(key);
    let parent = null;
    for (let i = 0; i < trial.revisions.length; i++) {
      const r = trial.revisions[i];
      if (r.revision_id !== `${key}:r${i + 1}` || revisions.has(r.revision_id) || r.parent_revision_id !== parent) throw new Error('STORE_REVISION_INVALID');
      revisions.add(r.revision_id); parent = r.revision_id;
      if (r.record?.study_id !== trial.study_id || r.record?.trial_id !== trial.trial_id ||
        stable(reviewRecord(extractRow(r.record.raw_input))) !== stable(r.record)) throw new Error('STORE_RECORD_INVALID');
      if (r.user_confirmation !== 'CONFIRMED' || r.flags_acknowledged !== true || !['csv','json'].includes(r.import_format) || !Number.isFinite(Date.parse(r.created_at))) throw new Error('STORE_PROVENANCE_INVALID');
    }
    if (trial.active_revision_id !== parent) throw new Error('STORE_ACTIVE_REVISION_INVALID');
  }
  return db;
}

/** Storage is injected: localStorage in browser, fake storage in tests. No module globals. */
export function openAtlasStore(storage, { key = STORE_KEY, clock = () => new Date().toISOString() } = {}) {
  const plans = new WeakMap();
  function read() {
    try {
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error('STORAGE_UNAVAILABLE');
      const raw = storage.getItem(key);
      return { ok:true, raw, database:freeze(raw === null ? emptyDatabase() : validateDatabase(JSON.parse(raw))) };
    } catch (error) { return { ok:false, error:{ code:'STORE_READ_FAILED', message:error.message } }; }
  }
  function preview(text, format) {
    const loaded = read();
    if (!loaded.ok) return loaded;
    const preview = previewImport(text, format, loaded.database);
    const plan = freeze({ ...preview, base_generation: loaded.database.generation });
    if (plan.ok) plans.set(plan, { text, format, base:loaded.raw });
    return plan;
  }
  function commit(plan, { confirmed = false, acknowledgeFlags = false } = {}) {
    if (!confirmed) return { ok:false, error:{ code:'CONFIRMATION_REQUIRED' } };
    const pending = plans.get(plan);
    if (!pending || !plan.ok) return { ok:false, error:{ code:'INVALID_PREVIEW' } };
    if (!acknowledgeFlags && plan.entries.some(e => e.record.review.status === 'FLAGGED_FOR_REVIEW')) return { ok:false, error:{ code:'FLAG_ACKNOWLEDGEMENT_REQUIRED' } };
    const loaded = read();
    if (!loaded.ok) return loaded;
    if (loaded.raw !== pending.base) return { ok:false, error:{ code:'STALE_PREVIEW', message:'Reload and preview again; another write changed the store.' } };
    // Re-extract instead of trusting a caller-modified preview object.
    const checked = previewImport(pending.text, pending.format, loaded.database);
    if (!checked.ok) return { ok:false, error:{ code:'INVALID_PREVIEW' } };
    const next = clone(loaded.database), changes = [];
    try {
      for (const entry of checked.entries) {
        if (!['INSERT','NEW_REVISION'].includes(entry.action)) continue;
        const record = clone(entry.record);
        let trial = next.trials.find(t => trialKey(t.study_id, t.trial_id) === entry.key);
        if (!trial) { trial = { study_id:record.study_id, trial_id:record.trial_id, active_revision_id:null, revisions:[] }; next.trials.push(trial); }
        const revision_id = `${entry.key}:r${trial.revisions.length + 1}`;
        trial.revisions.push({ revision_id, parent_revision_id:trial.active_revision_id, created_at:clock(), import_format:pending.format,
          user_confirmation:'CONFIRMED', flags_acknowledged:true, record });
        trial.active_revision_id = revision_id;
        changes.push({ study_id:trial.study_id, trial_id:trial.trial_id, revision_id, action:entry.action });
      }
      if (changes.length) {
        next.generation++;
        validateDatabase(next);
        // One setItem gives atomic replacement on conforming Web Storage implementations.
        storage.setItem(key, JSON.stringify(next));
      }
      plans.delete(plan);
      return { ok:true, database:freeze(next), changes:freeze(changes), unchanged:checked.entries.length - changes.length };
    } catch (error) { return { ok:false, error:{ code:'STORE_WRITE_FAILED', message:error.message } }; }
  }
  return Object.freeze({ load:read, preview, commit });
}

export function activeRecords(database) {
  return database.trials.map(t => t.revisions.find(r => r.revision_id === t.active_revision_id).record);
}

/** JSON exchange contains original input rows; normalized SI is recomputed on import. */
export function exportJSON(database) {
  validateDatabase(database);
  return JSON.stringify({ schema_version:SCHEMA_VERSION, rows:activeRecords(database).map(r => r.raw_input) }, null, 2);
}

/** Full revision archive is a backup, not an import that can assert verified status. */
export function exportArchive(database) { validateDatabase(database); return JSON.stringify(database, null, 2); }
