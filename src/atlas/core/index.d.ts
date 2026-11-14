import type {
  Database,
  ImportRow,
  ImportPreview,
  StoreError,
  StorageAdapter,
  TrialRecord,
  Revision,
  SourceReference,
  ParsedQuery,
  QueryFilter,
  ChecklistEvaluation,
  RankingWeights,
  RankedTrialResult,
  SensitivityReport,
  EvidenceGapStatus,
} from './types';
export type * from './types';
export const SCHEMA_VERSION:'skyforge.atlas/1';
export const STORE_KEY:string;
export const ALIGNMENT_THRESHOLD_PCT:70;
export const SCORE_TERMINOLOGY:'alignment_score';
export const MIN_SELECTED_TRIALS:1;
export const MAX_SELECTED_TRIALS:3;
export const REPORT_SCHEMA_VERSION:'skyforge.atlas.report/1';
export const REPORT_EXPORT_MODE:'PRESENTATION_REPORT_NOT_IMPORT_EXCHANGE';
export const API_STATUS_UNAVAILABLE:'API_UNAVAILABLE';
export const API_STATUS_READY:'API_ADAPTER_CONFIGURED';
export const DEFAULT_WEIGHTS:RankingWeights;
export const EVIDENCE_GAP_STATUSES:Record<string, EvidenceGapStatus>;
export const ALL_EVIDENCE_GAP_STATUSES:readonly EvidenceGapStatus[];

export function trialKey(study:string, trial:string):string;
export function parseCSV(text:string):ImportRow[];
export function writeCSV(rows:ImportRow[]):string;
export function extractRow(row:ImportRow):Omit<TrialRecord,'review'>;
export function reviewRecord(record:Omit<TrialRecord,'review'>):TrialRecord;
export function readImport(text:string, format:'csv' | 'json'):ImportRow[];
export function emptyDatabase():Database;
export function validateDatabase(database:unknown):Database;
export function previewImport(text:string,format:'csv' | 'json',database:Database,options?:{allowHistoricalRevision?:boolean}):Omit<ImportPreview,'base_generation'>;
export function getRevision(database:Database,study:string,trial:string,revision?:string):Revision | null;
export function fieldEvidence(database:Database,study:string,trial:string,field:string,revision?:string):{revision_id:string; scientific_verification:'NOT_VERIFIED'; sources:SourceReference[]} | null;
export function activeRecords(database:Database):TrialRecord[];
export function exportJSON(database:Database):string;
export function exportArchive(database:Database):string;

export function createMetadataAdapter(declarations?:Record<string, unknown>):{ kind:string; resolve(record:TrialRecord):Record<string, unknown> };
export function resolveMetadata(record:TrialRecord, adapter?:unknown):Record<string, unknown>;

export function parseQuery(queryText:string, options?:{ skipClarification?:boolean }):ParsedQuery;
export function addFilter(queryState:ParsedQuery, filterSpec:Partial<QueryFilter> & { field:string; value:unknown }):ParsedQuery;
export function updateFilter(queryState:ParsedQuery, filterIdOrField:string, patch:Partial<QueryFilter>):ParsedQuery;
export function removeFilter(queryState:ParsedQuery, filterIdOrField:string):ParsedQuery;
export function skipClarification(queryState:ParsedQuery, skipped?:boolean):ParsedQuery;
export function equalQueryFilters(queryA:ParsedQuery | string, queryB:ParsedQuery | string):boolean;
export function evaluateChecklist(queryState:ParsedQuery | string, record:TrialRecord, adapter?:unknown):ChecklistEvaluation;

export function normalizeWeights(input?:Partial<RankingWeights>):RankingWeights;
export function classifyEvidenceTier(record:TrialRecord, queryState:ParsedQuery | string, adapter?:unknown):{ tier:1 | 2 | 3 | 4; code:string; title_en:string; title_uz:string; reason:string };
export function computeComponentScores(record:TrialRecord, queryState:ParsedQuery | string, adapter?:unknown):Record<keyof RankingWeights, { score:number; detail:string }>;
export function scoreWithinTier(components:Record<keyof RankingWeights, { score:number; detail:string }>, weights?:Partial<RankingWeights>):number;
export function checkWeightSensitivity(evaluatedItems:unknown[], baseWeights?:Partial<RankingWeights>, relativeDelta?:number):SensitivityReport;
export function rankTrials(databaseOrRecords:Database | TrialRecord[], queryInput:ParsedQuery | string, options?:{ weights?:Partial<RankingWeights>; metadataAdapter?:unknown; sensitivityDelta?:number }):{
  query:ParsedQuery;
  weights:RankingWeights;
  score_terminology:'alignment_score';
  alignment_threshold_pct:number;
  clarification:{ needed:boolean; skipped:boolean; high_alignment_count:number; threshold_pct:number; threshold_metric:'alignment_score' };
  sensitivity:SensitivityReport;
  results:RankedTrialResult[];
};

