import { MISSING_STATES, LOCATIONS, trialKey, clone, freeze } from './contract.js';

export const SAFETY_DOMAINS = Object.freeze([
  'PREVENTION_SOLID',
  'SUPPRESSION_DROPLET',
  'DETECTION_AEROSOL',
  'GAS_EMULATION',
  'CFD_MODELING',
]);

export const FUEL_TYPES = Object.freeze([
  'SOLID_FABRIC',
  'SOLID_POLYMER',
  'LIQUID_DROPLET',
  'GAS_BURNER',
  'AEROSOL_SUBSTRATE',
]);

export const ENVIRONMENTS = Object.freeze([
  'FLIGHT_0G',
  'PARTIAL_G_MOON',
  'PARTIAL_G_MARS',
  'PARTIAL_G',
  'FLIGHT_PROXY_0G',
  'GROUND_CFD',
  'GROUND_1G',
]);

export const UNIT_FAMILIES = Object.freeze([
  'FAMILY_A_FLAME_METRICS',
  'FAMILY_B_ATMOS_THERMO',
  'FAMILY_C_HEAT_FLUX',
  'FAMILY_D_SOOT_AEROSOL',
  'FAMILY_E_CFD_GRID',
]);

const DOMAIN_ALIASES = Object.freeze({
  prevention_solid: 'PREVENTION_SOLID',
  solid: 'PREVENTION_SOLID',
  solid_flame_spread: 'PREVENTION_SOLID',
  solid_combustion: 'PREVENTION_SOLID',
  suppression_droplet: 'SUPPRESSION_DROPLET',
  droplet: 'SUPPRESSION_DROPLET',
  droplet_suppression: 'SUPPRESSION_DROPLET',
  liquid_droplet: 'SUPPRESSION_DROPLET',
  detection_aerosol: 'DETECTION_AEROSOL',
  smoke: 'DETECTION_AEROSOL',
  aerosol: 'DETECTION_AEROSOL',
  smoke_detection: 'DETECTION_AEROSOL',
  gas_emulation: 'GAS_EMULATION',
  gas_burner: 'GAS_EMULATION',
  proxy: 'GAS_EMULATION',
  emulator: 'GAS_EMULATION',
  cfd_modeling: 'CFD_MODELING',
  cfd: 'CFD_MODELING',
  ground_cfd: 'CFD_MODELING',
  simulation: 'CFD_MODELING',
});

const FUEL_ALIASES = Object.freeze({
  solid_fabric: 'SOLID_FABRIC',
  fabric: 'SOLID_FABRIC',
  textile: 'SOLID_FABRIC',
  mato: 'SOLID_FABRIC',
  solid_polymer: 'SOLID_POLYMER',
  polymer: 'SOLID_POLYMER',
  polimer: 'SOLID_POLYMER',
  liquid_droplet: 'LIQUID_DROPLET',
  liquid: 'LIQUID_DROPLET',
  droplet: 'LIQUID_DROPLET',
  tomchi: 'LIQUID_DROPLET',
  gas_burner: 'GAS_BURNER',
  gas: 'GAS_BURNER',
  gaseous: 'GAS_BURNER',
  gorelka: 'GAS_BURNER',
  aerosol_substrate: 'AEROSOL_SUBSTRATE',
  aerosol: 'AEROSOL_SUBSTRATE',
  smoke: 'AEROSOL_SUBSTRATE',
});

const ENV_ALIASES = Object.freeze({
  flight_0g: 'FLIGHT_0G',
  '0g': 'FLIGHT_0G',
  microgravity: 'FLIGHT_0G',
  zero_g: 'FLIGHT_0G',
  orbital: 'FLIGHT_0G',
  iss: 'FLIGHT_0G',
  partial_g_moon: 'PARTIAL_G_MOON',
  moon: 'PARTIAL_G_MOON',
  lunar: 'PARTIAL_G_MOON',
  '0.16g': 'PARTIAL_G_MOON',
  oy: 'PARTIAL_G_MOON',
  partial_g_mars: 'PARTIAL_G_MARS',
  mars: 'PARTIAL_G_MARS',
  martian: 'PARTIAL_G_MARS',
  '0.38g': 'PARTIAL_G_MARS',
  partial_g: 'PARTIAL_G',
  'partial-g': 'PARTIAL_G',
  flight_proxy_0g: 'FLIGHT_PROXY_0G',
  proxy_0g: 'FLIGHT_PROXY_0G',
  emulator: 'FLIGHT_PROXY_0G',
  ground_cfd: 'GROUND_CFD',
  cfd: 'GROUND_CFD',
  ground_1g: 'GROUND_1G',
  '1g': 'GROUND_1G',
  earth: 'GROUND_1G',
  ground: 'GROUND_1G',
  yer: 'GROUND_1G',
});

