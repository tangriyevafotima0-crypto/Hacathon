export const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';

export function apiError(code, status) {
  return Object.assign(new Error(code), { status });
}

export function createOpenRouter({ key, model = DEFAULT_MODEL, dailyLimit = 100 } = {}) {
  let day='', calls=0, active=0;
  return {
    configured:Boolean(key),
    model,
    async complete({name,schema,instructions,input}) {
      if (!key) throw apiError('OPENROUTER_NOT_CONFIGURED',503);
      const today=new Date().toISOString().slice(0,10);
      if(today!==day){day=today;calls=0;}
      if(calls>=dailyLimit||active>=2) throw apiError('API_DEMO_LIMIT',429);
      const started=performance.now();
      calls++;active++;
      try {
        const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
          method:'POST',
          redirect:'error',
          headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'SKYFORGE Fire Atlas'},
          signal:AbortSignal.timeout(22_000),
          body:JSON.stringify({
            model, max_completion_tokens:650, temperature:0,
            provider:{require_parameters:true},
            response_format:{type:'json_schema',json_schema:{name,strict:true,schema}},
            messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(input)}],
          }),
        });
        if(response.status===401||response.status===403) throw apiError('OPENROUTER_AUTH',502);
        if(response.status===402) throw apiError('OPENROUTER_CREDIT',402);
        if(response.status===429) throw apiError('API_QUOTA',429);
        if(!response.ok) throw apiError('API_PROVIDER_FAILED',502);
        try {
          const payload=await response.json();
          const data=JSON.parse(payload.choices[0].message.content);
          const usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens','cost']
            .filter(field=>Number.isFinite(payload.usage?.[field])).map(field=>[field,payload.usage[field]]));
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
