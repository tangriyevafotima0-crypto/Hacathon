import { parseCSV } from './csv.js';
import { SCHEMA_VERSION, MISSING_STATES, LOCATIONS, PARAMS, id, number, safeURL, convert, direction, stable, trialKey, clone, freeze } from './contract.js';

const columns = new Set(['study_id','study','trial_id','material','sample_width_cm','sample_width_raw','sample_width_unit','sample_width_status','sample_width_location','flow_raw','flow_unit','flow_status','flow_location','oxygen_vol_pct','oxygen_raw','oxygen_unit','oxygen_status','oxygen_location','sample_history','outcome','source_url','document_id','pdf_page','printed_page','table','row_id','source_excerpt','excerpt_kind','claim_type','schema_version']);
const missing = value => value === undefined || value === null || String(value).trim() === '';
const str = value => missing(value) ? '' : String(value);

function parameter(row, key, rawKey, unitKey, statusKey, locationKey, ref) {
  const raw = str(row[rawKey]);
  let status = str(row[statusKey]) || (missing(raw) ? 'NOT_PROVIDED' : 'MEASURED');
  if (!MISSING_STATES.includes(status)) throw new Error(`INVALID_MISSING_STATE:${key}`);
  if (['NOT_PROVIDED','NOT_APPLICABLE'].includes(status) && raw) throw new Error(`MISSING_STATE_HAS_VALUE:${key}`);
  const unit = str(row[unitKey]) || PARAMS[key][0];
  const location = str(row[locationKey]) || PARAMS[key][2];
  if (!LOCATIONS.includes(location)) throw new Error(`INVALID_LOCATION:${key}`);
  let values = [];
  if (status === 'MEASURED') {
    const parts = key === 'flow_velocity' ? raw.trim().split(/\s*(?:->|→|\bto\b)\s*/i) : [raw];
    if (parts.length > 2) throw new Error('FLOW_REQUIRES_ONE_OR_TWO_ORDERED_VALUES');
    values = parts.map(number);
  }
  const si = status === 'MEASURED' ? convert(values, unit, key) : { unit: PARAMS[key][1], values: [] };
  return { param_key: key, status, raw_display: raw ? `${raw} ${unit}` : '', raw: { text: raw, unit, values }, si,
    si_display: si.values.length ? `${si.values.join(' → ')} ${si.unit}` : '',
    direction: values.length ? direction(values) : 'unknown', location, source_ref_ids: [ref] };
}

/** Pass 1: deterministic extraction. No credibility or user confirmation inferred. */
export function extractRow(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('ROW_OBJECT_REQUIRED');
  for (const [k, v] of Object.entries(input)) {
    if (['__proto__','constructor','prototype'].includes(k)) throw new Error('UNSAFE_KEY');
    if (v !== null && !['string','number','boolean'].includes(typeof v)) throw new Error(`FLAT_SCALAR_REQUIRED:${k}`);
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`NONFINITE_NUMBER:${k}`);
  }
  const row = clone(input);
  if (row.schema_version && row.schema_version !== SCHEMA_VERSION) throw new Error('UNSUPPORTED_SCHEMA');
  // Unit-bearing legacy column names remain authoritative about their units.
  if (!missing(row.sample_width_cm) && missing(row.sample_width_raw) && row.sample_width_unit && row.sample_width_unit !== 'cm') throw new Error('UNIT_COLUMN_CONFLICT:sample_width_cm');
  if (!missing(row.oxygen_vol_pct) && missing(row.oxygen_raw) && row.oxygen_unit && row.oxygen_unit !== 'vol%') throw new Error('UNIT_COLUMN_CONFLICT:oxygen_vol_pct');
  // If a flexible value and a legacy alias are both present, require equal SI values.
  if (!missing(row.sample_width_cm) && !missing(row.sample_width_raw)) {
    if (convert([number(row.sample_width_raw)],row.sample_width_unit || 'cm','sample_width').values[0] !== convert([number(row.sample_width_cm)],'cm','sample_width').values[0]) throw new Error('ALIAS_VALUE_CONFLICT:sample_width');
  }
  if (!missing(row.oxygen_vol_pct) && !missing(row.oxygen_raw)) {
    if (convert([number(row.oxygen_raw)],row.oxygen_unit || 'vol%','o2_concentration').values[0] !== convert([number(row.oxygen_vol_pct)],'vol%','o2_concentration').values[0]) throw new Error('ALIAS_VALUE_CONFLICT:oxygen');
  }
  const study = row.study_id || (row.study === 'BASS-II' ? 'PSI-25' : row.study);
  const study_id = id(study), trial_id = id(row.trial_id);
  if (!safeURL(row.source_url)) throw new Error('SOURCE_HTTP_URL_REQUIRED');
  for (const k of ['pdf_page','printed_page']) if (!missing(row[k]) && (!Number.isInteger(number(row[k])) || number(row[k]) < 1)) throw new Error(`INVALID_PAGE:${k}`);
  const ref = `${study_id}:${trial_id}:source`;
  const source = { source_ref_id: ref, url: row.source_url, document_id: str(row.document_id) || 'NOT_PROVIDED',
    pdf_page: missing(row.pdf_page) ? null : number(row.pdf_page), printed_page: missing(row.printed_page) ? null : number(row.printed_page),
    table: str(row.table), row_id: str(row.row_id) || trial_id, excerpt: str(row.source_excerpt),
    excerpt_kind: row.source_excerpt ? (row.excerpt_kind === 'TABLE_TRANSCRIPTION' ? 'TABLE_TRANSCRIPTION' : 'USER_SUPPLIED_UNVERIFIED') : 'NOT_PROVIDED' };
  const parameters = [
    parameter({ ...row, sample_width_raw: row.sample_width_raw ?? row.sample_width_cm }, 'sample_width', 'sample_width_raw','sample_width_unit','sample_width_status','sample_width_location',ref),
    parameter(row, 'flow_velocity','flow_raw','flow_unit','flow_status','flow_location',ref),
    parameter({ ...row, oxygen_raw: row.oxygen_raw ?? row.oxygen_vol_pct }, 'o2_concentration','oxygen_raw','oxygen_unit','oxygen_status','oxygen_location',ref),
  ];
  const history = str(row.sample_history) || 'NOT_PROVIDED';
  if (!['NEW','REUSED','NOT_PROVIDED','NOT_EXTRACTED','CONFLICTING','NOT_APPLICABLE'].includes(history)) throw new Error('INVALID_SAMPLE_HISTORY');
  const claim_type = str(row.claim_type) || 'OBSERVATION';
  if (!['OBJECTIVE','HYPOTHESIS','OBSERVATION','MODEL_RESULT','CAVEAT'].includes(claim_type)) throw new Error('INVALID_CLAIM_TYPE');
  return { schema_version: SCHEMA_VERSION, study_id, trial_id, material: str(row.material), claim_type,
    sample_history: { value: ['NEW','REUSED'].includes(history) ? history : null, status: ['NEW','REUSED'].includes(history) ? 'MEASURED' : history, source_ref_ids: [ref] },
    outcome: { raw_display: str(row.outcome), status: missing(row.outcome) ? 'NOT_PROVIDED' : 'MEASURED', source_ref_ids: [ref] },
    parameters, sources: [source], field_source_refs: Object.fromEntries(['material','outcome','sample_history',...parameters.map(p => p.param_key)].map(k => [k,[ref]])), raw_input: row,
    unparsed_columns: Object.keys(row).filter(k => !columns.has(k)).map(k => ({ param_key:k, status:'NOT_EXTRACTED', raw:row[k] })) };
}

