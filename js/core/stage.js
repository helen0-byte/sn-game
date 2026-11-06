/* 3D-сцена. Собрано из пролога (тун-фигуры, позы, окружения) и обобщено:
   · персонажи и локации регистрируются по имени и создаются по требованию;
   · если в models/manifest.json есть .glb для персонажа или локации, заглушка заменяется моделью;
   · мизансцены (shots) описывают, кто где стоит, в какой позе и откуда смотрит камера;
   · есть «бледный контур» (ghost) и микродвижения (flinch) для визуального языка.
   ФАЙЛ СОБРАН СКРИПТОМ ИЗ КУСКОВ ПРОЛОГА — правь прямо здесь, пролог отдельно. */
(function(){
"use strict";
const SN=window.SN=window.SN||{};
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x0f0d12,6,16);
scene.background=new THREE.Color(0x0f0d12);
const camera=new THREE.PerspectiveCamera(42,1,.1,50);
const camPos=new THREE.Vector3(0,1.6,4),camLook=new THREE.Vector3(0,1,0);
const camPosT=camPos.clone(),camLookT=camLook.clone();
let renderer=null,stageEl=null;
const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,flatShading:true,roughness:.85},o));
const box=(w,h,d,m)=>{const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);g.castShadow=true;g.receiveShadow=true;return g};
const at=(o,x,y,z)=>{o.position.set(x,y,z);return o};
const hemi=new THREE.HemisphereLight(0x6a6080,0x15121a,.55);scene.add(hemi);
const gradTex=(()=>{const d=new Uint8Array([70,150,255]);const t=new THREE.DataTexture(d,3,1,THREE.LuminanceFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t})();
const T=(c,o={})=>new THREE.MeshToonMaterial(Object.assign({color:c,gradientMap:gradTex},o));
const outlineM=new THREE.MeshBasicMaterial({color:0x140f14,side:THREE.BackSide});
function ol(mesh,k=1.07){const o=new THREE.Mesh(mesh.geometry,outlineM);o.scale.setScalar(k);mesh.add(o);mesh.castShadow=true;return mesh}
const sph=(r,m,ws=16,hs=12)=>new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),m);
function limb(r,len,m,cap=true){
  const g=new THREE.Group();
  const c=ol(new THREE.Mesh(new THREE.CylinderGeometry(r,r*.92,len,14),m),1.09);c.position.y=-len/2;g.add(c);
  if(cap){const e=ol(sph(r*.98,m),1.09);e.position.y=-len;g.add(e);const t=ol(sph(r,m),1.09);g.add(t)}
  return g;
}
const flat=c=>new THREE.MeshBasicMaterial({color:c});
function rig(o){
  const R={root:new THREE.Group()};
  const hips=R.hips=new THREE.Group();R.root.add(hips);hips.position.y=.95;
  const mk=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g};
  ["L","R"].forEach((s,i)=>{
    const sx=i?-1:1;
    const th=R["th"+s]=mk(hips,.095*sx,0,0);
    th.add(limb(.085,.44,o.legs));
    const kn=R["kn"+s]=mk(th,0,-.46,0);
    kn.add(limb(.075,.4,o.legs,false));
    const shoe=ol(sph(.1,o.shoes),1.08);shoe.scale.set(.9,.6,1.4);shoe.position.set(0,-.44,.05);kn.add(shoe);(R.shoes=R.shoes||[]).push(shoe);
  });
  const sp=R.spine=mk(hips,0,0,0);
  const pel=ol(sph(.17*o.w,o.legs),1.06);pel.scale.set(1,.55,.75);pel.position.y=.02;sp.add(pel);
  const tor=ol(new THREE.Mesh(new THREE.CylinderGeometry(.19*o.w,.16*o.w,.5,18),o.torso),1.05);tor.scale.z=.72;tor.position.y=.28;sp.add(tor);
  const sh=ol(sph(.19*o.w,o.torso),1.05);sh.scale.set(1,.5,.72);sh.position.y=.52;sp.add(sh);
  if(o.chest){const ch=new THREE.Mesh(new THREE.BoxGeometry(.1*o.w,.46,.02),o.chest);ch.position.set(0,.3,.118*o.w+.01);sp.add(ch)}
  if(o.coat){
    const cg=new THREE.CylinderGeometry(.23*o.w,.29*o.w,(o.coatLen||1),20,1,true,.5,Math.PI*2-1);
    const coat=new THREE.Mesh(cg,Object.assign(o.coat.clone(),{side:THREE.DoubleSide}));coat.scale.z=.8;coat.position.y=.64-(o.coatLen||1)/2;coat.castShadow=true;sp.add(coat);
    const co=new THREE.Mesh(cg,outlineM);co.scale.set(1.04,1.01,1.04);coat.add(co);
    const col=ol(new THREE.Mesh(new THREE.TorusGeometry(.17*o.w,.065,8,18),o.collar||o.coat),1.06);col.rotation.x=Math.PI/2;col.scale.y=.8;col.position.set(0,.6,-.01);sp.add(col);
  }
  const nk=R.neck=mk(sp,0,.6,0);
  const head=ol(sph(.21,o.skin,20,16),1.05);head.scale.set(1,.97,.95);head.position.y=.2;nk.add(head);R.head=head;
  const face=new THREE.Group();face.position.set(0,0,0);head.add(face);
  if(o.eyes==="narrow"){
    [1,-1].forEach(s=>{const e=new THREE.Mesh(new THREE.TorusGeometry(.04,.009,4,12,Math.PI*.8),flat(0x1a1218));e.position.set(.075*s+(s>0?.006:0),.0,.193);e.rotation.z=Math.PI*.1+(s>0?-.08:.08);e.scale.y=.6;face.add(e)});
  }else{
    [1,-1].forEach(s=>{
      const e=sph(.042,flat(0x1a1218),12,10);e.scale.set(.8,1.15,.35);e.position.set(.075*s,.0,.188);face.add(e);
      const ir=sph(.03,flat(o.iris||0x3a2a22),12,10);ir.scale.set(.8,1.1,.3);ir.position.set(.075*s,-.008,.2);face.add(ir);
      const hl=sph(.011,flat(0xffffff),8,6);hl.position.set(.075*s+.012,.02,.205);face.add(hl);
    });
  }
  const mc=flat(0x5a2830),MO={};
  MO.smile=new THREE.Mesh(new THREE.TorusGeometry(o.smile||.022,.006,4,12,Math.PI),mc);MO.smile.rotation.z=Math.PI;MO.smile.position.set(0,-.08,.19);
  MO.flat=new THREE.Mesh(new THREE.BoxGeometry(.034,.007,.01),mc);MO.flat.position.set(0,-.09,.195);
  MO.sad=new THREE.Mesh(new THREE.TorusGeometry(.02,.006,4,12,Math.PI),mc);MO.sad.position.set(0,-.105,.19);
  MO.open=sph(.022,mc,10,8);MO.open.scale.set(1,1.2,.35);MO.open.position.set(0,-.095,.19);
  Object.values(MO).forEach(m=>{m.visible=false;face.add(m)});MO.smile.visible=true;
  const BR=[],TE=[];
  if(o.expr){[1,-1].forEach(s=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.055,.011,.01),flat(0x9a6a20));b.position.set(.078*s,.075,.19);b.userData.s=s;face.add(b);BR.push(b);
    const t=sph(.012,new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.85}),8,6);t.scale.set(.8,1.6,.4);t.position.set(.085*s,-.05,.19);t.visible=false;t.userData.s=s;face.add(t);TE.push(t)})}
  R.face={MO,BR,TE};
  if(o.blush)[1,-1].forEach(s=>{const b=sph(.03,new THREE.MeshBasicMaterial({color:0xff8aa0,transparent:true,opacity:.45}),10,8);b.scale.set(1.2,.6,.3);b.position.set(.12*s,-.045,.165);face.add(b)});
  if(o.whiskers){const wm=flat(0x5a3020);[1,-1].forEach(sx=>[0,1,2].forEach(k=>{const w=new THREE.Mesh(new THREE.BoxGeometry(.06,.007,.006),wm);w.position.set(.13*sx,-.035-.02*k,.155);w.rotation.y=sx*.6;w.rotation.z=sx*(.12-k*.12);face.add(w)}))}
  if(o.plaster){const p=new THREE.Mesh(new THREE.BoxGeometry(.075,.032,.02),T(0xffffff));p.position.set(0,.035,.205);face.add(p)}
  if(o.hair) o.hair(head);
  ["L","R"].forEach((s,i)=>{
    const sx=i?-1:1;
    const shp=R["sh"+s]=mk(sp,(.2*o.w+.05)*sx,.5,0);
    shp.add(limb(.065*o.arm,.3,o.sleeve));
    const el=R["el"+s]=mk(shp,0,-.31,0);
    el.add(limb(.058*o.arm,.27,o.sleeve,false));
    const hand=ol(sph(.055,o.skin,10,8),1.1);hand.position.y=-.31;el.add(hand);R["hand"+s]=hand;
    if(o.rings){const rm=new THREE.MeshStandardMaterial({color:0xe6e8ee,metalness:.9,roughness:.2});[-.02,0,.02].forEach(z=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.016,.006,6,10),rm);r.position.set(.035,-.33,z);r.rotation.y=Math.PI/2;el.add(r)})}
  });
  R.setFace=function(name){
    const F=R.face,map={smile:"smile",happycry:"smile",neutral:"flat",sad:"sad",cry:"open",scared:"flat"};
    Object.entries(F.MO).forEach(([k,m])=>m.visible=k===(map[name]||"smile"));
    const br={sad:.32,cry:.4,happycry:.25,scared:.38,neutral:.08,smile:-.05}[name]||0;
    F.BR.forEach(b=>{b.rotation.z=-b.userData.s*br;b.position.y=.075+(name==="scared"?.015:0)});
    F.TE.forEach(t=>t.visible=(name==="cry"||name==="happycry"));R.faceName=name;
  };
  R.root.scale.setScalar(o.scale||1);
  R.cur={};R.base={};R.fx={};
  if(o.cig){const cg=new THREE.Group();cg.add(new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.08,6),T(0xf4f0e8)));const tp=new THREE.Mesh(new THREE.SphereGeometry(.011,6,5),new THREE.MeshBasicMaterial({color:0xff6a1a}));tp.position.y=.04;cg.add(tp);cg.rotation.x=Math.PI/2;cg.position.set(0,-.34,.05);R.elR.add(cg);R.cigTip=tp}
  scene.add(R.root);
  return R;
}
function spikes(h,mat,n,len,cfg){
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2+(cfg.off||0);
    const up=cfg.up(i);
    const v=new THREE.Vector3(Math.sin(a)*Math.cos(up),Math.sin(up),Math.cos(a)*Math.cos(up)).normalize();
    if(cfg.skipFront&&v.z>.6&&v.y<.5) continue;
    const c=ol(new THREE.Mesh(new THREE.ConeGeometry(.075,len*(.8+((i*37)%10)/25),8),mat),1.08);
    c.position.copy(v.clone().multiplyScalar(.19));
    const dir=v.clone().add(new THREE.Vector3(0,cfg.lift||.4,0)).normalize();
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
    c.position.add(dir.clone().multiplyScalar(len*.35));
    h.add(c);
  }
}
/* ---------- реестр персонажей ---------- */
const CHAR_DEF={},CH={};
/* defineChar(id, ()=>опции_заглушки, {model:"id в manifest.json"}) */
function defineChar(id,optsFn,meta){CHAR_DEF[id]={optsFn,meta:meta||{}}}
function build(id,opt){
  const d=CHAR_DEF[id];if(!d){console.warn("[SN] нет персонажа",id);return null}
  const R=rig(d.optsFn());R.id=id;R.seed=Object.keys(CH).length*1.3;R.target=new THREE.Vector3();R.targetRy=0;R.root.visible=false;R.cur={};
  const baseFace=R.setFace;R.setFace=n=>{baseFace(n);if(R.glb&&SN.models)SN.models.setFace(R,n)};
  if(SN.models) SN.models.attach(R,d.meta.model||id,opt);
  return R;
}
const driveBones=(c,v)=>{if(SN.models)SN.models.driveBones(c,v)};
function getChar(id){if(CH[id])return CH[id];const R=build(id);if(R)CH[id]=R;return R}
const skin=T(0xf6d2b0),skinK=T(0xf7dccb);
defineChar("naruto",()=>({w:1.05,arm:1.15,legs:T(0x2f3f63),shoes:T(0x1e1e24),torso:T(0xf2862a),chest:T(0x23202c),sleeve:T(0xf2862a),skin,whiskers:true,iris:0x2f8fe8,blush:true,expr:true,
  hair(h){const hm=T(0xffd43a);
    const cap=ol(new THREE.Mesh(new THREE.SphereGeometry(.222,20,14,0,Math.PI*2,0,Math.PI*.52),hm),1.04);cap.rotation.x=-.32;cap.position.y=.02;h.add(cap);
    spikes(h,hm,11,.2,{up:i=>.55+((i*13)%5)*.08,skipFront:true,lift:.5});
    spikes(h,hm,7,.16,{up:i=>1.05,off:.3,lift:.6});
    [-.09,0,.09].forEach((x,k)=>{const b=ol(new THREE.Mesh(new THREE.ConeGeometry(.05,.13,8),hm),1.08);b.position.set(x,.13,.17);b.rotation.x=Math.PI*.82;b.rotation.z=x*2.5;h.add(b)});
  }}));
