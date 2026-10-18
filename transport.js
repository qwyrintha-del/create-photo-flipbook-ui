(() => {
 const configPath='album-config-20261018f.json';
 const completed=new Map();let cachedHash=null;
 const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
 const error=(stage,reason)=>Object.assign(new Error(reason),{stage,reason});
 async function request(path,kind,stage,verify){
  let failure;
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),stage==='目录'?15000:30000);
   try{
    const response=await fetch(path,{cache:stage==='目录'||attempt?'no-store':'force-cache',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response.ok)throw error(stage,'HTTP'+response.status);
    const value=kind==='json'?await response.json():new Uint8Array(await response.arrayBuffer());
    if(verify)await verify(value);
    return value;
   }catch(cause){
    failure=cause.stage?cause:error(stage,cause.name==='AbortError'?'TIMEOUT':cause instanceof SyntaxError?'FORMAT':'FETCH');
   }finally{clearTimeout(timeout)}
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
  }
  throw failure;
 }
 function validate(config){
  if(config.version!==2||config.format!=='album-json'||config.iterations!==600000||
     !/^album-[a-f0-9]{16}\.enc$/.test(config.payload)||!validHash(config.sha256)||
     !Number.isInteger(config.bytes)||config.bytes<1000||config.bytes>40000000||
     !Array.isArray(config.parts)||config.parts.length<1||config.parts.length>220||
     config.parts.some(p=>!/^chunks\/part-[a-f0-9]{16}\.bin$/.test(p.path)||!validHash(p.sha256)||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>196608)||
     config.parts.reduce((sum,p)=>sum+p.bytes,0)!==config.bytes)throw error('目录','FORMAT');
 }
 window.albumTransport={async load(onProgress){
  const config=await request(configPath,'json','目录',validate);
  if(cachedHash!==config.sha256){completed.clear();cachedHash=config.sha256}
  const report=()=>onProgress(Array.from(completed.values()).reduce((sum,p)=>sum+p.length,0),config.bytes);
  report();let cursor=0,failure=null;
  async function worker(){
   while(cursor<config.parts.length&&!failure){
    const part=config.parts[cursor++];if(completed.has(part.path))continue;
    try{
     const data=await request(part.path,'bytes','照片',async value=>{
      if(value.length!==part.bytes)throw error('照片','SIZE');
      if(await digest(value)!==part.sha256)throw error('照片','HASH');
     });
     completed.set(part.path,data);report();
    }catch(cause){failure=cause}
   }
  }
  // Finish in-flight requests before allowing a retry; completed chunks are reused.
  await Promise.all([worker(),worker(),worker()]);
  if(failure)throw failure;
  const data=new Uint8Array(config.bytes);let offset=0;
  for(const part of config.parts){data.set(completed.get(part.path),offset);offset+=part.bytes}
  if(await digest(data)!==config.sha256){completed.clear();throw error('校验','HASH')}
  completed.clear();return {config,data};
 }};
})();
