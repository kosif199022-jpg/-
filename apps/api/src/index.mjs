import { runtimeConfig, authenticate } from './auth.mjs';
import { withClient, provisionedActor, assertOrgAccess } from './db.mjs';
import { postJournal } from './posting.mjs';
import { validateJournal } from '../../../packages/accounting/src/journal.mjs';
function json(body,status=200,ctx={requestId:'',correlationId:''}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','x-request-id':ctx.requestId,'x-correlation-id':ctx.correlationId}})}
function errorBody(code){return {error:{code}}}
function sameOrigin(request){const site=request.headers.get('sec-fetch-site');return !site||['same-origin','same-site','none'].includes(site)}
export default {async fetch(request,env){const requestId=crypto.randomUUID();const correlationId=request.headers.get('x-correlation-id')||crypto.randomUUID();const ctx={requestId,correlationId};const url=new URL(request.url);try{
  if(url.pathname==='/api/health') return json({status:'ok',service:'altareeq'},200,ctx);
  if(url.pathname==='/api/capabilities'&&request.method==='GET') return env.ASSETS.fetch(new Request(new URL('/capabilities.json',url),request));
  if(url.pathname==='/api/accounting/validate-journal'&&request.method==='POST') {if(!sameOrigin(request)) return json(errorBody('ORIGIN_NOT_ALLOWED'),403,ctx);const body=await request.json();const r=validateJournal(body);return json({valid:r.valid,debitMinor:r.debitMinor.toString(),creditMinor:r.creditMinor.toString(),errors:r.errors},r.valid?200:422,ctx);}
  if(url.pathname.match(/^\/api\/accounting\/journals\/[0-9a-f-]+\/post$/)&&request.method==='POST') {if(!sameOrigin(request)) return json(errorBody('ORIGIN_NOT_ALLOWED'),403,ctx);const config=runtimeConfig(env);const actor=await authenticate(request,config);const body=await request.json();const journalId=url.pathname.split('/')[4];const organizationId=String(body.organizationId||'');const idempotencyKey=String(request.headers.get('idempotency-key')||'');if(!organizationId||!idempotencyKey) return json(errorBody('VALIDATION_FAILED'),400,ctx);const result=await withClient(env,async client=>{const actorId=await provisionedActor(client,actor.subject);await assertOrgAccess(client,actorId,organizationId);return postJournal(client,{organizationId,journalId,actorId,idempotencyKey,requestId,correlationId});});return json(result,200,ctx);}
  if(url.pathname.startsWith('/api/')) return json(errorBody('API_ROUTE_NOT_FOUND'),404,ctx);
  return env.ASSETS.fetch(request);
}catch(e){const code=e instanceof Error?e.message:'INTERNAL_ERROR';const status=Number(e?.status)||500;return json(errorBody(code),status,ctx);}}
};
