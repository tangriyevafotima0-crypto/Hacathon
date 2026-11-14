import { trialKey, number, freeze } from './contract.js';
import { activeRecords } from './store.js';
import { getRevision, fieldEvidence } from './selectors.js';
import { resolveMetadata } from './metadata.js';
import { parseQuery } from './query.js';
import { rankTrials } from './ranking.js';

export const EVIDENCE_GAP_STATUSES = Object.freeze({
  DIRECT_MATCH: 'Direct matching evidence',
  RELATED_DIFFERENT_CONDITIONS: 'Related evidence with different conditions',
  NO_MATCH_IN_CONNECTED_CORPUS: 'No matching evidence in connected corpus',
  INSUFFICIENT_METADATA: 'Insufficient metadata',
});

export const ALL_EVIDENCE_GAP_STATUSES = Object.freeze(Object.values(EVIDENCE_GAP_STATUSES));

function extractRecords(databaseOrRecords) {
  if (Array.isArray(databaseOrRecords)) return databaseOrRecords;
  if (databaseOrRecords && Array.isArray(databaseOrRecords.trials)) return activeRecords(databaseOrRecords);
  throw new Error('DATABASE_OR_RECORDS_REQUIRED');
}

/**
 * Evaluates the connected corpus against a query or target scenario and returns one of the
 * four exact evidence-gap statuses without interpolating Moon/Mars combustion values or
 * turning "not in connected corpus" into "does not exist in science".
 */
