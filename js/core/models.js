/* Модели .glb.
   models/manifest.json говорит, какой файл у какого персонажа или локации.
   Пока файла нет (или он не загрузился), на сцене стоит заглушка из кода, игра не ломается.
   Сжатые модели (meshopt + webp) читаются сами: декодер подключён в index.html. */
(function(){
"use strict";
const SN=window.SN=window.SN||{};
const BASE="models/";
let manifest={characters:{},locations:{}};
const cache={};   // id -> Promise<gltf>
const texCache={};

const ready=fetch(BASE+"manifest.json",{cache:"no-cache"}).then(r=>r.ok?r.json():{}).then(m=>{manifest=Object.assign({characters:{},locations:{}},m);return manifest}).catch(()=>manifest);

function loader(){
  const L=new THREE.GLTFLoader();
  if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
  return L;
}
function loadGLTF(file){
  if(!cache[file]) cache[file]=new Promise((res,rej)=>loader().load(BASE+file,res,undefined,rej));
  return cache[file];
}

/* Mixamo-кости по умолчанию. Если у модели другие имена, их можно задать в manifest: "bones":{...} */
const DEFAULT_BONES={hips:"mixamorigHips",spine:"mixamorigSpine",neck:"mixamorigNeck",
  thL:"mixamorigLeftUpLeg",thR:"mixamorigRightUpLeg",knL:"mixamorigLeftLeg",knR:"mixamorigRightLeg",
  shL:"mixamorigLeftArm",shR:"mixamorigRightArm",elL:"mixamorigLeftForeArm",elR:"mixamorigRightForeArm"};
/* как углы поз заглушки ложатся на кости: ось и знак. ПОДСТРОИТЬ на первой настоящей модели */
const DEFAULT_AXES={spine:["x",1],neck:["x",1],thL:["x",-1],thR:["x",-1],knL:["x",-1],knR:["x",-1],shL:["x",-1],shR:["x",-1],elL:["x",-1],elR:["x",-1]};

function normalize(obj,entry){
  obj.updateMatrixWorld(true);
  /* у риггованных моделей рамка сжатой геометрии врёт, поэтому меряем по костям (макушка — самая верхняя кость) */
  const bones=[];obj.traverse(o=>{if(o.isBone)bones.push(o)});
  let minY=Infinity,maxY=-Infinity;const v=new THREE.Vector3();
  if(bones.length>3){bones.forEach(b=>{b.getWorldPosition(v);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y)})}
  else{const box=new THREE.Box3().setFromObject(obj);minY=box.min.y;maxY=box.max.y}
  const h=entry.height||1.75,size=maxY-minY;
  const s=size>0?h/size:1;obj.scale.multiplyScalar(s);
  obj.position.y-=minY*s-(entry.footY||0);
  if(entry.rotY) obj.rotation.y=entry.rotY;
  /* рамка у сжатой геометрии неверная: отключаем отсечение, иначе модель пропадает */
  obj.traverse(o=>{if(o.isMesh)o.frustumCulled=false});
}

function attach(R,id,opt){
  opt=opt||{};
  ready.then(()=>{
    const entry=manifest.characters[id];
    if(!entry||!entry.file) return;
    return loadGLTF(entry.file).then(gltf=>{
      const model=THREE.SkeletonUtils?THREE.SkeletonUtils.clone(gltf.scene):gltf.scene.clone(true);
      normalize(model,entry);
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(opt.ghost){o.material=opt.ghost;o.castShadow=false}}});
      /* заглушку прячем, но её группы остаются: на них держатся позы и микродвижения */
      R.hips.traverse(o=>{if(o.isMesh)o.visible=false});
      R.root.add(model);R.glb=model;R.glbY=model.position.y;R.entry=entry;
      /* кости */
      const names=Object.assign({},DEFAULT_BONES,entry.bones||{});R.axes=Object.assign({},DEFAULT_AXES,entry.axes||{});
      const bones={};model.traverse(o=>{if(!o.isBone)return;for(const k in names) if(o.name===names[k]||o.name.replace(/[:_]/g,"")===names[k]) bones[k]=o});
      if(Object.keys(bones).length){R.bones=bones;R.rest={};for(const k in bones)R.rest[k]=bones[k].quaternion.clone()}
      /* анимации: клип с именем позы играет вместо поворота костей */
      if(gltf.animations&&gltf.animations.length){
        R.mixer=new THREE.AnimationMixer(model);R.clips={};
        gltf.animations.forEach(a=>R.clips[a.name]=a);
        if(R.poseName) playClip(R,R.poseName);
      }
      /* лицо */
      if(entry.faceMaterial){model.traverse(o=>{if(o.isMesh&&o.material&&o.material.name===entry.faceMaterial)R.faceMesh=o})}
      if(R.faceName) setFace(R,R.faceName);
    });
  }).catch(e=>console.warn("[SN] модель не загрузилась, остаётся заглушка:",id,e));
}

