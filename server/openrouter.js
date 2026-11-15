import Ajv from 'ajv';

export const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';
const schemas=new WeakMap();
const ajv=new Ajv({allowUnionTypes:true});
function validOutput(schema,value){
  if(!schemas.has(schema))schemas.set(schema,ajv.compile(schema));
  return schemas.get(schema)(value);
}

export function apiError(code, status) {
  return Object.assign(new Error(code), { status });
}

export function createOpenRouter({ key, model = DEFAULT_MODEL, dailyLimit = 100, ledger, dailyMicroUsd=100_000 } = {}) {
  let day='', calls=0, active=0;
  return {
    configured:Boolean(key),
    model,
    async complete({name,schema,instructions,input,signal,images=[]}) {
      if (!key) throw apiError('OPENROUTER_NOT_CONFIGURED',503);
      const today=new Date().toISOString().slice(0,10);
      if(today!==day){day=today;calls=0;}
      if(calls>=dailyLimit||active>=2) throw apiError('API_DEMO_LIMIT',429);
      if(model!==DEFAULT_MODEL&&ledger)throw apiError('MODEL_NOT_ALLOWLISTED',503);
      const started=performance.now();
      const content=JSON.stringify(input);
      if(Buffer.byteLength(content)+Buffer.byteLength(instructions)>24_000)throw apiError('AI_CONTEXT_LIMIT',400);
      if(images.length>3||images.some(url=>typeof url!=='string'||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)||url.length>11000000))throw apiError('INVALID_IMAGE_INPUT',400);
      const reservation=ledger?.reserve('application',12_000,dailyMicroUsd);
      calls++;active++;
      try {
        const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
          method:'POST',
          redirect:'error',
          headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'SKYFORGE Fire Atlas'},
          signal:signal?AbortSignal.any([signal,AbortSignal.timeout(22_000)]):AbortSignal.timeout(22_000),
          body:JSON.stringify({
            model, max_completion_tokens:650, temperature:0,
            provider:{require_parameters:true,max_price:{prompt:.25,completion:1.5}},
            response_format:{type:'json_schema',json_schema:{name,strict:true,schema}},
            messages:[{role:'system',content:instructions},{role:'user',content:images.length?[{type:'text',text:content},...images.map(url=>({type:'image_url',image_url:{url}}))]:content}],
          }),
        });
        if(!response.ok&&reservation)ledger.settle(reservation,0);
        if(response.status===401||response.status===403) throw apiError('OPENROUTER_AUTH',502);
        if(response.status===402) throw apiError('OPENROUTER_CREDIT',402);
        if(response.status===429) throw apiError('API_QUOTA',429);
        if(!response.ok) throw apiError('API_PROVIDER_FAILED',502);
        try {
          const payload=await response.json();
          const usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens','cost']
            .filter(field=>Number.isFinite(payload.usage?.[field])).map(field=>[field,payload.usage[field]]));
          if(reservation&&usage.cost>=0)ledger.settle(reservation,Math.ceil(usage.cost*1e6));
          const data=JSON.parse(payload.choices[0].message.content);
          if(!validOutput(schema,data))throw Error('INVALID_SCHEMA');
          return {data,model,usage,duration_ms:Math.round(performance.now()-started)};
        } catch { throw apiError('API_INVALID_RESPONSE',502); }
      } catch(error) {
        if(error.status)throw error;
        if(['AbortError','TimeoutError'].includes(error.name))throw apiError('UPSTREAM_TIMEOUT',504);
        throw apiError('API_PROVIDER_FAILED',502);
      } finally {active--;}
    },
  };
}
