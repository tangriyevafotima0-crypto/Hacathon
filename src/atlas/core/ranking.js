import { trialKey, freeze } from './contract.js';
import { activeRecords } from './store.js';
import { resolveMetadata } from './metadata.js';
import { parseQuery, evaluateChecklist, ALIGNMENT_THRESHOLD_PCT, SCORE_TERMINOLOGY } from './query.js';

export const DEFAULT_WEIGHTS = Object.freeze({
  domain: 0.25,
  fuel: 0.25,
  atmosphere: 0.25,
  unit_family: 0.25,
});

export const TIER_DEFINITIONS = Object.freeze({
  1: {
    tier: 1,
    code: 'TIER_1_DIRECT_MATCH',
    title_en: 'Tier 1: Direct matching experimental evidence',
    title_uz: 'Tier 1: Bevosita mos keluvchi eksperimental dalil',
    criteria: 'OBSERVATION record (not proxy/emulator/CFD) where all queried physical conditions and locations are MEASURED/KNOWN and directly match.',
  },
  2: {
    tier: 2,
    code: 'TIER_2_RELATED_DIFFERENT_CONDITIONS',
    title_en: 'Tier 2: Direct experimental evidence with divergent or partially unknown conditions',
    title_uz: 'Tier 2: Sharoiti farqli yoki qisman noma’lum eksperimental dalil',
    criteria: 'OBSERVATION record matching the primary material or domain, not a gas-burner proxy or CFD simulation, where secondary conditions differ or are unknown.',
  },
  3: {
    tier: 3,
    code: 'TIER_3_PROXY_OR_MODEL',
    title_en: 'Tier 3: Proxy, emulator, burner-flow analog, or CFD simulation',
    title_uz: 'Tier 3: Proksi, emulyator, gorelka oqimi analogi yoki CFD model',
    criteria: 'Proxy/emulator experiment (e.g. gas-burner proxy with burner_flow O2, E-FIELD/BRE) or numerical simulation (MODEL_RESULT / GROUND_CFD).',
  },
  4: {
    tier: 4,
    code: 'TIER_4_CONTEXT_ONLY',
    title_en: 'Tier 4: General context, hypothesis/caveat, or insufficient metadata match',
    title_uz: 'Tier 4: Umumiy kontekst, gipoteza/izoh yoki mos kelmaydigan yozuv',
    criteria: 'Non-observational claim (HYPOTHESIS/OBJECTIVE/CAVEAT), unrelated domain/fuel, or unverified context.',
  },
});

export function normalizeWeights(input = DEFAULT_WEIGHTS) {
  const raw = {
    domain: Number(input?.domain ?? DEFAULT_WEIGHTS.domain),
    fuel: Number(input?.fuel ?? DEFAULT_WEIGHTS.fuel),
    atmosphere: Number(input?.atmosphere ?? DEFAULT_WEIGHTS.atmosphere),
    unit_family: Number(input?.unit_family ?? DEFAULT_WEIGHTS.unit_family),
  };
  for (const [k, v] of Object.entries(raw)) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`INVALID_WEIGHT:${k}`);
  }
  const sum = raw.domain + raw.fuel + raw.atmosphere + raw.unit_family;
  if (sum <= 0) throw new Error('WEIGHT_SUM_MUST_BE_POSITIVE');
  return freeze({
    domain: raw.domain / sum,
    fuel: raw.fuel / sum,
    atmosphere: raw.atmosphere / sum,
    unit_family: raw.unit_family / sum,
  });
}

/**
 * Classifies a candidate TrialRecord into Tier 1..4 BEFORE component scores are computed.
 * Enforces:
 * - Solid fabric queries never place gas-burner proxies above direct solid evidence;
 * - 85% burner_flow O2 never counts as chamber_atmosphere match;
 * - Unknown metadata never counts as a direct match (cannot enter Tier 1).
 */
