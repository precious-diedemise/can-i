import {timingSafeEqual} from 'node:crypto';
import {runAssistant} from '../server/assistant.mjs';
const limits=new Map();
function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);}
export function createHandler({env=process.env,fetcher=fetch,clock=()=>Date.now()}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  const configured=!!env.OPENAI_API_KEY&&!!env.CAN_I_ACCESS_CODE&&!!env.OPENAI_MODEL;
  if(req.method==='GET')return send(200,{configured,codeRequired:true});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{error:'Use POST.'});}
  if(!configured)return send(503,{error:'AI is not connected yet. The owner needs to add the API settings in Vercel. Manual comparisons still work.'});
  const origin=req.headers.origin,host=req.headers.host;
  if(origin){try{if(new URL(origin).host!==host)return send(403,{error:'This request must come from the app.'});}catch{return send(403,{error:'Invalid origin.'});}}
  if(!equal(req.headers['x-can-i-code'],env.CAN_I_ACCESS_CODE))return send(401,{error:'Enter the pilot access code shared by the app owner.'});
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const now=clock(),slot=limits.get(ip)||{start:now,count:0};if(now-slot.start>60000){slot.start=now;slot.count=0;}if(++slot.count>8){res.setHeader('Retry-After','60');return send(429,{error:'Please wait a minute before sending another message.'});}limits.set(ip,slot);if(limits.size>5000)for(const [k,v] of limits)if(now-v.start>60000)limits.delete(k);
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||Buffer.byteLength(JSON.stringify(body))>100000)return send(413,{error:'This conversation is too long. Start a new chat.'});}catch{return send(400,{error:'Invalid request.'});}
  // Limit the entire multi-step turn; never expose upstream error bodies or log financial payloads.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
  try{
   const output=await runAssistant(body,async payload=>{
    const upstream=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({...payload,model:env.OPENAI_MODEL,reasoning:{effort:'low'}}),signal:controller.signal});
    if(!upstream.ok){const e=new Error(upstream.status===429?'The AI service is at its usage limit. Try later or ask the owner to check API billing.':'The AI connection failed. Ask the owner to check the API key and model setting.');e.upstream=true;throw e;}return upstream.json();
   });return send(200,output);
  }catch(error){return send(error.name==='AbortError'?504:error.upstream?502:400,{error:error.name==='AbortError'?'The response took too long. Try again with one question.':error.message});}finally{clearTimeout(timer);}
 };
}
export default createHandler();
