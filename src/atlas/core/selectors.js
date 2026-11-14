import { clone, freeze } from './contract.js';
import { selectLibraryStudies, selectStudyTrials, validateTrialSelection, updateTrialSelection } from './library.js';

export function getRevision(database, study_id, trial_id, revision_id) {
  const trial = database.trials.find(t => t.study_id === study_id && t.trial_id === trial_id);
  return trial?.revisions.find(r => r.revision_id === (revision_id ?? trial.active_revision_id)) ?? null;
}

/** Each reference is resolved within the chosen revision, so old links retain old evidence. */
export function fieldEvidence(database, study_id, trial_id, field, revision_id) {
  const revision = getRevision(database, study_id, trial_id, revision_id);
  if (!revision) return null;
  const ids = revision.record.field_source_refs[field];
  if (!ids) return null;
  return freeze(clone({ revision_id:revision.revision_id, scientific_verification:revision.record.review.scientific_verification,
    sources:revision.record.sources.filter(s => ids.includes(s.source_ref_id)) }));
}

export { selectLibraryStudies, selectStudyTrials, validateTrialSelection, updateTrialSelection };
