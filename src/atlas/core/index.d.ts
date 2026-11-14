import type { Database, ImportRow, ImportPreview, StoreError, StorageAdapter, TrialRecord, Revision, SourceReference } from './types';
export type * from './types';
export const SCHEMA_VERSION:'skyforge.atlas/1';
export const STORE_KEY:string;
export function trialKey(study:string, trial:string):string;
export function parseCSV(text:string):ImportRow[];
export function writeCSV(rows:ImportRow[]):string;
export function extractRow(row:ImportRow):Omit<TrialRecord,'review'>;
export function reviewRecord(record:Omit<TrialRecord,'review'>):TrialRecord;
export function readImport(text:string, format:'csv' | 'json'):ImportRow[];
export function emptyDatabase():Database;
export function validateDatabase(database:unknown):Database;
export function previewImport(text:string,format:'csv' | 'json',database:Database):Omit<ImportPreview,'base_generation'>;
export function getRevision(database:Database,study:string,trial:string,revision?:string):Revision | null;
export function fieldEvidence(database:Database,study:string,trial:string,field:string,revision?:string):{revision_id:string; scientific_verification:'NOT_VERIFIED'; sources:SourceReference[]} | null;
export function activeRecords(database:Database):TrialRecord[];
export function exportJSON(database:Database):string;
export function exportArchive(database:Database):string;
export interface AtlasStore {
  load():{ok:true;raw:string | null;database:Database} | StoreError;
  preview(text:string,format:'csv' | 'json'):ImportPreview | StoreError;
  commit(plan:ImportPreview,options?:{confirmed?:boolean;acknowledgeFlags?:boolean}):{ok:true;database:Database;changes:{study_id:string;trial_id:string;revision_id:string;action:string}[];unchanged:number} | StoreError;
}
export function openAtlasStore(storage:StorageAdapter | null, options?:{key?:string;clock?:() => string}):AtlasStore;
