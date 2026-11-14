export type MissingState = 'MEASURED' | 'NOT_PROVIDED' | 'NOT_EXTRACTED' | 'NOT_APPLICABLE' | 'CONFLICTING';
export type Location = 'chamber_atmosphere' | 'burner_flow' | 'sample_surface' | 'simulation_domain' | 'NOT_PROVIDED';
export type SafetyDomain = 'PREVENTION_SOLID' | 'SUPPRESSION_DROPLET' | 'DETECTION_AEROSOL' | 'GAS_EMULATION' | 'CFD_MODELING';
export type FuelType = 'SOLID_FABRIC' | 'SOLID_POLYMER' | 'LIQUID_DROPLET' | 'GAS_BURNER' | 'AEROSOL_SUBSTRATE';
export type EnvironmentType = 'FLIGHT_0G' | 'PARTIAL_G_MOON' | 'PARTIAL_G_MARS' | 'PARTIAL_G' | 'FLIGHT_PROXY_0G' | 'GROUND_CFD' | 'GROUND_1G';
export type UnitFamilyId = 'FAMILY_A_FLAME_METRICS' | 'FAMILY_B_ATMOS_THERMO' | 'FAMILY_C_HEAT_FLUX' | 'FAMILY_D_SOOT_AEROSOL' | 'FAMILY_E_CFD_GRID';
export type EvidenceGapStatus =
  | 'Direct matching evidence'
  | 'Related evidence with different conditions'
  | 'No matching evidence in connected corpus'
  | 'Insufficient metadata';

export interface DirectionalParameter {
  param_key: 'sample_width' | 'flow_velocity' | 'o2_concentration';
  status: MissingState;
  raw_display: string;
  raw: { text:string; unit:string; values:number[] };
  si: { unit:string; values:number[] };
  si_display: string;
  direction: 'constant' | 'decreasing' | 'increasing' | 'unknown';
  location: Location;
  source_ref_ids: string[];
}
export interface SourceReference {
  source_ref_id:string; url:string; document_id:string;
  pdf_page:number | null; printed_page:number | null; table:string; row_id:string;
  excerpt:string;
  excerpt_kind:'TABLE_TRANSCRIPTION' | 'USER_SUPPLIED_UNVERIFIED' | 'NOT_PROVIDED';
}
export type ImportRow = Record<string, string | number | boolean | null>;
export interface TrialRecord {
  schema_version:'skyforge.atlas/1'; study_id:string; trial_id:string; material:string;
  claim_type:'OBJECTIVE' | 'HYPOTHESIS' | 'OBSERVATION' | 'MODEL_RESULT' | 'CAVEAT';
  sample_history:{ value:'NEW' | 'REUSED' | null; status:MissingState; source_ref_ids:string[] };
  outcome:{ raw_display:string; status:MissingState; source_ref_ids:string[] };
  parameters:DirectionalParameter[]; sources:SourceReference[]; field_source_refs:Record<string,string[]>; raw_input:ImportRow;
  unparsed_columns:{ param_key:string; status:'NOT_EXTRACTED'; raw:ImportRow[string] }[];
  review:{ status:'FLAGGED_FOR_REVIEW' | 'UNREVIEWED'; reasons:string[]; scientific_verification:'NOT_VERIFIED' };
}
export interface Revision {
  revision_id:string; parent_revision_id:string | null; created_at:string; import_format:'csv' | 'json';
  user_confirmation:'CONFIRMED'; flags_acknowledged:true; record:TrialRecord;
}
export interface Trial {
  study_id:string; trial_id:string; active_revision_id:string; revisions:Revision[];
}
export interface Database { schema_version:'skyforge.atlas/1'; generation:number; trials:Trial[] }
export interface ImportPreview {
  ok:boolean; base_generation:number;
  entries:{ row:number; key:string; action:'INSERT' | 'NEW_REVISION' | 'UNCHANGED' | 'DUPLICATE_IN_BATCH'; matched_revision_id?:string | null; record:TrialRecord }[];
  errors:{ row:number | null; message:string }[];
}
export interface StoreError { ok:false; error:{ code:string; message?:string } }
export interface StorageAdapter { getItem(key:string):string | null; setItem(key:string, value:string):void }

export interface QueryFilter {
  filter_id: string;
  field: string;
  operator: string;
  value: unknown;
  si_value: number | number[] | null;
  unit: string | null;
  location: Location | null;
  direction: string | null;
  source_text: string;
  origin: 'parsed' | 'user_added' | 'user_modified';
  status: 'PARSED' | 'UNKNOWN';
}

export interface ParsedQuery {
  raw_query: string;
  detected_language: 'uz' | 'en' | 'mixed' | 'unknown';
  filters: QueryFilter[];
  canonical_filters: Omit<QueryFilter, 'filter_id' | 'source_text' | 'origin'>[];
  canonical_signature: string;
  unparsed_requirements: { id: string; source_text: string; reason: string }[];
  clarification: {
    needed: boolean;
    skipped: boolean;
    reason: string | null;
    threshold_pct: number;
    threshold_metric: 'alignment_score';
  };
}

export interface ChecklistItem {
  filter_id: string;
  field: string;
  expected: unknown;
  observed: unknown;
  source_text: string;
  status: 'matched' | 'partial' | 'unknown';
  label_uz: string;
  label_en: string;
  reason: string;
}

export interface ChecklistEvaluation {
  study_id: string;
  trial_id: string;
  items: ChecklistItem[];
  counts: { matched: number; partial: number; unknown: number; total: number };
}

export interface RankingWeights {
  domain: number;
  fuel: number;
  atmosphere: number;
  unit_family: number;
}

export interface RankedTrialResult {
  rank: number;
  key: string;
  study_id: string;
  trial_id: string;
  tier: 1 | 2 | 3 | 4;
  tier_code: string;
  tier_title_en: string;
  tier_title_uz: string;
  tier_reason: string;
  alignment_score: number;
  alignment_score_pct: number;
  meets_alignment_threshold: boolean;
  score_terminology: 'alignment_score';
  score_disclaimer: string;
  weights_used: RankingWeights;
  components: Record<keyof RankingWeights, { score: number; detail: string }>;
  checklist: ChecklistEvaluation;
  sensitivity_warning: boolean;
  record: TrialRecord;
}

export interface SensitivityReport {
  warning: boolean;
  status: 'SENSITIVITY_ORDER_CHANGED' | 'SENSITIVITY_STABLE';
  relative_delta: number;
  affected_tiers: number[];
  affected_keys: string[];
  flips: {
    component: keyof RankingWeights;
    relative_perturbation: string;
    normalized_weights: RankingWeights;
    tier: number;
    baseline_order: string[];
    perturbed_order: string[];
  }[];
  runs: {
    component: keyof RankingWeights;
    relative_perturbation: string;
    normalized_weights: RankingWeights;
  }[];
}
