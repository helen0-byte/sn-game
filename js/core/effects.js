/* Экраны визуального языка (утверждено 05.11).
   Каждый эффект возвращает Promise: движок ждёт его конца и только потом показывает следующий экран.
   blackout  — провал памяти: белая вспышка до рези, высокий писк, обрыв на середине, сразу «через час»
   leave     — уход из тела: чёрный
   harm      — самоповреждение: тёмно-алый от краёв, звук глохнет, дыхание и стук в висках, потом «после»
               (если Наруто не помнит: remembers:false → белый вместо алого)
   choke     — изнасилование: щель на одной вещи, серый, его сердце и чужое дыхание, без курсора,
               пропустить нельзя, долго, потом обрыв. Тела не видно
   mood("heroin") / mood("gray") / mood("hunger") — состояния на несколько экранов; конец героина всегда разом;
               hunger — сильный голод: мрачное ч/б, фон сильнее плывёт (look.js) */
(function(){
"use strict";
const SN=window.SN=window.SN||{};
const A=()=>SN.audio;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let root=null;

function el(cls,parent){const d=document.createElement("div");d.className=cls;(parent||root).appendChild(d);return d}
function mount(){if(root)return;root=document.createElement("div");root.id="fx";root.setAttribute("aria-hidden","true");document.body.appendChild(root)}
function clear(){root.innerHTML=""}
function tween(node,prop,to,ms,ease){node.style.transition=`${prop} ${ms}ms ${ease||"linear"}`;void node.offsetWidth;node.style[prop]=to}

/* блокируем ввод на время эффекта; у удушья ещё и курсор */
let blockKeys=null;
function lockInput(cursor){
  document.body.classList.add("locked-input");if(cursor)document.body.classList.add("nocursor");
  blockKeys=e=>{e.preventDefault();e.stopPropagation()};
  addEventListener("keydown",blockKeys,true);
}
function unlockInput(){document.body.classList.remove("locked-input","nocursor");if(blockKeys)removeEventListener("keydown",blockKeys,true);blockKeys=null}

async function blackout(){
  mount();lockInput();
  const w=el("layer white");w.style.opacity=0;
  const planned=1800;A().beep(planned*.55);         /* писк обрывается на середине */
  tween(w,"opacity","1",planned*.5,"cubic-bezier(.6,0,1,1)");
  await wait(planned*.55);
  clear();unlockInput();                             /* разом, без затухания */
}

async function leave(o){
  o=o||{};mount();lockInput();
  const b=el("layer black");b.style.opacity=0;A().muffle(250,900);
  tween(b,"opacity","1",o.in||1800,"ease-in");await wait((o.in||1800)+(o.hold||2600));
  A().muffle(false);tween(b,"opacity","0",o.out||1200);await wait(o.out||1200);
  clear();unlockInput();
}

async function harm(o){
  o=o||{};
  if(o.remembers===false) return blackout();
  mount();lockInput();
  const c=el("layer crimson");c.style.opacity=0;
  A().muffle(220,1200);A().hum(false);A().breath(13,.22,520);A().temples(92);
  tween(c,"opacity","1",900);c.style.transform="scale(1.8)";void c.offsetWidth;
  tween(c,"transform","scale(.55)",o.ms||5200,"ease-in");
  await wait(o.ms||5200);
  const k=el("layer black");k.style.opacity=1;A().stop("breath");A().stop("temples");
  await wait(900);A().muffle(false);
  clear();unlockInput();
}

async function choke(o){
  o=o||{};const ms=o.ms||26000;mount();lockInput(true);
  const app=document.getElementById("app"),panel=document.getElementById("panelWrap"),cv=SN.stage.canvas;
  const st=document.getElementById("stage");
  panel.style.visibility="hidden";
  /* сцена во весь экран, камера на одну вещь */
  const prev={st:st.getAttribute("style")};
  st.style.cssText="position:fixed;inset:0;z-index:40";
  if(o.focus) SN.stage.focusOn(o.focus,o.dist);
  if(cv){cv.style.transition="filter 6s";cv.style.filter="grayscale(1) contrast(1.15) brightness(.85)"}
  const top=el("slit"),bot=el("slit");[top,bot].forEach(s=>{s.style.opacity=1;s.style.transition=`height ${ms*.6}ms cubic-bezier(.3,0,.2,1)`});
  top.style.cssText+=";top:0;bottom:auto;height:0";bot.style.cssText+=";bottom:0;top:auto;height:0";
  void top.offsetWidth;top.style.height="calc(50% - 9px)";bot.style.height="calc(50% - 9px)";
  A().muffle(900,800);A().heart(108,.9);A().breath(22,.3,380);
  /* дрожь щели */
  let alive=true;(function shake(){if(!alive)return;const dx=(Math.random()-.5)*3,dy=(Math.random()-.5)*2;top.style.transform=`translate(${dx}px,${dy}px)`;bot.style.transform=`translate(${-dx}px,${dy}px)`;setTimeout(shake,70)})();
  await wait(ms);
  alive=false;A().stop("heart");A().stop("breath");
  const k=el("layer black");k.style.opacity=1;                 /* обрыв */
  await wait(1800);
  if(cv){cv.style.transition="";cv.style.filter=""}
  if(prev.st==null)st.removeAttribute("style");else st.setAttribute("style",prev.st);
  panel.style.visibility="";A().muffle(false);
  clear();unlockInput();
}

/* состояния на несколько экранов */
let curMood=null,amber=null;
async function mood(name){
  mount();
  if(name===curMood) return;
  const was=curMood;curMood=name||null;
  document.body.classList.remove("mood-heroin","mood-gray");
  if(was==="heroin"){                        /* конец героина: серый резкий экран, громкий звук */
    SN.stage.timeScale=1;A().muffle(false);if(amber){amber.remove();amber=null}
    const g=el("layer gray");g.style.opacity=1;A().slam();lockInput();
    await wait(650);g.remove();unlockInput();
  }
  if(name==="heroin"){
    document.body.classList.add("mood-heroin");SN.stage.timeScale=.42;A().muffle(700,2400);
    amber=el("layer amber");tween(amber,"opacity",".85",2400,"ease-out");
  }
  if(name==="gray") document.body.classList.add("mood-gray");   /* ломка всегда серая */
  /* сильный голод: мрачное ч/б через фильтр сцены (look.js), плавно */
  if(SN.look) SN.look.mood(name==="hunger"?"hunger":null);
}

/* белая вспышка сама по себе, без писка — «Наруто не помнит» */
async function white(ms){mount();const w=el("layer white");w.style.opacity=1;await wait(ms||700);clear()}

SN.fx={blackout,leave,harm,choke,mood,white,get mood_(){return curMood},wait};
})();
