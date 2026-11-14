import { BASS_THREE } from '../src/atlas/data/index.js';
import { convert, number } from '../src/atlas/core/contract.js';
import { createOpenRouter } from './openrouter.js';

const NASA = 'https://psi.nasa.gov/geode-py/ws';
const STATUSES = ['CONFIRMED', 'PROPOSED_CORRECTION', 'INSUFFICIENT_EVIDENCE'];

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) return null;
  }
  try { return JSON.parse(body); } catch { return null; }
}

async function getNasaTable() {
  const signal = AbortSignal.timeout(15000);
  const metadata = await fetch(NASA + '/repo/investigations/PSI-25', { signal });
  if (!metadata.ok) throw new Error('NASA_METADATA_UNAVAILABLE');
  const study = await metadata.json();
  const file = study.experimentalTable?.find(item => item.visible && !item.restricted &&
    item.file_name === 'PSI-25_Experimental table_BASS-II.csv');
  if (!file) throw new Error('NASA_TABLE_UNAVAILABLE');
  const params = new URLSearchParams({
    file: file._id.$oid, version: file.version, studyVersion: study.version, redirect: 'false',
  });
  const link = await fetch(NASA + '/studies/PSI-25/download?' + params, { signal });
  if (!link.ok) throw new Error('NASA_DOWNLOAD_UNAVAILABLE');
  const url = new URL((await link.text()).trim().replace(/^"|"$/g, ''));
  if (url.protocol !== 'https:' || !(url.hostname.endsWith('.amazonaws.com') || url.hostname.endsWith('.nasa.gov'))) {
    throw new Error('NASA_DOWNLOAD_HOST_INVALID');
  }
  const csv = await fetch(url, { signal, redirect: 'error' });
  if (!csv.ok) throw new Error('NASA_TABLE_UNAVAILABLE');
  const table = await csv.text();
  if (!table.startsWith('PI,Test #,Date,GMT,')) throw new Error('NASA_TABLE_FORMAT_CHANGED');
  return table;
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: STATUSES },
    trial_id: { type: 'string' },
    field: { type: 'string' },
    source_ref_id: { type: 'string' },
    value_cm: { type: ['number', 'null'] },
    rationale: { type: 'string' },
  },
  required: ['status', 'trial_id', 'field', 'source_ref_id', 'value_cm', 'rationale'],
};

function validateReevaluation(input) {
  const row = BASS_THREE.rows.find(r => r.study_id === input.study_id && r.trial_id === input.trial_id);
  const source = row && row.study_id + ':' + row.trial_id + ':source';
  if (!row || input.field !== 'sample_width_cm' || input.source_ref_id !== source ||
      !['string', 'number'].includes(typeof input.value)) return null;
  try {
    const value = number(input.value);
    const widthM = convert([value], 'cm', 'sample_width').values[0];
    if (widthM <= 0) return null;
    return { row, source, value, widthM };
  } catch {
    return null;
  }
}

async function reevaluate(input, router, { row, source, value, widthM }) {
  const evidence = input.withhold_width === true ? null : Number(row.sample_width_cm);
  const expected = evidence === null ? 'INSUFFICIENT_EVIDENCE' :
    widthM === convert([evidence], 'cm', 'sample_width').values[0] ? 'CONFIRMED' : 'PROPOSED_CORRECTION';
  const {data:result,...meta}=await router.complete({
    name:'atlas_width_check',schema:RESULT_SCHEMA,
    instructions:'Compare the supplied sample width in cm to the NASA width. Return CONFIRMED when equal, PROPOSED_CORRECTION for a mismatch or INSUFFICIENT_EVIDENCE when the NASA width is null. Return the NASA width or null in value_cm. Preserve identifiers. Explain briefly in the requested language.',
    input:{trial_id:row.trial_id,field:input.field,source_ref_id:source,value_cm:value,nasa_width_cm:evidence,language:input.language==='uz'?'Uzbek':'English'},
  });
  if (result?.status !== expected || result.trial_id !== row.trial_id ||
      result.field !== input.field || result.source_ref_id !== source ||
      result.value_cm !== evidence || typeof result.rationale !== 'string') {
    return { error: 'API_INVALID_RESPONSE', http: 502 };
  }
  return {
    status: result.status, trial_id: row.trial_id, field: input.field, source_ref_id: source,
    rationale: result.rationale.slice(0, 1000), ...meta,
    ...(expected === 'PROPOSED_CORRECTION' ? { proposed_raw_patch: { sample_width_cm: String(evidence) } } : {}),
  };
}

export function createAtlasApi(router=createOpenRouter()) {
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!['/api/nasa/bass-ii', '/api/re-evaluate'].includes(path)) return next();
    try {
      if (path === '/api/nasa/bass-ii' && req.method === 'GET') return send(res, 200, { csv: await getNasaTable() });
      if (path !== '/api/re-evaluate' || req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      if (!router.configured) return send(res, 503, { error: 'API_UNAVAILABLE' });
      if (req.headers?.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`) {
        return send(res,403,{error:'API_ORIGIN'});
      }
      const input = await readBody(req);
      const validated = input && validateReevaluation(input);
      if (!validated) return send(res, 400, { error: 'INVALID_REQUEST' });
      const result = await reevaluate(input, router, validated);
      return send(res, result.http ?? 200, result);
    } catch (error) {
      if(error.status)return send(res,error.status,{error:error.message});
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      return send(res, timeout ? 504 : 502, { error: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FAILED' });
    }
  };
}