export function classifyEvidenceTier(record, queryState, adapter = null) {
  const q = typeof queryState === 'string' ? parseQuery(queryState) : queryState;
  const meta = resolveMetadata(record, adapter);
  const checklist = evaluateChecklist(q, record, adapter);

  const qMaterial = q.filters.find(f => f.field === 'material')?.value ?? null;
  const qFuel = q.filters.find(f => f.field === 'fuel_type')?.value ?? null;
  const qDomain = q.filters.find(f => f.field === 'domain')?.value ?? null;
  const qEnv = q.filters.find(f => f.field === 'environment')?.value ?? null;
  const qLoc = q.filters.find(f => f.field === 'oxygen_location')?.value ?? 'chamber_atmosphere';

  const askingForSolid = qFuel === 'SOLID_FABRIC' || qFuel === 'SOLID_POLYMER' || qDomain === 'PREVENTION_SOLID' ||
    ['SIBAL', 'PMMA', 'NOMEX', 'COTTON', 'SILICONE'].includes(qMaterial);

  const isGasBurnerOrProxy = meta.is_proxy_or_model ||
    meta.fuel_type.value === 'GAS_BURNER' ||
    meta.domain.value === 'GAS_EMULATION' ||
    (meta.has_burner_flow_o2 && qLoc !== 'burner_flow');

  // Non-observation claims (HYPOTHESIS, OBJECTIVE, CAVEAT) belong in Tier 4
  if (['HYPOTHESIS', 'OBJECTIVE', 'CAVEAT'].includes(meta.claim_type)) {
    return freeze({
      tier: 4,
      ...TIER_DEFINITIONS[4],
      reason: `NON_EXPERIMENTAL_CLAIM_TYPE:${meta.claim_type}`,
    });
  }

  // If the record is a proxy, emulator, CFD model, or gas-burner trial when solid fabric or chamber O2 was requested -> Tier 3 (or Tier 4 if completely unrelated)
  if (isGasBurnerOrProxy) {
    return freeze({
      tier: 3,
      ...TIER_DEFINITIONS[3],
      reason: askingForSolid
        ? 'PROXY_OR_BURNER_FLOW_CANNOT_OUTRANK_DIRECT_SOLID_EVIDENCE'
        : 'PROXY_EMULATOR_OR_MODEL_EVIDENCE',
    });
  }

  // Check if primary subject (material, fuel_type, or domain) matches with KNOWN metadata
  const materialMatched = qMaterial && meta.material.status === 'MEASURED' && meta.material.value === qMaterial;
  const fuelMatched = qFuel && meta.fuel_type.status === 'MEASURED' && meta.fuel_type.value === qFuel;
  const domainMatched = qDomain && meta.domain.status === 'MEASURED' && meta.domain.value === qDomain;

  // If query asked for a specific material/fuel/domain and the record has a KNOWN completely different domain/fuel -> Tier 4
  if (qDomain && meta.domain.status === 'MEASURED' && meta.domain.value !== qDomain && !materialMatched && !fuelMatched) {
    return freeze({
      tier: 4,
      ...TIER_DEFINITIONS[4],
      reason: `UNRELATED_DOMAIN:${meta.domain.value}`,
    });
  }
  if (qFuel && meta.fuel_type.status === 'MEASURED' && meta.fuel_type.value !== qFuel && !materialMatched) {
    return freeze({
      tier: 3,
      ...TIER_DEFINITIONS[3],
      reason: `CROSS_FUEL_ANALOG:${meta.fuel_type.value}`,
    });
  }

  const hasSubjectMatch = Boolean(
    materialMatched ||
    fuelMatched ||
    domainMatched ||
    (!qMaterial && !qFuel && !qDomain && (
      meta.material.status === 'MEASURED' ||
      meta.fuel_type.status === 'MEASURED' ||
      meta.domain.status === 'MEASURED'
    ))
  );

  if (!hasSubjectMatch) {
    return freeze({
      tier: 4,
      ...TIER_DEFINITIONS[4],
      reason: 'SUBJECT_METADATA_UNKNOWN_OR_UNMATCHED',
    });
  }

  // Tier 1 requires:
  // 1) At least one parsed filter in the query
  // 2) Zero 'partial' or 'unknown' items in checklist (all queried requirements known & matched)
  // 3) If environment was queried, record environment must be MEASURED and match
  // 4) Oxygen location cannot be 'NOT_PROVIDED' or mismatched when oxygen is queried
  const allQueriedFiltersMatched = checklist.counts.total > 0 &&
    checklist.counts.matched === checklist.counts.total &&
    checklist.counts.partial === 0 &&
    checklist.counts.unknown === 0;

  const envBlocking = qEnv && (meta.environment.status !== 'MEASURED' || meta.environment.value !== qEnv);

  if (allQueriedFiltersMatched && !envBlocking) {
    return freeze({
      tier: 1,
      ...TIER_DEFINITIONS[1],
      reason: 'ALL_QUERIED_CONDITIONS_MEASURED_AND_MATCHED',
    });
  }

  return freeze({
    tier: 2,
    ...TIER_DEFINITIONS[2],
    reason: checklist.counts.unknown > 0
      ? 'RELATED_EXPERIMENTAL_EVIDENCE_WITH_UNKNOWN_METADATA'
      : 'RELATED_EXPERIMENTAL_EVIDENCE_WITH_DIVERGENT_CONDITIONS',
  });
}

