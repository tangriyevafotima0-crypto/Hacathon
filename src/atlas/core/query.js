import { LOCATIONS, convert, number, direction as computeDirection, stable, clone, freeze } from './contract.js';
import {
  SAFETY_DOMAINS,
  FUEL_TYPES,
  ENVIRONMENTS,
  UNIT_FAMILIES,
  normalizeEnum,
  normalizeMaterialName,
  resolveMetadata,
} from './metadata.js';

export const ALIGNMENT_THRESHOLD_PCT = 70;
export const SCORE_TERMINOLOGY = 'alignment_score';

const MATERIAL_PATTERNS = [
  { canonical: 'SIBAL', fuel_type: 'SOLID_FABRIC', domain: 'PREVENTION_SOLID', regex: /\bsibal\b(?:\s+(?:qattiq\s+)?(?:mato(?:si|da|ning)?|fabric|textile|cloth))?/i },
  { canonical: 'PMMA', fuel_type: 'SOLID_POLYMER', domain: 'PREVENTION_SOLID', regex: /\b(?:pmma|acrylic|akril|polimetilmetakrilat)\b(?:\s+(?:polimer(?:i|da)?|polymer|plastic|plastik|sterjen|rod))?/i },
  { canonical: 'NOMEX', fuel_type: 'SOLID_FABRIC', domain: 'PREVENTION_SOLID', regex: /\bnomex\b(?:\s+(?:mato(?:si|da)?|fabric|textile))?/i },
  { canonical: 'COTTON', fuel_type: 'SOLID_FABRIC', domain: 'PREVENTION_SOLID', regex: /\b(?:cotton|paxta)\b(?:\s+(?:mato(?:si|da)?|fabric|textile))?/i },
  { canonical: 'SILICONE', fuel_type: 'SOLID_POLYMER', domain: 'PREVENTION_SOLID', regex: /\b(?:silicone|silikon)\b/i },
  { canonical: 'KAPTON', fuel_type: 'AEROSOL_SUBSTRATE', domain: 'DETECTION_AEROSOL', regex: /\bkapton\b/i },
  { canonical: 'HEPTANE', fuel_type: 'LIQUID_DROPLET', domain: 'SUPPRESSION_DROPLET', regex: /\b(?:n-?heptane|heptane|n-?geptan|geptan)\b/i },
  { canonical: 'METHANOL', fuel_type: 'LIQUID_DROPLET', domain: 'SUPPRESSION_DROPLET', regex: /\b(?:methanol|metanol)\b/i },
];