defineChar("kurama",()=>({cig:true,w:1,arm:1.2,scale:1.1,legs:T(0x1d1a21),shoes:T(0x111014),torso:skinK,coat:T(0x4a3028),collar:T(0x5c3c30),sleeve:T(0x4a3028),skin:skinK,plaster:true,rings:true,eyes:"narrow",smile:.04,
  hair(h){const hm=T(0xd8262f);
    const cap=ol(new THREE.Mesh(new THREE.SphereGeometry(.226,20,14,0,Math.PI*2,0,Math.PI*.5),hm),1.04);cap.rotation.x=-.38;h.add(cap);
    const hm2=T(0xb81c26);
    const back=ol(new THREE.Mesh(new THREE.CylinderGeometry(.25,.21,1.05,18,1,false),hm),1.03);back.scale.z=.55;back.position.set(0,-.48,-.12);h.add(back);
    const tipB=ol(new THREE.Mesh(new THREE.ConeGeometry(.21,.22,18),hm),1.03);tipB.scale.z=.55;tipB.rotation.x=Math.PI;tipB.position.set(0,-1.1,-.12);h.add(tipB);
    for(let i=0;i<9;i++){const a=-1.25+i*(2.5/8);const len=.8+((i*7)%4)*.07;
      const st=ol(new THREE.Mesh(new THREE.CylinderGeometry(.075,.03,len,10),i%2?hm2:hm),1.06);
      st.position.set(Math.sin(a)*.2,-len/2+.02,-.05-Math.cos(a)*.12);st.rotation.z=Math.sin(a)*.12;h.add(st)}
    [1,-1].forEach(s=>{const st=ol(new THREE.Mesh(new THREE.CylinderGeometry(.075,.035,.78,12),hm),1.06);st.position.set(.2*s,-.33,.04);st.rotation.z=s*.1;st.rotation.x=-.12;h.add(st);
      const st2=ol(new THREE.Mesh(new THREE.CylinderGeometry(.06,.025,.6,10),hm2),1.06);st2.position.set(.235*s,-.25,-.04);st2.rotation.z=s*.16;h.add(st2)});
    const fr=ol(new THREE.Mesh(new THREE.ConeGeometry(.07,.16,8),hm),1.08);fr.position.set(.07,.12,.17);fr.rotation.x=Math.PI*.8;fr.rotation.z=.4;h.add(fr);
  }}));
defineChar("man",()=>({w:1.4,arm:1.3,legs:T(0x3d3832),shoes:T(0x1b1b1f),torso:T(0x7a6a58),sleeve:T(0x7a6a58),skin:T(0xe0ae90),iris:0x3a2a1a,smile:.015,
  hair(h){const s=ol(new THREE.Mesh(new THREE.SphereGeometry(.215,16,10,0,Math.PI*2,0,Math.PI*.3),T(0x4a3d33)),1.03);s.rotation.x=-.6;h.add(s)}}));