/**
 * Computes the 4 component scores (domain, fuel, atmosphere, unit_family) in [0, 1].
 * Unknown metadata ALWAYS scores 0 for that component (never treated as a match).
 */
export function computeComponentScores(record, queryState, adapter = null) {
  const q = typeof queryState === 'string' ? parseQuery(queryState) : queryState;
  const meta = resolveMetadata(record, adapter);

  const qDomain = q.filters.find(f => f.field === 'domain')?.value ?? null;
  const qMaterial = q.filters.find(f => f.field === 'material')?.value ?? null;
  const qFuel = q.filters.find(f => f.field === 'fuel_type')?.value ?? null;
  const qO2 = q.filters.find(f => f.field === 'o2_concentration') ?? null;
  const qLoc = q.filters.find(f => f.field === 'oxygen_location')?.value ?? qO2?.location ?? 'chamber_atmosphere';
  const qFlow = q.filters.find(f => f.field === 'flow_velocity') ?? null;
  const qEnv = q.filters.find(f => f.field === 'environment')?.value ?? null;
  const qUnitFamilies = q.filters.filter(f => f.field === 'unit_family').map(f => f.value);

  // 1. Domain component
  let domainScore = 0;
  let domainDetail = 'UNKNOWN_METADATA';
  if (meta.domain.status === 'MEASURED' && meta.domain.value) {
    if (!qDomain) {
      domainScore = 0.5;
      domainDetail = 'KNOWN_DOMAIN_UNSPECIFIED_IN_QUERY';
    } else if (meta.domain.value === qDomain) {
      domainScore = 1.0;
      domainDetail = 'EXACT_DOMAIN_MATCH';
    } else if (
      (qDomain === 'PREVENTION_SOLID' && ['GAS_EMULATION', 'CFD_MODELING'].includes(meta.domain.value)) ||
      (qDomain === 'SUPPRESSION_DROPLET' && meta.domain.value === 'CFD_MODELING')
    ) {
      domainScore = 0.35;
      domainDetail = 'RELATED_PROXY_OR_MODEL_DOMAIN';
    } else {
      domainScore = 0;
      domainDetail = 'DOMAIN_MISMATCH';
    }
  }

  // 2. Fuel / Material component
  let fuelScore = 0;
  let fuelDetail = 'UNKNOWN_METADATA';
  const hasMat = meta.material.status === 'MEASURED' && Boolean(meta.material.value);
  const hasFuel = meta.fuel_type.status === 'MEASURED' && Boolean(meta.fuel_type.value);
  if (hasMat || hasFuel) {
    if (!qMaterial && !qFuel) {
      fuelScore = hasMat && hasFuel ? 0.6 : 0.5;
      fuelDetail = 'KNOWN_FUEL_UNSPECIFIED_IN_QUERY';
    } else if (qMaterial && hasMat && meta.material.value === qMaterial) {
      if (!qFuel || (hasFuel && meta.fuel_type.value === qFuel)) {
        fuelScore = 1.0;
        fuelDetail = 'EXACT_MATERIAL_AND_FUEL_MATCH';
      } else {
        // Specific material matches, but fuel_type metadata was not provided
        fuelScore = 0.85;
        fuelDetail = 'EXACT_MATERIAL_MATCH_FUEL_CLASS_UNKNOWN';
      }
    } else if (!qMaterial && qFuel && hasFuel && meta.fuel_type.value === qFuel) {
      fuelScore = 1.0;
      fuelDetail = 'EXACT_FUEL_CLASS_MATCH';
    } else if (qFuel && hasFuel && meta.fuel_type.value === qFuel) {
      fuelScore = 0.65;
      fuelDetail = 'SAME_FUEL_CLASS_DIFFERENT_MATERIAL';
    } else {
      fuelScore = 0;
      fuelDetail = 'FUEL_OR_MATERIAL_MISMATCH';
    }
  }

  // 3. Atmosphere component (oxygen value + location + flow + environment)
  const atmosSubscores = [];
  const atmosReasons = [];

  if (qO2 || q.filters.some(f => f.field === 'oxygen_location')) {
    if (meta.oxygen.status !== 'MEASURED' || meta.oxygen.si_value === null || meta.oxygen.location === 'NOT_PROVIDED') {
      atmosSubscores.push(0);
      atmosReasons.push('OXYGEN_UNKNOWN_OR_LOCATION_MISSING');
    } else if (meta.oxygen.location !== qLoc) {
      // CRITICAL RULE: 85% burner_flow O2 is NEVER counted as chamber_atmosphere match!
      atmosSubscores.push(0);
      atmosReasons.push(`OXYGEN_LOCATION_MISMATCH:${meta.oxygen.location}_VS_${qLoc}`);
    } else if (!qO2) {
      atmosSubscores.push(1.0);
      atmosReasons.push('OXYGEN_LOCATION_MATCH');
    } else {
      const diff = Math.abs(meta.oxygen.si_value - qO2.si_value);
      if (diff <= 0.005) {
        atmosSubscores.push(1.0);
        atmosReasons.push('OXYGEN_EXACT_MATCH');
      } else if (diff <= 0.08) {
        const proximity = Math.max(0.2, Number((1 - diff / 0.10).toFixed(6)));
        atmosSubscores.push(proximity);
        atmosReasons.push('OXYGEN_PARTIAL_PROXIMITY');
      } else {
        atmosSubscores.push(0.1);
        atmosReasons.push('OXYGEN_DIVERGENT_VALUE');
      }
    }
  }

  if (qFlow) {
    if (meta.flow_velocity.status !== 'MEASURED' || !meta.flow_velocity.si_values.length) {
      atmosSubscores.push(0);
      atmosReasons.push('FLOW_UNKNOWN');
    } else {
      const targetVals = Array.isArray(qFlow.si_value) ? qFlow.si_value : [qFlow.si_value];
      const sameLen = meta.flow_velocity.si_values.length === targetVals.length;
      const sameVals = sameLen && meta.flow_velocity.si_values.every((v, i) => Math.abs(v - targetVals[i]) <= 0.002);
      const sameDir = meta.flow_velocity.direction === qFlow.direction;
      if (sameVals && sameDir) {
        atmosSubscores.push(1.0);
        atmosReasons.push('FLOW_EXACT_MATCH');
      } else if (sameDir) {
        atmosSubscores.push(0.5);
        atmosReasons.push('FLOW_DIRECTION_MATCH');
      } else {
        atmosSubscores.push(0.2);
        atmosReasons.push('FLOW_DIRECTION_DIFFERS');
      }
    }
  }

  if (qEnv) {
    if (meta.environment.status !== 'MEASURED' || !meta.environment.value) {
      atmosSubscores.push(0);
      atmosReasons.push('ENVIRONMENT_UNKNOWN');
    } else if (meta.environment.value === qEnv) {
      atmosSubscores.push(1.0);
      atmosReasons.push('ENVIRONMENT_EXACT_MATCH');
    } else {
      atmosSubscores.push(0.15);
      atmosReasons.push(`ENVIRONMENT_DIFFERS:${meta.environment.value}`);
    }
  }

  let atmosphereScore = 0;
  if (atmosSubscores.length > 0) {
    atmosphereScore = atmosSubscores.reduce((s, v) => s + v, 0) / atmosSubscores.length;
  } else {
    // When query did not specify atmosphere filters, evaluate measured chamber O2 + flow completeness
    const o2Valid = meta.oxygen.status === 'MEASURED' && meta.oxygen.location === 'chamber_atmosphere' ? 0.5 : 0;
    const flowValid = meta.flow_velocity.status === 'MEASURED' && meta.flow_velocity.location === 'chamber_atmosphere' ? 0.5 : 0;
    atmosphereScore = (o2Valid + flowValid) * 0.5;
    atmosReasons.push(atmosphereScore > 0 ? 'MEASURED_CHAMBER_ATMOSPHERE' : 'ATMOSPHERE_METADATA_UNKNOWN');
  }

  // 4. Unit family component
  let unitFamilyScore = 0;
  let unitFamilyDetail = 'UNKNOWN_METADATA';
  const knownFamilies = meta.unit_families.values;
  if (meta.unit_families.status === 'MEASURED' && knownFamilies.length > 0) {
    if (qUnitFamilies.length > 0) {
      const hits = qUnitFamilies.filter(f => knownFamilies.includes(f)).length;
      unitFamilyScore = hits / qUnitFamilies.length;
      unitFamilyDetail = hits === qUnitFamilies.length
        ? 'EXACT_UNIT_FAMILY_MATCH'
        : hits > 0
          ? 'PARTIAL_UNIT_FAMILY_MATCH'
          : 'UNIT_FAMILY_MISMATCH';
    } else {
      // Score proportion of core experimental families present
      unitFamilyScore = Math.min(1, knownFamilies.length / 2);
      unitFamilyDetail = 'MEASURED_UNIT_FAMILIES_PRESENT';
    }
  }

  return freeze({
    domain: { score: Number(domainScore.toFixed(6)), detail: domainDetail },
    fuel: { score: Number(fuelScore.toFixed(6)), detail: fuelDetail },
    atmosphere: { score: Number(atmosphereScore.toFixed(6)), detail: atmosReasons.join(';') },
    unit_family: { score: Number(unitFamilyScore.toFixed(6)), detail: unitFamilyDetail },
  });
}

