// Reel "tal cual": convierte imágenes ya diseñadas en un video vertical, sin recortarlas.
// Cada imagen va completa sobre un fondo desenfocado de sí misma, con un zoom suave y
// fundido entre imágenes, más música de fondo.
// Uso: node src/diapositivas.mjs datos.json salida/bruto.mp4
//   datos: { "fotos": ["https://…", …], "segundos": 3.5 }
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TMP = path.join(RAIZ, "salida", "diapos");
const MUSICA = path.join(RAIZ, "plantilla", "assets", "musica-diapos.m4a");
const W = 1080, H = 1920, FPS = 30, FUNDIDO = 0.5;

const d = JSON.parse(process.env.REEL_DATA || (await fs.readFile(process.argv[2], "utf8")));
const salida = path.resolve(process.argv[3] || "salida/bruto.mp4");
const fotos = (d.fotos || []).slice(0, 10);
if (!fotos.length) throw new Error("No hay imágenes para el Reel");
const seg = Math.min(6, Math.max(2.5, Number(d.segundos) || (fotos.length <= 4 ? 4 : 3.2)));

async function obtener(f) {
  if (!/^https?:\/\//.test(f)) return fs.readFile(path.resolve(f));
  const r = await fetch(f);
  if (!r.ok) throw new Error(`No se pudo descargar la imagen (${r.status}): ${f}`);
  return Buffer.from(await r.arrayBuffer());
}

// Imagen completa (contain) sobre su propia versión ampliada y desenfocada, al doble de tamaño
// para que el zoom no tiemble.
async function preparar(f, n) {
  const img = await sharp(await obtener(f)).rotate().toBuffer();
  const fondo = await sharp(img).resize(W * 2, H * 2, { fit: "cover" }).blur(60).modulate({ brightness: 0.55 }).toBuffer();
  const frente = await sharp(img).resize(W * 2, H * 2, { fit: "inside" }).toBuffer();
  const archivo = path.join(TMP, `d${String(n).padStart(2, "0")}.png`);
  await sharp(fondo).composite([{ input: frente, gravity: "center" }]).png().toFile(archivo);
  return archivo;
}

await fs.mkdir(TMP, { recursive: true });
const archivos = [];
for (let i = 0; i < fotos.length; i++) archivos.push(await preparar(fotos[i], i));

const marcos = Math.round(seg * FPS);
const args = ["-y", "-v", "error"];
for (const a of archivos) args.push("-loop", "1", "-framerate", String(FPS), "-t", String(seg), "-i", a);
args.push("-stream_loop", "-1", "-i", MUSICA);
const filtros = archivos.map((_, i) => {
  // Alterna acercar y alejar para que no se sienta repetitivo
  const z = i % 2 === 0 ? `1+0.06*on/${marcos}` : `1.06-0.06*on/${marcos}`;
  return `[${i}:v]zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},trim=duration=${seg},setsar=1,format=yuv420p[v${i}]`;
});
let ult = "v0", t = seg;
for (let i = 1; i < archivos.length; i++) {
  filtros.push(`[${ult}][v${i}]xfade=transition=fade:duration=${FUNDIDO}:offset=${(t - FUNDIDO).toFixed(3)}[x${i}]`);
  ult = `x${i}`; t += seg - FUNDIDO;
}
const total = t;
filtros.push(`[${archivos.length}:a]atrim=duration=${total.toFixed(3)},afade=t=in:d=0.6,afade=t=out:st=${(total - 1.2).toFixed(3)}:d=1.2,volume=0.8[a]`);
args.push("-filter_complex", filtros.join(";"), "-map", `[${ult}]`, "-map", "[a]",
  "-t", total.toFixed(3), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", salida);
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log(`Reel tal cual: ${archivos.length} imágenes, ${total.toFixed(1)} s → ${salida}`);