export function selectLibraryStudies(database:Database, filters?:Record<string, unknown>, options?:{ metadataAdapter?:unknown }):unknown[];
export function selectStudyTrials(database:Database, study_id:string, options?:{ filters?:Record<string, unknown>; metadataAdapter?:unknown }):unknown[];
export function validateTrialSelection(database:Database, selection:unknown[]):{ ok:boolean; count?:number; selected?:{ study_id:string; trial_id:string; key:string }[]; trials?:unknown[]; error?:{ code:string; message?:string } };
export function updateTrialSelection(currentSelection:unknown[], candidate:unknown, action?:'toggle' | 'add' | 'remove'):{ ok:boolean; selected:unknown[]; count?:number; error?:{ code:string } };

export function detectEvidenceGap(databaseOrRecords:Database | TrialRecord[], queryOrScenario:ParsedQuery | string | Record<string, unknown>, options?:{ metadataAdapter?:unknown; dRulesConnected?:boolean; interpolatePartialG?:boolean; requireKnownEnvironment?:boolean }):{
  status:EvidenceGapStatus;
  reason:string;
  interpolation_blocked:true;
  interpolated_values:null;
  safety_verdict:null;
  corpus_scope_note:string;
  matching_trials:unknown[];
  related_trials:unknown[];
  dependencies:unknown[];
};
export function guardConclusion(database:Database, proposal:{ text:string; citations:{ study_id:string; trial_id:string; revision_id?:string; field:string; source_ref_id?:string }[]; target_conditions?:Record<string, unknown> }, options?:{ metadataAdapter?:unknown; dRulesConnected?:boolean }):{
  ok:boolean;
  allowed:boolean;
  status:'APPROVED_WITH_PROVENANCE' | 'CONSTRAINED_WITH_LIMITATIONS' | 'BLOCKED';
  violations:{ code:string; message:string }[];
  constraints:{ code:string; message:string }[];
  resolved_evidence:unknown[];
  dependencies:unknown[];
};
export function compareTrials(database:Database, selections:{ study_id:string; trial_id:string; revision_id?:string }[], options?:{ metadataAdapter?:unknown }):unknown;

export function buildReportRows(database:Database, options?:{ selection?:unknown[] }):ImportRow[];
export function exportReportJSON(database:Database, options?:{ selection?:unknown[] }):string;
export function exportReportCSV(database:Database, options?:{ selection?:unknown[] }):string;

export function getReevaluationApiStatus(adapter?:unknown):{ available:boolean; status:string; message:string };
export function proposeReevaluation(store:AtlasStore, request:{ study_id:string; trial_id:string; revision_id?:string; field?:string }, options?:{ adapter?:unknown }):Promise<unknown>;
export function cancelReevaluation(proposal:unknown):{ ok:true; status:'CANCELLED'; mutated:false };
export function commitReevaluation(store:AtlasStore, proposal:unknown, options?:{ confirmed?:boolean; acknowledgeFlags?:boolean }):unknown;

export interface AtlasStore {
  load():{ok:true;raw:string | null;database:Database} | StoreError;
  preview(text:string,format:'csv' | 'json',options?:{allowHistoricalRevision?:boolean}):ImportPreview | StoreError;
  commit(plan:ImportPreview,options?:{confirmed?:boolean;acknowledgeFlags?:boolean}):{ok:true;database:Database;changes:{study_id:string;trial_id:string;revision_id:string;action:string}[];unchanged:number} | StoreError;
}
export function openAtlasStore(storage:StorageAdapter | null, options?:{key?:string;clock?:() => string}):AtlasStore;
