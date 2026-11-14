import { BASS_THREE } from '../src/atlas/data/index.js';

const NASA = 'https://psi.nasa.gov/geode-py/ws';
const STATUSES = ['CONFIRMED', 'PROPOSED_CORRECTION', 'INSUFFICIENT_EVIDENCE'];
const MODEL = 'gemini-3.8-flash';

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

async function reevaluate(input, key) {
  const row = BASS_THREE.rows.find(r => r.study_id === input.study_id && r.trial_id === input.trial_id);
  const source = row && row.study_id + ':' + row.trial_id + ':source';
  if (!row || input.field !== 'sample_width_cm' || input.source_ref_id !== source ||
      !['string', 'number'].includes(typeof input.value) || !Number.isFinite(Number(input.value))) return null;
  const evidence = input.withhold_width === true ? null : Number(row.sample_width_cm);
  const expected = evidence === null ? 'INSUFFICIENT_EVIDENCE' :
    Number(input.value) === evidence ? 'CONFIRMED' : 'PROPOSED_CORRECTION';
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Compare the supplied sample width (cm) to the NASA table width (cm). Return CONFIRMED for equal values, PROPOSED_CORRECTION for a mismatch and INSUFFICIENT_EVIDENCE for missing evidence. Repeat identifiers exactly. Explain briefly in the requested language. ' +
        JSON.stringify({ trial_id: row.trial_id, field: input.field, source_ref_id: source, value_cm: Number(input.value), nasa_width_cm: evidence, language: input.language === 'uz' ? 'Uzbek' : 'English' }) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESULT_SCHEMA, maxOutputTokens: 768, thinkingConfig: { thinkingLevel: 'LOW' } },
    }),
  });
  if (response.status === 429) return { error: 'API_QUOTA', http: 429 };
  if (!response.ok) return { error: 'API_PROVIDER_FAILED', http: 502 };
  const payload = await response.json();
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const result = JSON.parse(parts.filter(part => !part.thought).map(part => part.text ?? '').join(''));
  if (result.status !== expected || result.trial_id !== row.trial_id ||
      result.field !== input.field || result.source_ref_id !== source ||
      result.value_cm !== evidence || typeof result.rationale !== 'string') {
    return { error: 'API_INVALID_RESPONSE', http: 502 };
  }
  return {
    status: result.status, trial_id: row.trial_id, field: input.field, source_ref_id: source,
    rationale: result.rationale.slice(0, 1000), model: MODEL,
    ...(expected === 'PROPOSED_CORRECTION' ? { proposed_raw_patch: { sample_width_cm: String(evidence) } } : {}),
  };
}

export function createAtlasApi(key) {
  let calls = 0;
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!['/api/nasa/bass-ii', '/api/re-evaluate'].includes(path)) return next();
    try {
      if (path === '/api/nasa/bass-ii' && req.method === 'GET') return send(res, 200, { csv: await getNasaTable() });
      if (path !== '/api/re-evaluate' || req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      if (!key) return send(res, 503, { error: 'API_UNAVAILABLE' });
      const input = await readBody(req);
      if (!input) return send(res, 400, { error: 'INVALID_REQUEST' });
      if (calls >= 100) return send(res, 429, { error: 'API_DEMO_LIMIT' });
      calls++;
      const result = await reevaluate(input, key);
      return result ? send(res, result.http ?? 200, result) : send(res, 400, { error: 'INVALID_REQUEST' });
    } catch (error) {
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      return send(res, timeout ? 504 : 502, { error: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FAILED' });
    }
  };
}
