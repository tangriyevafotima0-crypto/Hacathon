import { parseCSV, SCHEMA_VERSION } from './core/index.js';
import { BASS_THREE } from './data/index.js';

export function convertNasaTable(csv) {
  const rows = parseCSV(csv);
  const canonical = new Map(BASS_THREE.rows.map(row => [row.trial_id, row]));
  const matched = rows.filter(row => canonical.has('GMT' + row.GMT + '-' + row['Test #']));
  const selected = matched.map(row => {
    const trial = canonical.get('GMT' + row.GMT + '-' + row['Test #']);
    if (!/SIBAL/i.test(row['Fuel Sample Material'])) throw new Error('NASA_SOURCE_ROW_CHANGED');
    return { ...trial, psi_csv_material_label: row['Fuel Sample Material'] };
  });
  if (selected.length !== canonical.size || new Set(selected.map(row => row.trial_id)).size !== canonical.size) {
    throw new Error('NASA_SOURCE_ROWS_INCOMPLETE');
  }
  return JSON.stringify({ schema_version: SCHEMA_VERSION, rows: selected });
}
