/* Хранилище и код сохранения.
   Всё лежит в localStorage с приставкой sn_game_ (как в прологе).
   Профиль игрока: какие части пройдены, чем кончились, что несётся дальше.
   Код SN-… — тот же профиль в base64, чтобы перенести на другое устройство. */
(function(){
"use strict";
const SN=window.SN=window.SN||{};
const PFX="sn_game_";

const store={
  get(k,d){try{const v=localStorage.getItem(PFX+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(PFX+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem(PFX+k)}catch(e){}}
};

/* base64 с поддержкой кириллицы; читает и обычный base64 пролога, и url-вариант */
function b64e(str){return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function b64d(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return decodeURIComponent(escape(atob(s)))}

/* профиль v2:
   { v:2,
     done:{ p0:{end:"…"}, p1:{end:"fire"}, … },   // чем кончилась каждая часть
     carry:{ c:{…счётчики}, t:{…нити}, f:{…флаги} }, // что переходит в следующую часть
     endings:{ "p1:fire":1, … },                   // найденные концовки
     loops:{ p1:3 } }                               // сколько раз дошёл до канона (для петли) */
function emptyProfile(){return {v:2,done:{},carry:{c:{},t:{},f:{}},endings:{},loops:{}}}

/* сохранение пролога (v1, ключ sn_game_save) переводится в v2 */
function fromV1(s){
  const p=emptyProfile();
  if(!s||s.part!=="prolog") return p;
  p.done.p1={end:s.end};
  p.carry.c={warm:s.warm|0,truth:s.truth|0,own:s.own|0};
  p.carry.f={fire:!!s.fire,age15:!!s.age15,saidNo:!!s.saidNo};
  p.endings["p1:"+s.end]=1;
  p.loops.p1=s.loops|0;
  return p;
}

const profile={
  load(){
    let p=store.get("profile",null);
    if(!p||p.v!==2){p=fromV1(store.get("save",null));}
    /* пролог живёт отдельной страницей и пишет только v1: подхватываем его свежий результат */
    const v1=store.get("save",null);
    if(v1&&v1.part==="prolog"){const m=fromV1(v1);p.done.p1=m.done.p1;Object.assign(p.endings,m.endings);p.loops.p1=m.loops.p1;
      if(!p.done.p2){p.carry.c=Object.assign({},p.carry.c,m.carry.c);p.carry.f=Object.assign({},p.carry.f,m.carry.f);}}
    return p;
  },
  save(p){store.set("profile",p)},
  reset(){store.del("profile");store.del("save");store.del("endings");store.del("loops")},
  toCode(p){return "SN-"+b64e(JSON.stringify(p))},
  fromCode(code){
    const raw=String(code||"").trim().replace(/^SN-/i,"");
    if(!raw) throw new Error("пустой код");
    const o=JSON.parse(b64d(raw));
    if(o.v===2) return Object.assign(emptyProfile(),o);
    if(o.v===1) return fromV1(o);
    throw new Error("незнакомый код");
  },
  empty:emptyProfile
};

SN.store=store;SN.profile=profile;
})();
