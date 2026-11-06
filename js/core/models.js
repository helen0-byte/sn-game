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
/* сжатые модели хранят координаты целыми числами (normalized Int16). Видеокарта их понимает,
   а three r128 при подсчёте рамок, лучах и позе костей — нет. Переводим координаты обратно в обычные числа один раз при загрузке */
function dequantize(root){
  root.traverse(o=>{
    const a=o.isMesh&&o.geometry&&o.geometry.attributes.position;if(!a||!a.normalized) return;
    const src=a.array,k=src instanceof Int8Array?127:src instanceof Uint8Array?255:src instanceof Int16Array?32767:src instanceof Uint16Array?65535:1;
    const isInt=src instanceof Int8Array||src instanceof Int16Array,f=new Float32Array(a.count*3);
    for(let i=0;i<a.count;i++)for(let j=0;j<3;j++){const v=a.isInterleavedBufferAttribute?a.data.array[i*a.data.stride+a.offset+j]:src[i*a.itemSize+j];f[i*3+j]=isInt?Math.max(v/k,-1):v/k}
    o.geometry.setAttribute("position",new THREE.BufferAttribute(f,3));
    o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  });
}
function loadGLTF(file){
  if(!cache[file]) cache[file]=new Promise((res,rej)=>loader().load(BASE+file,g=>{dequantize(g.scene);res(g)},undefined,rej));
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

/* где на самом деле подошвы: считаем кожу модели в позе «стоит» прямо на процессоре.
   Кость стопы выше подошвы на толщину ботинка, поэтому по костям ноги уходили в пол.
   Веса костей в сжатых моделях тоже целые числа (0..255), их делим сами. */
function soleY(model,gltf,entry){
  const spec=entry.clips&&(entry.clips.stand||entry.clips.idle);const name=spec&&(spec.clip||spec);
  const clip=name&&gltf.animations&&gltf.animations.find(a=>a.name===name);
  let mixer=null;
  if(clip){mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();mixer.update(0)}
  model.updateMatrixWorld(true);
  const ys=[],p=new THREE.Vector3(),t=new THREE.Vector3(),acc=new THREE.Vector3(),m=new THREE.Matrix4();
  model.traverse(o=>{
    if(!o.isSkinnedMesh) return;
    o.skeleton.update();
    const P=o.geometry.attributes.position,SI=o.geometry.attributes.skinIndex,SW=o.geometry.attributes.skinWeight;
    const wk=SW.normalized?(SW.array instanceof Uint8Array?255:SW.array instanceof Uint16Array?65535:1):1;
    const bm=o.skeleton.boneMatrices,step=Math.max(1,Math.floor(P.count/6000));
    for(let i=0;i<P.count;i+=step){
      p.fromBufferAttribute(P,i).applyMatrix4(o.bindMatrix);acc.set(0,0,0);let ws=0;
      for(let j=0;j<4;j++){const w=SW.getComponent?SW.getComponent(i,j)/wk:[SW.getX(i),SW.getY(i),SW.getZ(i),SW.getW(i)][j]/wk;if(!w)continue;
        const bi=[SI.getX(i),SI.getY(i),SI.getZ(i),SI.getW(i)][j];m.fromArray(bm,bi*16);t.copy(p).applyMatrix4(m);acc.addScaledVector(t,w);ws+=w}
      if(ws<.5) continue;
      acc.divideScalar(ws).applyMatrix4(o.bindMatrixInverse).applyMatrix4(o.matrixWorld);ys.push(acc.y);
    }
  });
  if(mixer){mixer.stopAllAction();mixer.uncacheRoot(model)}
  if(!ys.length) return null;
  ys.sort((a,b)=>a-b);return ys[Math.floor(ys.length*.002)];   /* не самая нижняя точка: одна кривая вершина не должна поднимать всю фигуру */
}

function attach(R,id,opt){
  opt=opt||{};
  ready.then(()=>{
    const entry=manifest.characters[id];
    if(!entry||!entry.file) return;
    return loadGLTF(entry.file).then(gltf=>{
      const model=THREE.SkeletonUtils?THREE.SkeletonUtils.clone(gltf.scene):gltf.scene.clone(true);
      normalize(model,entry);
      if(entry.footY==null){const y=soleY(model,gltf,entry);if(y!=null&&Math.abs(y)<.3)model.position.y-=y}
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(opt.ghost){o.material=opt.ghost;o.castShadow=false}}});
      if(SN.look){if(opt.ghost)SN.look.noEdges(model);else SN.look.adopt(model)}
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
      if(SN.look){if(entry.look!==false)SN.look.adopt(model);
        /* сканы и сильно упрощённые модели дают кашу из линий: "edges":false — контур только вокруг персонажей */
        if(entry.edges===false)SN.look.noEdges(model)}
      /* свет из заглушки оставляем, геометрию прячем */
      const keep=entry.keepPlaceholder|0; /* первые N кусков заглушки остаются (например ровная земля под ногами) */
      placeholder.children.forEach((ch,i)=>{if(i>=keep)ch.traverse(o=>{if(o.isMesh)o.visible=false})});
      group.add(model);
      /* изнутри видны однослойные стены: "doubleSide":true рисует их с обеих сторон */
      if(entry.doubleSide) model.traverse(o=>{if(o.isMesh&&o.material){o.material.side=THREE.DoubleSide}});
      /* скрыть куски модели по имени узла (кондиционер, лишнее поле): "hide":["Имя",…] */
      if(entry.hide) model.traverse(o=>{if(entry.hide.some(h=>o.name.indexOf(h)>=0))o.visible=false});
      if(SN.stage&&SN.stage.reground){group.updateMatrixWorld(true);SN.stage.reground()}
      return loadProps(group,entry);
    });
  }).catch(e=>console.warn("[SN] локация не загрузилась, остаётся заглушка:",id,e));
}

