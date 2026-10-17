const form=document.querySelector('#unlock-form');
const input=document.querySelector('#password');
const status=document.querySelector('#status');
const button=document.querySelector('#unlock');
const progress=document.querySelector('#progress');
const frame=document.querySelector('#book-frame');
window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='private-album-page-turn')return;
 const page=Number(event.data.page);
 if(Number.isInteger(page)&&page>=0&&page<16)window.albumMusic.playTurn(page);
});
let encryptedBytes=null,config=null,blobUrl=null,busy=false;
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const normalize=value=>value.toUpperCase().replace(/[\s-]/g,'');
function say(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
document.querySelector('#reveal').addEventListener('click',event=>{const show=input.type==='password';input.type=show?'text':'password';event.currentTarget.textContent=show?'隐藏':'显示';event.currentTarget.setAttribute('aria-label',show?'隐藏密码':'显示密码');event.currentTarget.setAttribute('aria-pressed',String(show))});
async function loadPayload(){
 if(encryptedBytes&&config)return;
 const response=await fetch('album-config.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw new Error('NETWORK');
 config=await response.json();
 if(config.version!==1||config.compression!=='gzip'||config.iterations!==600000)throw new Error('FORMAT');
 const payload=await fetch('album.enc',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 if(!payload.ok)throw new Error('NETWORK');
 progress.hidden=false;
 if(payload.body){
  const reader=payload.body.getReader();const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;progress.value=Math.min(100,size/config.bytes*100);say(`正在载入相册… ${Math.round(progress.value)}%`)}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}encryptedBytes=result;
 }else{encryptedBytes=new Uint8Array(await payload.arrayBuffer())}
 if(encryptedBytes.length!==config.bytes){encryptedBytes=null;throw new Error('NETWORK')}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 if(!crypto.subtle||typeof DecompressionStream==='undefined'){say('请用较新版本的 Safari 或 Chrome 打开这个链接。',true);return}
 const password=normalize(input.value);if(!password){say('请输入访问密码。',true);return}
 busy=true;button.disabled=true;say('正在准备相册…');
 window.albumMusic.prepare();
 try{
  await loadPayload();say('正在解锁…');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let packed;
  try{packed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(config.iv),additionalData:new TextEncoder().encode(config.aad)},key,encryptedBytes)}catch{say('密码不正确，请核对后再试。',true);return}
  const html=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).blob();
  blobUrl=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  frame.src=blobUrl;input.value='';input.blur();
  document.querySelector('#gate').hidden=true;document.querySelector('#reader').hidden=false;
  window.albumMusic.start();
 }catch(error){say(error.message==='FORMAT'?'相册格式暂不支持，请联系分享者。':'相册载入未完成，请检查网络后重试。',true)}
 finally{busy=false;button.disabled=false;progress.hidden=true}
});
document.querySelector('#lock').addEventListener('click',()=>{
 window.albumMusic.stop();frame.src='about:blank';if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;
 document.querySelector('#reader').hidden=true;document.querySelector('#gate').hidden=false;
 say('相册已关闭，再次打开需要输入密码。');input.focus();
});

if(/aweme|douyin|bytedance/i.test(navigator.userAgent)||new URLSearchParams(location.search).has('from'))document.querySelector('#in-app-note').hidden=false;
