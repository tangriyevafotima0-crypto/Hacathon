export type MissingState = 'MEASURED' | 'NOT_PROVIDED' | 'NOT_EXTRACTED' | 'NOT_APPLICABLE' | 'CONFLICTING';
export type Location = 'chamber_atmosphere' | 'burner_flow' | 'sample_surface' | 'simulation_domain' | 'NOT_PROVIDED';
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
