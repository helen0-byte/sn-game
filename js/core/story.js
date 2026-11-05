/* Движок сюжета: части, экраны, выборы, концовки, меню.
   Часть описывается в js/parts/pN_*.js через SN.part({...}). Формат — в docs/КАК_ПИСАТЬ_ЧАСТЬ.md. */
(function(){
"use strict";
const SN=window.SN=window.SN||{};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const PARTS={};          // id -> определение части (когда файл загружен)
let S=null,P=null,part=null,pendingPre=null,busy=false;

function definePart(def){PARTS[def.id]=def;validate(def)}

/* проверки, которые ловят нарушения правил ещё при разработке */
function validate(def){
  for(const [id,n] of Object.entries(def.nodes||{})){
    if(typeof n.ch!=="function"&&n.ch){
      if(n.ch.length&&n.ch.every(c=>c.struck)) console.error(`[SN] ${def.id}/${id}: все строки зачёркнуты, выхода нет`);
      n.ch.forEach(c=>{
        if(c.to&&!c.to.startsWith("E:")&&!def.nodes[c.to]) console.error(`[SN] ${def.id}/${id}: нет экрана ${c.to}`);
        if(c.to&&c.to.startsWith("E:")&&!(def.endings||{})[c.to.slice(2)]) console.error(`[SN] ${def.id}/${id}: нет концовки ${c.to}`);
        if(/умереть|вылечиться|перестать нуждаться/i.test(c.t||"")) console.error(`[SN] ${def.id}/${id}: такой кнопки в игре быть не должно: «${c.t}»`);
      });
    }
  }
  for(const [k,e] of Object.entries(def.endings||{})) if(e.death&&!e.fallback) console.error(`[SN] ${def.id}: смертельной концовке ${k} нужен fallback (на случай, если пришла нить)`);
}

/* ---------- запуск части ---------- */
function loadPart(meta){
  if(PARTS[meta.id]) return Promise.resolve(PARTS[meta.id]);
  return new Promise((res,rej)=>{const s=document.createElement("script");s.src=meta.file+"?v="+(SN.VERSION||"");s.onload=()=>PARTS[meta.id]?res(PARTS[meta.id]):rej(new Error("файл не зарегистрировал часть"));s.onerror=rej;document.head.appendChild(s)});
}
function start(id){
  const meta=SN.PARTS.find(p=>p.id===id);if(!meta)return menu();
  if(meta.href){location.href=meta.href;return}
  SN.audio.init();
  loadPart(meta).then(def=>{
    part=def;P=SN.profile.load();
    S=SN.state.newState(P.carry);S.part=def.id;
    if(def.onStart) def.onStart(S,P);
    history.replaceState(null,"","#"+id);
    go(def.start);
  }).catch(e=>{console.error(e);sheetHTML(`<p>Не получилось загрузить часть.</p><div class="row"><button class="ghost" id="menu">В начало</button></div>`);$("menu").onclick=menu});
}

/* ---------- экран ---------- */
function sheetHTML(h){$("sheet").innerHTML=h;$("panelWrap").scrollTop=0}
async function go(id){
  if(id.startsWith("E:")) return ending(id.slice(2));
  const n=part.nodes[id];if(!n){console.error("[SN] нет экрана",id);return}
  S.node=id;S.hist.push(id);
  if(n.mood!==undefined||SN.fx.mood_) await SN.fx.mood(n.mood||null);
  if(n.music!==undefined) SN.audio.music(n.music);
  if(n.shot) SN.stage.setShot(n.shot);
  if(n.pose) for(const k in n.pose) SN.stage.setPose(k,n.pose[k]);
  if(n.face) for(const k in n.face) SN.stage.setFace(k,n.face[k]);
  if(n.place!==undefined) $("place").textContent=n.place;
  const paras=(typeof n.text==="function"?n.text(S,P):n.text||[]).filter(Boolean);
  let h="";
  if(pendingPre){h+=`<p class="pre">${esc(pendingPre)}</p>`;pendingPre=null}
  h+=paras.map(p=>`<p>${esc(p)}</p>`).join("");
  h+=`<div class="choices" id="ch"></div>`;
  sheetHTML(h);
  const list=(typeof n.ch==="function"?n.ch(S,P):n.ch||[]).filter(c=>SN.state.open(c.when,S,P));
  renderChoices($("ch"),list);
}
function mkBtn(k,t){const b=document.createElement("button");b.className="opt";b.dataset.k=k;b.textContent=t;return b}
function renderChoices(box,list){
  list.forEach((c,i)=>{
    const b=mkBtn(String.fromCharCode(1040+i),c.t);
    if(c.lock&&!SN.state.open(c.lock,S,P)){b.classList.add("locked");b.setAttribute("aria-disabled","true");b.onclick=()=>SN.stage.flinch("naruto")}
    else if(c.struck){b.classList.add("struck");b.onclick=()=>restrike(c,b)}
    else b.onclick=()=>choose(c,b,box);
    box.appendChild(b);
  });
  const f=box.querySelector(".opt:not(.struck):not(.locked)");if(f&&matchMedia("(min-width:900px)").matches)f.focus({preventScroll:true});
}
/* зачёркнутая строка: жать можно сколько угодно, она зачёркивается заново, Наруто не двигается */
function restrike(c,b){
  b.classList.remove("restrike");void b.offsetWidth;b.classList.add("restrike");
  SN.stage.flinch("naruto",c.flinch);
  if(c.fx&&!c.fxOnce){/* зачёркнутое ничего не считает */}
}
async function choose(c,b,box){
  if(busy) return;busy=true;
  box.querySelectorAll(".opt").forEach(x=>x.disabled=true);
  SN.state.applyFx(S,c);
  pendingPre=c.pre||null;
  if(c.body){                               /* тело делает своё */
    b.classList.add("glow");
    await SN.stage.ghost(c.body.who||"naruto",c.body.ghost,c.body.body,c.body.ms);
  } else {
    b.classList.add("picked");await SN.fx.wait(260);
  }
  if(c.effect){
    const o=Object.assign({},c.effectOpt||{});
    await SN.fx[c.effect](o);
    if(c.effect==="blackout"&&!pendingPre) pendingPre=o.after||"Через час.";
    if(c.effect==="harm"&&!pendingPre) pendingPre=o.after||"После.";
  }
  busy=false;
  go(c.to);
}

/* ---------- концовка ---------- */
function times(n){if(!n)return "ни разу";const a=n%10,b=n%100;return n+" "+((a>=2&&a<=4&&(b<12||b>14))?"раза":"раз")}
async function ending(key){
  let E=part.endings[key];
  /* смертельная концовка только если не пришла ни одна нить */
  if(E.death&&SN.state.anyThread(S)){key=E.fallback;E=part.endings[key]}
  await SN.fx.mood(E.mood||null);
  const loops=P.loops[part.id]=(P.loops[part.id]|0)+(E.canon?1:0);
  if(E.loopTo&&loops>=(E.loopAfter||3)){key=E.loopTo;E=part.endings[key]}
  const T=typeof E.text==="function"?E.text(S,P):(E.text||[]);
  if(E.shot) SN.stage.setShot(E.shot);
  if(E.pose) for(const k in E.pose) SN.stage.setPose(k,E.pose[k]);
  /* сохранение */
  if(!part.noSave){
    P.done[part.id]={end:key};P.carry=SN.state.carryOut(S);P.endings[part.id+":"+key]=1;
    SN.profile.save(P);
  }
  const code=SN.profile.toCode(P);
  const pre=pendingPre?`<p class="pre">${esc(pendingPre)}</p>`:"";pendingPre=null;
  const log=Object.entries(part.endings).map(([k,e])=>P.endings[part.id+":"+k]?`<li class="got">${esc(e.title)}</li>`:`<li class="no">${e.secret?"скрытая концовка":"???"}</li>`).join("");
  const next=SN.PARTS.find(p=>p.n===part.n+1);
  const nextOpen=!part.noSave&&next&&(next.file||next.href)&&(!next.requires||next.requires(P));
  sheetHTML(`${pre}
   <p class="hand">концовка</p>
   <h2 class="endtitle">${esc(E.title)}</h2>
   <span class="tag ${E.canon?"canon":"alt"}">${E.canon?"так было в фике":"этого в фике не было"}</span>
   ${T.map(p=>`<p>${esc(p)}</p>`).join("")}
   <ul class="log">${log}</ul>
   ${part.noSave?"":`<div class="savebox"><p style="font-size:13px;margin:0 0 6px"><b>Твой путь сохранён.</b> Следующая часть сама подхватит его на этом устройстве. Для другого устройства вот код:</p>
   <code id="code">${code}</code><button class="ghost" id="copy" style="margin-top:8px">Скопировать код</button></div>`}
   <div class="row">${nextOpen?`<button class="ghost" id="next">Дальше: ${esc(next.title)}</button>`:""}<button class="ghost" id="again">Сыграть ещё раз</button><button class="ghost" id="menu">Ко всем частям</button></div>`);
  if(nextOpen) $("next").onclick=()=>start(next.id);
  $("again").onclick=()=>start(part.id);
  $("menu").onclick=menu;
  const cb=$("copy");if(cb)cb.onclick=()=>{
    const sel=()=>{const r=document.createRange();r.selectNodeContents($("code"));const s=getSelection();s.removeAllRanges();s.addRange(r);cb.textContent="Код выделен, скопируй его"};
    try{navigator.clipboard.writeText(code).then(()=>cb.textContent="Скопировано",sel)}catch(e){sel()}
  };
}

/* ---------- меню частей ---------- */
function menu(){
  SN.fx.mood(null);busy=false;
  history.replaceState(null,"",location.pathname+location.search);
  SN.stage.setShot("menu");$("place").textContent="";
  /* заглавная тема: браузер даст звук только после первого нажатия */
  const theme=()=>{SN.audio.init();SN.audio.music((SN.audio.musicList&&SN.audio.musicList.theme)||"louis_xiv")};
  theme();addEventListener("pointerdown",theme,{once:true});
  P=SN.profile.load();
  const all=/[?&]all\b/.test(location.search);
  const items=SN.PARTS.filter(p=>!p.hidden).map(p=>{
    const ready=!!(p.file||p.href);
    const open=ready&&(all||!p.requires||p.requires(P));
    const done=P.done[p.id];
    const sub=!ready?(p.note||"в работе"):!open?(p.lockNote||"откроется после прошлой части"):done?"пройдено":"";
    return `<li><button class="opt${open?"":" soon"}" data-k="${p.n}" data-id="${p.id}" ${open?"":"aria-disabled=\"true\""}>«${esc(p.title)}»<small>${esc(p.sub||"")}${sub?" · "+esc(sub):""}</small></button></li>`;
  }).join("");
  sheetHTML(`
   <div class="ransom"><span class="r1">ВЫЖИВИ</span><span class="r3">в теле</span><span class="r2">НАРУТО</span></div>
   <p>Ты Наруто. По мотивам фанфика S&nbsp;&amp;&nbsp;N.</p>
   <p class="warn"><b>18+</b><span>В игре есть самоповреждения, насилие, наркотики и алкоголь. Без подробностей, но тяжело.</span></p>
   <ul class="parts">${items}</ul>
   <div class="codein"><input id="codein" placeholder="Есть код SN-…? Вставь сюда" aria-label="Код сохранения"><button class="ghost" id="codego">Загрузить</button></div>
   <p class="msg" id="msg"></p>
   <div class="row"><button class="ghost" id="demo">Витрина эффектов</button></div>`);
  document.querySelectorAll(".parts .opt").forEach(b=>{if(!b.classList.contains("soon"))b.onclick=()=>start(b.dataset.id)});
  $("demo").onclick=()=>start("demo");
  $("codego").onclick=()=>{
    try{const p=SN.profile.fromCode($("codein").value);SN.profile.save(p);
      /* пролог читает свой ключ: отдаём ему его часть */
      if(p.done.p1) SN.store.set("save",{v:1,part:"prolog",end:p.done.p1.end,warm:p.carry.c.warm|0,truth:p.carry.c.truth|0,own:p.carry.c.own|0,fire:p.carry.f.fire?1:0,age15:p.carry.f.age15?1:0,saidNo:p.carry.f.saidNo?1:0,loops:p.loops.p1|0});
      $("msg").textContent="Путь загружен.";setTimeout(menu,600)}
    catch(e){$("msg").textContent="Код не читается. Проверь, что он скопирован целиком."}
  };
}

/* меню-сцена: Наруто один в пустоте */
SN.stage.defineShot("menu",{env:"void",cast:{naruto:[0,0,.25,"stand"]},cam:[.4,1.4,3.2],look:[0,1.1,0],face:"neutral",shiver:1});

function boot(){
  SN.stage.init($("stage"));
  const h=location.hash.slice(1);
  if(h&&SN.PARTS.find(p=>p.id===h)){menu();start(h)}else menu();
}
SN.part=definePart;SN.story={start,menu,boot,get S(){return S},get P(){return P},go};
})();
