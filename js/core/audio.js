/* Звук без файлов: всё синтезируется WebAudio.
   Включается после первого нажатия (так требуют браузеры).
   Когда появятся настоящие звуки, их можно положить в sounds/ и играть через SN.audio.file(). */
(function(){
"use strict";
const SN=window.SN=window.SN||{};
let ctx=null,master=null,lp=null,noiseBuf=null;
const loops={};

function init(){
  if(ctx) {if(ctx.state==="suspended")ctx.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC) return;
  ctx=new AC();
  lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=20000;
  master=ctx.createGain();master.gain.value=.8;
  master.connect(lp);lp.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
}
const now=()=>ctx?ctx.currentTime:0;

/* ватный звук: героин, самоповреждение */
function muffle(on,ms){if(!ctx)return;lp.frequency.cancelScheduledValues(now());lp.frequency.setTargetAtTime(on?(typeof on==="number"?on:380):20000,now(),(ms||600)/3000)}

/* высокий писк провала памяти; обрывается на середине, без затухания */
function beep(ms){
  if(!ctx)return;
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(6200,now());o.frequency.linearRampToValueAtTime(7400,now()+ms/1000);
  g.gain.setValueAtTime(0,now());g.gain.linearRampToValueAtTime(.22,now()+ms/1000*.8);
  o.connect(g);g.connect(ctx.destination); /* мимо фильтра: писк режет всегда */
  o.start();o.stop(now()+ms/1000);
}

function thump(freq,vol,dest){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(freq,now());o.frequency.exponentialRampToValueAtTime(freq*.55,now()+.14);
  g.gain.setValueAtTime(vol,now());g.gain.exponentialRampToValueAtTime(.001,now()+.18);
  o.connect(g);g.connect(dest||ctx.destination);o.start();o.stop(now()+.2);
}

/* сердце (его) и стук в висках: короткие двойные удары */
function heart(bpm,vol){
  stop("heart");if(!ctx)return;
  const beat=()=>{thump(58,vol||.9);setTimeout(()=>thump(50,(vol||.9)*.7),140)};
  beat();loops.heart=setInterval(beat,60000/(bpm||70));
}
function temples(bpm){
  stop("temples");if(!ctx)return;
  const beat=()=>thump(90,.35);beat();loops.temples=setInterval(beat,60000/(bpm||88));
}

/* дыхание: шум через полосовой фильтр, громкость дышит */
function breath(rate,vol,freq){
  stop("breath");if(!ctx)return;
  const src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;
  const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=freq||700;bp.Q.value=.8;
  const g=ctx.createGain();g.gain.value=0;
  src.connect(bp);bp.connect(g);g.connect(ctx.destination);src.start();
  const per=60/(rate||14),v=vol||.25;let t=now();
  const sched=()=>{for(let i=0;i<4;i++){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+per*.35);g.gain.linearRampToValueAtTime(v*.15,t+per*.55);g.gain.linearRampToValueAtTime(v*.7,t+per*.75);g.gain.linearRampToValueAtTime(0,t+per);t+=per}};
  sched();const iv=setInterval(()=>{if(t-now()<per*2)sched()},per*1000);
  loops.breath={stop(){clearInterval(iv);try{src.stop()}catch(e){}}};
}

/* громкий резкий звук: конец героина */
function slam(){
  if(!ctx)return;
  const src=ctx.createBufferSource();src.buffer=noiseBuf;
  const g=ctx.createGain();g.gain.setValueAtTime(.9,now());g.gain.exponentialRampToValueAtTime(.001,now()+.9);
  src.connect(g);g.connect(ctx.destination);src.start();src.stop(now()+1);
  thump(42,1);
}

/* фон сцены, который можно приглушить (тишина вместо «глохнет», пока нет настоящих звуков) */
function hum(on){
  stop("hum");if(!ctx||!on)return;
  const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.value=on===true?62:on;g.gain.value=.03;
  o.connect(g);g.connect(master);o.start();loops.hum={stop(){try{o.stop()}catch(e){}}};
}

/* файл из sounds/, если когда-нибудь понадобится */
function file(url,vol){if(!ctx)return;fetch(url).then(r=>r.arrayBuffer()).then(b=>ctx.decodeAudioData(b)).then(buf=>{const s=ctx.createBufferSource();s.buffer=buf;const g=ctx.createGain();g.gain.value=vol==null?1:vol;s.connect(g);g.connect(master);s.start()}).catch(()=>{})}


/* музыка из audio/music (список в music.json). Идёт через общий фильтр: muffle глушит и её.
   music("ero") — кроссфейд на трек; music(null) — плавно в тишину; повтор того же id ничего не делает. */
const MUSIC_BASE="audio/music/";
let musicList=null,curMusic=null;
const musicReady=fetch(MUSIC_BASE+"music.json",{cache:"no-cache"}).then(r=>r.ok?r.json():{tracks:{}}).then(j=>musicList=j).catch(()=>musicList={tracks:{}});
function music(id,opt){
  opt=opt||{};const fade=(opt.fade==null?2.5:opt.fade);
  if(!ctx) return;
  if(id&&curMusic&&curMusic.id===id) return;
  if(curMusic){const old=curMusic;curMusic=null;old.g.gain.cancelScheduledValues(now());old.g.gain.setValueAtTime(old.g.gain.value,now());old.g.gain.linearRampToValueAtTime(0,now()+fade);setTimeout(()=>{old.el.pause();old.el.src=""},fade*1000+100)}
  if(!id) return;
  musicReady.then(()=>{
    const t=musicList.tracks&&musicList.tracks[id];if(!t){console.warn("[SN] нет трека",id);return}
    const el=new Audio(MUSIC_BASE+t.file);el.crossOrigin="anonymous";el.loop=opt.loop!=null?opt.loop:!!t.loop;el.preload="auto";
    const src=ctx.createMediaElementSource(el),g=ctx.createGain();g.gain.value=0;src.connect(g);g.connect(master);
    const vol=opt.vol==null?.55:opt.vol;
    const m={id,el,g};curMusic=m;
    el.play().then(()=>{g.gain.setValueAtTime(0,now());g.gain.linearRampToValueAtTime(vol,now()+fade)}).catch(e=>console.warn("[SN] музыка не играет",e));
    el.onended=()=>{if(curMusic===m){curMusic=null;if(opt.then)music(opt.then,opt)}};
  });
}

function stop(name){const l=loops[name];if(!l)return;if(typeof l==="number")clearInterval(l);else l.stop();delete loops[name]}
function stopAll(){Object.keys(loops).forEach(stop);music(null,{fade:.4})}

SN.audio={init,muffle,beep,heart,temples,breath,slam,hum,file,music,stop,stopAll,get music_(){return curMusic&&curMusic.id},get musicList(){return musicList}};
})();
