import { BASS_THREE } from '../data/index.js';
import { extractRow } from '../core/import.js';

const trials = BASS_THREE.rows.map(extractRow);
const fields = [
  ['sample_width', /\b(?:en(?:i|ini)?|width|kengligi)\b/i, 'Namuna eni', 'Sample width'],
  ['flow_velocity', /\b(?:havo\s+oqim\w*|oqim\w*|airflow|air\s*flow)\b/i, 'Havo oqimi', 'Airflow'],
  ['o2_concentration', /\b(?:o2|kislorod\w*|oxygen)\b/i, 'Kamera atmosferasidagi kislorod', 'Chamber-atmosphere oxygen'],
  ['outcome', /\b(?:natija\w*|outcome\w*|result\w*)\b/i, 'Kuzatilgan natija', 'Observed outcome'],
  ['sample_history', /\b(?:ishlatilgan\w*|sample\s+history|used|reused)\b/i, 'Namuna tarixi', 'Sample history'],
];
const outsideScope = /\b(?:oy\w*|moon|mars\w*|lunar|xavfsiz\w*|safety|safe|predict\w*|bashorat\w*|why|nega|sabab\w*|qalinlig\w*|thickness|bosim\w*|pressure)\b|\b0[.,](?:16|38)\s*g\b/i;
const outcomeUz = {Quenched:'Alanga so‘ngan (Quenched)','Blow-off':'Alanga uzilib ketgan (Blow-off)','Reused, ignited':'Qayta ishlatilgan namuna yongan (Reused, ignited)'};

export function localTrialAnswer(question, ids, language) {
  if (!ids.length || outsideScope.test(question)) return null;
  const requested = fields.filter(([, pattern]) => pattern.test(question));
  if (!requested.length) return null;
  const selected = ids.map(id => trials.find(trial =>
    trial.trial_id === id || trial.trial_id.split('-').at(-1) === id));
  if (selected.some(trial => !trial)) return null;
  const uz = language === 'uz';
  const evidence = [...new Set(selected)].map(trial => {
    const source = trial.sources[0];
    return {
      id:trial.trial_id, trial, sourceUrl:source.url,
      locator:`Table ${source.table} · PDF ${source.pdf_page} · ${source.row_id}`,
    };
  });
  const claims = evidence.map(({id,trial}) => {
    const values = requested.map(([field,,uzLabel,enLabel]) => {
      let value;
      if (field === 'outcome') value = uz ? outcomeUz[trial.outcome.raw_display] : trial.outcome.raw_display;
      else if (field === 'sample_history') {
        value = trial.sample_history.value === 'REUSED'
          ? uz ? 'Qayta ishlatilgan' : 'Reused'
          : uz ? 'Manbada ko‘rsatilmagan' : 'Not provided in the source';
      } else {
        const parameter = trial.parameters.find(item => item.param_key === field);
        if (parameter?.status === 'MEASURED') value = parameter.raw_display.replace(/\s+to\s+/gi,' → ');
      }
      return `${uz ? uzLabel : enLabel}: ${value || (uz ? 'Manbada ko‘rsatilmagan' : 'Not provided in the source')}`;
    });
    return {text:`${id} — ${values.join(' · ')}`,evidence_ids:[id]};
  });
  return {status:'ANSWERED',local:true,claims,evidence:evidence.map(({trial,...source})=>source)};
}