export function detectEvidenceGap(databaseOrRecords, queryOrScenario, options = {}) {
  const records = extractRecords(databaseOrRecords);
  const adapter = options.metadataAdapter ?? null;

  const dependencies = [
    {
      owner: 'D',
      path: 'src/atlas/data',
      status: options.dRulesConnected ? 'CONNECTED' : 'PENDING_AUTHORITATIVE_D_PACKAGE',
      note: 'Conservative Z01/Z02 physical guardrails active; authoritative D01/D02 dataset and extended domain rules remain an explicit dependency.',
    },
  ];

  // Block any attempt to interpolate partial-gravity (Moon 0.16g / Mars 0.38g) values
  if (options.interpolatePartialG) {
    return freeze({
      status: EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA,
      reason: 'PARTIAL_G_INTERPOLATION_PROHIBITED',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: [],
      related_trials: [],
      dependencies,
    });
  }

  const query = typeof queryOrScenario === 'string'
    ? parseQuery(queryOrScenario)
    : queryOrScenario?.filters
      ? queryOrScenario
      : parseQuery(String(queryOrScenario?.query ?? ''));

  // Empty query or unparsed-only query -> Insufficient metadata
  const parsedFilters = query.filters.filter(f => f.status !== 'UNKNOWN' && f.field !== 'unparsed');
  if (parsedFilters.length === 0) {
    return freeze({
      status: EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA,
      reason: 'QUERY_OR_SCENARIO_CONDITIONS_INSUFFICIENT',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: [],
      related_trials: [],
      dependencies,
    });
  }

  if (records.length === 0) {
    return freeze({
      status: EVIDENCE_GAP_STATUSES.NO_MATCH_IN_CONNECTED_CORPUS,
      reason: 'CONNECTED_CORPUS_EMPTY',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: [],
      related_trials: [],
      dependencies,
    });
  }

  const ranked = rankTrials(records, query, { metadataAdapter: adapter });
  const qEnv = query.filters.find(f => f.field === 'environment')?.value ?? null;
  const qO2 = query.filters.find(f => f.field === 'o2_concentration') ?? null;
  const qLoc = query.filters.find(f => f.field === 'oxygen_location')?.value ?? 'chamber_atmosphere';
  const qMaterial = query.filters.find(f => f.field === 'material')?.value ?? null;
  const qFuel = query.filters.find(f => f.field === 'fuel_type')?.value ?? null;
  const qDomain = query.filters.find(f => f.field === 'domain')?.value ?? null;

  const isPartialGTarget = qEnv === 'PARTIAL_G_MOON' || qEnv === 'PARTIAL_G_MARS' || qEnv === 'PARTIAL_G';

  // Filter candidates that share the subject (material, fuel, or domain)
  const subjectCandidates = ranked.results.filter(r => r.tier <= 3);

  // If no record in the connected corpus matches the subject at all -> No matching evidence in connected corpus
  if (subjectCandidates.length === 0) {
    // Check if records failed to match solely because all records lack material/fuel/domain metadata
    const allSubjectMetaMissing = ranked.results.every(r => {
      const m = r.metadata;
      return (!qMaterial || m.material.status !== 'MEASURED') &&
        (!qFuel || m.fuel_type.status !== 'MEASURED') &&
        (!qDomain || m.domain.status !== 'MEASURED');
    });

    if (allSubjectMetaMissing) {
      return freeze({
        status: EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA,
        reason: 'CORPUS_RECORDS_MISSING_REQUIRED_SUBJECT_METADATA',
        interpolation_blocked: true,
        interpolated_values: null,
        safety_verdict: null,
        corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
        matching_trials: [],
        related_trials: [],
        dependencies,
      });
    }

    return freeze({
      status: EVIDENCE_GAP_STATUSES.NO_MATCH_IN_CONNECTED_CORPUS,
      reason: 'NO_MATCHING_SUBJECT_OR_DOMAIN_IN_CONNECTED_CORPUS',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: [],
      related_trials: [],
      dependencies,
    });
  }

  // Check if any Tier 1 direct match exists where all critical conditions (including environment/gravity if queried,
  // or baseline environment if required) are KNOWN and matched.
  const requireKnownEnvironment = Boolean(qEnv || options.requireKnownEnvironment);
  const directMatches = subjectCandidates.filter(r => {
    if (r.tier !== 1) return false;
    if (isPartialGTarget && r.metadata.environment.value !== qEnv) return false;
    if (requireKnownEnvironment && r.metadata.environment.status !== 'MEASURED') return false;
    if (qO2 && (r.metadata.oxygen.status !== 'MEASURED' || r.metadata.oxygen.location !== qLoc)) return false;
    if (r.checklist.counts.unknown > 0 || r.checklist.counts.partial > 0) return false;
    return true;
  });

  if (directMatches.length > 0) {
    return freeze({
      status: EVIDENCE_GAP_STATUSES.DIRECT_MATCH,
      reason: 'DIRECT_EXPERIMENTAL_MATCH_WITH_KNOWN_CONDITIONS',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: directMatches.map(r => ({ study_id: r.study_id, trial_id: r.trial_id, key: r.key })),
      related_trials: [],
      dependencies,
    });
  }

  // If a top candidate matches all KNOWN/MEASURED queried conditions (zero partial mismatches),
  // and fails direct match SOLELY because one or more queried conditions are UNKNOWN (`counts.unknown > 0`),
  // report `Insufficient metadata` rather than claiming conditions are different!
  const blockedOnlyByUnknownMetadata = subjectCandidates.some(
    r => r.tier === 2 && r.checklist.counts.partial === 0 && r.checklist.counts.unknown > 0 && r.checklist.counts.matched > 0
  );

  if (blockedOnlyByUnknownMetadata) {
    return freeze({
      status: EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA,
      reason: 'CRITICAL_CONDITION_METADATA_UNKNOWN_ON_CANDIDATE_RECORDS',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: [],
      related_trials: subjectCandidates.map(r => ({
        study_id: r.study_id,
        trial_id: r.trial_id,
        key: r.key,
        unknown_items: r.checklist.items.filter(i => i.status === 'unknown'),
      })),
      dependencies,
    });
  }

  const hasKnownDivergentCondition = subjectCandidates.some(r => {
    if (r.tier === 3) return true; // Proxy / burner_flow / model is related evidence with different conditions
    if (r.checklist.counts.partial > 0) return true; // Known value or location differs
    if (isPartialGTarget && r.metadata.environment.status === 'MEASURED' && r.metadata.environment.value !== qEnv) return true;
    return false;
  });

  if (hasKnownDivergentCondition) {
    return freeze({
      status: EVIDENCE_GAP_STATUSES.RELATED_DIFFERENT_CONDITIONS,
      reason: isPartialGTarget
        ? 'PARTIAL_G_DIRECT_DATA_ABSENT_ONLY_DIFFERENT_GRAVITY_OR_PROXY_AVAILABLE'
        : 'RELATED_TRIALS_HAVE_DIFFERENT_PHYSICAL_CONDITIONS_OR_LOCATIONS',
      interpolation_blocked: true,
      interpolated_values: null,
      safety_verdict: null,
      corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
      matching_trials: [],
      related_trials: subjectCandidates.map(r => ({
        study_id: r.study_id,
        trial_id: r.trial_id,
        key: r.key,
        tier: r.tier,
        divergent_items: r.checklist.items.filter(i => i.status !== 'matched'),
      })),
      dependencies,
    });
  }

  return freeze({
    status: EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA,
    reason: 'CRITICAL_CONDITION_METADATA_UNKNOWN_ON_CANDIDATE_RECORDS',
    interpolation_blocked: true,
    interpolated_values: null,
    safety_verdict: null,
    corpus_scope_note: 'Applies only to the currently connected local corpus; this does NOT mean evidence does not exist in broader scientific literature.',
    matching_trials: [],
    related_trials: subjectCandidates.map(r => ({
      study_id: r.study_id,
      trial_id: r.trial_id,
      key: r.key,
      unknown_items: r.checklist.items.filter(i => i.status === 'unknown'),
    })),
    dependencies,
  });
}