export function scoreWithinTier(components, weights = DEFAULT_WEIGHTS) {
  const w = normalizeWeights(weights);
  const score =
    w.domain * components.domain.score +
    w.fuel * components.fuel.score +
    w.atmosphere * components.atmosphere.score +
    w.unit_family * components.unit_family.score;
  return Number(score.toFixed(6));
}

function compareRankedItems(a, b) {
  // 1. Tier-first priority (1 < 2 < 3 < 4)
  if (a.tier !== b.tier) return a.tier - b.tier;
  // 2. Within-tier alignment score descending
  const scoreDiff = b.alignment_score - a.alignment_score;
  if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
  // 3. Matched checklist count descending
  if (b.checklist.counts.matched !== a.checklist.counts.matched) {
    return b.checklist.counts.matched - a.checklist.counts.matched;
  }
  // 4. Fewer review reasons / unknown flags preferred on exact score tie
  const aFlags = a.record.review?.reasons?.length ?? 0;
  const bFlags = b.record.review?.reasons?.length ?? 0;
  if (aFlags !== bFlags) return aFlags - bFlags;
  // 5. Deterministic composite identity tie-breaker
  return a.record.study_id.localeCompare(b.record.study_id) ||
    a.record.trial_id.localeCompare(b.record.trial_id);
}

