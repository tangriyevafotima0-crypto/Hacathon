// All constants are invented educational UI weights, not measured material properties.
export const DEFAULTS = Object.freeze({ oxygen: 32, pressure: 10.2, airflow: 8 });
export const MATERIALS = Object.freeze([
  { id: 'nomex', name: 'Nomex', type: 'Flame-resistant fabric', base: 18 },
  { id: 'pmma', name: 'PMMA / Acrylic', type: 'Thermoplastic polymer', base: 78 },
  { id: 'polyethylene', name: 'Polyethylene', type: 'Polymer', base: 65 },
  { id: 'cotton', name: 'Cotton', type: 'Natural textile', base: 45 },
]);
export const CONTROLS = Object.freeze([
  { key: 'oxygen', label: 'Oxygen concentration', min: 21, max: 100, step: 1, unit: '%', digits: 0 },
  { key: 'pressure', label: 'Cabin pressure', min: 4.3, max: 14.7, step: 0.1, unit: 'psi', digits: 1 },
  { key: 'airflow', label: 'Airflow velocity', min: 0, max: 20, step: 1, unit: 'cm/s', digits: 0 },
]);
export function contributions({ oxygen, pressure, airflow }) {
  return { oxygen: Math.max(0, oxygen - 21) * 0.65, pressure: Math.max(0, pressure - 4.3) * 1.3, airflow: airflow * 0.65 };
}
export function calculateRisk(material, environment) {
  const modifiers = contributions(environment);
  const score = Math.min(100, Math.max(0, Math.round(material.base + Object.values(modifiers).reduce((sum, n) => sum + n, 0))));
  return { ...material, score, level: score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low' };
}
export function rankMaterials(environment) {
  return MATERIALS.map(material => calculateRisk(material, environment)).sort((a, b) => b.score - a.score || b.base - a.base);
}
export function getAdvice(environment, ranked) {
  return [
    { title: 'Review the oxygen scenario', text: `${environment.oxygen}% oxygen is ${environment.oxygen > 21 ? 'above' : 'at'} the toy model’s 21% reference. Check material test conditions before drawing conclusions.` },
    { title: 'Keep ventilation in context', text: environment.airflow < 3 ? 'Low forced flow does not establish safety. Actual flame persistence and sensor transport depend on geometry, fuel and heat loss.' : 'Forced flow can change oxygen transport and flame behavior. This model’s linear airflow term cannot represent extinction or all flow regimes.' },
    { title: `Prioritize ${ranked[0].name} for investigation`, text: `Its demo index is ${ranked[0].score}/100 at ${environment.pressure.toFixed(1)} psi. This ranking comes from invented weights; use qualified experimental data for material selection.` },
  ];
}
