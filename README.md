# Fábrica de Reels · Riobamba en Construcción

Convierte las fotos del día en un Reel vertical (1080×1920) con la marca **Riobamba en Construcción · Alcaldía de la Gente**.

**Flujo:** bot de Telegram (@Publicador_beto_bot) → n8n → GitHub Actions (este repo) → Cloudinary → n8n → vista previa en Telegram → ✅ publicar en Instagram y Facebook.

## Estructura del Reel

1. **Portada:** «Riobamba en Construcción», el título (p. ej. *Bacheo de la semana*) y «Escuadrón Panal en acción».
2. **Pasos (1 a 4):** número, título y descripción corta, cada uno sobre una foto.
3. **Equipo:** «Detrás de cada bacheo existe la Colmena Vial en acción».
4. **Plataforma atendida:** la plataforma y la lista de calles, sin repetir ninguna.
5. **Próxima parada:** la plataforma que se atiende después y su sector (opcional).
6. **Cierre:** el video institucional de la Alcaldía.

Los textos largos se achican solos para no salirse del borde ni encimarse.

## Datos de entrada (JSON)

```json
{
  "id": "2026-09-27-plataforma-m",
  "tema": { "linea1": "Bacheo de", "linea2": "la semana" },
  "etiqueta": "Escuadrón Panal en acción",
  "fotos": ["https://res.cloudinary.com/.../1.jpg", "https://.../2.jpg"],
  "pasos": [
    { "titulo": "Fresado", "texto": "Retiramos el asfalto dañado" },
    { "titulo": "Asfalto", "texto": "Colocamos y nivelamos la mezcla" },
    { "titulo": "Compactación", "texto": "El rodillo deja la vía lista" }
  ],
  "equipo": {},
  "atendida": { "plataforma": "M", "calles": ["Calle México", "Av. Cordovez"] },
  "proxima": { "plataforma": "C", "sector": "Sector Hospital Andino" },
  "hashtag": "#RiobambaEnConstrucción"
}
```

- Cada escena puede traer su propia `foto`. Las que no la traen toman las de `fotos` en orden, y se repiten si no alcanzan.
- `equipo` y `proxima` son opcionales: si faltan, esa escena no aparece.

## Uso

**Desde n8n (automático):** dispara el workflow *Fabricar Reel* con los campos `datos` (el JSON como texto) y `callback` (el webhook de n8n). Al terminar, el webhook recibe `{ ok, id, video_url, duracion, run }`.

**En tu computadora:**

```bash
npm ci
node src/construir.mjs ejemplos/bacheo-plataforma-m.json
cd plantilla && npx hyperframes render --output ../salida/reel.mp4
```

## Cambiar la marca

- Colores, tipografías y diseño: `src/plantilla.mjs` (variables `--oscuro`, `--acento` y `--miel`).
- Logo y video de cierre: `plantilla/assets/`.