/**
 * Perturbs each of the 4 weights one-by-one by ±10% relative, renormalizes weights to sum to 1,
 * and checks whether the ordering within any tier changes.
 */
export function checkWeightSensitivity(evaluatedItems, baseWeights = DEFAULT_WEIGHTS, relativeDelta = 0.10) {
  const w = normalizeWeights(baseWeights);
  const keys = ['domain', 'fuel', 'atmosphere', 'unit_family'];
  const deltas = [-relativeDelta, +relativeDelta];

  const baseOrderByTier = new Map();
  for (const tier of [1, 2, 3, 4]) {
    const ids = evaluatedItems
      .filter(item => item.tier === tier)
      .sort(compareRankedItems)
      .map(item => item.key);
    baseOrderByTier.set(tier, ids);
  }

  const runs = [];
  const flips = [];
  const affectedTiers = new Set();
  const affectedKeys = new Set();

  for (const k of keys) {
    for (const d of deltas) {
      const perturbedRaw = { ...w, [k]: w[k] * (1 + d) };
      const normalized = normalizeWeights(perturbedRaw);
      const rescored = evaluatedItems.map(item => ({
        ...item,
        alignment_score: scoreWithinTier(item.components, normalized),
      }));

      for (const tier of [1, 2, 3, 4]) {
        const baseIds = baseOrderByTier.get(tier);
        if (!baseIds || baseIds.length < 2) continue;
        const nextIds = rescored
          .filter(item => item.tier === tier)
          .sort(compareRankedItems)
          .map(item => item.key);
        const changed = baseIds.some((id, idx) => id !== nextIds[idx]);
        if (changed) {
          affectedTiers.add(tier);
          baseIds.forEach((id, idx) => {
            if (id !== nextIds[idx]) affectedKeys.add(id);
          });
          flips.push({
            component: k,
            relative_perturbation: d > 0 ? `+${Math.round(d * 100)}%` : `${Math.round(d * 100)}%`,
            normalized_weights: normalized,
            tier,
            baseline_order: baseIds,
            perturbed_order: nextIds,
          });
        }
      }

      runs.push({
        component: k,
        relative_perturbation: d > 0 ? `+${Math.round(d * 100)}%` : `${Math.round(d * 100)}%`,
        normalized_weights: normalized,
      });
    }
  }

  return freeze({
    warning: flips.length > 0,
    status: flips.length > 0 ? 'SENSITIVITY_ORDER_CHANGED' : 'SENSITIVITY_STABLE',
    relative_delta: relativeDelta,
    affected_tiers: [...affectedTiers].sort(),
    affected_keys: [...affectedKeys].sort(),
    flips,
    runs,
  });
}