const UNIT_FAMILY_ALIASES = Object.freeze({
  family_a: 'FAMILY_A_FLAME_METRICS',
  family_a_flame_metrics: 'FAMILY_A_FLAME_METRICS',
  flame_metrics: 'FAMILY_A_FLAME_METRICS',
  size: 'FAMILY_A_FLAME_METRICS',
  width: 'FAMILY_A_FLAME_METRICS',
  family_b: 'FAMILY_B_ATMOS_THERMO',
  family_b_atmos_thermo: 'FAMILY_B_ATMOS_THERMO',
  atmosphere: 'FAMILY_B_ATMOS_THERMO',
  atmos_thermo: 'FAMILY_B_ATMOS_THERMO',
  family_c: 'FAMILY_C_HEAT_FLUX',
  family_c_heat_flux: 'FAMILY_C_HEAT_FLUX',
  heat_flux: 'FAMILY_C_HEAT_FLUX',
  family_d: 'FAMILY_D_SOOT_AEROSOL',
  family_d_soot_aerosol: 'FAMILY_D_SOOT_AEROSOL',
  soot_aerosol: 'FAMILY_D_SOOT_AEROSOL',
  aerosol: 'FAMILY_D_SOOT_AEROSOL',
  family_e: 'FAMILY_E_CFD_GRID',
  family_e_cfd_grid: 'FAMILY_E_CFD_GRID',
  cfd_grid: 'FAMILY_E_CFD_GRID',
});

export function normalizeEnum(value, catalog, aliases) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (catalog.includes(upper)) return upper;
  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return aliases[lower] ?? aliases[raw.toLowerCase()] ?? null;
}

export function normalizeMaterialName(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (['NOT_PROVIDED', 'UNKNOWN', 'NONE', 'NULL'].includes(upper)) return null;
  if (upper.includes('SIBAL')) return 'SIBAL';
  if (upper.includes('PMMA') || upper.includes('ACRYLIC') || upper.includes('AKRIL')) return 'PMMA';
  if (upper.includes('NOMEX')) return 'NOMEX';
  if (upper.includes('COTTON') || upper.includes('PAXTA')) return 'COTTON';
  if (upper.includes('SILICONE') || upper.includes('SILIKON')) return 'SILICONE';
  if (upper.includes('KAPTON')) return 'KAPTON';
  if (upper.includes('HEPTANE') || upper.includes('GEPTAN')) return 'HEPTANE';
  if (upper.includes('METHANOL') || upper.includes('METANOL')) return 'METHANOL';
  return upper;
}

export function getParam(record, paramKey) {
  return record?.parameters?.find(p => p.param_key === paramKey) ?? null;
}

/**
 * Creates a deterministic, explicit metadata adapter for Z02.
 * Never fabricates values: only returns metadata explicitly declared in `declarations`
 * (keyed by trialKey(study_id, trial_id), study_id, or material).
 */
export function createMetadataAdapter(declarations = {}) {
  const byTrial = new Map(Object.entries(declarations.trials ?? {}));
  const byStudy = new Map(Object.entries(declarations.studies ?? {}));
  const byMaterial = new Map(Object.entries(declarations.materials ?? {}));

  return Object.freeze({
    kind: 'skyforge.atlas.metadata-adapter/1',
    resolve(record) {
      if (!record || typeof record !== 'object') return {};
      const key = trialKey(record.study_id, record.trial_id);
      const tMeta = byTrial.get(key) ?? byTrial.get(`${record.study_id}:${record.trial_id}`) ?? {};
      const sMeta = byStudy.get(record.study_id) ?? {};
      const matKey = normalizeMaterialName(record.material);
      const mMeta = (matKey && byMaterial.get(matKey)) ?? {};
      return clone({ ...mMeta, ...sMeta, ...tMeta });
    },
  });
}

