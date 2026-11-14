import { trialKey, clone, freeze } from './contract.js';
import { SAFETY_DOMAINS, UNIT_FAMILIES, normalizeEnum, normalizeMaterialName, resolveMetadata } from './metadata.js';

export const MIN_SELECTED_TRIALS = 1;
export const MAX_SELECTED_TRIALS = 3;

function trialMatchesFilter(trialEntry, filters, adapter) {
  const { record } = trialEntry;
  const meta = resolveMetadata(record, adapter);

  if (filters.study_id && record.study_id !== filters.study_id) return false;
  if (filters.domain) {
    const targetDomain = normalizeEnum(filters.domain, SAFETY_DOMAINS, {}) ?? filters.domain;
    if (meta.domain.status !== 'MEASURED' || meta.domain.value !== targetDomain) return false;
  }
  if (filters.unit_family) {
    const targetFamily = normalizeEnum(filters.unit_family, UNIT_FAMILIES, {}) ?? filters.unit_family;
    if (meta.unit_families.status !== 'MEASURED' || !meta.unit_families.values.includes(targetFamily)) return false;
  }
  if (filters.material) {
    const targetMat = normalizeMaterialName(filters.material) ?? String(filters.material).toUpperCase();
    if (meta.material.status !== 'MEASURED' || meta.material.value !== targetMat) return false;
  }
  if (filters.environment) {
    if (meta.environment.status !== 'MEASURED' || meta.environment.value !== filters.environment) return false;
  }
  if (filters.claim_type) {
    if (record.claim_type !== filters.claim_type) return false;
  }
  if (filters.search_text && String(filters.search_text).trim()) {
    const needle = String(filters.search_text).trim().toLowerCase();
    const haystack = [
      record.study_id,
      record.trial_id,
      record.material,
      record.outcome?.raw_display,
      ...(record.sources ?? []).map(s => `${s.document_id} ${s.table} ${s.excerpt}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/**
 * Pure selector returning unique parent studies (each study_id appears at most once)
 * with their child trials (Study -> trial hierarchy).
 */
export function selectLibraryStudies(database, filters = {}, options = {}) {
  if (!database || !Array.isArray(database.trials)) throw new Error('VALID_DATABASE_REQUIRED');
  const adapter = options.metadataAdapter ?? null;
  const studyMap = new Map();

  for (const trial of database.trials) {
    const activeRev = trial.revisions.find(r => r.revision_id === trial.active_revision_id);
    if (!activeRev) continue;
    const record = activeRev.record;
    const key = trialKey(trial.study_id, trial.trial_id);
    const meta = resolveMetadata(record, adapter);

    if (!studyMap.has(trial.study_id)) {
      studyMap.set(trial.study_id, {
        study_id: trial.study_id,
        domains: new Set(),
        unit_families: new Set(),
        materials: new Set(),
        environments: new Set(),
        all_trials: [],
        matched_trials: [],
      });
    }

    const group = studyMap.get(trial.study_id);
    if (meta.domain.value) group.domains.add(meta.domain.value);
    for (const uf of meta.unit_families.values) group.unit_families.add(uf);
    if (meta.material.value) group.materials.add(meta.material.value);
    if (meta.environment.value) group.environments.add(meta.environment.value);

    const summary = {
      key,
      study_id: trial.study_id,
      trial_id: trial.trial_id,
      active_revision_id: trial.active_revision_id,
      material: record.material,
      outcome: record.outcome.raw_display,
      sample_history: record.sample_history,
      claim_type: record.claim_type,
      review_status: record.review.status,
      metadata: meta,
      record,
    };

    group.all_trials.push(summary);
    if (trialMatchesFilter(summary, filters, adapter)) {
      group.matched_trials.push(summary);
    }
  }

  const hasActiveFilter = Object.values(filters ?? {}).some(v => v !== undefined && v !== null && String(v).trim() !== '');
  const studies = [];

  for (const group of studyMap.values()) {
    if (hasActiveFilter && group.matched_trials.length === 0) continue;
    const trialsToShow = hasActiveFilter ? group.matched_trials : group.all_trials;
    trialsToShow.sort((a, b) => a.trial_id.localeCompare(b.trial_id));

    studies.push({
      study_id: group.study_id,
      total_trial_count: group.all_trials.length,
      matched_trial_count: trialsToShow.length,
      domains: [...group.domains].sort(),
      unit_families: [...group.unit_families].sort(),
      materials: [...group.materials].sort(),
      environments: [...group.environments].sort(),
      trials: trialsToShow,
    });
  }

  studies.sort((a, b) => a.study_id.localeCompare(b.study_id));
  return freeze(studies);
}

/**
 * Pure selector for Study -> Trial drilldown.
 * Returns only child trials belonging to the specified `study_id`, preventing cross-study trial_id collisions.
 */
export function selectStudyTrials(database, study_id, options = {}) {
  if (!database || !Array.isArray(database.trials)) throw new Error('VALID_DATABASE_REQUIRED');
  if (typeof study_id !== 'string' || !study_id.trim()) throw new Error('STUDY_ID_REQUIRED');
  const studies = selectLibraryStudies(database, { ...(options.filters ?? {}), study_id }, options);
  const found = studies.find(s => s.study_id === study_id);
  return freeze(found ? found.trials : []);
}

function parseSelectionItem(item) {
  if (typeof item === 'string') {
    try {
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
        return { study_id: parsed[0], trial_id: parsed[1], key: trialKey(parsed[0], parsed[1]) };
      }
    } catch {
      // Bare string is not a valid composite [study_id, trial_id] key
    }
    return { error: 'COMPOSITE_STUDY_TRIAL_ID_REQUIRED', raw: item };
  }
  if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
    return { study_id: item[0], trial_id: item[1], key: trialKey(item[0], item[1]) };
  }
  if (item && typeof item === 'object' && typeof item.study_id === 'string' && typeof item.trial_id === 'string') {
    if (!item.study_id.trim() || !item.trial_id.trim()) {
      return { error: 'COMPOSITE_STUDY_TRIAL_ID_REQUIRED', raw: item };
    }
    return { study_id: item.study_id, trial_id: item.trial_id, key: trialKey(item.study_id, item.trial_id) };
  }
  return { error: 'COMPOSITE_STUDY_TRIAL_ID_REQUIRED', raw: item };
}

/**
 * Validates that a user selection contains 1 to 3 distinct composite [study_id, trial_id] items
 * and resolves them against `database` without mixing identical `trial_id`s across studies.
 */
export function validateTrialSelection(database, selection) {
  if (!Array.isArray(selection)) {
    return freeze({ ok: false, error: { code: 'SELECTION_ARRAY_REQUIRED', min: MIN_SELECTED_TRIALS, max: MAX_SELECTED_TRIALS } });
  }
  if (selection.length < MIN_SELECTED_TRIALS) {
    return freeze({
      ok: false,
      error: { code: 'SELECTION_EMPTY', message: 'Select between 1 and 3 trials.', min: MIN_SELECTED_TRIALS, max: MAX_SELECTED_TRIALS, count: 0 },
    });
  }

  const normalized = [];
  const seenKeys = new Set();

  for (const item of selection) {
    const parsed = parseSelectionItem(item);
    if (parsed.error) {
      return freeze({ ok: false, error: { code: parsed.error, item: parsed.raw } });
    }
    if (seenKeys.has(parsed.key)) {
      return freeze({ ok: false, error: { code: 'DUPLICATE_TRIAL_SELECTION', key: parsed.key } });
    }
    seenKeys.add(parsed.key);
    normalized.push(parsed);
  }

  if (normalized.length > MAX_SELECTED_TRIALS) {
    return freeze({
      ok: false,
      error: {
        code: 'SELECTION_LIMIT_EXCEEDED',
        message: `Maximum ${MAX_SELECTED_TRIALS} trials can be selected at once.`,
        min: MIN_SELECTED_TRIALS,
        max: MAX_SELECTED_TRIALS,
        count: normalized.length,
      },
    });
  }

  const resolved = [];
  if (database && Array.isArray(database.trials)) {
    for (const sel of normalized) {
      const trial = database.trials.find(t => t.study_id === sel.study_id && t.trial_id === sel.trial_id);
      if (!trial) {
        return freeze({ ok: false, error: { code: 'TRIAL_NOT_FOUND', study_id: sel.study_id, trial_id: sel.trial_id } });
      }
      const rev = trial.revisions.find(r => r.revision_id === trial.active_revision_id);
      resolved.push({
        key: sel.key,
        study_id: trial.study_id,
        trial_id: trial.trial_id,
        revision_id: rev.revision_id,
        record: clone(rev.record),
      });
    }
  }

  return freeze({
    ok: true,
    count: normalized.length,
    min: MIN_SELECTED_TRIALS,
    max: MAX_SELECTED_TRIALS,
    selected: normalized,
    trials: resolved,
  });
}

/**
 * Pure helper for UI selection toggling while enforcing composite identity and max 3 trials.
 */
export function updateTrialSelection(currentSelection = [], candidate, action = 'toggle') {
  const parsedCandidate = parseSelectionItem(candidate);
  if (parsedCandidate.error) {
    return freeze({ ok: false, error: { code: parsedCandidate.error }, selected: clone(currentSelection) });
  }

  const list = [];
  for (const item of currentSelection) {
    const p = parseSelectionItem(item);
    if (p.error) return freeze({ ok: false, error: { code: p.error }, selected: clone(currentSelection) });
    if (!list.some(x => x.key === p.key)) list.push(p);
  }

  const existsIdx = list.findIndex(x => x.key === parsedCandidate.key);
  if (action === 'remove' || (action === 'toggle' && existsIdx !== -1)) {
    if (existsIdx !== -1) list.splice(existsIdx, 1);
    return freeze({ ok: true, selected: list, count: list.length });
  }

  if (existsIdx !== -1) {
    return freeze({ ok: true, selected: list, count: list.length });
  }

  if (list.length >= MAX_SELECTED_TRIALS) {
    return freeze({
      ok: false,
      error: { code: 'SELECTION_LIMIT_EXCEEDED', max: MAX_SELECTED_TRIALS },
      selected: list,
    });
  }

  list.push(parsedCandidate);
  return freeze({ ok: true, selected: list, count: list.length });
}
