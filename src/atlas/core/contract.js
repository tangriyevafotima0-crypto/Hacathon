export const SCHEMA_VERSION = 'skyforge.atlas/1';
export const MISSING_STATES = Object.freeze(['MEASURED', 'NOT_PROVIDED', 'NOT_EXTRACTED', 'NOT_APPLICABLE', 'CONFLICTING']);
export const LOCATIONS = Object.freeze(['chamber_atmosphere', 'burner_flow', 'sample_surface', 'simulation_domain', 'NOT_PROVIDED']);
export const clone = value => JSON.parse(JSON.stringify(value));
export const trialKey = (study, trial) => JSON.stringify([study, trial]);
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function safeURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export function id(value) {
  if (typeof value !== 'string' || !/^[\p{L}\p{N}_.:-]{1,100}$/u.test(value)) throw new Error('INVALID_ID');
  return value;
}
export function number(value) {
  const s = String(value).trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(s)) throw new Error(`INVALID_NUMBER:${s}`);
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error('NONFINITE_NUMBER');
  return n;
}
export const CONVERSIONS = Object.freeze({ cm: ['m', .01], mm: ['m', .001], m: ['m', 1], 'cm/s': ['m/s', .01], 'm/s': ['m/s', 1], 'vol%': ['mol/mol', .01], 'mol/mol': ['mol/mol', 1] });
export const PARAMS = Object.freeze({ sample_width: ['cm', 'm', 'sample_surface'], flow_velocity: ['cm/s', 'm/s', 'chamber_atmosphere'], o2_concentration: ['vol%', 'mol/mol', 'NOT_PROVIDED'] });
export function convert(values, unit, key) {
  const conversion = CONVERSIONS[unit];
  if (!conversion || conversion[0] !== PARAMS[key]?.[1]) throw new Error(`UNIT_FAMILY_MISMATCH:${key}:${unit}`);
  if (!values.every(n => Number.isFinite(n) && n >= 0)) throw new Error(`INVALID_PHYSICAL_VALUE:${key}`);
  if (key === 'o2_concentration' && values.some(n => n > (unit === 'vol%' ? 100 : 1))) throw new Error('OXYGEN_OUT_OF_RANGE');
  if (key === 'sample_width' && values.some(n => n <= 0)) throw new Error('WIDTH_MUST_BE_POSITIVE');
  return { unit: conversion[0], values: values.map(n => Number((n * conversion[1]).toPrecision(14))) };
}
export function direction(values) { return values.length === 1 ? 'constant' : values[1] < values[0] ? 'decreasing' : values[1] > values[0] ? 'increasing' : 'constant'; }
export function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