const FUEL_PATTERNS = [
  { canonical: 'SOLID_FABRIC', domain: 'PREVENTION_SOLID', regex: /\b(?:solid\s+fabric(?:s)?|solid\s+textile(?:s)?|qattiq\s+mato(?:lar|da|si)?|mato\s+yonish(?:i)?|fabric\s+combustion|fabric|mato)\b/i },
  { canonical: 'SOLID_POLYMER', domain: 'PREVENTION_SOLID', regex: /\b(?:solid\s+polymer(?:s)?|qattiq\s+polimer(?:lar)?|polimer|polymer)\b/i },
  { canonical: 'LIQUID_DROPLET', domain: 'SUPPRESSION_DROPLET', regex: /\b(?:liquid\s+droplet(?:s)?|fuel\s+droplet(?:s)?|suyuq\s+tomchi(?:lar)?|yoqilg['’`]?i\s+tomchi(?:si|lari)?|droplet|tomchi)\b/i },
  { canonical: 'GAS_BURNER', domain: 'GAS_EMULATION', regex: /\b(?:gas[\s-]+burner|gaseous\s+burner|spherical\s+burner|gaz\s+gorelka(?:si|da)?|sferik\s+gorelka|gorelka)\b/i },
];

const DOMAIN_PATTERNS = [
  { canonical: 'PREVENTION_SOLID', regex: /\b(?:flame\s+spread|solid\s+combustion|olov\s+tarqalish(?:i)?|qattiq\s+jism\s+yonish(?:i)?|prevention)\b/i },
  { canonical: 'SUPPRESSION_DROPLET', regex: /\b(?:cool\s+flame|droplet\s+suppression|sovuq\s+alanga|tomchi\s+o['’`]?chirish|suppression)\b/i },
  { canonical: 'DETECTION_AEROSOL', regex: /\b(?:smoke\s+aerosol|smoke\s+detection|aerosol\s+sizing|tutun\s+zarra(?:lari|chasi)?|tutun\s+detektor(?:i)?|aerozol)\b/i },
  { canonical: 'GAS_EMULATION', regex: /\b(?:burning\s+rate\s+emulator|gas\s+emulation|emulyator|proksi\s+gorelka)\b/i },
  { canonical: 'CFD_MODELING', regex: /\b(?:3d\s+cfd|openfoam|numerical\s+simulation|kompyuter\s+simulyatsiya(?:si)?|raqamli\s+model|cfd\s+model(?:ing)?|cfd)\b/i },
];

const ENVIRONMENT_PATTERNS = [
  { canonical: 'PARTIAL_G_MOON', regex: /\b(?:moon|lunar|0[.,]16\s*g|1\/6\s*g|oy\s+baza(?:si|da)?|oydagi|oyda|oy\s+tortishish(?:i)?|oy)\b/i },
  { canonical: 'PARTIAL_G_MARS', regex: /\b(?:mars(?:da|dagi)?|martian|0[.,]38\s*g)\b/i },
  { canonical: 'FLIGHT_PROXY_0G', regex: /\b(?:e-?field|electric[\s-]+field\s+proxy|elektr\s+maydon\s+proksi(?:si)?|ion[\s-]+wind\s+proxy)\b/i },
  { canonical: 'GROUND_CFD', regex: /\b(?:ground[\s-]+cfd|yerda(?:gi)?\s+cfd)\b/i },
  { canonical: 'FLIGHT_0G', regex: /\b(?:microgravity|zero[\s-]+gravity|zero[\s-]+g|0\s*g|freefall|orbital|mikrogravitatsiya(?:da)?|vaznsizlik(?:da)?|erkin\s+tushish(?:da)?)\b/i },
  { canonical: 'GROUND_1G', regex: /\b(?:1\s*g|earth\s+gravity|ground\s+test|yer\s+tortishish(?:i|ida)?|yerda\s+sinov)\b/i },
  { canonical: 'PARTIAL_G', regex: /\b(?:partial[\s-]+g(?:ravity)?|qisman\s+tortishish)\b/i },
];

const LOCATION_PATTERNS = [
  { canonical: 'burner_flow', regex: /\b(?:in\s+(?:the\s+)?burner(?:\s+flow)?|burner[_\s-]+flow|internal\s+burner|burner\s+inlet|gorelka\s+oqimi(?:da)?|gorelka\s+ichida|gorelkada)\b/i },
  { canonical: 'chamber_atmosphere', regex: /\b(?:in\s+(?:the\s+)?chamber(?:\s+atmosphere)?|chamber[_\s-]+atmosphere|cabin\s+atmosphere|ambient\s+chamber|kamera\s+atmosfera(?:si|sida)?|kamera\s+havosi(?:da)?|xona\s+havosi(?:da)?|kamerada|kabinada)\b/i },
  { canonical: 'sample_surface', regex: /\b(?:sample[_\s-]+surface|on\s+sample\s+surface|namuna\s+sirti(?:da)?|mato\s+yuzasi(?:da)?)\b/i },
  { canonical: 'simulation_domain', regex: /\b(?:simulation[_\s-]+domain|simulyatsiya\s+sohasi(?:da)?|model\s+domeni(?:da)?)\b/i },
];

const UNIT_FAMILY_PATTERNS = [
  { canonical: 'FAMILY_A_FLAME_METRICS', regex: /\b(?:family\s*a|flame\s+metrics|sample\s+width|namuna\s+eni|olcham\s+oilasi|birlik\s+oilasi\s*a)\b/i },
  { canonical: 'FAMILY_B_ATMOS_THERMO', regex: /\b(?:family\s*b|atmosphere\s+family|atmos\s+thermo|atmosfera\s+oilasi|birlik\s+oilasi\s*b)\b/i },
  { canonical: 'FAMILY_C_HEAT_FLUX', regex: /\b(?:family\s*c|heat\s+flux|issiqlik\s+oqimi|birlik\s+oilasi\s*c)\b/i },
  { canonical: 'FAMILY_D_SOOT_AEROSOL', regex: /\b(?:family\s*d|soot\s+aerosol|tutun\s+oilasi|birlik\s+oilasi\s*d)\b/i },
  { canonical: 'FAMILY_E_CFD_GRID', regex: /\b(?:family\s*e|cfd\s+grid|setka\s+oilasi|birlik\s+oilasi\s*e)\b/i },
];

const SAMPLE_HISTORY_PATTERNS = [
  { canonical: 'REUSED', regex: /\b(?:reused(?:\s+sample)?|qayta\s+ishlatilgan(?:\s+namuna)?)\b/i },
  { canonical: 'NEW', regex: /\b(?:new\s+sample|pristine\s+sample|yangi\s+namuna)\b/i },
];

const STOPWORDS = new Set([
  'in', 'at', 'on', 'for', 'with', 'and', 'or', 'the', 'a', 'an', 'of', 'to', 'from', 'by', 'is', 'are', 'what', 'which',
  'how', 'does', 'do', 'show', 'find', 'search', 'compare', 'under', 'about', 'condition', 'conditions', 'trial', 'trials',
  'study', 'studies', 'experiment', 'experiments', 'test', 'tests', 'burn', 'burning', 'combustion', 'fire', 'flame',
  'uchun', 'bilan', 'va', 'yoki', 'da', 'dagi', 'ning', 'ni', 'ga', 'dan', 'bu', 'qanday', 'qaysi', 'nima', 'top',
  'qidir', 'solishtir', 'sinov', 'sinovlar', 'tadqiqot', 'tadqiqotlar', 'tajriba', 'sharoit', 'sharoitda', 'yonish',
  'yongin', 'olov', 'alanga', 'haqida', 'bo‘yicha', 'boyicha', 'ber', 'ko‘rsat', 'korsat', 'mos', 'dalil', 'evidence',
  'width', 'eni', 'kengligi', 'flow', 'airflow', 'oqim', 'havo', 'tezligi', 'oxygen', 'kislorod', 'o2', 'o₂',
  'atmosphere', 'atmosfera', 'gravity', 'tortishish', 'unit', 'family', 'birlik', 'oilasi', 'sample', 'namuna',
]);

function detectLanguage(text) {
  const uzHits = (text.match(/\b(?:uchun|bilan|qattiq|mato|kislorod|oqim|namuna|eni|sinov|tadqiqot|oyda|yerda|gorelka|kamera|sovuq|tutun|qayta|ishlatilgan)\b/gi) ?? []).length;
  const enHits = (text.match(/\b(?:solid|fabric|oxygen|flow|sample|width|trial|study|moon|lunar|earth|burner|chamber|cool|smoke|reused|in|with|for)\b/gi) ?? []).length;
  if (uzHits > 0 && enHits > 0) return 'mixed';
  if (uzHits > 0) return 'uz';
  if (enHits > 0) return 'en';
  return 'unknown';
}

function consumeSpan(spans, match) {
  if (!match || match.index === undefined) return;
  spans.push([match.index, match.index + match[0].length]);
}

function isCovered(index, length, spans) {
  const end = index + length;
  return spans.some(([s, e]) => index < e && end > s);
}

function buildCanonicalFilterEntry(f) {
  return {
    field: f.field,
    operator: f.operator ?? 'eq',
    value: f.value,
    si_value: f.si_value ?? null,
    unit: f.unit ?? null,
    location: f.location ?? null,
    direction: f.direction ?? null,
    status: f.status ?? 'PARSED',
  };
}

function finalizeQueryState(state) {
  const filters = [...state.filters].map((f, idx) => ({
    filter_id: f.filter_id || `f_${idx + 1}_${f.field}`,
    field: f.field,
    operator: f.operator ?? 'eq',
    value: f.value,
    si_value: f.si_value ?? null,
    unit: f.unit ?? null,
    location: f.location ?? null,
    direction: f.direction ?? null,
    source_text: f.source_text ?? '',
    origin: f.origin ?? 'parsed',
    status: f.status ?? 'PARSED',
  }));

  const canonicalFilters = filters
    .map(buildCanonicalFilterEntry)
    .sort((a, b) => a.field.localeCompare(b.field) || String(a.value).localeCompare(String(b.value)));

  const unparsed = [...(state.unparsed_requirements ?? [])].map((u, idx) => ({
    id: u.id || `unparsed_${idx + 1}`,
    source_text: u.source_text,
    reason: u.reason || 'UNRECOGNIZED_REQUIREMENT',
  }));

  return freeze({
    raw_query: state.raw_query ?? '',
    detected_language: state.detected_language ?? 'unknown',
    filters,
    canonical_filters: canonicalFilters,
    canonical_signature: stable({
      filters: canonicalFilters,
      unparsed_count: unparsed.length,
    }),
    unparsed_requirements: unparsed,
    clarification: {
      needed: Boolean(state.clarification?.needed),
      skipped: Boolean(state.clarification?.skipped),
      reason: state.clarification?.reason ?? null,
      threshold_pct: ALIGNMENT_THRESHOLD_PCT,
      threshold_metric: SCORE_TERMINOLOGY,
    },
  });
}

/**
 * Pure parser converting an Uzbek or English natural-language question into structured,
 * editable filters while preserving original source text and any unparsed tokens.
 */
export function parseQuery(queryText, options = {}) {
  if (typeof queryText !== 'string') throw new Error('QUERY_STRING_REQUIRED');
  const raw_query = queryText.trim();
  const spans = [];
  const filters = [];
  const unparsed_requirements = [];

  const addParsed = (spec, match) => {
    if (match) consumeSpan(spans, match);
    filters.push({
      ...spec,
      source_text: spec.source_text ?? (match ? match[0].trim() : ''),
      origin: 'parsed',
      status: spec.status ?? 'PARSED',
    });
  };

  // 1. Oxygen concentration + optional location
  const o2PctRegex = /(?:(?:o2|o₂|oxygen|kislorod)\s*(?:[:=]?\s*)?([+-]?\d+(?:[.,]\d+)?)\s*(?:vol\s*%|%)|([+-]?\d+(?:[.,]\d+)?)\s*(?:vol\s*%|%)\s*(?:o2|o₂|oxygen|kislorod))/gi;
  for (const match of raw_query.matchAll(o2PctRegex)) {
    const numStr = match[1] ?? match[2];
    try {
      const val = number(numStr);
      const si = convert([val], 'vol%', 'o2_concentration');
      addParsed({
        field: 'o2_concentration',
        operator: 'approx',
        value: si.values[0],
        si_value: si.values[0],
        unit: 'mol/mol',
        location: null,
        direction: 'constant',
      }, match);
    } catch {
      consumeSpan(spans, match);
      unparsed_requirements.push({ source_text: match[0].trim(), reason: 'INVALID_OXYGEN_RANGE' });
      addParsed({
        field: 'o2_concentration',
        operator: 'unparsed',
        value: match[0].trim(),
        si_value: null,
        unit: 'vol%',
        status: 'UNKNOWN',
      }, null);
    }
  }

  const o2MolRegex = /(?:(?:o2|o₂|oxygen|kislorod)\s*(?:[:=]?\s*)?([+-]?\d+(?:[.,]\d+)?)\s*mol\/mol|([+-]?\d+(?:[.,]\d+)?)\s*mol\/mol\s*(?:o2|o₂|oxygen|kislorod))/gi;
  for (const match of raw_query.matchAll(o2MolRegex)) {
    const numStr = match[1] ?? match[2];
    try {
      const val = number(numStr);
      const si = convert([val], 'mol/mol', 'o2_concentration');
      addParsed({
        field: 'o2_concentration',
        operator: 'approx',
        value: si.values[0],
        si_value: si.values[0],
        unit: 'mol/mol',
        location: null,
        direction: 'constant',
      }, match);
    } catch {
      consumeSpan(spans, match);
      unparsed_requirements.push({ source_text: match[0].trim(), reason: 'INVALID_OXYGEN_RANGE' });
      addParsed({
        field: 'o2_concentration',
        operator: 'unparsed',
        value: match[0].trim(),
        si_value: null,
        unit: 'mol/mol',
        status: 'UNKNOWN',
      }, null);
    }
  }

  // 2. Oxygen / parameter location
  for (const locPat of LOCATION_PATTERNS) {
    const match = locPat.regex.exec(raw_query);
    if (match) {
      addParsed({
        field: 'oxygen_location',
        operator: 'eq',
        value: locPat.canonical,
        si_value: null,
        unit: null,
        location: locPat.canonical,
      }, match);
      const o2Filter = filters.find(f => f.field === 'o2_concentration' && !f.location);
      if (o2Filter) o2Filter.location = locPat.canonical;
      break;
    }
  }

  // 3. Flow velocity (ordered protocol e.g. 11 to 3 cm/s or single value e.g. 10 cm/s)
  const flowRegex = /([+-]?\d+(?:[.,]\d+)?(?:\s*(?:->|→|\bto\b|\bdan\b)\s*[+-]?\d+(?:[.,]\d+)?(?:\s*gacha)?)?)\s*(cm\/s|m\/s)/gi;
  for (const match of raw_query.matchAll(flowRegex)) {
    const rawSeq = match[1].replace(/\sgacha$/i, '').trim();
    const unit = match[2].toLowerCase();
    try {
      const parts = rawSeq.split(/\s*(?:->|→|\bto\b|\bdan\b)\s*/i).map(number);
      const si = convert(parts, unit, 'flow_velocity');
      const dir = computeDirection(si.values);
      addParsed({
        field: 'flow_velocity',
        operator: 'eq',
        value: si.values,
        si_value: si.values,
        unit: si.unit,
        location: 'chamber_atmosphere',
        direction: dir,
      }, match);
    } catch {
      consumeSpan(spans, match);
      unparsed_requirements.push({ source_text: match[0].trim(), reason: 'INVALID_FLOW_VALUE' });
    }
  }

  // 4. Sample width (e.g. 1.2 cm, 2.2 cm, 22 mm)
  const widthRegex = /(?:(?:sample\s+width|width|namuna\s+eni|eni|kengligi)\s*(?:[:=]?\s*)?([+-]?\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b|([+-]?\d+(?:[.,]\d+)?)\s*(cm|mm|m)\s*(?:sample\s+width|width|namuna\s+eni|eni|kengligi))/gi;
  for (const match of raw_query.matchAll(widthRegex)) {
    const numStr = match[1] ?? match[3];
    const unit = (match[2] ?? match[4]).toLowerCase();
    try {
      const val = number(numStr);
      const si = convert([val], unit, 'sample_width');
      addParsed({
        field: 'sample_width',
        operator: 'approx',
        value: si.values[0],
        si_value: si.values[0],
        unit: si.unit,
        location: 'sample_surface',
        direction: 'constant',
      }, match);
    } catch {
      consumeSpan(spans, match);
      unparsed_requirements.push({ source_text: match[0].trim(), reason: 'INVALID_WIDTH_VALUE' });
    }
  }

  // 5. Specific Material & Fuel Type
  let matchedSpecificMaterial = null;
  for (const matPat of MATERIAL_PATTERNS) {
    const match = matPat.regex.exec(raw_query);
    if (match) {
      matchedSpecificMaterial = matPat;
      addParsed({
        field: 'material',
        operator: 'eq',
        value: matPat.canonical,
      }, match);
      addParsed({
        field: 'fuel_type',
        operator: 'eq',
        value: matPat.fuel_type,
        source_text: match[0].trim(),
      }, null);
      break;
    }
  }

  for (const fuelPat of FUEL_PATTERNS) {
    const match = fuelPat.regex.exec(raw_query);
    if (match) {
      consumeSpan(spans, match);
      if (!filters.some(f => f.field === 'fuel_type' && f.value === fuelPat.canonical)) {
        addParsed({
          field: 'fuel_type',
          operator: 'eq',
          value: fuelPat.canonical,
        }, match);
      }
    }
  }

  // 6. Safety Domain
  for (const domPat of DOMAIN_PATTERNS) {
    const match = domPat.regex.exec(raw_query);
    if (match) {
      addParsed({
        field: 'domain',
        operator: 'eq',
        value: domPat.canonical,
      }, match);
      break;
    }
  }
  if (!filters.some(f => f.field === 'domain')) {
    const fuelFilter = filters.find(f => f.field === 'fuel_type');
    if (matchedSpecificMaterial) {
      addParsed({
        field: 'domain',
        operator: 'eq',
        value: matchedSpecificMaterial.domain,
        source_text: filters.find(f => f.field === 'material')?.source_text ?? '',
      }, null);
    } else if (fuelFilter) {
      const inferredDomain = FUEL_PATTERNS.find(p => p.canonical === fuelFilter.value)?.domain;
      if (inferredDomain) {
        addParsed({
          field: 'domain',
          operator: 'eq',
          value: inferredDomain,
          source_text: fuelFilter.source_text,
        }, null);
      }
    }
  }

  // 7. Environment / Gravity
  for (const envPat of ENVIRONMENT_PATTERNS) {
    const match = envPat.regex.exec(raw_query);
    if (match) {
      addParsed({
        field: 'environment',
        operator: 'eq',
        value: envPat.canonical,
      }, match);
      break;
    }
  }

  // 8. Unit Family
  for (const ufPat of UNIT_FAMILY_PATTERNS) {
    const match = ufPat.regex.exec(raw_query);
    if (match) {
      addParsed({
        field: 'unit_family',
        operator: 'eq',
        value: ufPat.canonical,
      }, match);
      break;
    }
  }
  if (!filters.some(f => f.field === 'unit_family')) {
    if (filters.some(f => f.field === 'sample_width')) {
      addParsed({
        field: 'unit_family',
        operator: 'eq',
        value: 'FAMILY_A_FLAME_METRICS',
        source_text: filters.find(f => f.field === 'sample_width')?.source_text ?? '',
      }, null);
    } else if (filters.some(f => f.field === 'o2_concentration' || f.field === 'flow_velocity')) {
      addParsed({
        field: 'unit_family',
        operator: 'eq',
        value: 'FAMILY_B_ATMOS_THERMO',
        source_text: filters.find(f => f.field === 'o2_concentration' || f.field === 'flow_velocity')?.source_text ?? '',
      }, null);
    }
  }

  // 9. Sample History
  for (const histPat of SAMPLE_HISTORY_PATTERNS) {
    const match = histPat.regex.exec(raw_query);
    if (match) {
      addParsed({
        field: 'sample_history',
        operator: 'eq',
        value: histPat.canonical,
      }, match);
      break;
    }
  }

  // 10. Detect unparsed numeric/unit phrases or unknown technical tokens so nothing is silently lost
  const leftoverNumericUnitRegex = /\b([+-]?\d+(?:[.,]\d+)?)\s*([a-zA-Z%°µμ/]+)\b/g;
  for (const match of raw_query.matchAll(leftoverNumericUnitRegex)) {
    if (isCovered(match.index, match[0].length, spans)) continue;
    if (STOPWORDS.has(match[2].toLowerCase())) continue;
    consumeSpan(spans, match);
    const token = match[0].trim();
    unparsed_requirements.push({ source_text: token, reason: 'UNSUPPORTED_PARAMETER_OR_UNIT' });
    addParsed({
      field: 'unparsed',
      operator: 'unparsed',
      value: token,
      status: 'UNKNOWN',
    }, match);
  }

  const wordRegex = /[\p{L}\p{N}_.-]{2,}/gu;
  for (const match of raw_query.matchAll(wordRegex)) {
    if (isCovered(match.index, match[0].length, spans)) continue;
    const word = match[0];
    const clean = word.toLowerCase().replace(/(?:da|dagi|ning|ni|ga|dan|lar|si|i)$/i, '');
    if (STOPWORDS.has(word.toLowerCase()) || STOPWORDS.has(clean) || /^\d+$/.test(word)) continue;
    consumeSpan(spans, match);
    unparsed_requirements.push({ source_text: word, reason: 'UNRECOGNIZED_TERM' });
    addParsed({
      field: 'unparsed',
      operator: 'unparsed',
      value: word.toUpperCase(),
      status: 'UNKNOWN',
    }, match);
  }

  return finalizeQueryState({
    raw_query,
    detected_language: detectLanguage(raw_query),
    filters,
    unparsed_requirements,
    clarification: {
      needed: false,
      skipped: Boolean(options.skipClarification),
      reason: null,
    },
  });
}

function normalizeFilterSpec(spec) {
  if (!spec || typeof spec !== 'object' || !spec.field) throw new Error('FILTER_FIELD_REQUIRED');
  const field = String(spec.field).trim();
  const base = {
    filter_id: spec.filter_id,
    field,
    operator: spec.operator ?? 'eq',
    value: spec.value,
    si_value: spec.si_value ?? null,
    unit: spec.unit ?? null,
    location: spec.location ?? null,
    direction: spec.direction ?? null,
    source_text: spec.source_text ?? String(spec.value ?? ''),
    origin: spec.origin ?? 'user_added',
    status: spec.status ?? 'PARSED',
  };

  if (field === 'material') {
    base.value = normalizeMaterialName(spec.value) ?? String(spec.value).toUpperCase();
  } else if (field === 'fuel_type') {
    base.value = normalizeEnum(spec.value, FUEL_TYPES, { [String(spec.value).toLowerCase()]: spec.value }) ?? String(spec.value).toUpperCase();
  } else if (field === 'domain') {
    base.value = normalizeEnum(spec.value, SAFETY_DOMAINS, { [String(spec.value).toLowerCase()]: spec.value }) ?? String(spec.value).toUpperCase();
  } else if (field === 'environment') {
    base.value = normalizeEnum(spec.value, ENVIRONMENTS, { [String(spec.value).toLowerCase()]: spec.value }) ?? String(spec.value).toUpperCase();
  } else if (field === 'unit_family') {
    base.value = normalizeEnum(spec.value, UNIT_FAMILIES, { [String(spec.value).toLowerCase()]: spec.value }) ?? String(spec.value).toUpperCase();
  } else if (field === 'oxygen_location') {
    if (!LOCATIONS.includes(spec.value)) throw new Error(`INVALID_LOCATION:${spec.value}`);
    base.value = spec.value;
    base.location = spec.value;
  } else if (field === 'o2_concentration') {
    const unit = spec.unit || (Number(spec.value) > 1 ? 'vol%' : 'mol/mol');
    const si = convert([number(spec.value)], unit, 'o2_concentration');
    base.value = si.values[0];
    base.si_value = si.values[0];
    base.unit = 'mol/mol';
    base.operator = spec.operator ?? 'approx';
  } else if (field === 'sample_width') {
    const unit = spec.unit || 'cm';
    const si = convert([number(spec.value)], unit, 'sample_width');
    base.value = si.values[0];
    base.si_value = si.values[0];
    base.unit = 'm';
    base.location = spec.location || 'sample_surface';
    base.operator = spec.operator ?? 'approx';
  } else if (field === 'flow_velocity') {
    const unit = spec.unit || 'cm/s';
    const rawValues = Array.isArray(spec.value)
      ? spec.value.map(number)
      : String(spec.value).split(/\s*(?:->|→|\bto\b)\s*/i).map(number);
    const si = convert(rawValues, unit, 'flow_velocity');
    base.value = si.values;
    base.si_value = si.values;
    base.unit = 'm/s';
    base.direction = spec.direction || computeDirection(si.values);
    base.location = spec.location || 'chamber_atmosphere';
  }
  return base;
}

/** Pure function to add a filter to a parsed query state. */
export function addFilter(queryState, filterSpec) {
  if (!queryState || !Array.isArray(queryState.filters)) throw new Error('VALID_QUERY_STATE_REQUIRED');
  const nextFilter = normalizeFilterSpec({ ...filterSpec, origin: 'user_added' });
  const next = clone(queryState);
  next.filters.push(nextFilter);
  return finalizeQueryState(next);
}

/** Pure function to update an existing filter by filter_id or field name. */
export function updateFilter(queryState, filterIdOrField, patch) {
  if (!queryState || !Array.isArray(queryState.filters)) throw new Error('VALID_QUERY_STATE_REQUIRED');
  const next = clone(queryState);
  const idx = next.filters.findIndex(f => f.filter_id === filterIdOrField || f.field === filterIdOrField);
  if (idx === -1) throw new Error(`FILTER_NOT_FOUND:${filterIdOrField}`);
  const merged = { ...next.filters[idx], ...patch, origin: 'user_modified' };
  next.filters[idx] = normalizeFilterSpec(merged);
  return finalizeQueryState(next);
}

/** Pure function to remove a filter by filter_id or field name. */
export function removeFilter(queryState, filterIdOrField) {
  if (!queryState || !Array.isArray(queryState.filters)) throw new Error('VALID_QUERY_STATE_REQUIRED');
  const next = clone(queryState);
  const before = next.filters.length;
  next.filters = next.filters.filter(f => f.filter_id !== filterIdOrField && f.field !== filterIdOrField);
  if (next.filters.length === before) throw new Error(`FILTER_NOT_FOUND:${filterIdOrField}`);
  return finalizeQueryState(next);
}

/** Pure function to toggle skipping non-blocking clarification. */
export function skipClarification(queryState, skipped = true) {
  if (!queryState || !Array.isArray(queryState.filters)) throw new Error('VALID_QUERY_STATE_REQUIRED');
  const next = clone(queryState);
  next.clarification = {
    ...(next.clarification ?? {}),
    skipped: Boolean(skipped),
    needed: Boolean(skipped) ? false : Boolean(next.clarification?.needed),
  };
  return finalizeQueryState(next);
}

/** Checks whether two parsed/edited queries produce identical canonical filter requirements. */
export function equalQueryFilters(queryA, queryB) {
  const a = typeof queryA === 'string' ? parseQuery(queryA) : queryA;
  const b = typeof queryB === 'string' ? parseQuery(queryB) : queryB;
  return a.canonical_signature === b.canonical_signature;
}

/**
 * Evaluates a candidate TrialRecord against all filters in `queryState`, returning
 * a structured matched / partial / unknown checklist.
 * Unknown metadata is NEVER counted as a match.
 */
export function evaluateChecklist(queryState, record, adapter = null) {
  const q = typeof queryState === 'string' ? parseQuery(queryState) : queryState;
  const meta = resolveMetadata(record, adapter);
  const items = [];
  const requestedLocation = q.filters.find(f => f.field === 'oxygen_location')?.value ?? 'chamber_atmosphere';

  for (const f of q.filters) {
    let status = 'unknown';
    let observed = null;
    let reason = '';

    if (f.status === 'UNKNOWN' || f.field === 'unparsed') {
      status = 'unknown';
      observed = null;
      reason = 'UNPARSED_OR_UNKNOWN_IN_CORPUS';
    } else if (f.field === 'material') {
      observed = meta.material.value;
      if (meta.material.status !== 'MEASURED' || !observed) {
        status = 'unknown';
        reason = 'MATERIAL_METADATA_MISSING';
      } else if (observed === f.value) {
        status = 'matched';
        reason = 'EXACT_MATERIAL_MATCH';
      } else {
        status = 'partial';
        reason = `DIFFERENT_MATERIAL:${observed}`;
      }
    } else if (f.field === 'fuel_type') {
      observed = meta.fuel_type.value;
      if (meta.fuel_type.status !== 'MEASURED' || !observed) {
        status = 'unknown';
        reason = 'FUEL_TYPE_METADATA_MISSING';
      } else if (observed === f.value) {
        status = 'matched';
        reason = 'EXACT_FUEL_TYPE_MATCH';
      } else {
        status = 'partial';
        reason = `DIFFERENT_FUEL_TYPE:${observed}`;
      }
    } else if (f.field === 'domain') {
      observed = meta.domain.value;
      if (meta.domain.status !== 'MEASURED' || !observed) {
        status = 'unknown';
        reason = 'DOMAIN_METADATA_MISSING';
      } else if (observed === f.value) {
        status = 'matched';
        reason = 'EXACT_DOMAIN_MATCH';
      } else {
        status = 'partial';
        reason = `DIFFERENT_DOMAIN:${observed}`;
      }
    } else if (f.field === 'environment') {
      observed = meta.environment.value;
      if (meta.environment.status !== 'MEASURED' || !observed) {
        status = 'unknown';
        reason = 'ENVIRONMENT_METADATA_MISSING';
      } else if (observed === f.value) {
        status = 'matched';
        reason = 'EXACT_ENVIRONMENT_MATCH';
      } else {
        status = 'partial';
        reason = `DIFFERENT_ENVIRONMENT:${observed}`;
      }
    } else if (f.field === 'oxygen_location') {
      observed = meta.oxygen.location;
      if (!observed || observed === 'NOT_PROVIDED') {
        status = 'unknown';
        reason = 'OXYGEN_LOCATION_MISSING';
      } else if (observed === f.value) {
        status = 'matched';
        reason = 'EXACT_OXYGEN_LOCATION_MATCH';
      } else {
        status = 'partial';
        reason = `OXYGEN_LOCATION_MISMATCH:${observed}`;
      }
    } else if (f.field === 'o2_concentration') {
      const targetLoc = f.location || requestedLocation;
      observed = {
        si_value: meta.oxygen.si_value,
        location: meta.oxygen.location,
        status: meta.oxygen.status,
      };
      if (meta.oxygen.status !== 'MEASURED' || meta.oxygen.si_value === null || meta.oxygen.location === 'NOT_PROVIDED') {
        status = 'unknown';
        reason = 'OXYGEN_VALUE_OR_LOCATION_MISSING';
      } else if (meta.oxygen.location !== targetLoc) {
        status = 'partial';
        reason = `OXYGEN_LOCATION_MISMATCH:${meta.oxygen.location}_VS_${targetLoc}`;
      } else {
        const diff = Math.abs(meta.oxygen.si_value - f.si_value);
        if (diff <= 0.005) {
          status = 'matched';
          reason = 'OXYGEN_CONCENTRATION_AND_LOCATION_MATCH';
        } else {
          status = 'partial';
          reason = `OXYGEN_VALUE_DIFFERS:${meta.oxygen.si_value}_VS_${f.si_value}`;
        }
      }
    } else if (f.field === 'flow_velocity') {
      observed = {
        si_values: meta.flow_velocity.si_values,
        direction: meta.flow_velocity.direction,
        status: meta.flow_velocity.status,
      };
      if (meta.flow_velocity.status !== 'MEASURED' || !meta.flow_velocity.si_values.length) {
        status = 'unknown';
        reason = 'FLOW_VELOCITY_MISSING';
      } else {
        const targetVals = Array.isArray(f.si_value) ? f.si_value : [f.si_value];
        const sameLen = meta.flow_velocity.si_values.length === targetVals.length;
        const sameVals = sameLen && meta.flow_velocity.si_values.every((v, i) => Math.abs(v - targetVals[i]) <= 0.002);
        const sameDir = meta.flow_velocity.direction === f.direction;
        if (sameVals && sameDir) {
          status = 'matched';
          reason = 'EXACT_ORDERED_FLOW_MATCH';
        } else {
          status = 'partial';
          reason = 'FLOW_PROTOCOL_OR_DIRECTION_DIFFERS';
        }
      }
    } else if (f.field === 'sample_width') {
      observed = meta.sample_width.si_value;
      if (meta.sample_width.status !== 'MEASURED' || observed === null) {
        status = 'unknown';
        reason = 'SAMPLE_WIDTH_MISSING';
      } else if (Math.abs(observed - f.si_value) <= 0.0005) {
        status = 'matched';
        reason = 'EXACT_SAMPLE_WIDTH_MATCH';
      } else {
        status = 'partial';
        reason = `SAMPLE_WIDTH_DIFFERS:${observed}`;
      }
    } else if (f.field === 'unit_family') {
      observed = meta.unit_families.values;
      if (meta.unit_families.status !== 'MEASURED' || !observed.length) {
        status = 'unknown';
        reason = 'UNIT_FAMILY_MISSING';
      } else if (observed.includes(f.value)) {
        status = 'matched';
        reason = 'UNIT_FAMILY_PRESENT';
      } else {
        status = 'partial';
        reason = 'DIFFERENT_UNIT_FAMILY';
      }
    } else if (f.field === 'sample_history') {
      observed = meta.sample_history.value;
      if (meta.sample_history.status !== 'MEASURED' || !observed) {
        status = 'unknown';
        reason = 'SAMPLE_HISTORY_UNKNOWN';
      } else if (observed === f.value) {
        status = 'matched';
        reason = 'SAMPLE_HISTORY_MATCH';
      } else {
        status = 'partial';
        reason = `SAMPLE_HISTORY_DIFFERS:${observed}`;
      }
    }

    const labels = status === 'matched'
      ? { uz: 'Topildi', en: 'Matched' }
      : status === 'partial'
        ? { uz: 'Qisman mos', en: 'Partially Matched' }
        : { uz: "Manbada noma'lum", en: 'Unknown in Source' };

    items.push({
      filter_id: f.filter_id,
      field: f.field,
      expected: f.value,
      observed,
      source_text: f.source_text,
      status,
      label_uz: labels.uz,
      label_en: labels.en,
      reason,
    });
  }

  const counts = {
    matched: items.filter(i => i.status === 'matched').length,
    partial: items.filter(i => i.status === 'partial').length,
    unknown: items.filter(i => i.status === 'unknown').length,
    total: items.length,
  };

  return freeze({
    study_id: record.study_id,
    trial_id: record.trial_id,
    items,
    counts,
  });
}