function attachLocation(group,placeholder,id){
  ready.then(()=>{
    const entry=manifest.locations[id];
    if(!entry||!entry.file) return;
    return loadGLTF(entry.file).then(gltf=>{
      const model=gltf.scene.clone(true);
      if(entry.scale) model.scale.setScalar(entry.scale);
      if(entry.offset) model.position.set(...entry.offset);
      if(entry.rotY) model.rotation.y=entry.rotY;
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
      /* свет из заглушки оставляем, геометрию прячем */
      const keep=entry.keepPlaceholder|0; /* первые N кусков заглушки остаются (например ровная земля под ногами) */
      placeholder.children.forEach((ch,i)=>{if(i>=keep)ch.traverse(o=>{if(o.isMesh)o.visible=false})});
      group.add(model);
    });
  }).catch(e=>console.warn("[SN] локация не загрузилась, остаётся заглушка:",id,e));
}

function playClip(R,name){
  if(!R.mixer||!R.clips) return;
  const clip=R.clips[name]||R.clips[(R.entry&&R.entry.clips&&R.entry.clips[name])||""];
  if(!clip) {if(R.cur && R.action){R.action.fadeOut(.3);R.action=null}return}
  const a=R.mixer.clipAction(clip);
  if(R.action===a) return;
  a.reset().fadeIn(.35).play();if(R.action)R.action.fadeOut(.35);R.action=a;
}

/* лица — варианты текстур: "faces":{"smile":"faces/naruto_smile.webp",…} */
function setFace(R,name){
  if(!R.faceMesh||!R.entry||!R.entry.faces) return;
  const f=R.entry.faces[name]||R.entry.faces.neutral;if(!f) return;
  if(!texCache[f]){texCache[f]=new THREE.TextureLoader().load(BASE+f);texCache[f].flipY=false;texCache[f].encoding=THREE.sRGBEncoding}
  R.faceMesh.material=R.faceMesh.material.clone();R.faceMesh.material.map=texCache[f];R.faceMesh.material.needsUpdate=true;
}

/* без клипа: углы поз заглушки поворачивают кости модели */
const _q=new THREE.Quaternion(),_ax={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
function driveBones(R,v){
  if(R.action) return;
  if(R.glb) R.glb.position.y=R.glbY+(v.y-.95);
  const B=R.bones,A=R.axes,rest=R.rest;
  const set=(k,ang)=>{if(!B[k])return;const [ax,sg]=A[k]||["x",1];B[k].quaternion.copy(rest[k]).multiply(_q.setFromAxisAngle(_ax[ax],ang*sg))};
  set("spine",v.sp);set("neck",v.nx);set("thL",v.thL);set("thR",v.thR);set("knL",v.knL);set("knR",v.knR);
  set("shL",v.shLx);set("shR",v.shRx);set("elL",v.elL);set("elR",v.elR);
}

SN.models={ready,attach,attachLocation,playClip,setFace,driveBones,get manifest(){return manifest}};
})();
