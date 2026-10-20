import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const origins = new Set(['https://researchflow-collabix.pages.dev','https://teamprojectcolla.netlify.app','http://localhost:5173']);
Deno.serve(async (req: Request) => {
 const origin=req.headers.get('Origin');
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'};
 if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return respond(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond(405,{error:'POST required'});
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return respond(401,{error:'Sign in required'});
 try {
  const url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  // Own authentication is mandatory because modern asymmetric JWTs do not use the legacy gateway verifier.
  const {data:identity,error:authError}=await caller.auth.getUser(authorization.slice(7));
  if(authError||!identity.user)return respond(401,{error:'Invalid or expired session'});
  const text=await req.text();if(text.length>2048)return respond(400,{error:'Invalid request'});
  const p=JSON.parse(text);const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(p.workspace_id)||!uuid.test(p.id))return respond(400,{error:'Invalid record identifier'});
  // Caller-scoped RPC checks dataset ACL, permission, retention and status; it logs issuance atomically.
  const {error:denied}=await caller.rpc('rf_operations',{action:'dataset_download',p:{workspace_id:p.workspace_id,id:p.id}});
  if(denied)return respond(403,{error:'Dataset access denied'});
  const {data:version,error}=await caller.from('rf_dataset_versions').select('path,name,external_url').eq('workspace_id',p.workspace_id).eq('id',p.id).single();
  if(error||!version)return respond(403,{error:'Dataset access denied'});
  if(version.external_url)return respond(200,{url:version.external_url,external:true,expires_in:null});
  // Service credential stays inside Supabase. Only the already-authorized DB path is signed.
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await admin.storage.from('researchflow-datasets').createSignedUrl(version.path,60,{download:version.name});
  if(signed.error||!signed.data)return respond(503,{error:'Secure download temporarily unavailable'});
  return respond(200,{url:signed.data.signedUrl,external:false,expires_in:60});
 }catch{return respond(400,{error:'Unable to authorize this download'});}
});
