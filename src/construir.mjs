// Prepara el proyecto HyperFrames a partir de un JSON de datos.
// Uso: node src/construir.mjs datos.json    (o variable de entorno REEL_DATA con el JSON)
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { construirHTML } from "./plantilla.mjs";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PROY = path.join(RAIZ, "plantilla");
const FOTOS = path.join(PROY, "assets", "fotos");

async function leerDatos() {
  if (process.env.REEL_DATA) return JSON.parse(process.env.REEL_DATA);
  const f = process.argv[2];
  if (!f) throw new Error("Falta el archivo de datos (node src/construir.mjs datos.json)");
  return JSON.parse(await fs.readFile(f, "utf8"));
}

async function obtener(fuente) {
  if (/^https?:\/\//.test(fuente)) {
    const r = await fetch(fuente);
    if (!r.ok) throw new Error(`No se pudo descargar la foto (${r.status}): ${fuente}`);
    return Buffer.from(await r.arrayBuffer());
  }
  return fs.readFile(path.resolve(fuente));
}

// Endereza (EXIF), recorta lo mínimo y deja la foto cubriendo 1080×1920.
async function prepararFoto(fuente, n) {
  const derecha = await sharp(await obtener(fuente)).rotate().toBuffer();
  const img = sharp(derecha);
  const { width, height } = await img.metadata();
  const k = Math.max(1080 / width, 1920 / height);
  const w = Math.max(1080, Math.round(width * k)), h = Math.max(1920, Math.round(height * k));
  const archivo = `foto${String(n).padStart(2, "0")}.jpg`;
  await img.resize(w, h, { fit: "cover" }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(FOTOS, archivo));
  return { src: `assets/fotos/${archivo}`, w, h };
}

// Completa las fotos que falten usando la lista "fotos" en orden (y repite si no alcanzan).
function asignarFotos(d) {
  const lista = [...(d.fotos || [])];
  const huecos = [];
  const pedir = (obj, clave) => { if (obj && !obj[clave]) huecos.push([obj, clave]); };
  if (!d.portada) huecos.push([d, "portada"]);
  (d.pasos || []).forEach((p) => pedir(p, "foto"));
  if (d.equipo) pedir(d.equipo, "foto");
  if (d.atendida) pedir(d.atendida, "foto");
  if (d.proxima) pedir(d.proxima, "foto");
  if (huecos.length && !lista.length) throw new Error("No hay fotos para el Reel");
  huecos.forEach(([o, c], i) => { o[c] = lista[i % lista.length]; });
}

export async function construir(d) {
  asignarFotos(d);
  await fs.rm(FOTOS, { recursive: true, force: true });
  await fs.mkdir(FOTOS, { recursive: true });

  const cache = new Map();
  let n = 0;
  const foto = async (fuente) => {
    if (!cache.has(fuente)) cache.set(fuente, await prepararFoto(fuente, ++n));
    return cache.get(fuente);
  };

  d.portada = await foto(d.portada);
  for (const p of d.pasos || []) p.foto = await foto(p.foto);
  if (d.equipo) d.equipo.foto = await foto(d.equipo.foto);
  if (d.atendida) d.atendida.foto = await foto(d.atendida.foto);
  if (d.proxima) d.proxima.foto = await foto(d.proxima.foto);

  await fs.writeFile(path.join(PROY, "index.html"), construirHTML(d));
  return d;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = await leerDatos();
  await construir(d);
  console.log("Proyecto listo en", PROY);
}
