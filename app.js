const form=document.querySelector('#unlock-form');
const input=document.querySelector('#password');
const status=document.querySelector('#status');
const button=document.querySelector('#unlock');
const progress=document.querySelector('#progress');
const gate=document.querySelector('#gate');
const reader=document.querySelector('#reader');
const loading=document.querySelector('#reader-loading');
let encryptedBytes=null,config=null,busy=false,generation=0;
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const normalize=value=>value.toUpperCase().replace(/[\s-]/g,'');
function say(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
const reveal=document.querySelector('#reveal');
reveal.addEventListener('click',()=>{
 const show=input.type==='password';input.type=show?'text':'password';
 reveal.textContent=show?'隐藏':'显示';reveal.setAttribute('aria-label',show?'隐藏密码':'显示密码');reveal.setAttribute('aria-pressed',String(show));
});
function conceal(){input.type='password';reveal.textContent='显示';reveal.setAttribute('aria-label','显示密码');reveal.setAttribute('aria-pressed','false')}

async function fetchFile(path,cache){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),90000);
 try{
  const response=await fetch(path,{cache,credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
  if(!response.ok)throw new Error('NETWORK');
  return {response,release:()=>clearTimeout(timeout)};
 }catch(error){clearTimeout(timeout);throw error}
}
async function loadPayload(){
 if(encryptedBytes&&config)return;
 let result=await fetchFile('album-config.json','no-store');
 try{config=await result.response.json()}finally{result.release()}
 if(config.version!==2||config.format!=='album-json'||config.iterations!==600000||
    !/^album-[a-f0-9]{16}\.enc$/.test(config.payload)||!Number.isInteger(config.bytes)||
    config.bytes<1000||config.bytes>40000000||!/^[a-f0-9]{64}$/.test(config.sha256))throw new Error('FORMAT');
 result=await fetchFile(config.payload,'force-cache');
 progress.hidden=false;progress.value=0;
 try{
  const payload=result.response;
  if(payload.body&&typeof payload.body.getReader==='function'){
   const stream=payload.body.getReader();const chunks=[];let size=0;
   for(;;){
    const part=await stream.read();if(part.done)break;
    chunks.push(part.value);size+=part.value.length;
    if(size>config.bytes){await stream.cancel();throw new Error('NETWORK')}
    progress.value=Math.min(100,size/config.bytes*100);
    say('正在载入相册… '+Math.round(progress.value)+'%');
   }
   encryptedBytes=new Uint8Array(size);let offset=0;
   for(const chunk of chunks){encryptedBytes.set(chunk,offset);offset+=chunk.length}
  }else{encryptedBytes=new Uint8Array(await payload.arrayBuffer())}
 }finally{result.release()}
 if(encryptedBytes.length!==config.bytes){encryptedBytes=null;throw new Error('NETWORK')}
 const digest=await crypto.subtle.digest('SHA-256',encryptedBytes);
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(hex!==config.sha256){encryptedBytes=null;throw new Error('NETWORK')}
}

function closeReader(){
 generation++;
 window.albumMusic?.stop();
 window.albumReader?.destroy();
 reader.hidden=true;loading.hidden=true;gate.hidden=false;
 document.body.classList.remove('reading');
 input.value='';conceal();
 say('相册已关闭，再次打开需要输入密码。');
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 if(!window.crypto?.subtle){say('这个内置浏览器暂不支持解锁，请从右上角菜单选择“在浏览器打开”，使用 Safari 或 Chrome。',true);return}
 if(!window.albumReader){say('阅读器未加载完整，请刷新后重试，或在系统浏览器打开。',true);return}
 const password=normalize(input.value);if(!password){say('请输入访问密码。',true);return}
 const requestId=++generation;
 busy=true;button.disabled=true;say('正在准备相册…');
 window.albumMusic?.prepare();
 try{
  await loadPayload();say('正在解锁…');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let plain;
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(config.iv),additionalData:new TextEncoder().encode(config.aad)},key,encryptedBytes)}
  catch{say('密码不正确，请核对后再试。',true);return}
  const data=JSON.parse(new TextDecoder().decode(plain));
  if(requestId!==generation)return;
  input.value='';conceal();input.blur();
  gate.hidden=true;reader.hidden=false;loading.hidden=false;
  document.body.classList.add('reading');
  let timer;
  try{
   await Promise.race([window.albumReader.mount(data),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('READER')),20000)})]);
  }finally{clearTimeout(timer)}
  if(requestId!==generation)return;
  loading.hidden=true;
  window.albumMusic?.start();
 }catch(error){
  if(requestId!==generation)return;
  window.albumReader?.destroy();window.albumMusic?.stop();
  reader.hidden=true;loading.hidden=true;gate.hidden=false;document.body.classList.remove('reading');
  if(error.message==='FORMAT')say('页面版本已更新，请刷新链接后再打开。',true);
  else if(error.message==='IMAGE'||error.message==='READER')say('书页没有显示成功，请刷新重试，或从右上角选择“在浏览器打开”。',true);
  else{encryptedBytes=null;config=null;say('相册载入未完成，请检查网络后重试。',true)}
 }finally{busy=false;button.disabled=false;progress.hidden=true}
});
document.querySelector('#lock').addEventListener('click',closeReader);
if(/aweme|douyin|bytedance/i.test(navigator.userAgent)||new URLSearchParams(location.search).has('from'))document.querySelector('#in-app-note').hidden=false;