function extractRecordsInput(databaseOrRecords) {
  if (Array.isArray(databaseOrRecords)) return databaseOrRecords;
  if (databaseOrRecords && Array.isArray(databaseOrRecords.trials)) return activeRecords(databaseOrRecords);
  throw new Error('DATABASE_OR_RECORDS_ARRAY_REQUIRED');
}

/**
 * Full two-stage deterministic ranking:
 * Stage A: Tier 1..4 classification (always takes priority over within-tier scores)
 * Stage B: Within-tier 4-component alignment score (default 25% each) + ±10% sensitivity check.
 */
export function rankTrials(databaseOrRecords, queryInput, options = {}) {
  const records = extractRecordsInput(databaseOrRecords);
  const query = typeof queryInput === 'string' ? parseQuery(queryInput, options) : queryInput;
  const weights = normalizeWeights(options.weights ?? DEFAULT_WEIGHTS);
  const adapter = options.metadataAdapter ?? null;

  const evaluated = records.map(record => {
    const key = trialKey(record.study_id, record.trial_id);
    const tierInfo = classifyEvidenceTier(record, query, adapter);
    const components = computeComponentScores(record, query, adapter);
    const checklist = evaluateChecklist(query, record, adapter);
    const alignment_score = scoreWithinTier(components, weights);
    const alignment_score_pct = Number((alignment_score * 100).toFixed(2));
    return {
      key,
      study_id: record.study_id,
      trial_id: record.trial_id,
      tier: tierInfo.tier,
      tier_code: tierInfo.code,
      tier_title_en: tierInfo.title_en,
      tier_title_uz: tierInfo.title_uz,
      tier_reason: tierInfo.reason,
      alignment_score,
      alignment_score_pct,
      meets_alignment_threshold: alignment_score_pct >= ALIGNMENT_THRESHOLD_PCT,
      score_terminology: SCORE_TERMINOLOGY,
      score_disclaimer: 'Alignment score measures filter/metadata match only; it is NOT scientific confidence or safety probability.',
      weights_used: weights,
      components,
      checklist,
      metadata: resolveMetadata(record, adapter),
      record,
    };
  });

  evaluated.sort(compareRankedItems);

  const sensitivity = checkWeightSensitivity(evaluated, weights, options.sensitivityDelta ?? 0.10);
  const ranked = evaluated.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    sensitivity_warning: sensitivity.affected_keys.includes(item.key),
  }));

  const highAlignmentCount = ranked.filter(r => r.meets_alignment_threshold).length;
  const clarificationNeeded = !query.clarification?.skipped && (
    highAlignmentCount > 3 ||
    (ranked.length > 1 && query.filters.length === 0)
  );

  return freeze({
    query,
    weights,
    score_terminology: SCORE_TERMINOLOGY,
    alignment_threshold_pct: ALIGNMENT_THRESHOLD_PCT,
    clarification: {
      needed: clarificationNeeded,
      skipped: Boolean(query.clarification?.skipped),
      high_alignment_count: highAlignmentCount,
      threshold_pct: ALIGNMENT_THRESHOLD_PCT,
      threshold_metric: SCORE_TERMINOLOGY,
    },
    sensitivity,
    results: ranked,
  });
}
