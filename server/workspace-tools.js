import { rankTrials } from '../src/atlas/core/index.js';
import { extractRow, reviewRecord } from '../src/atlas/core/import.js';
import { BASS_THREE } from '../src/atlas/data/index.js';
import { digest, failure } from './workspace-store.js';
import betaQuantile from '@stdlib/stats-base-dists-beta-quantile';

export const publicTrials=BASS_THREE.rows.map(row=>reviewRecord(extractRow(row)));
export const trialSnapshot=digest(JSON.stringify(BASS_THREE.rows));
export function syntheticEstimate({n,k,a,b}){
  if(![n,k].every(Number.isSafeInteger)||n<1||n>1_000_000||k<0||k>n||![a,b].every(x=>Number.isFinite(x)&&x>0&&x<=1_000_000)){
    throw failure(400,'INVALID_SYNTHETIC_INPUT');
  }
  const alpha=a+k,beta=b+n-k;
  return {status:'ESTIMATED',mode:'BAYESIAN_EVENT',method_version:'1',synthetic:true,unit:'probability',
    method:'Beta-binomial, equal-tailed 95% credible interval',n,k,
    prior:{alpha:a,beta:b},posterior:{alpha,beta},estimate:alpha/(alpha+beta),
    interval:[betaQuantile(.025,alpha,beta),betaQuantile(.975,alpha,beta)]};
}
const identity=record=>record.study_id+':'+record.trial_id;
export function compareTrials(ids) {
  if(!Array.isArray(ids)||ids.length<1||ids.length>3||new Set(ids).size!==ids.length)throw failure(400,'INVALID_TRIAL_SELECTION');
  const trials=ids.map(id=>publicTrials.find(record=>identity(record)===id));
  if(trials.some(record=>!record))throw failure(404,'TRIAL_NOT_FOUND');
  return {
    trials,rows:trials[0].parameters.map(parameter=>{
      const fields=trials.map(record=>record.parameters.find(p=>p.param_key===parameter.param_key));
      const status=fields.some(p=>!p||p.status!=='MEASURED')?'UNKNOWN':
        fields.some(p=>p.location!==parameter.location||p.si.unit!==parameter.si.unit)?'NOT_COMPARABLE':
          fields.every(p=>JSON.stringify(p.si.values)===JSON.stringify(parameter.si.values))?'EQUIVALENT':'DIFFERENT';
      return {field:parameter.param_key,status,values:fields.map(p=>p?.raw_display??null)};
    }),
    limitations:['Observational comparison. Outcomes do not isolate the effect of a single variable.'],
  };
}

export function runTool(definition) {
  if(definition.tool==='ranking'){
    const {results,weights,sensitivity}=rankTrials(publicTrials,definition.target,{
      weights:definition.weights,
      metadataAdapter:()=>({environment:'FLIGHT_0G',domain:'PREVENTION_SOLID',fuel_type:'SOLID_FABRIC'}),
    });
    const rows=results.map(item=>({
      id:identity(item.record),rank:item.rank,tier:item.tier,tier_reason:item.tier_reason,score:item.alignment_score_pct,
      criteria:item.components,checklist:item.checklist.items,sources:item.record.sources,
    }));
    if(definition.rank_mode==='MEASURED_PERFORMANCE')return {
      status:'INSUFFICIENT_EVIDENCE',method:'Measured-performance eligibility v1',results:[],
      limitations:['The connected records do not establish controlled, comparable material-performance outcomes.'],
    };
    const entity=definition.entity_type??'TRIAL';
    const aggregated=entity==='TRIAL'?rows:[...Map.groupBy(rows,row=>entity==='STUDY'?row.id.split(':')[0]:'SIBAL')]
      .map(([id,group],index)=>({...group[0],id,rank:index+1,contributing_trials:group.map(row=>row.id)}));
    return {status:'READY',method_version:'1',method:'Atlas tier-first alignment v1',aggregation:entity==='TRIAL'?'No pooling':'Highest applicable trial; tiers and scores are ordered before aggregation',
      entity_type:entity,rank_mode:'RESEARCH_USEFULNESS',weights,sensitivity,results:aggregated};
  }
  if(definition.tool==='estimation'){
    if(definition.synthetic)return syntheticEstimate(definition.synthetic);
    return {status:'NOT_ESTIMABLE',mode:'NONE',method_version:'1',synthetic:false,method:'Physical eligibility v1',estimate:null,interval:null,
      population:definition.target,independent_count:null,
      missing_requirements:['Defined sampling frame','Eligible independent outcomes','Matched target conditions or validated transfer model'],
      limitations:['The connected evidence does not establish an eligible sampling frame and independent outcomes for this target.'],
      next_measurement:'Define a target outcome and record independent burns under matched conditions.'};
  }
  if(definition.tool==='scenario'){
    const matching=publicTrials.filter(record=>definition.trials?.includes(identity(record)));
    return {status:'PARTIAL',method:'Conditional comparison v1',notice:'Research scenario with conditional applicability',
      observations:matching.map(record=>({trial:identity(record),outcome:record.outcome.raw_display,sources:record.sources})),
      scenarios:(definition.assumptions?.length?definition.assumptions:['Target conditions unspecified']).map((assumption,index)=>({
        id:'scenario-'+(index+1),title:assumption,assumptions:[assumption],assumption,probability:null,outcome:'Unresolved for the target conditions.',
        premise_evidence_ids:matching.flatMap(record=>record.sources.map(source=>source.source_ref_id)),
        contradictions:[],limitations:['The connected corpus has no validated probability model for this change.'],
        rationale:'Connected observations describe their own conditions. A matched target outcome is required.',
        next_measurement:'Repeat independent burns under the stated conditions, holding other factors fixed.',
      }))};
  }
  throw failure(400,'INVALID_TOOL');
}
