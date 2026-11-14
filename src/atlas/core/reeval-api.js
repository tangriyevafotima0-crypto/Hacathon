import { clone, freeze } from './contract.js';
import { getRevision } from './selectors.js';

export const API_STATUS_UNAVAILABLE = 'API_UNAVAILABLE';
export const API_STATUS_READY = 'API_ADAPTER_CONFIGURED';

const SECRET_KEY_REGEX = /(?:api[_-]?key|secret|token|password|authorization|bearer)/i;
const proposals = new WeakMap();

export function containsSecretMaterial(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_REGEX.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
      return true;
    }
    if (v && typeof v === 'object' && containsSecretMaterial(v)) return true;
  }
  return false;
}

/**
 * Reports whether a real re-evaluation adapter is configured.
 * Because the repository contains no live AI provider adapter, the default is `API_UNAVAILABLE`.
 */
export function getReevaluationApiStatus(adapter = null) {
  if (adapter && containsSecretMaterial(adapter)) {
    return freeze({
      available: false,
      status: 'API_SECRET_REJECTED',
      message: 'API keys or secrets must never be passed into frontend or core adapter objects.',
    });
  }
  if (!adapter || typeof adapter.evaluate !== 'function') {
    return freeze({
      available: false,
      status: API_STATUS_UNAVAILABLE,
      message: 'API unavailable: no configured re-evaluation adapter exists in this repository.',
    });
  }
  return freeze({
    available: true,
    status: API_STATUS_READY,
    provider_name: String(adapter.name || 'custom-adapter'),
    message: 'External re-evaluation adapter configured; proposals require explicit diff confirmation before creating a revision.',
  });
}

/**
 * Requests a non-mutating re-evaluation proposal from an injected adapter.
 * - If no adapter is configured, returns `API_UNAVAILABLE`.
 * - Never modifies the underlying store or active record.
 * - On provider failure, preserves the original record and returns `API_PROVIDER_FAILED`.
 */
export async function proposeReevaluation(store, request, options = {}) {
  if (!store || typeof store.load !== 'function' || typeof store.preview !== 'function') {
    throw new Error('VALID_ATLAS_STORE_REQUIRED');
  }
  const adapter = options.adapter ?? null;
  const apiStatus = getReevaluationApiStatus(adapter);
  if (!apiStatus.available) {
    return freeze({
      ok: false,
      status: apiStatus.status,
      error: { code: apiStatus.status, message: apiStatus.message },
    });
  }

  const loaded = store.load();
  if (!loaded.ok) return loaded;

  const { study_id, trial_id, revision_id } = request ?? {};
  if (!study_id || !trial_id) {
    return freeze({
      ok: false,
      status: 'INVALID_REQUEST',
      error: { code: 'STUDY_AND_TRIAL_ID_REQUIRED', message: 'study_id and trial_id are required.' },
    });
  }

  const targetRevision = getRevision(loaded.database, study_id, trial_id, revision_id);
  if (!targetRevision) {
    return freeze({
      ok: false,
      status: 'NOT_FOUND',
      error: { code: 'TARGET_REVISION_NOT_FOUND', message: `No revision found for ${study_id}/${trial_id}.` },
    });
  }

  let providerResult;
  try {
    providerResult = await adapter.evaluate(
      freeze(clone({
        study_id,
        trial_id,
        revision_id: targetRevision.revision_id,
        record: targetRevision.record,
        sources: targetRevision.record.sources,
      }))
    );
  } catch (error) {
    return freeze({
      ok: false,
      status: 'PROVIDER_ERROR',
      error: { code: 'API_PROVIDER_FAILED', message: error?.message || 'Adapter evaluation failed.' },
    });
  }

  if (!providerResult || typeof providerResult !== 'object' || !providerResult.proposed_raw_patch || typeof providerResult.proposed_raw_patch !== 'object') {
    return freeze({
      ok: false,
      status: 'PROVIDER_ERROR',
      error: { code: 'INVALID_PROVIDER_PROPOSAL', message: 'Adapter must return a proposed_raw_patch object.' },
    });
  }

  if (containsSecretMaterial(providerResult)) {
    return freeze({
      ok: false,
      status: 'API_SECRET_REJECTED',
      error: { code: 'API_SECRET_REJECTED', message: 'Provider response must not contain credentials or tokens.' },
    });
  }

  const originalRaw = clone(targetRevision.record.raw_input);
  const safePatch = clone(providerResult.proposed_raw_patch);
  // Identity fields cannot be overwritten by re-evaluation patch
  delete safePatch.study_id;
  delete safePatch.study;
  delete safePatch.trial_id;
  const candidateRaw = { ...originalRaw, ...safePatch };

  const diffs = [];
  for (const [k, afterVal] of Object.entries(candidateRaw)) {
    const beforeVal = originalRaw[k] ?? null;
    if (String(beforeVal ?? '') !== String(afterVal ?? '')) {
      diffs.push({
        field: k,
        before: beforeVal,
        after: afterVal,
        note: providerResult.notes?.[k] ?? providerResult.rationale ?? '',
      });
    }
  }

  // Validate candidate row via store.preview (read-only)
  const previewPlan = store.preview(JSON.stringify([candidateRaw]), 'json');
  if (!previewPlan.ok) {
    return freeze({
      ok: false,
      status: 'INVALID_PROPOSAL_VALUES',
      error: { code: 'PROPOSAL_FAILED_CONTRACT_VALIDATION', details: previewPlan.errors },
    });
  }

  const proposal = freeze({
    ok: true,
    status: 'PROPOSAL_READY_FOR_CONFIRMATION',
    study_id,
    trial_id,
    base_revision_id: targetRevision.revision_id,
    base_generation: loaded.database.generation,
    rationale: String(providerResult.rationale ?? ''),
    diffs,
    original_raw_input: originalRaw,
    proposed_raw_input: candidateRaw,
    preview_entry: previewPlan.entries[0],
  });

  proposals.set(proposal, {
    store,
    previewPlan,
    cancelled: false,
  });

  return proposal;
}

/**
 * Cancels a pending re-evaluation proposal without modifying the store.
 */
export function cancelReevaluation(proposal) {
  const entry = proposals.get(proposal);
  if (entry) {
    entry.cancelled = true;
    proposals.delete(proposal);
  }
  return freeze({
    ok: true,
    status: 'CANCELLED',
    mutated: false,
  });
}

/**
 * Commits a previously generated re-evaluation proposal ONLY after explicit user diff confirmation,
 * creating a new append-only revision while preserving all prior revisions.
 */
export function commitReevaluation(store, proposal, { confirmed = false, acknowledgeFlags = false } = {}) {
  if (!confirmed) {
    return freeze({ ok: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'User must confirm the diff before creating a revision.' } });
  }
  const pending = proposals.get(proposal);
  if (!pending || pending.cancelled || pending.store !== store || !proposal?.ok) {
    return freeze({ ok: false, error: { code: 'INVALID_OR_CANCELLED_PROPOSAL' } });
  }
  const result = store.commit(pending.previewPlan, { confirmed: true, acknowledgeFlags });
  if (result.ok) {
    proposals.delete(proposal);
  }
  return result;
}
