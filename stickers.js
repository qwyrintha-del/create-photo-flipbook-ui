(() => {
 const stage=document.querySelector('#sticker-playground');
 const heartMarkup='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M31 55C24 48 7 36 7 22C7 6 27 6 32 20C40 6 58 11 57 25C56 37 39 51 31 55Z" fill="#ff8cba" stroke="#fffaf4" stroke-width="7" stroke-linejoin="round"/><path d="M17 20Q20 14 25 19" fill="none" stroke="#ffdce9" stroke-width="4" stroke-linecap="round"/></svg>';
 const svg=body=>'<svg viewBox="0 0 80 80" aria-hidden="true">'+body+'</svg>';
 const art={
  flower:'<img src="stickers/flower.png" alt="" draggable="false">',
  star:'<img src="stickers/star.png" alt="" draggable="false">',
  bubble:svg('<circle cx="40" cy="40" r="30" fill="#c6e9ff99" stroke="#fff" stroke-width="4"/><path d="M17 37Q19 18 35 17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M52 61Q64 54 64 40" fill="none" stroke="#ffacd7" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="41" r="2.5" fill="#496181"/><circle cx="48" cy="41" r="2.5" fill="#496181"/><path d="M36 49Q41 53 46 48" fill="none" stroke="#496181" stroke-width="2.5" stroke-linecap="round"/>'),
  moon:svg('<path d="M52 9C19 5 4 40 23 61C40 80 67 65 72 48C44 57 33 30 52 9Z" fill="#ffe6a0" stroke="#fffaf4" stroke-width="4"/><path d="M26 43Q30 48 34 43" fill="none" stroke="#76648d" stroke-width="3" stroke-linecap="round"/><ellipse cx="28" cy="51" rx="6" ry="3" fill="#ffacc6"/><path d="M62 15L65 23L74 26L65 29L62 38L59 29L50 26L59 23Z" fill="#c5b7f5" stroke="#fff" stroke-width="2"/>'),
  cloud:svg('<path d="M20 58C0 56 4 31 23 31C27 7 58 11 62 32C81 31 82 59 62 59Z" fill="#fff7fb" stroke="#b9d3ef" stroke-width="4"/><circle cx="31" cy="42" r="2.5" fill="#6a6c96"/><circle cx="49" cy="42" r="2.5" fill="#6a6c96"/><path d="M35 49Q40 54 45 49" fill="none" stroke="#6a6c96" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="23" cy="48" rx="5" ry="3" fill="#ffbbd1"/><ellipse cx="57" cy="48" rx="5" ry="3" fill="#ffbbd1"/>'),
  butterfly:svg('<path d="M39 36C17 0 0 25 21 44C1 62 28 80 40 49C54 80 79 61 59 43C82 22 62 2 41 36Z" fill="#dac4f8" stroke="#fff" stroke-width="4"/><path d="M39 35L42 56M38 34L32 24M42 34L49 23" fill="none" stroke="#8f79af" stroke-width="4" stroke-linecap="round"/><path d="M18 27L29 35M60 27L51 35" stroke="#ffb6d2" stroke-width="6" stroke-linecap="round"/>')
 };
 const kinds=['flower','bubble','moon','star','cloud','butterfly'];
 const labels=['小花','泡泡','月亮','星星','云朵','蝴蝶'];
 const timers=new Set();let mounted=false;
 function later(fn,delay){const id=setTimeout(()=>{timers.delete(id);if(mounted)fn()},delay);timers.add(id)}
 function reset(){
  for(const id of timers)clearTimeout(id);timers.clear();
  stage.querySelectorAll('.heart-burst').forEach(node=>node.remove());
  for(const button of stage.querySelectorAll('button')){button.hidden=false;button.disabled=false;button.classList.remove('is-popping')}
  window.albumMusic?.silenceEffects();
 }
 function pop(button){
  if(button.disabled||!mounted)return;
  button.disabled=true;button.classList.add('is-popping');
  window.albumMusic?.playPop();
  later(()=>{
   const burst=document.createElement('div');burst.className='heart-burst';burst.setAttribute('aria-hidden','true');
   // Buttons are centered at left with translateX(-50%).
   burst.style.left=button.offsetLeft+'px';
   burst.style.top=(button.offsetTop+button.offsetHeight/2)+'px';
   for(let i=0;i<9;i++){
    const heart=document.createElement('span');heart.className='burst-heart';heart.innerHTML=heartMarkup;
    const angle=i*Math.PI*2/9,range=36+(i%3)*13;
    heart.style.setProperty('--dx',Math.cos(angle)*range+'px');heart.style.setProperty('--dy',Math.sin(angle)*range+'px');
    heart.style.setProperty('--spin',(i%2?24:-28)+'deg');heart.style.setProperty('--size',(20+i%3*5)+'px');
    burst.appendChild(heart);
   }
   for(let i=0;i<6;i++){
    const spark=document.createElement('span');spark.className='burst-spark';
    const angle=i*Math.PI/3;spark.style.setProperty('--dx',Math.cos(angle)*58+'px');spark.style.setProperty('--dy',Math.sin(angle)*52+'px');burst.appendChild(spark);
   }
   stage.appendChild(burst);button.hidden=true;
   later(()=>{burst.classList.add('is-dissolving');window.albumMusic?.playSparkle()},620);
   later(()=>burst.remove(),1550);
   later(()=>{button.hidden=false;button.disabled=false;button.classList.remove('is-popping')},4800);
  },240);
 }
 window.albumStickers={heartMarkup,
  mount(){
   reset();mounted=true;stage.textContent='';
   kinds.forEach((kind,index)=>{
    const button=document.createElement('button');button.type='button';button.className='pop-sticker';
    button.dataset.kind=kind;button.dataset.side=index<3?'left':'right';button.style.top=[14,44,74][index%3]+'%';
    button.style.setProperty('--delay',(-index*.7)+'s');button.setAttribute('aria-label','点破'+labels[index]+'，变成小爱心');
    button.innerHTML='<span class="sticker-art">'+art[kind]+'</span>';
    button.addEventListener('click',()=>pop(button));stage.appendChild(button);
   });
  },
  destroy(){mounted=false;reset();stage.textContent=''}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
})();