function resolveAdapterOutput(record, adapter) {
  if (!adapter) return {};
  if (typeof adapter === 'function') return adapter(record) ?? {};
  if (typeof adapter.resolve === 'function') return adapter.resolve(record) ?? {};
  if (typeof adapter === 'object') {
    const helper = createMetadataAdapter(adapter);
    return helper.resolve(record);
  }
  return {};
}

/**
 * Resolves Z01 record + explicit raw_input extension columns + optional metadataAdapter
 * into a transparent metadata descriptor. Anything not explicitly present in the record,
 * its measured parameters, or the injected adapter remains status: 'NOT_PROVIDED' (null).
 */
export function resolveMetadata(record, adapter = null) {
  if (!record || typeof record !== 'object') throw new Error('RECORD_REQUIRED_FOR_METADATA');
  const raw = record.raw_input ?? {};
  const ext = resolveAdapterOutput(record, adapter);

  const materialValue = normalizeMaterialName(record.material || raw.material || ext.material);
  const materialStatus = materialValue ? 'MEASURED' : 'NOT_PROVIDED';

  const rawDomain = normalizeEnum(raw.domain ?? raw.safety_domain, SAFETY_DOMAINS, DOMAIN_ALIASES);
  const extDomain = normalizeEnum(ext.domain ?? ext.safety_domain, SAFETY_DOMAINS, DOMAIN_ALIASES);
  const domainValue = rawDomain ?? extDomain ?? null;
  const domainProvenance = rawDomain ? 'RECORD_EXPLICIT' : extDomain ? 'ADAPTER_SUPPLIED' : 'UNKNOWN';

  const rawFuel = normalizeEnum(raw.fuel_type ?? raw.material_class, FUEL_TYPES, FUEL_ALIASES);
  const extFuel = normalizeEnum(ext.fuel_type ?? ext.material_class, FUEL_TYPES, FUEL_ALIASES);
  const fuelValue = rawFuel ?? extFuel ?? null;
  const fuelProvenance = rawFuel ? 'RECORD_EXPLICIT' : extFuel ? 'ADAPTER_SUPPLIED' : 'UNKNOWN';

  const rawEnv = normalizeEnum(raw.environment ?? raw.environment_type ?? raw.gravity ?? raw.gravity_regime, ENVIRONMENTS, ENV_ALIASES);
  const extEnv = normalizeEnum(ext.environment ?? ext.environment_type ?? ext.gravity ?? ext.gravity_regime, ENVIRONMENTS, ENV_ALIASES);
  const modelEnv = !rawEnv && !extEnv && (record.claim_type === 'MODEL_RESULT' || record.parameters?.some(p => p.location === 'simulation_domain'))
    ? 'GROUND_CFD'
    : null;
  const envValue = rawEnv ?? extEnv ?? modelEnv ?? null;
  const envProvenance = rawEnv ? 'RECORD_EXPLICIT' : extEnv ? 'ADAPTER_SUPPLIED' : modelEnv ? 'PARAMETER_DERIVED' : 'UNKNOWN';

  // Unit families: derived from measured Z01 parameters plus any explicit declarations
  const unitFamilies = new Set();
  const unitFamilySources = new Set();
  const widthParam = getParam(record, 'sample_width');
  const flowParam = getParam(record, 'flow_velocity');
  const o2Param = getParam(record, 'o2_concentration');

  if (widthParam && widthParam.status === 'MEASURED') {
    unitFamilies.add('FAMILY_A_FLAME_METRICS');
    unitFamilySources.add('PARAMETER_DERIVED');
  }
  if ((flowParam && flowParam.status === 'MEASURED') || (o2Param && o2Param.status === 'MEASURED')) {
    unitFamilies.add('FAMILY_B_ATMOS_THERMO');
    unitFamilySources.add('PARAMETER_DERIVED');
  }

  const rawFamilies = [raw.unit_family, raw.unit_family_id, ...(Array.isArray(raw.unit_families) ? raw.unit_families : [])]
    .flatMap(v => (typeof v === 'string' ? v.split(/[;,|]/) : []))
    .map(v => normalizeEnum(v, UNIT_FAMILIES, UNIT_FAMILY_ALIASES))
    .filter(Boolean);
  for (const f of rawFamilies) {
    unitFamilies.add(f);
    unitFamilySources.add('RECORD_EXPLICIT');
  }

  const extFamilies = [ext.unit_family, ext.unit_family_id, ...(Array.isArray(ext.unit_families) ? ext.unit_families : [])]
    .flatMap(v => (typeof v === 'string' ? v.split(/[;,|]/) : [v]))
    .map(v => normalizeEnum(v, UNIT_FAMILIES, UNIT_FAMILY_ALIASES))
    .filter(Boolean);
  for (const f of extFamilies) {
    unitFamilies.add(f);
    unitFamilySources.add('ADAPTER_SUPPLIED');
  }

  const hasBurnerFlowO2 = Boolean(o2Param && o2Param.location === 'burner_flow');
  const isProxyOrModel = Boolean(
    record.claim_type === 'MODEL_RESULT' ||
    envValue === 'FLIGHT_PROXY_0G' ||
    envValue === 'GROUND_CFD' ||
    domainValue === 'GAS_EMULATION' ||
    domainValue === 'CFD_MODELING' ||
    raw.is_proxy === true ||
    raw.is_proxy === 'true' ||
    ext.is_proxy === true
  );

  return freeze({
    study_id: record.study_id,
    trial_id: record.trial_id,
    material: {
      value: materialValue,
      status: materialStatus,
      provenance: materialValue ? (record.material ? 'RECORD_EXPLICIT' : 'ADAPTER_SUPPLIED') : 'UNKNOWN',
    },
    fuel_type: {
      value: fuelValue,
      status: fuelValue ? 'MEASURED' : 'NOT_PROVIDED',
      provenance: fuelProvenance,
    },
    domain: {
      value: domainValue,
      status: domainValue ? 'MEASURED' : 'NOT_PROVIDED',
      provenance: domainProvenance,
    },
    environment: {
      value: envValue,
      status: envValue ? 'MEASURED' : 'NOT_PROVIDED',
      provenance: envProvenance,
    },
    unit_families: {
      values: [...unitFamilies].sort(),
      status: unitFamilies.size > 0 ? 'MEASURED' : 'NOT_PROVIDED',
      provenance: unitFamilySources.has('RECORD_EXPLICIT')
        ? 'RECORD_EXPLICIT'
        : unitFamilySources.has('ADAPTER_SUPPLIED')
          ? 'ADAPTER_SUPPLIED'
          : unitFamilySources.has('PARAMETER_DERIVED')
            ? 'PARAMETER_DERIVED'
            : 'UNKNOWN',
    },
    oxygen: {
      status: o2Param?.status ?? 'NOT_PROVIDED',
      si_value: o2Param?.status === 'MEASURED' ? (o2Param.si?.values?.[0] ?? null) : null,
      si_unit: o2Param?.si?.unit ?? 'mol/mol',
      raw_display: o2Param?.raw_display ?? '',
      location: o2Param?.location && LOCATIONS.includes(o2Param.location) ? o2Param.location : 'NOT_PROVIDED',
    },
    flow_velocity: {
      status: flowParam?.status ?? 'NOT_PROVIDED',
      si_values: flowParam?.status === 'MEASURED' ? [...(flowParam.si?.values ?? [])] : [],
      si_unit: flowParam?.si?.unit ?? 'm/s',
      raw_display: flowParam?.raw_display ?? '',
      direction: flowParam?.direction ?? 'unknown',
      location: flowParam?.location && LOCATIONS.includes(flowParam.location) ? flowParam.location : 'NOT_PROVIDED',
    },
    sample_width: {
      status: widthParam?.status ?? 'NOT_PROVIDED',
      si_value: widthParam?.status === 'MEASURED' ? (widthParam.si?.values?.[0] ?? null) : null,
      si_unit: widthParam?.si?.unit ?? 'm',
      raw_display: widthParam?.raw_display ?? '',
      location: widthParam?.location && LOCATIONS.includes(widthParam.location) ? widthParam.location : 'NOT_PROVIDED',
    },
    sample_history: {
      value: record.sample_history?.value ?? null,
      status: record.sample_history?.status && MISSING_STATES.includes(record.sample_history.status)
        ? record.sample_history.status
        : 'NOT_PROVIDED',
    },
    claim_type: record.claim_type ?? 'OBSERVATION',
    has_burner_flow_o2: hasBurnerFlowO2,
    is_proxy_or_model: isProxyOrModel,
  });
}