defineChar("official",()=>({w:1.1,arm:1.1,legs:T(0x2b2c33),shoes:T(0x111111),torso:T(0x3a3f4a),sleeve:T(0x4b4f58),coat:T(0x4b4f58),skin:T(0xe8c0a0),iris:0x2a2420,
  hair(h){const s=ol(new THREE.Mesh(new THREE.SphereGeometry(.22,16,10,0,Math.PI*2,0,Math.PI*.42),T(0x2a2420)),1.03);s.rotation.x=-.3;h.add(s)}}));
defineChar("tsunade",()=>({w:.95,arm:1,legs:T(0x2b2b33),shoes:T(0x111111),torso:T(0x3f5244),sleeve:T(0x5f6e57),coat:T(0x5f6e57),skin:T(0xf5d6bc),iris:0x8a6a3a,blush:true,expr:true,
  hair(h){const hm=T(0xf0d47e);const cap=ol(new THREE.Mesh(new THREE.SphereGeometry(.225,18,12,0,Math.PI*2,0,Math.PI*.5),hm),1.04);cap.rotation.x=-.38;h.add(cap);
    [1,-1].forEach(s=>{const t=ol(new THREE.Mesh(new THREE.CylinderGeometry(.06,.035,.4,10),hm),1.07);t.position.set(.13*s,-.26,-.12);h.add(t)})}}));/* заглушки новых персонажей: только чтобы было кого ставить в кадр, внешность уточнит модель */
defineChar("sai",()=>({w:.98,arm:1.05,legs:T(0x1c1c22),shoes:T(0x111114),torso:T(0x24242c),sleeve:T(0x24242c),skin:T(0xf3e6dc),iris:0x1a1a1e,smile:.018,
  hair(h){const hm=T(0x141418);const cap=ol(new THREE.Mesh(new THREE.SphereGeometry(.226,18,12,0,Math.PI*2,0,Math.PI*.5),hm),1.04);cap.rotation.x=-.3;h.add(cap)}}));
/* Курама 1974: короткие оранжевые волосы, кожанка, красная рубашка */
defineChar("kurama1974",()=>({cig:true,w:1,arm:1.2,scale:1.1,legs:T(0x1d1a21),shoes:T(0x111014),torso:T(0xb3222c),coat:T(0x17151a),coatLen:.55,collar:T(0x17151a),sleeve:T(0x17151a),skin:T(0xf7dccb),eyes:"narrow",smile:.04,
  hair(h){const hm=T(0xf07a1e);const cap=ol(new THREE.Mesh(new THREE.SphereGeometry(.23,20,14,0,Math.PI*2,0,Math.PI*.55),hm),1.04);cap.rotation.x=-.3;h.add(cap);
    spikes(h,hm,9,.1,{up:i=>.7+((i*7)%3)*.1,lift:.3})}}),{model:"kurama1974"});
/* молодой Курама 1970 — это «kurama» из пролога */
const P={
  stand:{y:.95},
  walk:{y:.95,walk:1},
  sit:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57},
  table:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,sp:1.05,nx:.25,ny:.9,shLx:-1.2,shRx:-1.3,elL:-.9,elR:-.8},
  eyes:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,sp:-.05,nx:-.25,shLx:-.3,shRx:-.2,elL:-1.2,elR:-1.1},
  upside:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,sp:-.35,nx:-1.0,shLx:-.2,shRx:-.2,elL:-.6,elR:-.6},
  lean:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,sp:.1,nx:-.2,shLx:-.4,shRx:-.4,elL:-1.2,elR:-1.2},
  ground:{y:.12,thL:-1.2,thR:-1.2,knL:2.1,knR:2.1,sp:.25,nx:.2,shLx:-.8,shRx:-.8,elL:-1.4,elR:-1.4,shLz:.1,shRz:-.1},
  rock:{y:.12,thL:-1.2,thR:-1.2,knL:2.1,knR:2.1,sp:.35,nx:.35,shLx:-.9,shRx:-.9,elL:-1.6,elR:-1.6,rock:1},
  reach_up:{y:.12,thL:-1.2,thR:-1.2,knL:2.1,knR:2.1,sp:.05,nx:-.45,shLx:-.8,shRx:-2.0,elL:-1.4,elR:-.2},
  look_up:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,sp:.05,nx:-.3,shLx:-.5,shRx:-.5,elL:-1,elR:-1},
  look_down:{y:.12,thL:-1.2,thR:-1.2,knL:2.1,knR:2.1,sp:.45,nx:.6,ny:.5,shLx:-.9,shRx:-.9,elL:-1.6,elR:-1.6},
  kneel:{y:.45,thL:-.1,thR:-.1,knL:1.9,knR:1.9,sp:.9,nx:.4,shLx:-1.5,shRx:-1.5,elL:-.3,elR:-.3},
  wall:{y:.12,thL:-1.3,thR:-1.3,knL:2.2,knR:2.2,sp:-.05,nx:.1,shLx:-.6,shRx:-.6,elL:-1.3,elR:-1.3},
  hold_hand:{y:.95,shRx:-.5,shRz:-.15,elR:-.5},
  glow:{y:.95,nx:-.25,shRx:-.9,shRz:-.2,elR:-.2,sob:1},
  hugged:{y:.95,nx:-.15,shLx:-.3,shRx:-.3,elL:-1.6,elR:-1.6,sob:1},
  slump:{y:.12,thL:-1.3,thR:-1.3,knL:2.2,knR:2.2,sp:.5,nx:.7,shLx:-.4,shRx:-.4,elL:-.4,elR:-.4},
  // позы, которые есть только клипами настоящей модели (у заглушки — похожие углы)
  idle:{y:.95},idle2:{y:.95},chat:{y:.95,shRx:-.4,elR:-.8},wave:{y:.95,shRx:-2.4,elR:-.4},step_back:{y:.95,sp:.3},
  depressed:{y:.95,sp:.25,nx:.5,shLx:-.1,shRx:-.1},
  head_pain:{y:.95,sp:.3,nx:.5,shLx:-2.4,shRx:-2.4,elL:-1.9,elR:-1.9},
  drink:{y:.95,shRx:-1.2,elR:-1.9},
  sit_drink:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,shRx:-1.2,elR:-1.9},
  crosslegged:{y:.12,thL:-1.4,thR:-1.4,knL:2.2,knR:2.2,sp:.2,nx:.2,shLx:-.4,shRx:-.4,elL:-.6,elR:-.6},
  lie:{y:.12,sp:-1.5},
  lie_side:{y:.12,sp:-1.5},
  toss:{y:.12,sp:-1.5},
  drunk:{y:.95,walk:1,sp:.15},
  fall:{y:.12,sp:-1.4},
  push:{y:.95,shLx:-1.5,shRx:-1.5,elL:-.2,elR:-.2},
  // Курама
  k_stand:{y:.95,shRx:-.3,elR:-1.6,shRz:-.1,smoke:1},
  k_cover:{y:.95,sp:.15,nx:.4,shRx:-1.7,shRz:-.15,elR:-.4,shLx:-.1},
  k_over:{y:.95,sp:.25,nx:.9,shLx:-.2,shRx:-.2},
  k_lean:{y:.95,sp:.7,nx:.2,shLx:-1.3,elL:-.3,shRx:-.2},
  k_crouch:{y:.38,thL:-2.3,thR:-2.3,knL:2.5,knR:2.5,sp:.25,nx:.1,shRx:-.4,shRz:-.6,elR:-.8,shLx:-.9,elL:-.6},
  k_offer:{y:.95,sp:.15,nx:.4,shRx:-1.1,elR:-.2},
  k_hold:{y:.95,shLx:-.5,shLz:.15,elL:-.5,walk:1},
  k_door:{y:.95,ny:.3,shLx:-.6,shRx:-.6,elL:-1.9,elR:-1.9},
  k_sitwall:{y:.12,thL:-1.4,thR:-1.4,knL:1.6,knR:1.4,sp:-.05,shRx:-.3,elR:-1.7,smoke:1,shLx:-.5,elL:-.4},
  k_hug:{y:.95,sp:.06,nx:.2,shLx:-1.4,shRx:-1.4,shLz:-.5,shRz:.5,elL:-.9,elR:-.9},
  k_face:{y:.95,nx:-.35,shLx:-.4,shLz:.15,elL:-.5},
  m_sit:{y:.52,thL:-1.57,thR:-1.57,knL:1.57,knR:1.57,sp:.2,shLx:-1,elL:-.5},
  m_stand:{y:.95,sp:-.1,shLx:-.4,shRx:-.4},
};
const KEYS=["y","sp","nx","ny","thL","thR","knL","knR","shLx","shRx","shLz","shRz","elL","elR"];
function applyPose(c,t,dt){
  const p=c.pose||P.stand,cur=c.cur;
  const k=1-Math.pow(.02,dt);
  KEYS.forEach(key=>{const tv=p[key]!==undefined?p[key]:(key==="y"?.95:0);cur[key]=cur[key]===undefined?tv:cur[key]+(tv-cur[key])*k});
  let sp=cur.sp,nx=cur.nx,thL=cur.thL,thR=cur.thR,shLx=cur.shLx,shRx=cur.shRx;
  const br=Math.sin(t*1.7+c.seed)*.015;
  sp+=br;
  if(p.rock){sp+=Math.sin(t*2.4)*.22;}
  if(p.sob){nx+=Math.sin(t*9)*.03;sp+=Math.abs(Math.sin(t*4.5))*.05}
  if(p.walk){const w=Math.sin(t*5);thL+=w*.45;thR-=w*.45;shLx-=w*.25;if(c.id==="naruto")shRx+=w*.25}
  if(c.shiver){nx+=Math.sin(t*17)*.006+Math.sin(t*11.3)*.004;shLx+=Math.sin(t*14.7)*.012;shRx+=Math.sin(t*13.1+1)*.012}
  if(p.smoke){const ph=(t*.35+c.seed)%1;if(ph<.18){const a=Math.sin(ph/.18*Math.PI);shRx=-0.3-1.0*a;}}
  c.hips.position.y=cur.y;
  c.spine.rotation.x=sp;c.neck.rotation.x=nx;c.neck.rotation.y=cur.ny;
  c.thL.rotation.x=thL;c.thR.rotation.x=thR;c.knL.rotation.x=cur.knL;c.knR.rotation.x=cur.knR;
  c.shL.rotation.x=shLx;c.shR.rotation.x=shRx;c.shL.rotation.z=cur.shLz;c.shR.rotation.z=cur.shRz;
  c.elL.rotation.x=cur.elL;c.elR.rotation.x=cur.elR;
  if(c.bones) driveBones(c,{y:cur.y,sp,nx,ny:cur.ny,thL,thR,knL:cur.knL,knR:cur.knR,shLx,shRx,shLz:cur.shLz,shRz:cur.shRz,elL:cur.elL,elR:cur.elR});
  if(c.flinchT>0){c.flinchT-=dt;const a=Math.sin(Math.max(0,c.flinchT)*18)*Math.max(0,c.flinchT)*1.6;if(c.flinchKind==="toes"){(c.shoes||[]).forEach(s=>s.scale.z=1.4-a*1.2)}else{c.shR.rotation.z+=a*.5;c.shR.position.y=.5+a*.06}}
  if(c.target){c.root.position.lerp(c.target,1-Math.pow(.05,dt));let dy=c.targetRy-c.root.rotation.y;c.root.rotation.y+=dy*(1-Math.pow(.05,dt))}
}