/** Pass 2: explicit review reasons. Import trust is separate from physical metadata. */
export function reviewRecord(record) {
  const reasons = [];
  if (record.sample_history.value === 'REUSED') reasons.push('REUSED_SAMPLE');
  if (record.sample_history.status !== 'MEASURED') reasons.push('SAMPLE_HISTORY_MISSING');
  for (const p of record.parameters) {
    if (p.status !== 'MEASURED') reasons.push(`${p.param_key}:METADATA_MISSING`);
    if (p.location === 'NOT_PROVIDED') reasons.push(`${p.param_key}:LOCATION_MISSING`);
  }
  if (!record.material) reasons.push('MATERIAL_MISSING');
  if (record.outcome.status !== 'MEASURED') reasons.push('OUTCOME_MISSING');
  if (record.sources.some(s => s.pdf_page === null || s.printed_page === null || !s.table || s.excerpt_kind === 'NOT_PROVIDED')) reasons.push('SOURCE_LOCATOR_OR_EXCERPT_INCOMPLETE');
  if (record.unparsed_columns.length) reasons.push('UNMAPPED_COLUMNS');
  if (record.sources.some(s => s.row_id !== record.trial_id)) reasons.push('SOURCE_ROW_ID_DIFFERS');
  return { ...clone(record), review: { status: reasons.length ? 'FLAGGED_FOR_REVIEW' : 'UNREVIEWED', reasons, scientific_verification: 'NOT_VERIFIED' } };
}

export function readImport(text, format) {
  if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('IMPORT_TEXT_INVALID_OR_TOO_LARGE');
  let rows;
  if (format === 'csv') rows = parseCSV(text);
  else if (format === 'json') {
    const data = JSON.parse(text);
    if (Array.isArray(data)) rows = data;
    else if (data?.schema_version === SCHEMA_VERSION && Array.isArray(data.rows)) rows = data.rows;
    else throw new Error('JSON_ROWS_ARRAY_REQUIRED');
  } else throw new Error('UNSUPPORTED_IMPORT_FORMAT');
  if (!rows.length || rows.length > 10000) throw new Error('IMPORT_ROW_COUNT');
  return rows;
}

export function previewImport(text, format, database) {
  const entries = [], errors = [], seen = new Map();
  let rows;
  try { rows = readImport(text, format); } catch (error) { return freeze({ ok:false, entries:[], errors:[{ row:null, message:error.message }] }); }
  for (let i = 0; i < rows.length; i++) {
    try {
      const record = reviewRecord(extractRow(rows[i]));
      const key = trialKey(record.study_id, record.trial_id);
      const signature = stable(record);
      if (seen.has(key)) {
        if (seen.get(key) !== signature) throw new Error('CONFLICTING_DUPLICATE_IN_BATCH');
        entries.push({ row:i + 1, key, action:'DUPLICATE_IN_BATCH', record }); continue;
      }
      seen.set(key, signature);
      const existing = database.trials.find(t => trialKey(t.study_id, t.trial_id) === key);
      const previous = existing?.revisions.find(r => stable(r.record) === signature);
      entries.push({ row:i + 1, key, action: previous ? 'UNCHANGED' : existing ? 'NEW_REVISION' : 'INSERT',
        matched_revision_id: previous?.revision_id ?? null, record });
    } catch (error) { errors.push({ row:i + 1, message:error.message }); }
  }
  return freeze({ ok: errors.length === 0, entries, errors });
}
