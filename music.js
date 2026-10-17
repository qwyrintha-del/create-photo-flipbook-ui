// Original procedural ambient score. No external media requests or recordings.
(() => {
 let ctx=null,master=null,timer=null,active=false,nextTime=0,step=0;
 const notes=[60,64,67,71,62,66,69,74,59,62,67,69,57,60,64,67];
 const bass=[48,50,43,45];
 const control=document.querySelector('#music');
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
 control.addEventListener('click',()=>active?stop():start());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 window.addEventListener('pagehide',stop);
 window.albumMusic={prepare,start,stop,isPlaying:()=>active};update();
})();
