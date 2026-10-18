const form=document.querySelector('#unlock-form');
const input=document.querySelector('#password');
const status=document.querySelector('#status');
const button=document.querySelector('#unlock');
const progress=document.querySelector('#progress');
const gate=document.querySelector('#gate');
const reader=document.querySelector('#reader');
const loading=document.querySelector('#reader-loading');
let encryptedBytes=null,config=null,busy=false,generation=0,payloadTask=null,phase='目录';
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const normalize=value=>value.toUpperCase().replace(/[\s-]/g,'');
function say(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
const reveal=document.querySelector('#reveal');
reveal.addEventListener('click',()=>{
 const show=input.type==='password';input.type=show?'text':'password';
 reveal.textContent=show?'隐藏':'显示';reveal.setAttribute('aria-label',show?'隐藏密码':'显示密码');reveal.setAttribute('aria-pressed',String(show));
});
function conceal(){input.type='password';reveal.textContent='显示';reveal.setAttribute('aria-label','显示密码');reveal.setAttribute('aria-pressed','false')}

async function loadPayload(){
 if(payloadTask)return payloadTask;
 if(encryptedBytes&&config)return;
 payloadTask=fetchPayload().finally(()=>{payloadTask=null});
 return payloadTask;
}
async function fetchPayload(){
 phase='目录';
 progress.hidden=false;progress.value=0;
 const result=await window.albumTransport.load((loaded,total)=>{
  phase='照片';progress.value=Math.min(100,loaded/total*100);
  say((busy?'正在载入相册… ':'正在提前载入相册… ')+Math.round(progress.value)+'%');
 });
 config=result.config;encryptedBytes=result.data;
}
function showFailure(error){
 const stage=error.stage||phase;
 const code=error.reason||error.message;
 const detail=['FORMAT','SIZE','HASH','TIMEOUT','FETCH'].includes(code)||/^HTTP\d{3}$/.test(code)?code:'BROWSER';
 const marker='（F/'+stage+'/'+detail+'）';
 if(stage==='目录')say('相册目录未能载入，请稍后重试或用 Safari 打开。'+marker,true);
 else if(stage==='照片'||stage==='校验')say('照片未载入完整，已保留成功的部分；再次点击“打开相册”继续。'+marker,true);
 else if(stage==='解锁')say('浏览器未能完成解锁，请用 Safari 或 Chrome 打开。'+marker,true);
 else say('书页未能显示，请用 Safari 或 Chrome 打开。'+marker,true);
}

// Use password-entry time to fetch ciphertext, without storing or sending the password.
input.addEventListener('focus',()=>{
 if(!window.crypto?.subtle)return;
 loadPayload().then(()=>{
  if(!busy){say('相册已备好，输入密码就可以打开。');progress.hidden=true}
 }).catch(error=>{
  if(!busy){encryptedBytes=null;config=null;progress.hidden=true;showFailure(error)}
 });
},{once:true});

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
 if(!window.albumReader||!window.albumTransport){say('阅读器未加载完整，请刷新后重试，或在系统浏览器打开。',true);return}
 const password=normalize(input.value);if(!password){say('请输入访问密码。',true);return}
 const requestId=++generation;
 busy=true;button.disabled=true;say('正在准备相册…');
 window.albumMusic?.prepare();
 try{
  await loadPayload();phase='解锁';say('正在解锁…');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let plain;
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(config.iv),additionalData:new TextEncoder().encode(config.aad)},key,encryptedBytes)}
  catch{say('密码不正确，请核对后再试。',true);return}
  phase='书页';const data=JSON.parse(new TextDecoder().decode(plain));
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
  if(error.stage){encryptedBytes=null;config=null}
  showFailure(error);
 }finally{busy=false;button.disabled=false;progress.hidden=true}
});
document.querySelector('#lock').addEventListener('click',closeReader);
if(/aweme|douyin|bytedance/i.test(navigator.userAgent)||new URLSearchParams(location.search).has('from'))document.querySelector('#in-app-note').hidden=false;
