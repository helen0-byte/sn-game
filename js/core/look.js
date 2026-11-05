/* Единый вид игры («look»).
   Модели приходят из разных мест (Meshy, Sketchfab, сканы) и выглядят по-разному.
   Чтобы всё было из одного мира, делаем две вещи:
   1. материалы всех загруженных .glb меняем на мультяшные (toon): та же текстура и цвет,
      но свет ложится полосами, как у фигур из кода;
   2. картинку после рендера пропускаем через один фильтр: контур тушью по краям предметов,
      общая цветокоррекция, зерно, виньетка. Фильтр один на всю игру, поэтому скан кладбища,
      мультяшная улица и персонажи из Meshy получают одинаковую «плёнку».
   Стиль выбирается одним словом: SN.look.set("film"). Для проверки: ?look=ink|film|zine|off в адресе.
   Экраны визуального языка (провал, героин, серый, удушье) живут поверх этого в effects.js и css,
   их это не трогает. */
(function(){
"use strict";
const SN=window.SN=window.SN||{};

/* ---------- стили ----------
   bands    — сколько полос света у мультяшного материала (2 = жёстко, 4 = мягче)
   ink      — толщина контура в пикселях (0 = нет), inkColor — цвет туши
   edge     — чувствительность контура: [по глубине, по нормалям, по цвету]
   sat      — насыщенность, con — контраст, exp — яркость
   lift     — цвет теней (поднятые чёрные, как у старой плёнки), gain — цвет светов
   grain    — зерно, vig — виньетка, ca — расслоение цвета по краям (как у дешёвой линзы)
   tone     — 0 обычный цвет; 1 «ксерокс»: два тона (тонер и бумага) + одна краска (spot)
   halftone — точки растра в тенях (размер клетки в пикселях, 0 = нет)
   post     — false: фильтр выключен совсем (как было до этого) */
const STYLES={
  off:{post:false,bands:0},
  ink:{   /* комикс: жирная тушь, сочный плоский цвет, растр в тенях */
    bands:3,ink:1.6,inkColor:[.06,.04,.06],edge:[1,1,.15],
    sat:1.18,con:1.12,exp:1.05,lift:[.02,.01,.03],gain:[1,.98,.95],
    grain:.035,vig:.35,ca:0,tone:0,halftone:5,posterize:0},
  film:{  /* плёнка 70-х: тонкий контур, выцветшие чёрные, тёплый свет, холодные тени, сильное зерно, лёгкий ореол вокруг света */
    bands:4,ink:1,inkColor:[.07,.05,.07],edge:[.8,.7,0],
    sat:.82,con:1.04,exp:1.08,lift:[.05,.06,.08],gain:[1.06,.98,.86],
    grain:.08,vig:.5,ca:.35,tone:0,halftone:0,posterize:0,halo:.35},
  film_kodak:{  /* тёплая любительская плёнка: сильный ореол, засветы с края, мягкий жёлто-розовый свет */
    bands:4,ink:.9,inkColor:[.09,.05,.06],edge:[.8,.7,0],
    sat:.9,con:1.02,exp:1.1,lift:[.08,.06,.07],gain:[1.08,.97,.82],
    grain:.07,vig:.45,ca:.4,tone:0,halftone:0,posterize:0,halo:.6,leak:.9,leakCol:[1,.38,.12],flicker:.05},
  film_16mm:{  /* затёртая 16 мм из проектора: пыль, царапины, мерцание, кадр подрагивает, цвет уходит в сепию */
    bands:4,ink:1,inkColor:[.08,.06,.05],edge:[.8,.7,0],
    sat:.55,con:1.1,exp:1.06,lift:[.07,.06,.05],gain:[1.05,.97,.84],
    grain:.13,vig:.7,ca:.25,tone:0,halftone:0,posterize:0,halo:.3,dust:.8,flicker:.12,weave:1.2},
  film_night:{  /* холодная ночная плёнка Нью-Йорка: зелёно-бирюзовые тени, фонари с красным ореолом */
    bands:4,ink:1,inkColor:[.04,.06,.07],edge:[.8,.7,0],
    sat:.75,con:1.12,exp:1.12,lift:[.02,.09,.1],gain:[.98,1.02,.92],
    grain:.1,vig:.55,ca:.45,tone:0,halftone:0,posterize:0,halo:1,haloCol:[1,.25,.12],flicker:.03},
  punk:{  /* панк-плакат: розовая краска, чёрный растр, бумага, приводка сбита (как афиши Round House) */
    bands:3,ink:1.4,inkColor:[.06,.05,.06],edge:[1,1,.2],
    sat:1,con:1.2,exp:1.1,grain:.05,vig:.15,ca:0,tone:2,halftone:5,posterize:0,zgamma:.6,
    paper:[.93,.91,.86],toner:[.07,.06,.07],spot:[1,.24,.6]},
  punk_flag:{  /* панк-плакат «флаг»: тёплое красной краской, холодное синей, остальное чёрный растр на бумаге */
    bands:3,ink:1.4,inkColor:[.06,.05,.06],edge:[1,1,.2],
    sat:1.3,con:1.15,exp:1.1,grain:.05,vig:.15,ca:0,tone:2,halftone:5,posterize:-1,zgamma:.6,
    paper:[.92,.9,.86],toner:[.07,.06,.07],spot:[.86,.12,.2],spot2:[.12,.2,.55]},
  zine:{  /* фанзин/ксерокс: тонер на бумаге и одна краска (оранжевый маркер), как листок с текстом */
    bands:3,ink:1.4,inkColor:[.08,.07,.08],edge:[1,1,.2],
    sat:1,con:1.25,exp:1.1,lift:[0,0,0],gain:[1,1,1],
    grain:.06,vig:.25,ca:0,tone:1,halftone:4,posterize:0,zgamma:.55,
    paper:[.925,.9,.855],toner:[.08,.067,.078],spot:[.94,.54,.17]},
};
let cur=null,curName="off";
const dbgMode=+((/[?&]lookdbg=(\d)/.exec(location.search)||[])[1]||0);

/* ---------- 1. материалы ---------- */
const grads={};
function gradient(n){
  if(grads[n]) return grads[n];
  const d=new Uint8Array(n);for(let i=0;i<n;i++) d[i]=Math.round(40+(215*i)/(n-1));
  const t=new THREE.DataTexture(d,n,1,THREE.LuminanceFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;
  return grads[n]=t;
}
const adopted=new Set();   /* меши, у которых мы поменяли материал: чтобы можно было переключать стиль на лету */
function toToon(m,bands){
  if(!m||m.isMeshToonMaterial||m.isMeshBasicMaterial||m.isShaderMaterial||m.isPointsMaterial||m.isLineBasicMaterial) return m;
  if(!(m.isMeshStandardMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial)) return m;
  const t=new THREE.MeshToonMaterial({
    color:m.color?m.color.clone():new THREE.Color(1,1,1),map:m.map||null,
    normalMap:m.normalMap||null,alphaMap:m.alphaMap||null,aoMap:m.aoMap||null,
    emissive:m.emissive?m.emissive.clone():new THREE.Color(0),emissiveMap:m.emissiveMap||null,
    transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,side:m.side,
    skinning:m.skinning,morphTargets:m.morphTargets,vertexColors:m.vertexColors,
    gradientMap:gradient(bands)});
  if(m.normalScale&&t.normalScale) t.normalScale.copy(m.normalScale);
  /* у сканов и металлов цвет часто тёмный из-за metalness: toon металл не понимает, чуть подсвечиваем */
  if(m.metalness>.5&&!m.map) t.color.offsetHSL(0,0,.08);
  t.name=m.name;t.userData.orig=m;
  return t;
}
function restyle(o){
  const st=cur||STYLES.off;
  const orig=o.userData.lookOrig||(o.userData.lookOrig=o.material);
  const conv=x=>st.bands?toToon(x,st.bands):x;
  o.material=Array.isArray(orig)?orig.map(conv):conv(orig);
}
/* вызывать для каждой загруженной модели (models.js делает это сам) */
function adopt(root){
  root.traverse(o=>{if(!o.isMesh||o.userData.noLook)return;adopted.add(o);restyle(o)});
}
/* предмет без контура (бледный контур «тело делает своё», огонь, дым) */
function noEdges(o){o.traverse(x=>{x.layers.set(1)})}

/* ---------- 2. фильтр ---------- */
let rtColor=null,rtNormal=null,quad=null,qScene=null,qCam=null,nmStatic=null,nmSkin=null,W=0,H=0;
const swapped=[],L0=new THREE.Layers();
const VERT="varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
const FRAG=`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor,tNormal,tDepth;
uniform vec2 res;uniform float time,near,far;
uniform float halo,dust,flicker,weave,leak,zgamma,dbg,ink,halftone,grain,vig,ca,sat,con,expo,tone,posterize;
uniform vec3 spot2,haloCol,leakCol,inkColor,edge,lift,gain,paper,toner,spot;
float lin(float d){float z=d*2.-1.;return (2.*near*far)/(far+near-z*(far-near));}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
void main(){
  vec2 px=1./res;
  /* расслоение цвета к краям кадра */
  /* плёнка идёт кадрами ~18 в секунду: пыль, мерцание и дрожание меняются по кадрам, а не плавно */
  float ft=floor(time*18.);
  vec2 uv=vUv+(vec2(hash(vec2(ft,1.)),hash(vec2(ft,2.)))-.5)*weave*px*3.;   /* дрожание кадра в проекторе */
  vec2 dc=(vUv-.5);float r2=dot(dc,dc);
  vec3 col;
  if(ca>0.){vec2 o=dc*r2*ca*px*60.;col=vec3(texture2D(tColor,uv+o).r,texture2D(tColor,uv).g,texture2D(tColor,uv-o).b);}
  else col=texture2D(tColor,uv).rgb;
  /* ореол (halation): яркие места светятся красно-оранжевым, как свет, отражённый от подложки плёнки */
  if(halo>0.){vec3 h=vec3(0.);
    for(int i=0;i<12;i++){float a=float(i)*.5236;vec2 o=vec2(cos(a),sin(a))*px*(i<6?7.:15.);
      vec3 c=texture2D(tColor,uv+o).rgb;h+=c*smoothstep(.75,1.,luma(c));}
    col+=haloCol*h/12.*halo;}
  /* контур: перепады глубины, нормалей и цвета вокруг точки */
  float e=0.;
  if(ink>0.){
    vec2 s=px*ink;
    float d0=lin(texture2D(tDepth,vUv).r);
    vec3 n0=texture2D(tNormal,vUv).rgb;float l0=luma(col);
    float dd=0.,nn=0.,ll=0.;
    for(int i=0;i<4;i++){
      vec2 o=i==0?vec2(s.x,0.):i==1?vec2(-s.x,0.):i==2?vec2(0.,s.y):vec2(0.,-s.y);
      float d=lin(texture2D(tDepth,vUv+o).r);
      dd+=abs(d-d0)/max(d0,.5);
      nn+=length(texture2D(tNormal,vUv+o).rgb-n0);
      ll+=abs(luma(texture2D(tColor,vUv+o).rgb)-l0);
    }
    float fade=1.-smoothstep(far*.45,far*.95,d0);  /* дальше тумана контур не нужен */
    e=max(max(smoothstep(.08,.22,dd*edge.x),smoothstep(.9,1.6,nn*edge.y)),smoothstep(.35,.7,ll*edge.z))*fade;
  }
  /* цвет */
  col*=expo*(1.+(hash(vec2(ft,3.))-.5)*flicker);             /* мерцание лампы проектора */
  col=lift+(gain-lift)*col;                                   /* тени к цвету lift, света к gain */
  col=(col-.5)*con+.5;
  float L=luma(col);col=mix(vec3(L),col,sat);
  if(posterize>0.) col=floor(col*posterize+.5)/posterize;
  float n=hash(gl_FragCoord.xy+fract(time*7.3)*vec2(91.7,37.3))-.5;
  if(tone>1.5){
    /* панк-плакат (шелкография): бумага, одна-две плоские краски и чёрный растр, напечатанный чуть мимо */
    vec3 hsv=rgb2hsv(clamp(col,0.,1.));
    float lv=clamp(pow(clamp(L,0.,1.),zgamma)+n*grain*1.5,0.,1.);
    vec3 cr=texture2D(tColor,uv+vec2(2.,-1.5)*px*(res.x/max(res.x,1.))).rgb;   /* чёрный слой сдвинут: сбитая приводка */
    float lk=clamp(pow(clamp(luma(cr*expo),0.,1.),zgamma),0.,1.);
    float a=.785,cs=cos(a),sn=sin(a);vec2 g=mat2(cs,-sn,sn,cs)*gl_FragCoord.xy;   /* растр под 45°, как в типографии */
    float h=length(fract(g/max(halftone,2.))-.5)*1.41;
    float kb=max(step(h,smoothstep(.62,.08,lk)),step(lk,.12));
    float spotOn;vec3 sc=spot;
    if(posterize<0.){                                           /* «флаг»: тёплое — красной, холодное — синей */
      float warmH=1.-smoothstep(.06,.14,abs(fract(hsv.x+.5)-.5-0.)*1.);
      float wr=smoothstep(.25,.45,hsv.y)*max(1.-smoothstep(.0,.1,min(hsv.x,1.-hsv.x)),1.-smoothstep(.04,.1,abs(hsv.x-.08)));
      float cb=smoothstep(.2,.4,hsv.y)*(1.-smoothstep(.08,.16,abs(hsv.x-.6)));
      spotOn=max(wr,cb);sc=wr>=cb?spot:spot2;
    }else spotOn=smoothstep(.9,.55,lv);                         /* одна краска: всё, что не светлое, заливается ей */
    vec3 c=mix(paper,sc,step(.5,spotOn));
    col=mix(c,toner,kb);
  }else if(tone>.5){
    /* ксерокс: яркость в тонер/бумагу через растр, тёплые насыщенные места — краской */
    vec3 hsv=rgb2hsv(clamp(col,0.,1.));
    float hd=abs(fract(hsv.x-.07+.5)-.5);                     /* насколько оттенок близок к оранжевому */
    float warm=smoothstep(.45,.65,hsv.y)*(1.-smoothstep(.05,.11,hd))*smoothstep(.25,.45,hsv.z);
    float h=halftone>0.?length(fract(gl_FragCoord.xy/halftone)-.5)*1.25:.5;
    float lv=clamp(pow(clamp(L,0.,1.),zgamma)+n*grain*2.,0.,1.);   /* zgamma<1 вытягивает ночь из черноты */
    float ink3=step(h,1.-lv);                                  /* точка растра: тонер */
    vec3 base=mix(paper,toner,ink3*smoothstep(.0,.9,1.-lv));
    base=mix(base,toner,smoothstep(.22,.08,lv));               /* глубокие тени сплошным тонером */
    col=mix(base,spot*mix(.75,1.,lv),warm*step(h,.95-lv*.3+.3));
  }else{
    if(halftone>0.){
      float h=length(fract(gl_FragCoord.xy/halftone)-.5);
      float dark=smoothstep(.32,.05,L);
      col*=1.-dark*step(h,.38)*.45;
    }
    col+=n*grain;
  }
  /* засвет: тёплое пятно медленно ползёт от края, как свет, попавший в кассету */
  if(leak>0.){vec2 lp=vec2(1.05,.25+.5*sin(time*.07));float la=leak*smoothstep(.75,0.,distance(vUv*vec2(res.x/res.y,1.),lp*vec2(res.x/res.y,1.)))*(.55+.45*sin(time*.23));
    col=1.-(1.-col)*(1.-leakCol*la);}
  /* виньетка */
  col*=1.-vig*smoothstep(.15,.75,r2*1.6);
  /* пыль и царапины */
  if(dust>0.){
    for(int i=0;i<5;i++){vec2 c=vec2(hash(vec2(ft,float(i)+10.)),hash(vec2(ft,float(i)+20.)));
      float on=step(hash(vec2(ft,float(i)+30.)),dust);float rr=(1.5+hash(vec2(ft,float(i)+40.))*4.)*px.y;
      vec2 d=(vUv-c)*vec2(res.x/res.y,1.);float sp=on*(1.-smoothstep(rr*.5,rr,length(d)+(hash(gl_FragCoord.xy)-.5)*rr*.6));
      col=mix(col,i<3?vec3(.04):vec3(.92,.9,.85),sp*.85);}
    float sx=hash(vec2(floor(time*1.3),7.));                   /* длинная царапина держится несколько кадров */
    float sc=step(hash(vec2(floor(time*1.3),8.)),dust*.6)*(1.-smoothstep(.0,px.x*1.2,abs(vUv.x-sx-sin(vUv.y*9.+sx*20.)*.002)));
    col=mix(col,vec3(.85,.83,.78),sc*.5);
  }
  col=mix(col,inkColor,e);
  if(dbg>.5){gl_FragColor=dbg<1.5?vec4(texture2D(tNormal,vUv).rgb,1.):vec4(vec3(lin(texture2D(tDepth,vUv).r)/20.),1.);return;}
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

function ensure(renderer){
  const s=renderer.getDrawingBufferSize(new THREE.Vector2());
  if(rtColor&&s.x===W&&s.y===H) return;
  W=s.x;H=s.y;
  if(rtColor){rtColor.dispose();rtNormal.dispose()}
  rtColor=new THREE.WebGLRenderTarget(W,H,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  rtColor.texture.encoding=THREE.sRGBEncoding;           /* материалы пишут уже в sRGB, фильтр работает с тем, что видно глазу */
  rtNormal=new THREE.WebGLRenderTarget(W,H,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  rtNormal.depthTexture=new THREE.DepthTexture(W,H);rtNormal.depthTexture.type=THREE.UnsignedIntType;
  if(!quad){
    nmStatic=new THREE.MeshNormalMaterial();nmSkin=new THREE.MeshNormalMaterial({skinning:true});
    qScene=new THREE.Scene();qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,depthTest:false,depthWrite:false,
      uniforms:{tColor:{value:null},tNormal:{value:null},tDepth:{value:null},res:{value:new THREE.Vector2()},time:{value:0},near:{value:.1},far:{value:50},
        halo:{value:0},dust:{value:0},flicker:{value:0},weave:{value:0},leak:{value:0},haloCol:{value:new THREE.Vector3(1,.35,.15)},leakCol:{value:new THREE.Vector3(1,.45,.15)},zgamma:{value:1},dbg:{value:0},ink:{value:0},halftone:{value:0},grain:{value:0},vig:{value:0},ca:{value:0},sat:{value:1},con:{value:1},expo:{value:1},tone:{value:0},posterize:{value:0},
        inkColor:{value:new THREE.Vector3()},edge:{value:new THREE.Vector3(1,1,1)},lift:{value:new THREE.Vector3()},gain:{value:new THREE.Vector3(1,1,1)},
        paper:{value:new THREE.Vector3(1,1,1)},toner:{value:new THREE.Vector3()},spot:{value:new THREE.Vector3(1,.5,0)},spot2:{value:new THREE.Vector3(.1,.2,.6)}}}));
    quad.frustumCulled=false;qScene.add(quad);
  }
}
function pushUniforms(camera){
  const u=quad.material.uniforms,st=cur;
  u.tColor.value=rtColor.texture;u.tNormal.value=rtNormal.texture;u.tDepth.value=rtNormal.depthTexture;
  u.res.value.set(W,H);u.time.value=performance.now()/1000;u.near.value=camera.near;
  u.far.value=Math.min(camera.far,(SN.stage&&SN.stage.scene.fog&&SN.stage.scene.fog.far)||camera.far);
  /* контур в пикселях экрана, а не буфера: на телефоне с плотным экраном толще */
  const pr=W/Math.max(1,(SN.stage&&SN.stage.canvas&&SN.stage.canvas.clientWidth)||W);
  u.ink.value=(st.ink||0)*pr;u.halftone.value=(st.halftone||0)*pr;
  ["grain","vig","ca","sat","con","tone","posterize"].forEach(k=>u[k].value=st[k]!=null?st[k]:u[k].value);
  u.expo.value=st.exp||1;u.dbg.value=dbgMode;u.zgamma.value=st.zgamma||1;
  ["halo","dust","flicker","weave","leak"].forEach(k=>u[k].value=st[k]||0);
  u.haloCol.value.fromArray(st.haloCol||[1,.35,.15]);u.leakCol.value.fromArray(st.leakCol||[1,.45,.15]);
  u.inkColor.value.fromArray(st.inkColor||[0,0,0]);u.edge.value.fromArray(st.edge||[1,1,1]);
  u.lift.value.fromArray(st.lift||[0,0,0]);u.gain.value.fromArray(st.gain||[1,1,1]);
  if(st.paper)u.paper.value.fromArray(st.paper);if(st.toner)u.toner.value.fromArray(st.toner);if(st.spot)u.spot.value.fromArray(st.spot);if(st.spot2)u.spot2.value.fromArray(st.spot2);
}

/* stage.js зовёт это вместо renderer.render; false — значит фильтр выключен, рисуй как обычно */
function render(renderer,scene,camera){
  camera.layers.enableAll();   /* слой 1 — «без контура», но видеть его надо всегда */
  if(!cur||cur.post===false) return false;
  ensure(renderer);
  renderer.setRenderTarget(rtColor);renderer.render(scene,camera);
  /* второй проход: нормали и глубина для контура. Тени уже посчитаны, второй раз не надо */
  /* scene.overrideMaterial в r128 не рисует персонажей с костями, поэтому меняем материалы руками и возвращаем обратно */
  const au=renderer.shadowMap.autoUpdate,bg=scene.background,fog=scene.fog;
  renderer.shadowMap.autoUpdate=false;scene.background=null;scene.fog=null;
  scene.traverseVisible(o=>{if(!o.isMesh&&!o.isPoints&&!o.isLine&&!o.isSprite)return;
    if(o.isMesh&&o.layers.test(L0)){const m=o.material;if(m&&((m.transparent&&m.opacity<.5)||m.side===THREE.BackSide)){o.visible=false;swapped.push(o,m,1);return}
      swapped.push(o,m,0);o.material=o.isSkinnedMesh?nmSkin:nmStatic}
    else{o.visible=false;swapped.push(o,o.material,1)}});
  renderer.setRenderTarget(rtNormal);renderer.setClearColor(0x8080ff,1);renderer.clear();renderer.render(scene,camera);
  for(let i=0;i<swapped.length;i+=3){const o=swapped[i];o.material=swapped[i+1];if(swapped[i+2])o.visible=true}swapped.length=0;
  scene.background=bg;scene.fog=fog;renderer.shadowMap.autoUpdate=au;renderer.setClearColor(0x000000,0);
  pushUniforms(camera);
  renderer.setRenderTarget(null);renderer.render(qScene,qCam);
  return true;
}

function set(name){
  const st=STYLES[name];if(!st){console.warn("[SN] нет стиля",name);return}
  cur=st;curName=name;
  adopted.forEach(restyle);
  document.documentElement.dataset.look=name;
}
const q=/[?&]look=(\w+)/.exec(location.search);
set(q&&STYLES[q[1]]?q[1]:"film");

SN.look={set,adopt,noEdges,render,styles:STYLES,get name(){return curName}};
})();