/**
 * Guards user or system conclusions:
 * 1) Requires explicit trial/revision, field, and resolved source provenance;
 * 2) Blocks ungrounded safety/hazard verdicts or fake NASA verification claims;
 * 3) Blocks Lunar (0.16g) / Martian (0.38g) linear interpolation or extrapolation;
 * 4) Blocks invented scientific numbers not present in cited revisions;
 * 5) Blocks or constrains cross-condition overgeneralizations (e.g., burner_flow -> chamber_atmosphere,
 *    REUSED -> NEW, 17.2% O2 -> 34% O2, sample_width -> thickness, Quenched == Blow-off).
 */
export function guardConclusion(database, proposal, options = {}) {
  if (!database || !Array.isArray(database.trials)) throw new Error('VALID_DATABASE_REQUIRED');
  if (!proposal || typeof proposal !== 'object') throw new Error('CONCLUSION_PROPOSAL_REQUIRED');

  const text = String(proposal.text ?? '').trim();
  const citations = Array.isArray(proposal.citations) ? proposal.citations : [];
  const target = proposal.target_conditions ?? {};
  const violations = [];
  const constraints = [];
  const resolved_evidence = [];

  if (!text) {
    violations.push({ code: 'EMPTY_CONCLUSION_TEXT', message: 'Conclusion text is required.' });
  }

  // 1. Provenance check: every conclusion must link to at least one valid trial/revision, field, and source
  if (citations.length === 0) {
    violations.push({
      code: 'PROVENANCE_CITATION_REQUIRED',
      message: 'Every conclusion must cite at least one trial, revision, field, and source.',
    });
  }

  const citedRevisions = [];
  for (const cit of citations) {
    if (!cit || !cit.study_id || !cit.trial_id || !cit.field) {
      violations.push({
        code: 'INCOMPLETE_CITATION_LINK',
        message: 'Citation must include study_id, trial_id, and field.',
        citation: cit,
      });
      continue;
    }
    const rev = getRevision(database, cit.study_id, cit.trial_id, cit.revision_id);
    const ev = fieldEvidence(database, cit.study_id, cit.trial_id, cit.field, cit.revision_id);
    if (!rev || !ev || !ev.sources || ev.sources.length === 0) {
      violations.push({
        code: 'UNRESOLVED_PROVENANCE_SOURCE',
        message: `Could not resolve revision or field evidence for ${cit.study_id}/${cit.trial_id} field "${cit.field}".`,
        citation: cit,
      });
      continue;
    }
    if (cit.source_ref_id && !ev.sources.some(s => s.source_ref_id === cit.source_ref_id)) {
      violations.push({
        code: 'SOURCE_REF_ID_MISMATCH',
        message: `Source ref "${cit.source_ref_id}" does not belong to revision "${rev.revision_id}".`,
        citation: cit,
      });
      continue;
    }
    citedRevisions.push(rev);
    resolved_evidence.push({
      study_id: cit.study_id,
      trial_id: cit.trial_id,
      revision_id: rev.revision_id,
      field: cit.field,
      scientific_verification: ev.scientific_verification,
      sources: ev.sources,
    });
  }

  // 2. Prohibit unsupported safety/hazard verdicts or claiming "does not exist in science"
  const safetyClaimRegex = /\b(?:completely\s+safe|guaranteed\s+safe|certified\s+safe|100%\s*safe|safe\s+for\s+flight|flight\s+certified|mutlaqo\s+xavfsiz|to['’`]?liq\s+xavfsiz|100%\s*xavfsiz|kafolatlangan\s+xavfsiz|nasa\s+verified|ilmiy\s+tasdiqlangan)\b/i;
  if (safetyClaimRegex.test(text)) {
    violations.push({
      code: 'UNSUPPORTED_SAFETY_OR_VERIFICATION_VERDICT',
      message: 'Conclusions cannot assert safety certification or NASA scientific verification from unverified corpus records.',
    });
  }

  const nonExistenceClaimRegex = /\b(?:does\s+not\s+exist\s+in\s+science|scientifically\s+impossible|never\s+studied\s+in\s+science|ilm[\s-]+fanda\s+mavjud\s+emas|fanda\s+umuman\s+yo['’`]?q)\b/i;
  if (nonExistenceClaimRegex.test(text)) {
    violations.push({
      code: 'CORPUS_ABSENCE_CONFLATED_WITH_SCIENTIFIC_NONEXISTENCE',
      message: 'Absence in the connected corpus must not be stated as absence in all of science.',
    });
  }

  // 3. Prohibit Moon (0.16g) / Mars (0.38g) interpolation or direct extrapolation from 0g/1g trials
  const mentionsLunarOrMars = /\b(?:moon|lunar|0[.,]16\s*g|mars|martian|0[.,]38\s*g|oy\s+baza(?:si|sida)?|oyda(?:gi)?|marsda(?:gi)?)\b/i.test(text) ||
    ['PARTIAL_G_MOON', 'PARTIAL_G_MARS', 'PARTIAL_G'].includes(target.environment);
  const acknowledgesGap = /\b(?:gap|insufficient|no\s+direct|cannot\s+extrapolate|cannot\s+interpolate|bo['’`]?shliq|yetarli\s+emas|ekstrapolyatsiya\s+qilib\s+bo['’`]?lmaydi|interpolyatsiya\s+mumkin\s+emas|cheklov)\b/i.test(text);

  if (mentionsLunarOrMars) {
    const hasDirectPartialGCitation = citedRevisions.some(r => {
      const m = resolveMetadata(r.record, options.metadataAdapter);
      return m.environment.status === 'MEASURED' && ['PARTIAL_G_MOON', 'PARTIAL_G_MARS', 'PARTIAL_G'].includes(m.environment.value);
    });
    if (!hasDirectPartialGCitation && !acknowledgesGap) {
      violations.push({
        code: 'PARTIAL_G_INTERPOLATION_OR_DIRECT_EXTRAPOLATION_BLOCKED',
        message: 'Cannot interpolate or directly extrapolate 0g/1g trial results to Lunar (0.16g) or Martian (0.38g) environments.',
      });
    } else if (!hasDirectPartialGCitation && acknowledgesGap) {
      constraints.push({
        code: 'PARTIAL_G_EVIDENCE_GAP_CONSTRAINT',
        message: 'Conclusion is scoped strictly as an evidence-gap note; no partial-g combustion metric is inferred.',
      });
    }
  }

  // 4. Physical semantics & condition mismatch checks against cited revisions
  if (citedRevisions.length > 0) {
    // 4a. Width vs thickness conflation
    if (/\b(?:1[.,]2\s*cm|2[.,]2\s*cm|0[.,]012\s*m|0[.,]022\s*m)\s+(?:thickness|thick|qalinlik(?:dagi|da)?|qalinligi)\b/i.test(text) ||
      /\b(?:thickness|qalinligi)\s*(?:[:=]|is)?\s*(?:1[.,]2\s*cm|2[.,]2\s*cm)\b/i.test(text)) {
      violations.push({
        code: 'WIDTH_THICKNESS_CONFLATION',
        message: '1.2 cm and 2.2 cm in BASS-II Table 7.1 are sample_width, never sample_thickness.',
      });
    }

    // 4b. Burner flow O2 applied to chamber atmosphere
    const citesBurnerO2 = citedRevisions.some(r =>
      r.record.parameters.find(p => p.param_key === 'o2_concentration')?.location === 'burner_flow'
    );
    const claimsChamberO2 = target.oxygen_location === 'chamber_atmosphere' ||
      /\b(?:chamber\s+atmosphere|cabin\s+atmosphere|kamera\s+atmosfera(?:si|sida)?|xona\s+havosi(?:da)?|kabina)\b/i.test(text);
    if (citesBurnerO2 && claimsChamberO2 && !/\b(?:not\s+chamber|burner[_\s-]+flow\s+only|kamera\s+emas|faqat\s+gorelka)\b/i.test(text)) {
      violations.push({
        code: 'BURNER_FLOW_TO_CHAMBER_ATMOSPHERE_MISMATCH',
        message: 'Burner-flow oxygen concentration (e.g., 85% O2 in burner_flow) cannot be applied as chamber_atmosphere evidence.',
      });
    }

    // 4c. REUSED sample cited without limitation or claimed as NEW
    const citesReused = citedRevisions.some(r => r.record.sample_history?.value === 'REUSED');
    if (citesReused) {
      if (target.sample_history === 'NEW' || /\b(?:new\s+sample|pristine\s+sample|yangi\s+namuna)\b/i.test(text)) {
        violations.push({
          code: 'REUSED_SAMPLE_CLAIMED_AS_NEW',
          message: 'A trial with REUSED sample_history cannot be claimed as a NEW sample.',
        });
      } else if (!/\b(?:reused|qayta\s+ishlatilgan)\b/i.test(text)) {
        constraints.push({
          code: 'REUSED_SAMPLE_LIMITATION_REQUIRED',
          message: 'Cited trial uses a REUSED sample (flagged for review); conclusion carries a sample-history limitation.',
        });
      }
    }

    // 4d. Target oxygen condition mismatch against cited records
    if (target.o2_vol_pct !== undefined && target.o2_vol_pct !== null) {
      const targetSi = Number(target.o2_vol_pct) / 100;
      const matchesCitedO2 = citedRevisions.some(r => {
        const p = r.record.parameters.find(x => x.param_key === 'o2_concentration');
        return p?.status === 'MEASURED' && Math.abs((p.si?.values?.[0] ?? -1) - targetSi) <= 0.005;
      });
      if (!matchesCitedO2) {
        violations.push({
          code: 'TARGET_OXYGEN_CONDITION_MISMATCH',
          message: `Target oxygen condition (${target.o2_vol_pct} vol%) does not match the cited trial revision(s).`,
        });
      }
    }

    // 4e. Check that numeric physical measurements asserted in conclusion text exist in cited revisions
    const allowedNumbers = new Set();
    for (const r of citedRevisions) {
      for (const p of r.record.parameters) {
        for (const v of p.raw?.values ?? []) allowedNumbers.add(Number(v.toPrecision(6)));
        for (const v of p.si?.values ?? []) allowedNumbers.add(Number(v.toPrecision(6)));
        if (p.param_key === 'o2_concentration' && p.si?.values?.[0] !== undefined) {
          allowedNumbers.add(Number((p.si.values[0] * 100).toPrecision(6)));
        }
      }
      if (r.record.sources) {
        for (const s of r.record.sources) {
          if (s.pdf_page !== null) allowedNumbers.add(s.pdf_page);
          if (s.printed_page !== null) allowedNumbers.add(s.printed_page);
        }
      }
    }

    const assertedMeasurements = [...text.matchAll(/([+-]?\d+(?:[.,]\d+)?)\s*(vol\s*%|%|cm\/s|m\/s|mm\/s|cm|mm|m|mol\/mol|psia|psi|atm)\b/gi)];
    for (const m of assertedMeasurements) {
      const val = number(m[1]);
      const norm = Number(val.toPrecision(6));
      const matchedInCitations = [...allowedNumbers].some(a => Math.abs(a - norm) <= 1e-4);
      if (!matchedInCitations && !acknowledgesGap) {
        violations.push({
          code: 'UNGROUNDED_SCIENTIFIC_NUMBER',
          message: `Measurement "${m[0]}" in conclusion does not appear in the cited trial revision(s).`,
          measurement: m[0],
        });
      }
    }
  }

  const allowed = violations.length === 0;
  const status = !allowed
    ? 'BLOCKED'
    : constraints.length > 0
      ? 'CONSTRAINED_WITH_LIMITATIONS'
      : 'APPROVED_WITH_PROVENANCE';

  return freeze({
    ok: allowed,
    allowed,
    status,
    violations,
    constraints,
    resolved_evidence,
    dependencies: [
      {
        owner: 'D',
        path: 'src/atlas/data',
        status: options.dRulesConnected ? 'CONNECTED' : 'PENDING_AUTHORITATIVE_D_PACKAGE',
      },
    ],
  });
}

/**
 * Compares 2 or 3 selected trials side-by-side, separating:
 * 1) Confirmed Shared Conditions
 * 2) Confirmed Contrasting Conditions + Exact Original Outcomes
 * 3) Semantic Mismatches / Unresolved Metadata Guards
 */
export function compareTrials(database, selections, options = {}) {
  if (!database || !Array.isArray(database.trials)) throw new Error('VALID_DATABASE_REQUIRED');
  if (!Array.isArray(selections) || selections.length < 2 || selections.length > 3) {
    throw new Error('COMPARE_REQUIRES_TWO_OR_THREE_TRIALS');
  }

  const resolved = selections.map(sel => {
    const rev = getRevision(database, sel.study_id, sel.trial_id, sel.revision_id);
    if (!rev) throw new Error(`TRIAL_NOT_FOUND:${sel.study_id}:${sel.trial_id}`);
    return {
      key: trialKey(sel.study_id, sel.trial_id),
      study_id: sel.study_id,
      trial_id: sel.trial_id,
      revision_id: rev.revision_id,
      record: rev.record,
      metadata: resolveMetadata(rev.record, options.metadataAdapter),
    };
  });

  const shared_conditions = [];
  const contrasting_conditions = [];
  const semantic_guards = [];

  // Material comparison
  const mats = resolved.map(r => r.metadata.material.value);
  if (mats.every(m => m && m === mats[0])) {
    shared_conditions.push({ field: 'material', value: mats[0] });
  } else if (mats.some(m => !m)) {
    semantic_guards.push({ field: 'material', reason: 'MATERIAL_MISSING_ON_SOME_TRIALS', values: mats });
  } else {
    contrasting_conditions.push({ field: 'material', values: resolved.map(r => ({ key: r.key, value: r.record.material })) });
  }

  // Parameters comparison (sample_width, flow_velocity, o2_concentration)
  for (const paramKey of ['sample_width', 'flow_velocity', 'o2_concentration']) {
    const params = resolved.map(r => ({
      key: r.key,
      param: r.record.parameters.find(p => p.param_key === paramKey),
    }));

    if (params.some(p => !p.param || p.param.status !== 'MEASURED')) {
      semantic_guards.push({
        field: paramKey,
        reason: 'PARAMETER_NOT_MEASURED_ON_ALL_TRIALS',
        states: params.map(p => ({ key: p.key, status: p.param?.status ?? 'NOT_PROVIDED' })),
      });
      continue;
    }

    const locations = params.map(p => p.param.location);
    if (locations.some(l => l === 'NOT_PROVIDED') || new Set(locations).size > 1) {
      semantic_guards.push({
        field: paramKey,
        reason: new Set(locations).size > 1 ? 'PARAMETER_LOCATION_MISMATCH' : 'PARAMETER_LOCATION_UNKNOWN',
        locations: params.map(p => ({ key: p.key, location: p.param.location })),
      });
    }

    const firstSig = JSON.stringify({ si: params[0].param.si.values, dir: params[0].param.direction, loc: params[0].param.location });
    const allSame = params.every(p =>
      JSON.stringify({ si: p.param.si.values, dir: p.param.direction, loc: p.param.location }) === firstSig
    );

    if (allSame && locations[0] !== 'NOT_PROVIDED') {
      shared_conditions.push({
        field: paramKey,
        raw_display: params[0].param.raw_display,
        si_display: params[0].param.si_display,
        direction: params[0].param.direction,
        location: params[0].param.location,
      });
    } else {
      contrasting_conditions.push({
        field: paramKey,
        values: params.map(p => ({
          key: p.key,
          raw_display: p.param.raw_display,
          si_display: p.param.si_display,
          direction: p.param.direction,
          location: p.param.location,
        })),
      });
    }
  }

  // Sample history guard
  const histories = resolved.map(r => ({ key: r.key, value: r.record.sample_history.value, status: r.record.sample_history.status }));
  if (histories.some(h => h.status !== 'MEASURED' || h.value === 'REUSED')) {
    semantic_guards.push({
      field: 'sample_history',
      reason: histories.some(h => h.value === 'REUSED') ? 'CONTAINS_REUSED_SAMPLE' : 'SAMPLE_HISTORY_UNKNOWN',
      values: histories,
    });
  }

  // Outcomes (always preserved verbatim, never merged into generic "Extinguished")
  const outcomes = resolved.map(r => ({
    key: r.key,
    study_id: r.study_id,
    trial_id: r.trial_id,
    revision_id: r.revision_id,
    outcome_raw_display: r.record.outcome.raw_display,
    outcome_status: r.record.outcome.status,
  }));

  return freeze({
    trials: resolved.map(r => ({ study_id: r.study_id, trial_id: r.trial_id, revision_id: r.revision_id, key: r.key })),
    shared_conditions,
    contrasting_conditions,
    outcomes,
    semantic_guards,
  });
}
