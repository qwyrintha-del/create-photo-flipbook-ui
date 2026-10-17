// Original procedural ambient score. No external media requests or recordings.
(() => {
 let ctx=null,master=null,timer=null,active=false,effectsActive=true,nextTime=0,step=0;
 const notes=[60,64,67,71,62,66,69,74,59,62,67,69,57,60,64,67];
 const bass=[48,50,43,45];
 const control=document.querySelector('#music');
 const effectsControl=document.querySelector('#effects');
 function update(){control.textContent=active?'音乐：播放中':'音乐：关闭';control.setAttribute('aria-pressed',String(active))}
 function tone(midi,time,duration,gain){
  const freq=440*Math.pow(2,(midi-69)/12);
  for(const [multiple,amount] of [[1,1],[2,.18],[3,.04]]){
   const oscillator=ctx.createOscillator(),envelope=ctx.createGain();
   oscillator.type='sine';oscillator.frequency.value=freq*multiple;
   envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(gain*amount,time+.035);envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
   oscillator.connect(envelope);envelope.connect(master);oscillator.start(time);oscillator.stop(time+duration+.05);
  }
 }
 function schedule(){if(!active||!ctx)return;while(nextTime<ctx.currentTime+.5){
  tone(notes[step%notes.length],nextTime,2.8,.07);
  if(step%4===0)tone(bass[Math.floor(step/4)%bass.length],nextTime,4.2,.05);
  if(step%8===6)tone(notes[step%notes.length]+12,nextTime+.4,2.1,.02);
  nextTime+=.83;step++;
 }}
 function prepare(){try{if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx=new Audio();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination)}ctx.resume().catch(()=>{})}catch{ctx=null}}
 async function start(){prepare();if(!ctx)return;try{await ctx.resume();if(ctx.state!=='running')return;if(active)return;active=true;nextTime=ctx.currentTime+.05;step=0;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(.65,ctx.currentTime,.25);schedule();timer=setInterval(schedule,200);update()}catch{active=false;update()}}
 function stop(){active=false;if(timer)clearInterval(timer);timer=null;if(ctx&&master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.08)}update()}
 function playTurn(page){
  if(!effectsActive||!ctx||ctx.state!=='running'||document.hidden)return;
  const time=ctx.currentTime+.015;
  const noise=ctx.createBuffer(1,Math.round(ctx.sampleRate*.12),ctx.sampleRate);
  const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const rustle=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),volume=ctx.createGain();
  rustle.buffer=noise;filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.55;
  volume.gain.setValueAtTime(.0001,time);volume.gain.exponentialRampToValueAtTime(.035,time+.015);volume.gain.exponentialRampToValueAtTime(.0001,time+.12);
  rustle.connect(filter);filter.connect(volume);volume.connect(ctx.destination);rustle.start(time);rustle.stop(time+.13);
  if(page===0||page===15){
   for(const [offset,frequency] of [[.07,880],[.19,1174]]){
    const bell=ctx.createOscillator(),bellGain=ctx.createGain();bell.type='sine';bell.frequency.value=frequency;
    bellGain.gain.setValueAtTime(.0001,time+offset);bellGain.gain.exponentialRampToValueAtTime(.035,time+offset+.015);bellGain.gain.exponentialRampToValueAtTime(.0001,time+offset+.45);
    bell.connect(bellGain);bellGain.connect(ctx.destination);bell.start(time+offset);bell.stop(time+offset+.47);
   }
  }
 }
 control.addEventListener('click',()=>active?stop():start());
 effectsControl.addEventListener('click',()=>{effectsActive=!effectsActive;effectsControl.textContent=effectsActive?'音效：开启':'音效：关闭';effectsControl.setAttribute('aria-pressed',String(effectsActive))});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 window.addEventListener('pagehide',stop);
 window.albumMusic={prepare,start,stop,playTurn,isPlaying:()=>active,effectsEnabled:()=>effectsActive};update();
})();