/* ---------- реестр локаций ---------- */
const ENV={},LOC_META={};
/* env(имя, построить_заглушку, {focus:{точка:[x,y,z]}, fog:[near,far], bg:0x…}) */
function env(name,build,meta){const g=new THREE.Group();g.visible=false;const ph=new THREE.Group();ph.name="placeholder";g.add(ph);build(ph);scene.add(g);ENV[name]=g;LOC_META[name]=meta||{};g.userData=ph.userData;
  if(SN.models) SN.models.attachLocation(g,ph,"loc_"+name);return g}
const floorM=M(0x2a2228),wallM=M(0x3a2c2a);
env("bar",g=>{
  g.add(at(box(14,.05,10,M(0x241c1c)),0,-.025,0));
  g.add(at(box(14,4,.2,M(0x3b2622)),0,2,-3));
  g.add(at(box(1.4,.06,.8,M(0x5a3a24,{roughness:.4})),0,.78,.55)); // стол
  g.add(at(box(.08,.75,.08,M(0x3a2618)),0,.39,.55));
  [[-.0,0],[.9,0]].forEach(([x])=>{});
  g.add(at(box(.42,.06,.42,M(0x5a3a24)),0,.48,0)); g.add(at(box(.06,.46,.06,M(0x3a2618)),0,.23,0));
  g.add(at(box(.42,.06,.42,M(0x5a3a24)),-.85,.48,.2)); g.add(at(box(.06,.46,.06,M(0x3a2618)),-.85,.23,.2));
  g.add(at(box(4,1.1,.7,M(0x4a2c1e)),2.6,.55,-1.9)); // стойка
  for(let i=0;i<9;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.28,6),M([0x3f6b3a,0x7a3b1f,0xb08a3a][i%3],{roughness:.3,transparent:true,opacity:.85}));b.position.set(1.2+i*.32,1.5,-2.8);g.add(b)}
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(.035,.03,.1,7),M(0xc9b27a,{transparent:true,opacity:.6,roughness:.2}));glass.position.set(.25,.86,.45);g.add(glass);
  const lamp=new THREE.PointLight(0xffb35a,1.6,7,2);lamp.position.set(0,2.2,.5);lamp.castShadow=true;g.add(lamp);
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(.2,.18,8,1,true),M(0x2a1a10,{side:THREE.DoubleSide})),0,2.35,.5));
  const neon=new THREE.PointLight(0xff3d6a,.8,6);neon.position.set(2.6,2.2,-2.6);g.add(neon);
  g.add(at(box(1.4,.18,.04,new THREE.MeshBasicMaterial({color:0xff3d6a})),2.6,2.3,-2.88));
});
env("street",g=>{
  g.add(at(box(16,.05,12,M(0x1a1c22,{roughness:.25,metalness:.4})),0,-.025,0));
  g.add(at(box(16,5,.3,M(0x4a2a22)),0,2.5,-2.2));
  g.add(at(box(16,.15,.6,M(0x55545a)),0,.07,-.9)); // бордюр
  const post=at(box(.08,3.2,.08,M(0x222225)),1.6,1.6,-.5);g.add(post);
  g.add(at(box(.5,.06,.12,M(0x222225)),1.4,3.2,-.5));
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffd27a}));bulb.position.set(1.2,3.12,-.5);g.add(bulb);
  const L=new THREE.SpotLight(0xffc96a,2.4,10,.75,.5,1.5);L.position.set(1.2,3.1,-.5);L.target.position.set(.6,0,.4);L.castShadow=true;g.add(L,L.target);
  for(let i=0;i<6;i++){const w=at(box(.7,.9,.05,new THREE.MeshBasicMaterial({color:i%3?0x1a1820:0x5a4a30})),-5+i*2,2.7,-2.04);g.add(w)}
});
env("shop",g=>{
  g.add(at(box(10,.05,8,M(0x3a2a20)),0,-.025,0));
  g.add(at(box(10,4,.2,M(0x4a3a30)),0,2,-2.6));
  g.add(at(box(.2,4,8,M(0x463630)),-3.2,2,0));
  for(let s=0;s<3;s++){g.add(at(box(2.6,.05,.4,M(0x5a4030)),-.5,.6+s*.7,-2.35));
    for(let r=0;r<16;r++){g.add(at(box(.025,.32,.3,M([0xd94a2a,0x2a5ad9,0xe8d24a,0x111111,0xeeeeee,0x6a2ad9][(r+s*5)%6])),-1.7+r*.15,.78+s*.7,-2.3))}}
  g.add(at(box(1.6,.95,.6,M(0x5a4030)),1.7,.48,-1.2));
  g.add(at(box(1.5,.05,.5,M(0x9fc4d0,{transparent:true,opacity:.4,roughness:.1})),1.7,.98,-1.2));
  const tt=at(box(.4,.08,.35,M(0x222222)),1.5,1.05,-1.2);g.add(tt);
  const rec=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.01,16),M(0x0a0a0a,{roughness:.2}));rec.position.set(1.5,1.1,-1.2);g.add(rec);g.userData.rec=rec;
  for(let c=0;c<3;c++) g.add(at(box(.6,.4,.5,M(0x6a4a30)),-2.4+c*.7,.2,-.4));
  const bulb=new THREE.PointLight(0xffe2a8,1.5,8,2);bulb.position.set(0,2.6,0);bulb.castShadow=true;g.add(bulb);g.userData.bulb=bulb;
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),new THREE.MeshBasicMaterial({color:0xfff0c8})),0,2.6,0));
  // дверь и бумага
  g.add(at(box(1,2.1,.08,M(0x2a1e18)),3.2,1.05,1.5));
  g.add(at(box(.2,.28,.01,M(0xffffff)),2.62,1.25,1.56));
});
env("bath",g=>{
  g.add(at(box(4,.05,4,M(0x6c7a78)),0,-.025,0));
  g.add(at(box(4,3,.15,M(0x8b9a92)),0,1.5,-1.3));
  g.add(at(box(.15,3,4,M(0x7e8c86)),-1.4,1.5,0));
  g.add(at(box(.15,3,4,M(0x7e8c86)),1.4,1.5,0));
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.22,.18,.4,10),M(0xf2f2ee,{roughness:.2}));bowl.position.set(-.2,.2,-.95);g.add(bowl);
  g.add(at(box(.4,.45,.18,M(0xf2f2ee,{roughness:.2})),-.2,.55,-1.15));
  g.add(at(box(.5,.12,.35,M(0xf2f2ee,{roughness:.2})),1,.85,-1.05));
  g.add(at(box(1.2,.02,1.4,M(0x7a2a2a)),.2,.01,.1)); // ковёр
  const L=new THREE.PointLight(0xe8fff4,1.1,6,2);L.position.set(0,2.6,0);L.castShadow=true;g.add(L);
});
env("home",g=>{
  g.add(at(box(8,.05,8,M(0x2a2630)),0,-.025,0));
  g.add(at(box(8,3.2,.2,M(0x332e3a)),0,1.6,-2));
  g.add(at(box(2,.4,1,M(0x3e3a48)),-.4,.2,-.8));
  g.add(at(box(1.1,1.3,.05,new THREE.MeshBasicMaterial({color:0x2a3a5a})),1.6,1.8,-1.88));
  const L=new THREE.PointLight(0x7a9ad8,.9,7,2);L.position.set(1.5,1.8,-1.2);g.add(L);
  g.add(at(box(1,2.1,.08,M(0x1e1a18)),2.6,1.05,.5));
  const D=new THREE.PointLight(0xdfe6f0,0,6,2);D.position.set(2.6,1.8,1.2);g.add(D);g.userData.door=D;
});
env("spofford",g=>{
  g.add(at(box(8,.05,8,M(0x4a4e52)),0,-.025,0));
  g.add(at(box(8,3.2,.2,M(0x7b8085)),0,1.6,-1.6));
  g.add(at(box(1.4,.06,.8,M(0x8a8f94)),0,.78,0));
  g.add(at(box(.08,.75,.08,M(0x55595e)),0,.39,0));
  [[0,.75],[0,-.75]].forEach(([x,z])=>{g.add(at(box(.42,.06,.42,M(0x55595e)),x,.48,z));g.add(at(box(.06,.46,.06,M(0x55595e)),x,.23,z))});
  g.add(at(box(.9,.6,.05,new THREE.MeshBasicMaterial({color:0xcfd8e0})),1.6,2,-1.48));
  const L=new THREE.PointLight(0xe8f0ff,1.4,8,2);L.position.set(0,2.6,0);L.castShadow=true;g.add(L);
});
/* огонь */
const fire=new THREE.Group();scene.add(fire);fire.visible=false;
const flames=[];
for(let i=0;i<26;i++){const f=new THREE.Mesh(new THREE.ConeGeometry(.12+Math.random()*.18,.6+Math.random()*.9,5),new THREE.MeshBasicMaterial({color:[0xff7a1a,0xffb02a,0xff3d1a][i%3],transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));
  f.position.set(-2.6+Math.random()*5.2,.3,-2.2+Math.random()*1.6);f.userData.p=Math.random()*6;fire.add(f);flames.push(f)}
/* похороны: заглушка-кладбище. Кладбище это или зал, решит фик и модель локации */
env("funeral",g=>{
  g.add(at(box(16,.05,12,M(0x2c3328)),0,-.025,0));
  for(let i=0;i<14;i++){const p=at(box(.06,1.1,.06,M(0x1c1c20)),-6.5+i,.55,-3.2);g.add(p)}
  g.add(at(box(14,.05,.04,M(0x1c1c20)),0,1.0,-3.2));g.add(at(box(14,.05,.04,M(0x1c1c20)),0,.4,-3.2));
  [[-2.6,-1.6],[-1.2,-2.2],[1.4,-1.9],[2.8,-1.3],[-3.8,-.6]].forEach(([x,z],i)=>{const s=at(box(.5,.7+(i%2)*.2,.12,M(0x6c6a66)),x,.38,z);s.rotation.y=(i-2)*.06;g.add(s)});
  g.add(at(box(.9,.35,2,M(0x3a2a20)),0,.17,-.6)); // заглушка гроба или холма
  [[-5,-2.5],[5.2,-2.4],[4.2,-3.6]].forEach(([x,z])=>{g.add(at(box(.18,1.6,.18,M(0x2a2018)),x,.8,z));const c=new THREE.Mesh(new THREE.IcosahedronGeometry(.9,0),M(0x24301e));c.position.set(x,2.0,z);g.add(c)});
  const L=new THREE.DirectionalLight(0xc8cdd8,.9);L.position.set(-3,6,4);L.castShadow=true;g.add(L);
},{fog:[5,18],bg:0x9aa0a8});
/* комната с трещиной на потолке: нужна экрану удушья (точка focus.crack) */
env("room",g=>{
  g.add(at(box(6,.05,6,M(0x3a3236)),0,-.025,0));
  g.add(at(box(6,3,.15,M(0x5a5054)),0,1.5,-2.5));
  g.add(at(box(6,.1,6,M(0x6a6064)),0,3,0));
  const cr=new THREE.Group();[[0,0,.5,.3],[.25,.05,.35,-.5],[.5,-.05,.3,.2],[-.24,.02,.4,-.3]].forEach(([x,z,l,r])=>{const s=at(box(l,.012,.02,new THREE.MeshBasicMaterial({color:0x1a1416})),x,2.94,z);s.rotation.y=r;cr.add(s)});g.add(cr);
  const L=new THREE.PointLight(0xd8d0c8,.9,7,2);L.position.set(1,2.4,1);g.add(L);
},{focus:{crack:[.1,2.95,0]}});
env("void",g=>{},{fog:[1,6],bg:0x000000});
/* ---------- локации части 0 ---------- */
/* квартира Джирайи над магазином (модель: дешёвая комната, loc_flat). Заглушка: кухня и тёплая лампа */
env("flat",g=>{
  g.add(at(box(8,.05,7,M(0x6a6a66)),0,-.025,0));
  g.add(at(box(8,2.9,.15,M(0xd8d2c4)),0,1.45,-3.2));
  g.add(at(box(3,.9,.6,M(0xe2dccb)),-.5,.45,-2.85));
  g.add(at(box(1.2,.05,.8,M(0x4a3020)),2,.75,-1.6));
  const L=new THREE.PointLight(0xffd6a0,1.3,9,2);L.position.set(0,2.5,-.6);L.castShadow=true;g.add(L);
  const W=new THREE.PointLight(0x9ab4d8,.5,8,2);W.position.set(3.5,1.8,1.5);g.add(W);
},{fog:[7,18],bg:0x14110f});
/* граница: ночная дорога в снегу, машина с зажжёнными фарами (скан, loc_border) */
env("border",g=>{
  g.add(at(box(40,.05,40,M(0xc8d0dc)),0,-.025,0));
  const car=at(box(1.9,1.4,4.6,M(0x2a2e36)),1.6,.7,-1.2);car.rotation.y=.5;g.add(car);
  const L=new THREE.SpotLight(0xfff0d0,2.2,14,.6,.6,1.5);L.position.set(.8,.8,1.2);L.target.position.set(-1,0,5);g.add(L,L.target);
  const M2=new THREE.DirectionalLight(0x8aa0c8,.55);M2.position.set(-4,8,3);g.add(M2);
},{fog:[4,22],bg:0x0c1018});
/* Торонто: седьмой этаж, окно во двор, напротив дом (loc_toronto, без своей модели комнаты: стены из кода) */
env("toronto",g=>{
  const wall=M(0x8a8478),wd=-2.2;
  g.add(at(box(8,.05,6,M(0x5a4636)),0,-.025,0));               // пол
  g.add(at(box(2.85,3,.18,wall),-2.475,1.5,wd));               // стена слева от окна
  g.add(at(box(2.85,3,.18,wall),2.475,1.5,wd));                // справа
  g.add(at(box(2.1,.9,.18,wall),0,.45,wd));                    // под окном
  g.add(at(box(2.1,.75,.18,wall),0,2.625,wd));                 // над окном
  g.add(at(box(2.3,.06,.42,M(0xd8d4c8)),0,.92,wd+.06));        // подоконник
  [-1.02,1.02].forEach(x=>g.add(at(box(.08,1.36,.22,M(0xd8d4c8)),x,1.58,wd)));  // рама
  g.add(at(box(2.1,.08,.22,M(0xd8d4c8)),0,2.22,wd));
  const open=at(box(1,1.3,.04,M(0x9fb6c8,{transparent:true,opacity:.18,roughness:.1})),-.6,1.58,wd+.45);open.rotation.y=-.9;g.add(open); // открытая створка
  g.add(at(box(.18,3,6,wall),-3.9,1.5,.8));
  g.add(at(box(8,.1,6,M(0x6a645c)),0,3,.8));
  const lamp=new THREE.PointLight(0xffc890,.9,7,2);lamp.position.set(1.8,2.4,.6);lamp.castShadow=true;g.add(lamp);
  const out=new THREE.PointLight(0x8aa6d8,.9,6,2);out.position.set(0,1.6,wd-.8);g.add(out);
  const sky=at(box(60,40,.1,new THREE.MeshBasicMaterial({color:0x0a0e18})),0,0,-40);g.add(sky);
},{fog:[9,60],bg:0x0a0e18});
/* ---------- снег: shot.snow = [cx,cy,cz, w,h,d] (коробка, где он идёт) или 1 — вокруг точки взгляда ---------- */
const SNOW_N=900,snowG=new THREE.BufferGeometry(),snowP=new Float32Array(SNOW_N*3),snowV=new Float32Array(SNOW_N);
for(let i=0;i<SNOW_N;i++){snowP[i*3]=Math.random();snowP[i*3+1]=Math.random();snowP[i*3+2]=Math.random();snowV[i]=.25+Math.random()*.35}
snowG.setAttribute("position",new THREE.BufferAttribute(snowP.slice(),3));
const snow=new THREE.Points(snowG,new THREE.PointsMaterial({color:0xf2f6ff,size:.035,transparent:true,opacity:.85,depthWrite:false}));
snow.visible=false;snow.frustumCulled=false;snow.userData.noLook=true;scene.add(snow);let snowBox=[0,0,0,1,1,1];
function setSnow(s){
  snow.visible=!!s.snow;if(!s.snow)return;
  snowBox=Array.isArray(s.snow)?s.snow:[s.look[0],1.8,s.look[2],10,4,10];
}
function snowTick(dt,t){
  if(!snow.visible)return;const a=snow.geometry.attributes.position,[cx,cy,cz,w,h,d]=snowBox;
  for(let i=0;i<SNOW_N;i++){snowP[i*3+1]-=dt*snowV[i]/h;if(snowP[i*3+1]<0)snowP[i*3+1]+=1;
    a.array[i*3]=cx+(snowP[i*3]-.5)*w+Math.sin(t*.7+i)*.08;a.array[i*3+1]=cy+(snowP[i*3+1]-.5)*h;a.array[i*3+2]=cz+(snowP[i*3+2]-.5)*d}
  a.needsUpdate=true;
}

const fl1=new THREE.PointLight(0xff7a2a,3,9,2);fl1.position.set(0,1.2,-1.2);fire.add(fl1);
const fl2=new THREE.PointLight(0xff4a1a,2,7,2);fl2.position.set(1.5,.8,-1.6);fire.add(fl2);
const embersG=new THREE.BufferGeometry();const EN=160;const ep=new Float32Array(EN*3);for(let i=0;i<EN;i++){ep[i*3]=-3+Math.random()*6;ep[i*3+1]=Math.random()*3;ep[i*3+2]=-2.5+Math.random()*2}
embersG.setAttribute("position",new THREE.BufferAttribute(ep,3));
const embers=new THREE.Points(embersG,new THREE.PointsMaterial({color:0xffa040,size:.04,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));fire.add(embers);

/* ---------- мизансцены ---------- */
/* для каждого: окружение, кто где стоит [x,z,поворот], поза, камера */
const ST={ // мизансцены пролога (для будущего переноса пролога на движок)
 bar_table:{face:"sad",env:"bar",cast:{naruto:[0,0,0,"table"]},cam:[1.6,1.5,2.6],look:[0,.8,.3],shiver:1},
 bar_man:{face:"scared",env:"bar",cast:{naruto:[0,0,0,"sit"],man:[-.85,.2,.9,"m_sit"]},cam:[1.4,1.5,2.6],look:[-.3,.9,.2],shiver:1},
 bar_eyes:{face:"neutral",env:"bar",cast:{naruto:[0,0,0,"eyes"],kurama:[0,-.42,0,"k_cover"],man:[-.85,.2,.9,"m_sit"]},cam:[1.5,1.6,2.2],look:[0,1.1,0]},
 bar_upside:{face:"neutral",env:"bar",cast:{naruto:[0,0,0,"upside"],kurama:[0,-.32,0,"k_over"],man:[-.85,.2,.9,"m_sit"]},cam:[2.6,1.5,1.1],look:[0,1.1,-.1]},
 bar_lean:{face:"smile",env:"bar",cast:{naruto:[0,0,0,"lean"],kurama:[.15,-.3,-.4,"k_lean"],man:[-1,.3,.9,"m_stand"]},cam:[1.8,1.5,2.4],look:[-.3,1,0]},
 street_sit:{face:"sad",env:"street",style:"film_night",cast:{naruto:[0,0,.3,"ground"],kurama:[1.1,-.2,-.6,"k_stand"]},cam:[-1.2,1.3,2.8],look:[.4,.7,0],shiver:1},
 street_reach:{face:"cry",env:"street",style:"film_night",cast:{naruto:[0,0,.6,"rock"],kurama:[.9,-.1,-1.2,"k_stand"]},cam:[-1.2,1.3,2.8],look:[.4,.7,0]},
 street_crouch:{face:"sad",env:"street",style:"film_night",cast:{naruto:[0,0,0,"rock"],kurama:[0,1.15,3.14,"k_crouch"]},cam:[-2.3,1.2,.7],look:[0,.5,.55]},
 street_hand:{face:"scared",env:"street",style:"film_night",cast:{naruto:[0,0,0,"reach_up"],kurama:[0,.95,3.14,"k_offer"]},cam:[-2.3,1.3,.9],look:[0,.8,.45]},
 street_stand:{face:"neutral",env:"street",style:"film_night",cast:{naruto:[0,0,0,"stand"],kurama:[0,.75,3.14,"stand"]},cam:[-2.4,1.6,.5],look:[0,1.45,.38]},
 street_walk:{face:"neutral",env:"street",style:"film_night",cast:{naruto:[-1.85,0,1.57,"walk"],kurama:[-1.45,0,1.57,"k_hold"]},cam:[-1.6,1.5,3.4],look:[-1.6,1.1,0],walk:1},
 street_alone:{face:"sad",env:"street",style:"film_night",cast:{naruto:[0,.3,0,"stand"]},cam:[-.8,1.5,3],look:[0,1,0],shiver:1},
 shop_door:{face:"neutral",env:"shop",cast:{naruto:[2.6,1.4,3.14,"stand"],kurama:[2.2,2.2,3.14,"stand"]},cam:[.6,1.7,3.8],look:[2.4,1.2,1.4]},
 shop_in:{face:"neutral",env:"shop",cast:{naruto:[1.1,-.6,.6,"stand"],kurama:[-.6,-.4,.8,"k_stand"]},cam:[0,1.7,3.2],look:[.4,1.1,-.8]},
 bath:{face:"scared",env:"bath",cast:{naruto:[-.2,-.45,3.14,"kneel"],kurama:[.9,.9,-2.5,"k_door"]},cam:[1.1,1.7,1.9],look:[-.1,.6,-.6]},
 bath_talk:{face:"cry",env:"bath",cast:{naruto:[-1.05,0,1.57,"wall"],kurama:[1.05,0,-1.57,"k_sitwall"]},cam:[0,1.25,2.2],look:[0,.55,0]},
 bath_alone:{face:"sad",env:"bath",cast:{naruto:[-1.05,0,1.57,"wall"]},cam:[.3,1.2,2],look:[-.6,.5,0],shiver:1},
 fire_hug:{face:"happycry",env:"shop",cast:{naruto:[0,.4,0,"hugged"],kurama:[0,-.02,0,"k_hug"]},cam:[.4,1.6,3],look:[0,1.25,.3],fire:1},
 fire_street:{face:"happycry",env:"street",style:"film_night",cast:{naruto:[-.3,.8,3.14,"glow"],kurama:[.4,.6,3.14,"k_face"]},cam:[-.4,1.4,4.2],look:[0,1.3,.6],fire:1},
 home:{face:"sad",env:"home",cast:{naruto:[-.4,-.8,0,"wall"]},cam:[1,1.6,2.6],look:[-.3,.6,-.6],shiver:1},
 home_door:{face:"scared",env:"home",cast:{naruto:[.8,.2,1.4,"stand"],official:[2.6,1.2,-1.8,"stand"]},cam:[-.6,1.6,2.8],look:[1.6,1.2,.6],door:1},
 twenty:{face:"sad",env:"street",style:"film_night",cast:{naruto:[-1,-1.6,0,"slump"],man:[2.6,.6,-1.2,"m_stand"]},cam:[0,1.4,3],look:[-.6,.6,-1],shiver:1},
 spofford:{face:"neutral",env:"spofford",cast:{naruto:[0,.75,3.14,"look_up"],tsunade:[0,-.75,0,"sit"]},cam:[1.9,1.6,1.9],look:[0,.95,0]},
};

/* ---------- мизансцены ---------- */
/* shot: {env, cast:{кто:[x,z,поворот,поза]}, cam:[x,y,z], look:[x,y,z], face, shiver, fire, door} */
const SHOTS=Object.assign({},ST);
function defineShot(name,s){SHOTS[name]=s}
let curShot=null,walkX=0,shotAge=0;
const shotSpot=new THREE.SpotLight(0xffd8a8,3,14,.6,.35,1.5);shotSpot.castShadow=true;shotSpot.shadow.mapSize.set(2048,2048);shotSpot.shadow.bias=-.004;shotSpot.shadow.normalBias=.04;shotSpot.visible=false;scene.add(shotSpot);scene.add(shotSpot.target);
/* земля под ногами: модели локаций (тротуар, порог, ковёр) бывают выше нуля, тогда ноги уходили в них.
   Пускаем луч сверху вниз в точке, где стоит герой, и ставим его на первое, что ниже колена */
const _rc=new THREE.Raycaster(),_down=new THREE.Vector3(0,-1,0),_from=new THREE.Vector3();
_rc.layers.enableAll();
function shown(o){while(o){if(!o.visible)return false;o=o.parent}return true}
function groundY(x,z){
  const env=curShot&&ENV[curShot.env];if(!env||(curShot.ground===false)) return 0;
  env.updateMatrixWorld(true);_from.set(x,.6,z);_rc.set(_from,_down);_rc.far=1.2;
  const h=_rc.intersectObject(env,true).find(h=>h.object.isMesh&&shown(h.object)&&!h.object.material.transparent);
  return h?h.point.y:0;
}
function reground(){
  if(!curShot) return;
  Object.keys(curShot.cast).forEach(k=>{const c=CH[k];if(!c||!c.root.visible)return;const a=curShot.cast[k]||[];const y=groundY(c.target.x,c.target.z)+(a[4]||0);c.target.y=y;c.root.position.y=y});
}
function setShot(name,fireOn){
  const s=SHOTS[name];if(!s){console.warn("[SN] нет мизансцены",name);return}
  const envChanged=!curShot||curShot.env!==s.env;curShot=s;walkX=0;
  Object.keys(ENV).forEach(k=>ENV[k].visible=k===s.env);
  const meta=LOC_META[s.env]||{};
  scene.fog.near=(meta.fog||[6,16])[0];scene.fog.far=(meta.fog||[6,16])[1];
  const bg=meta.bg!=null?meta.bg:0x0f0d12;scene.background.setHex(bg);scene.fog.color.setHex(bg);
  fire.visible=!!(s.fire||fireOn);
  if(s.env==="street"&&fire.visible){fire.position.set(0,0,.3)}else fire.position.set(0,0,0);
  Object.keys(s.cast).forEach(getChar);
  Object.entries(CH).forEach(([k,c])=>{
    if(c.ghost) c.ghost.root.visible=false;
    const a=s.cast[k];
    if(!a){c.root.visible=false;return}
    c.root.visible=true;c.target.set(a[0],groundY(a[0],a[1])+(a[4]||0),a[1]);c.targetRy=a[2];
    c.root.position.copy(c.target);c.root.rotation.y=a[2];
    setPose(k,a[3]);
    if(envChanged){c.cur={}}
  });
  if(CH.naruto){CH.naruto.shiver=!!s.shiver;CH.naruto.setFace(s.face||"sad")}
  if(CH.tsunade) CH.tsunade.setFace("neutral");
  if(ENV.home&&ENV.home.userData.door) ENV.home.userData.door.intensity=s.door?1.6:0;
  camPosT.set(...s.cam);camLookT.set(...s.look);
  setSnow(s);
  if(SN.look) SN.look.forShot(s);
  /* кадр (still:true): склейка вместо проезда камеры, позы стоят, камера почти неподвижна;
     fov — фокусное (меньше = длиннее объектив, плоский киношный план); push — медленный наезд, метров в секунду */
  /* spot: {pos,target,int,color} — свой прожектор кадра (тени на стене); dim — во сколько раз пригасить остальной свет */
  if(s.spot){shotSpot.position.set(...s.spot.pos);shotSpot.target.position.set(...s.spot.target);shotSpot.intensity=s.spot.int||3;shotSpot.color.setHex(s.spot.color||0xffd8a8);shotSpot.visible=true}else shotSpot.visible=false;
  scene.traverse(o=>{if(o.isLight&&o!==shotSpot){if(o.userData.baseI==null)o.userData.baseI=o.intensity;o.intensity=o.userData.baseI*(s.dim||1)}});
  shotAge=0;camera.fov=s.fov||42;camera.updateProjectionMatrix();
  if(envChanged||s.still){camPos.copy(camPosT);camLook.copy(camLookT)}
}
function setPose(who,p){const c=getChar(who);if(!c)return;c.pose=P[p]||P.stand;c.poseName=p;if(c.mixer&&SN.models)SN.models.playClip(c,p,!!(curShot&&curShot.still))}
function setFace(who,f){const c=getChar(who);if(c)c.setFace(f)}

/* ---------- бледный контур: «тело делает своё» ---------- */
/* контур отслаивается от фигуры и делает то, что выбрал игрок (ghostPose),
   цветное тело делает обратное (bodyPose) */
function ghostify(R,mat){R.root.traverse(o=>{if(!o.isMesh)return;if(o.material===outlineM){o.visible=false;return}o.material=mat;o.castShadow=false});if(SN.look)SN.look.noEdges(R.root)}
function ghost(who,ghostPose,bodyPose,ms){
  ms=ms||2600;const c=getChar(who);if(!c)return Promise.resolve();
  if(!c.ghost){
    const mat=new THREE.MeshBasicMaterial({color:0xeef3ff,transparent:true,opacity:0,depthWrite:false});
    const g=build(who,{ghost:mat});g.mat=mat;g.id=who+"_ghost";ghostify(g,mat);c.ghost=g;
  }
  const g=c.ghost;
  g.root.visible=true;g.root.position.copy(c.root.position);g.root.rotation.y=c.root.rotation.y;g.root.scale.copy(c.root.scale);
  g.cur=Object.assign({},c.cur);g.pose=P[ghostPose]||P.stand;g.seed=c.seed+.7;
  const fwd=new THREE.Vector3(Math.sin(c.root.rotation.y),0,Math.cos(c.root.rotation.y)).multiplyScalar(.32);
  g.target=c.root.position.clone().add(fwd);g.targetRy=c.root.rotation.y;g.life=ms/1000;g.age=0;
  setPose(who,bodyPose);
  return new Promise(r=>setTimeout(r,ms));
}
/* микродвижение без движения: поджатые пальцы ("toes") или дёрнувшееся плечо ("shoulder") */
function flinch(who,kind){const c=getChar(who);if(!c)return;c.flinchT=.6;c.flinchKind=kind||(Math.random()<.5?"toes":"shoulder")}

/* камера на точку локации (для щели удушья); возвращает экранные координаты 0..1 */
function focusOn(pointName,dist){
  const meta=curShot&&LOC_META[curShot.env];const p=meta&&meta.focus&&meta.focus[pointName];
  if(!p) return {x:.5,y:.5};
  const v=new THREE.Vector3(...p);
  camLookT.copy(v);camPosT.set(v.x+.3,Math.max(.9,v.y-(dist||1.6)),v.z+.9);
  return {x:.5,y:.5,point:v};
}
function screenOf(v){const p=v.clone().project(camera);return {x:(p.x+1)/2,y:(1-p.y)/2}}

/* ---------- поза руками ----------
   shot.bones = {naruto:{RightArm:[x,y,z], Head:[x,y,z], …}} — повороты костей в градусах (оси самой кости),
   накладываются поверх стоп-кадра клипа. Так ставятся объятия, руки на подоконнике и всё, чего нет в библиотеке */
const _e=new THREE.Euler(),_bq=new THREE.Quaternion(),D2R=Math.PI/180;
function bend(c,map){
  if(!c.boneByName){c.boneByName={};c.glb.traverse(o=>{if(o.isBone)c.boneByName[o.name.replace(/^mixamorig:?/,"")]=o})}
  for(const k in map){const b=c.boneByName[k];if(!b)continue;const r=map[k];
    if(!c.mixer||!c.action){if(!b.userData.rest)b.userData.rest=b.quaternion.clone();b.quaternion.copy(b.userData.rest)}
    _e.set(r[0]*D2R,r[1]*D2R,r[2]*D2R);b.quaternion.multiply(_bq.setFromEuler(_e))}
}
/* shot.reach = {naruto:{RightHand:[x,y,z], LeftHand:[…], Head:[…]}} — кисть (или голова) тянется к точке сцены:
   плечо и локоть доворачиваются сами (CCD). Точка — на спине другого героя, на подоконнике и т. п. */
const _bp=new THREE.Vector3(),_ep=new THREE.Vector3(),_tp=new THREE.Vector3(),_v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_rq=new THREE.Quaternion(),_wq=new THREE.Quaternion(),_pq=new THREE.Quaternion();
const CHAIN={RightHand:["RightForeArm","RightArm","RightShoulder"],LeftHand:["LeftForeArm","LeftArm","LeftShoulder"],Head:["Neck","Spine2"],
  RightFoot:["RightLeg","RightUpLeg"],LeftFoot:["LeftLeg","LeftUpLeg"]};
function reach(c,map){
  if(!c.boneByName) bend(c,{});
  for(const end in map){const E=c.boneByName[end],chain=(CHAIN[end]||[]).map(n=>c.boneByName[n]).filter(Boolean);if(!E||!chain.length)continue;
    _tp.set(...map[end]);
    for(let it=0;it<12;it++){for(const b of chain){
      c.root.updateMatrixWorld(true);
      b.getWorldPosition(_bp);E.getWorldPosition(_ep);
      _v1.subVectors(_ep,_bp).normalize();_v2.subVectors(_tp,_bp).normalize();
      _rq.setFromUnitVectors(_v1,_v2);
      /* мягко, чтобы плечо не выворачивалось: ключица почти не участвует */
      const w=b===chain[chain.length-1]&&chain.length>2?.15:1;_rq.slerp(_wq.identity(),1-w);
      b.getWorldQuaternion(_wq);b.parent.getWorldQuaternion(_pq);
      b.quaternion.copy(_pq.invert().multiply(_rq).multiply(_wq));
    }}
  }
  c.root.updateMatrixWorld(true);
}
/* ---------- цикл ---------- */
let clock=0,last=0,timeScale=1;
function resize(){if(!renderer)return;const r=stageEl.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix()}
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
function loop(now){
  const rdt=Math.min(.05,(now-last)/1000);last=now;const dt=rdt*timeScale;clock+=dt;const t=clock;
  Object.values(CH).forEach(c=>{
    if(c.root.visible)applyPose(c,reduce?0:t,dt);
    if(c.mixer)c.mixer.update(dt);
    if(c.glb&&curShot&&curShot.bones&&curShot.bones[c.id])bend(c,curShot.bones[c.id]);
    if(c.glb&&curShot&&curShot.reach&&curShot.reach[c.id])reach(c,curShot.reach[c.id]);
    if(c.cigTip)c.cigTip.material.color.setHSL(.05,1,.45+Math.sin(t*2)*.1);
    const g=c.ghost;
    if(g&&g.root.visible){g.age+=rdt;applyPose(g,reduce?0:t,rdt);if(g.mixer)g.mixer.update(rdt);
      const a=g.age<.5?g.age/.5:g.age>g.life-.6?Math.max(0,(g.life-g.age)/.6):1;g.mat.opacity=.55*a;if(g.age>=g.life)g.root.visible=false}
  });
  if(curShot&&curShot.walk&&walkX<3.2){walkX+=dt*.45;Object.keys(curShot.cast).forEach(k=>{const a=curShot.cast[k];if(CH[k]&&a[3]&&/walk|k_hold/.test(a[3])){CH[k].target.x=a[0]+walkX;CH[k].root.position.x=CH[k].target.x}});camLookT.x=curShot.look[0]+walkX;camPosT.x=curShot.cam[0]+walkX;
    if(walkX>=3.2){if(CH.naruto)setPose("naruto","hold_hand");if(CH.kurama)setPose("kurama","stand")}}
  snowTick(dt,t);
  if(fire.visible){flames.forEach(f=>{f.scale.y=.8+Math.sin(t*8+f.userData.p)*.25+Math.sin(t*19+f.userData.p*3)*.06;f.scale.x=f.scale.z=.9+Math.sin(t*6+f.userData.p)*.1});
    fl1.intensity=2.6+Math.sin(t*13)*.5+Math.sin(t*29)*.25;fl2.intensity=1.8+Math.sin(t*9+1)*.4;
    const pa=embersG.attributes.position;for(let i=0;i<EN;i++){let y=pa.getY(i)+dt*(.4+(i%7)*.08);if(y>3.2)y=0;pa.setY(i,y)}pa.needsUpdate=true}
  if(ENV.shop&&ENV.shop.visible&&ENV.shop.userData.rec) ENV.shop.userData.rec.rotation.y+=dt*3.5;
  shotAge+=rdt;
  if(curShot&&curShot.still){
    const push=Math.min(shotAge,40)*(curShot.push||0);
    _from.subVectors(camLookT,camPosT).normalize().multiplyScalar(push);
    camPos.copy(camPosT).add(_from);camLook.copy(camLookT);camera.position.copy(camPos);camera.lookAt(camLook);
  }else{
  const k=1-Math.pow(.15,rdt);camPos.lerp(camPosT,k);camLook.lerp(camLookT,k);
  camera.position.copy(camPos);camera.position.x+=Math.sin(t*.3)*.04;camera.position.y+=Math.sin(t*.23)*.03;camera.lookAt(camLook);}
  if(!(SN.look&&SN.look.render(renderer,scene,camera)))renderer.render(scene,camera);requestAnimationFrame(loop);
}
function init(el){
  stageEl=el;
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.outputEncoding=THREE.sRGBEncoding;
  el.prepend(renderer.domElement);
  addEventListener("resize",resize);new ResizeObserver(resize).observe(el);
  resize();last=performance.now();requestAnimationFrame(loop);
}

SN.stage={init,THREE,scene,camera,defineChar,getChar,chars:CH,env,ENV,defineShot,shots:SHOTS,setShot,setPose,setFace,poses:P,ghost,flinch,focusOn,screenOf,
  get timeScale(){return timeScale},set timeScale(v){timeScale=v},
  helpers:{M,T,box,at,ol,sph,limb,spikes,outlineM},
  get canvas(){return renderer&&renderer.domElement},get renderer(){return renderer},reground,get focusDist(){return camPos.distanceTo(camLook)}};
})();