/* реквизит и фон к локации: "props":[{"file":"props/sofa.glb","offset":[x,y,z],"scale":1,"rotY":0,"edges":false}] */
function loadProps(group,entry){
  return Promise.all((entry.props||[]).map(pr=>loadGLTF(pr.file).then(gltf=>{
    const m=gltf.scene.clone(true);
    if(pr.scale) m.scale.setScalar(pr.scale);
    if(pr.offset) m.position.set(...pr.offset);
    if(pr.rotY) m.rotation.y=pr.rotY;
    m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
    if(SN.look){SN.look.adopt(m);if(pr.edges===false)SN.look.noEdges(m)}
    group.add(m);
  }).catch(e=>console.warn("[SN] реквизит не загрузился:",pr.file,e))));
}
/* в manifest "clips": {"поза":"ИмяКлипа"} — играет по кругу;
   {"clip":"Имя","once":true} — один раз и замирает на последнем кадре;
   {"clip":"Имя","at":1.2} — стоп-кадр на этой секунде (например, «на колене» из «встать с колена») */
function playClip(R,name,instant){
  if(!R.mixer||!R.clips) return;
  let spec=(R.entry&&R.entry.clips&&R.entry.clips[name])||(R.clips[name]?name:null);
  if(typeof spec==="string") spec={clip:spec};
  const clip=spec&&R.clips[spec.clip];
  if(!clip){if(R.action){R.action.fadeOut(.3);R.action=null}return}
  const a=R.mixer.clipAction(clip);
  if(R.action===a&&R.actionSpec===JSON.stringify(spec)) return;
  /* кадр: поза встаёт сразу, без перетекания из прошлой */
  if(instant){R.mixer.stopAllAction();a.reset();a.enabled=true;a.setEffectiveWeight(1);a.timeScale=spec.at!=null?0:1;
    if(spec.once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true}else a.setLoop(THREE.LoopRepeat,Infinity);
    if(spec.at!=null)a.time=Math.min(spec.at,clip.duration);a.play();R.mixer.update(0);R.action=a;R.actionSpec=JSON.stringify(spec);return}
  a.reset();a.enabled=true;a.timeScale=1;
  if(spec.once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true}else a.setLoop(THREE.LoopRepeat,Infinity);
  if(spec.at!=null){a.time=Math.min(spec.at,clip.duration);a.timeScale=0}
  if(R.action&&R.action!==a){a.play();a.crossFadeFrom(R.action,.35,false)}else a.fadeIn(.35).play();
  R.action=a;R.actionSpec=JSON.stringify(spec);
}

/* лица — варианты текстур: "faces":{"smile":"faces/naruto_smile.webp",…} */
function setFace(R,name){
  if(!R.faceMesh||!R.entry||!R.entry.faces) return;
  const f=R.entry.faces[name]||R.entry.faces.neutral;if(!f) return;
  if(!texCache[f]){texCache[f]=new THREE.TextureLoader().load(BASE+f);texCache[f].flipY=false;texCache[f].encoding=THREE.sRGBEncoding}
  R.faceMesh.material=R.faceMesh.material.clone();R.faceMesh.material.map=texCache[f];R.faceMesh.material.needsUpdate=true;
}

/* без клипа: углы поз заглушки поворачивают кости модели */
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_ax={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
function driveBones(R,v){
  if(R.action) return;
  if(R.glb) R.glb.position.y=R.glbY+(v.y-.95);
  const B=R.bones,A=R.axes,rest=R.rest;
  /* armDown: [ось, угол] — опустить руки из A/T-позы модели в «руки вдоль тела» заглушки */
  const ad=(R.entry&&R.entry.armDown)||null;
  const set=(k,ang)=>{if(!B[k])return;const [ax,sg]=A[k]||["x",1];B[k].quaternion.copy(rest[k]);
    B[k].quaternion.multiply(_q.setFromAxisAngle(_ax[ax],ang*sg));
    if(ad&&(k==="shL"||k==="shR"))B[k].quaternion.multiply(_q2.setFromAxisAngle(_ax[ad[0]],ad[1]*(k==="shL"?1:-1)))};
  set("spine",v.sp);set("neck",v.nx);set("thL",v.thL);set("thR",v.thR);set("knL",v.knL);set("knR",v.knR);
  set("shL",v.shLx);set("shR",v.shRx);set("elL",v.elL);set("elR",v.elR);
}

SN.models={ready,attach,attachLocation,playClip,setFace,driveBones,get manifest(){return manifest}};
})();
