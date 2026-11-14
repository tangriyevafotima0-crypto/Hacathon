import { clone, freeze } from './contract.js';
import { writeCSV } from './csv.js';
import { validateDatabase } from './store.js';
import { getRevision } from './selectors.js';
import { validateTrialSelection } from './library.js';

export const REPORT_SCHEMA_VERSION = 'skyforge.atlas.report/1';
export const REPORT_EXPORT_MODE = 'PRESENTATION_REPORT_NOT_IMPORT_EXCHANGE';

function formatParamColumns(record, paramKey) {
  const p = record.parameters.find(x => x.param_key === paramKey);
  if (!p) {
    return {
      [`${paramKey}_status`]: 'NOT_PROVIDED',
      [`${paramKey}_raw_text`]: '',
      [`${paramKey}_raw_unit`]: '',
      [`${paramKey}_raw_values`]: '',
      [`${paramKey}_raw_display`]: '',
      [`${paramKey}_si_values`]: '',
      [`${paramKey}_si_unit`]: '',
      [`${paramKey}_si_display`]: '',
      [`${paramKey}_direction`]: 'unknown',
      [`${paramKey}_location`]: 'NOT_PROVIDED',
      [`${paramKey}_source_ref_ids`]: '',
    };
  }
  return {
    [`${paramKey}_status`]: p.status,
    [`${paramKey}_raw_text`]: p.raw.text,
    [`${paramKey}_raw_unit`]: p.raw.unit,
    [`${paramKey}_raw_values`]: p.raw.values.join(' -> '),
    [`${paramKey}_raw_display`]: p.raw_display,
    [`${paramKey}_si_values`]: p.si.values.join(' -> '),
    [`${paramKey}_si_unit`]: p.si.unit,
    [`${paramKey}_si_display`]: p.si_display,
    [`${paramKey}_direction`]: p.direction,
    [`${paramKey}_location`]: p.location,
    [`${paramKey}_source_ref_ids`]: p.source_ref_ids.join(';'),
  };
}

function selectTargetRevisions(database, options = {}) {
  validateDatabase(database);
  if (Array.isArray(options.selection) && options.selection.length > 0) {
    const validated = validateTrialSelection(database, options.selection);
    if (!validated.ok) throw new Error(`INVALID_REPORT_SELECTION:${validated.error.code}`);
    return validated.selected.map(sel => {
      const rev = getRevision(database, sel.study_id, sel.trial_id, sel.revision_id);
      if (!rev) throw new Error(`REVISION_NOT_FOUND:${sel.study_id}:${sel.trial_id}`);
      return rev;
    });
  }
  return database.trials.map(t => t.revisions.find(r => r.revision_id === t.active_revision_id));
}

/**
 * Builds presentation/report rows preserving study_id, trial_id, revision_id, raw/SI values and units,
 * ordered flow, direction, location, missing state, sample history, outcome, and source locators.
 * Explicitly marked as `report_schema: "skyforge.atlas.report/1"` so it is never confused with raw import exchange.
 */
export function buildReportRows(database, options = {}) {
  const revisions = selectTargetRevisions(database, options);
  const rows = revisions.map(rev => {
    const r = rev.record;
    const primarySource = r.sources[0] ?? {
      source_ref_id: '',
      url: '',
      document_id: 'NOT_PROVIDED',
      pdf_page: null,
      printed_page: null,
      table: '',
      row_id: '',
      excerpt: '',
      excerpt_kind: 'NOT_PROVIDED',
    };

    return {
      report_schema: REPORT_SCHEMA_VERSION,
      export_mode: REPORT_EXPORT_MODE,
      importable_exchange: false,
      study_id: r.study_id,
      trial_id: r.trial_id,
      revision_id: rev.revision_id,
      parent_revision_id: rev.parent_revision_id ?? '',
      created_at: rev.created_at,
      import_format: rev.import_format,
      user_confirmation: rev.user_confirmation,
      scientific_verification: r.review.scientific_verification,
      review_status: r.review.status,
      review_reasons: r.review.reasons.join(';'),
      claim_type: r.claim_type,
      material: r.material,
      sample_history_value: r.sample_history.value ?? '',
      sample_history_status: r.sample_history.status,
      sample_history_source_ref_ids: r.sample_history.source_ref_ids.join(';'),
      outcome_display: r.outcome.raw_display,
      outcome_status: r.outcome.status,
      outcome_source_ref_ids: r.outcome.source_ref_ids.join(';'),
      ...formatParamColumns(r, 'sample_width'),
      ...formatParamColumns(r, 'flow_velocity'),
      ...formatParamColumns(r, 'o2_concentration'),
      source_ref_id: primarySource.source_ref_id,
      source_url: primarySource.url,
      document_id: primarySource.document_id,
      pdf_page: primarySource.pdf_page ?? '',
      printed_page: primarySource.printed_page ?? '',
      table: primarySource.table,
      row_id: primarySource.row_id,
      source_excerpt: primarySource.excerpt,
      excerpt_kind: primarySource.excerpt_kind,
      field_source_refs_json: JSON.stringify(r.field_source_refs),
    };
  });

  return freeze(rows);
}

/**
 * Presentation/report JSON export.
 * Distinct from `exportJSON(db)` (which is the raw re-importable exchange).
 */
export function exportReportJSON(database, options = {}) {
  const revisions = selectTargetRevisions(database, options);
  const rows = buildReportRows(database, options);
  const records = revisions.map(rev => ({
    study_id: rev.record.study_id,
    trial_id: rev.record.trial_id,
    revision_id: rev.revision_id,
    parent_revision_id: rev.parent_revision_id,
    created_at: rev.created_at,
    user_confirmation: rev.user_confirmation,
    scientific_verification: rev.record.review.scientific_verification,
    review: clone(rev.record.review),
    claim_type: rev.record.claim_type,
    material: rev.record.material,
    sample_history: clone(rev.record.sample_history),
    outcome: clone(rev.record.outcome),
    parameters: clone(rev.record.parameters),
    sources: clone(rev.record.sources),
    field_source_refs: clone(rev.record.field_source_refs),
  }));

  return JSON.stringify(
    {
      report_schema: REPORT_SCHEMA_VERSION,
      export_mode: REPORT_EXPORT_MODE,
      importable_exchange: false,
      database_generation: database.generation,
      row_count: rows.length,
      rows,
      records,
    },
    null,
    2
  );
}

/**
 * Presentation/report CSV export with RFC 4180 quoting for commas, quotes, and newlines.
 */
export function exportReportCSV(database, options = {}) {
  const rows = buildReportRows(database, options);
  return writeCSV(rows);
}
