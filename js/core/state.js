/* Счётчики, нити, флаги и замки.
   Счётчики игроку не показываются. Части меняют их через fx у выбора:
     fx:{warm:1, death:1, "t:sai":1}   — прибавить (t: — нить по человеку)
     set:{wantsLive:true}              — флаг
   Правила, зашитые в движок:
     · ложь Саске падает только признанием: fx:{lie:-1} работает лишь у выбора с confess:true;
     · смертельная концовка (death:true) открывается только если ни одна нить не пришла,
       иначе движок уводит в её fallback. */
(function(){
"use strict";
const SN=window.SN=window.SN||{};

const COUNTERS={
  warm:"тепло", truth:"правда", own:"своё",
  death:"тяга к смерти", lie:"ложь Саске", kurama:"интерес Курамы", blame:"чья вина"
};
const FLAGS={
  wantsLive:"хочет жить", saidAloud:"сказал вслух", hidan:"работал на Хидана", taught:"научил",
  gaaraFree:"Гаара отпущен", catechismNo:"катехизис отвергнут", fire:"пожар"
};
/* нити заводятся по человеку, когда часть впервые их трогает (t:sai, t:sasuke, …) */

function newState(carry){
  carry=carry||{};
  const S={c:{},t:Object.assign({},carry.t||{}),f:Object.assign({},carry.f||{}),node:null,part:null,hist:[]};
  Object.keys(COUNTERS).forEach(k=>S.c[k]=(carry.c&&carry.c[k])|0);
  return S;
}

function applyFx(S,choice){
  const fx=choice.fx||{};
  for(const k in fx){
    const v=fx[k];
    if(k.startsWith("t:")){const who=k.slice(2);S.t[who]=(S.t[who]|0)+v;continue}
    if(k==="lie"&&v<0&&!choice.confess){console.warn("[SN] ложь Саске падает только признанием «Я соврал»: нужен confess:true");continue}
    if(!(k in COUNTERS)){console.warn("[SN] неизвестный счётчик",k);continue}
    S.c[k]+=v;
  }
  if(choice.set) for(const k in choice.set){
    if(!(k in FLAGS)) console.info("[SN] флаг части:",k);
    S.f[k]=choice.set[k];
  }
}

/* пришла ли хоть одна нить */
function anyThread(S){return Object.values(S.t).some(v=>v>0)}

/* то, что уходит в следующую часть */
function carryOut(S){return {c:Object.assign({},S.c),t:Object.assign({},S.t),f:Object.assign({},S.f)}}

/* замок: функция (S, profile) => true/false */
function open(lock,S,P){if(!lock) return true;try{return !!lock(S,P)}catch(e){console.warn("[SN] замок упал",e);return false}}

SN.state={COUNTERS,FLAGS,newState,applyFx,anyThread,carryOut,open};
})();
