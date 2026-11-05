// Сжатие .glb для игры: упрощение геометрии, meshopt, текстуры в webp.
//   node tools/compress.mjs исходник.glb models/имя.glb [--ratio 0.5] [--sloppy] [--tex 2048]
// --ratio   доля треугольников, которую оставить (1 = не упрощать). Персонажам обычно не нужно.
// --sloppy  грубое упрощение без учёта швов: для сканов и фотограмметрии (кладбища, улицы),
//           где обычное упрощение почти ничего не делает.
// --tex     максимальный размер текстуры в пикселях (по умолчанию 2048; персонажам хватит 1024–2048).
// Оригинал не трогается. В репозиторий кладём только результат.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, resample, join, flatten } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const args = process.argv.slice(2);
const [src, dst] = args.filter(a => !a.startsWith('--') && !/^[\d.]+$/.test(a));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
if (!src || !dst) { console.log('node tools/compress.mjs in.glb out.glb [--ratio 0.5] [--sloppy] [--tex 2048]'); process.exit(1); }
const ratio = Number(opt('ratio', 1)), sloppy = !!opt('sloppy', false), tex = Number(opt('tex', 2048));

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);

const tris = () => doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((n, p) => n + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);
console.log('треугольников было:', Math.round(tris()));

await doc.transform(dedup(), weld());

if (ratio < 1 && sloppy) {
  // грубое упрощение каждого куска до доли ratio
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices(), pos = prim.getAttribute('POSITION');
    if (!idx || !pos) continue;
    const indices = new Uint32Array(idx.getArray());
    const positions = new Float32Array(pos.getArray());
    const target = Math.max(3, Math.floor(indices.length * ratio / 3) * 3);
    const [out] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, target, 1);
    idx.setArray(new Uint32Array(out));
  }
} else if (ratio < 1) {
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }));
}

await doc.transform(
  resample(), prune(), flatten(), join(), weld(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' })
);
console.log('треугольников стало:', Math.round(tris()));
await io.write(dst, doc);
const mb = f => (statSync(f).size / 1048576).toFixed(1) + ' МБ';
console.log(`${src} (${mb(src)}) → ${dst} (${mb(dst)})`);
