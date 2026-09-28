// Genera el HTML de HyperFrames a partir de los datos del Reel.
// Marca: Riobamba en Construcción · Alcaldía de la Gente.

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const DUR = { portada: 3, paso: 3, equipo: 2.8, atendida: 4.5, proxima: 3.2, cierre: 2.4 };

// Movimiento de cámara según la forma de la foto (paneo + zoom suave).
function camara(f, i) {
  const dx = Math.max(0, f.w - 1080);
  const dy = Math.max(0, f.h - 1920);
  const ida = i % 2 === 0;
  if (dx > 80) {
    const a = -dx * (ida ? 0.75 : 0.25), b = -dx * (ida ? 0.35 : 0.6);
    return { from: { x: Math.round(a), y: 0 }, to: { x: Math.round(b), y: 0 } };
  }
  if (dy > 80) {
    const a = -dy * (ida ? 0.2 : 0.7), b = -dy * (ida ? 0.55 : 0.35);
    return { from: { x: 0, y: Math.round(a) }, to: { x: 0, y: Math.round(b) } };
  }
  return { from: { x: -Math.round(dx / 2), y: -Math.round(dy / 2) }, to: { x: -Math.round(dx / 2), y: -Math.round(dy / 2) } };
}

export function construirHTML(d) {
  const escenas = [];
  let t = 0;
  const add = (tipo, dur, extra) => { escenas.push({ tipo, t, dur, ...extra }); t = +(t + dur).toFixed(2); };

  add("portada", DUR.portada, { foto: d.portada });
  (d.pasos || []).forEach((p, k) => add("paso", DUR.paso, { foto: p.foto, paso: p, n: k + 1 }));
  if (d.equipo?.foto) add("equipo", DUR.equipo, { foto: d.equipo.foto });
  const nCalles = d.atendida?.calles?.length || 0;
  if (d.atendida) add("atendida", DUR.atendida + Math.max(0, nCalles - 6) * 0.25, { foto: d.atendida.foto });
  if (d.proxima) add("proxima", DUR.proxima, { foto: d.proxima.foto });
  const finFotos = t;
  add("cierre", DUR.cierre, {});
  const total = t;

  let html = "", js = "";
  const anim = (sel, from, to, at) => { js += `tl.fromTo(${JSON.stringify(sel)}, ${JSON.stringify(from)}, ${JSON.stringify(to)}, ${at.toFixed(2)});\n`; };
  const up = (sel, at, dist = 110) => anim(sel, { y: dist, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, at);

  escenas.forEach((e, i) => {
    if (e.tipo === "cierre") {
      html += `
      <video id="sting" class="sting clip" src="assets/cierre.mp4" muted playsinline data-start="${e.t}" data-duration="${e.dur}" data-track-index="1"></video>
      <audio id="sting-a" src="assets/cierre-audio.m4a" data-start="${e.t}" data-duration="${e.dur}" data-track-index="2"></audio>`;
      return;
    }
    const f = e.foto;
    const cam = camara(f, i);
    const oscuro = e.tipo === "atendida" ? "shade full" : "shade";
    let cuerpo = "";
    const s = e.t;

    if (e.tipo === "portada") {
      cuerpo = `
        <div class="cover">
          <div class="chakana" id="ck"><i style="background:#e63946"></i><i style="background:#f7941d"></i><i style="background:#ffc20e"></i><i style="background:#3aa757"></i><i style="background:#1e88e5"></i><i style="background:#6a3d9a"></i></div>
          <div class="badge" id="bdg" style="margin-top:24px">Riobamba <b>en Construcción</b></div>
          <div class="big"><span id="h1">${esc(d.tema?.linea1 ?? "Bacheo de")}</span><span id="h2" class="acc">${esc(d.tema?.linea2 ?? "la semana")}</span></div>
          <div class="bees" id="bees">
            <div class="hex">
              <svg viewBox="0 0 38 44" style="left:0;top:8px"><polygon points="19,1 37,11 37,33 19,43 1,33 1,11" fill="#ffc20e"/></svg>
              <svg viewBox="0 0 38 44" style="left:34px;top:-12px"><polygon points="19,1 37,11 37,33 19,43 1,33 1,11" fill="none" stroke="#ffc20e" stroke-width="3"/></svg>
              <svg viewBox="0 0 38 44" style="left:68px;top:8px"><polygon points="19,1 37,11 37,33 19,43 1,33 1,11" fill="#ffc20e" opacity=".55"/></svg>
            </div>
            ${esc(d.etiqueta ?? "Escuadrón Panal en acción")}
          </div>
        </div>`;
      anim("#ck", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.4, ease: "power3.out" }, s + 0.1);
      anim("#bdg", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "back.out(2)" }, s + 0.25);
      up("#h1", s + 0.45); up("#h2", s + 0.62);
      anim("#bees", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, s + 0.95);
    }

    if (e.tipo === "paso") {
      const id = `p${e.n}`;
      cuerpo = `
        <div class="step"><div class="num" id="${id}n">${String(e.n).padStart(2, "0")}</div><div class="stitle" id="${id}t">${esc(e.paso.titulo)}</div><div class="sdesc" id="${id}d">${esc(e.paso.texto || "")}</div></div>`;
      anim(`#${id}n`, { x: -200, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, s + 0.1);
      up(`#${id}t`, s + 0.25, 90);
      up(`#${id}d`, s + 0.55, 40);
    }

    if (e.tipo === "equipo") {
      cuerpo = `
        <div class="step" style="top:1080px"><div class="stitle tight" id="q1" style="font-size:96px">Detrás de cada bacheo</div><div class="stitle tight" id="q2" style="font-size:96px">existe la <span style="color:var(--acento)">Colmena Vial</span></div><div class="stitle tight" id="q3" style="font-size:96px;color:var(--miel)">en acción</div></div>`;
      up("#q1", s + 0.15, 90); up("#q2", s + 0.4, 90);
      anim("#q3", { scale: 0.6, opacity: 0, transformOrigin: "0% 50%" }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }, s + 0.7);
    }

    if (e.tipo === "atendida") {
      const a = d.atendida;
      cuerpo = `
        <div class="list-wrap">
          <div class="count-l" id="a1" style="font-size:80px;opacity:.9">Atendimos la</div>
          <div class="count" id="a2" style="font-size:158px;text-transform:uppercase">Plataforma ${esc(a.plataforma)}</div>
          ${a.sector ? `<div class="sdesc" id="a3" style="margin-top:8px">${esc(a.sector)}</div>` : ""}
          <ul id="streets">${(a.calles || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        </div>`;
      up("#a1", s + 0.1, 40);
      anim("#a2", { scale: 0.4, opacity: 0, transformOrigin: "0% 100%" }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)" }, s + 0.3);
      if (a.sector) up("#a3", s + 0.55, 30);
      js += `document.querySelectorAll("#streets li").forEach((li, k) => tl.fromTo(li, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: "power2.out" }, ${(s + 0.7).toFixed(2)} + k * ${Math.min(0.25, 2.6 / Math.max(1, (a.calles || []).length)).toFixed(3)}));\n`;
    }

    if (e.tipo === "proxima") {
      const p = d.proxima;
      cuerpo = `
        <div class="close">
          <div class="badge" id="x1">Próxima parada</div>
          <div class="big"><span id="x2">Atenderemos la</span><span id="x3" class="acc">Plataforma ${esc(p.plataforma)}</span></div>
          ${p.sector ? `<div class="sdesc" id="x4" style="margin-top:18px">${esc(p.sector)}</div>` : ""}
          <div class="hash" id="x5">${esc(d.hashtag ?? "#RiobambaEnConstrucción")}</div>
        </div>`;
      anim("#x1", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "back.out(2)" }, s + 0.1);
      up("#x2", s + 0.3); up("#x3", s + 0.5);
      if (p.sector) up("#x4", s + 0.85, 40);
      up("#x5", s + 1.1, 40);
    }

    html += `
      <div id="s${i}" class="scene clip" data-start="${s}" data-duration="${e.dur}" data-track-index="0">
        <img class="photo" id="ph${i}" src="${f.src}" style="width:${f.w}px;height:${f.h}px" alt="" />
        <div class="${oscuro}"></div>${cuerpo}
      </div>`;
    anim(`#ph${i}`, { ...cam.from, scale: 1.1, transformOrigin: "50% 50%" }, { ...cam.to, scale: 1.0, duration: e.dur, ease: "power1.out" }, s);
  });

  // Si la última escena con foto no es "próxima", el hashtag va al final de "atendida": no hace falta.
  anim("#logo", { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.05);

  return `<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Anton"; src: url("assets/anton.woff2") format("woff2"); font-weight: 400; }
      @font-face { font-family: "Inter"; src: url("assets/inter600.woff2") format("woff2"); font-weight: 600; }
      @font-face { font-family: "Inter"; src: url("assets/inter800.woff2") format("woff2"); font-weight: 800; }
      :root { --oscuro: #23315e; --acento: #f7941d; --miel: #ffc20e; --claro: #ffffff; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: var(--oscuro); }
      #root { position: relative; width: 1080px; height: 1920px; overflow: hidden; font-family: "Inter", sans-serif; color: var(--claro); }
      .scene { position: absolute; inset: 0; overflow: hidden; }
      .photo { position: absolute; top: 0; left: 0; max-width: none; will-change: transform; }
      .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(35,49,94,.55) 0%, rgba(35,49,94,0) 26%, rgba(35,49,94,0) 46%, rgba(35,49,94,.92) 76%, rgba(35,49,94,.97) 100%); }
      .shade.full { background: rgba(35,49,94,.84); }
      .chakana { display: flex; height: 16px; width: 360px; border-radius: 8px; overflow: hidden; }
      .chakana i { flex: 1; }
      #hud { position: absolute; inset: 0; z-index: 50; pointer-events: none; }
      #logo { position: absolute; top: 70px; left: 48px; }
      #logo img { display: block; height: 96px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.55)) drop-shadow(0 6px 18px rgba(0,0,0,.35)); }
      .cover { position: absolute; left: 60px; right: 60px; top: 960px; }
      .badge { display: inline-flex; align-items: center; gap: 14px; background: var(--claro); color: var(--oscuro); font-weight: 800; font-size: 36px; letter-spacing: .06em; padding: 14px 24px; border-radius: 12px; text-transform: uppercase; }
      .badge b { font-family: "Anton", sans-serif; font-weight: 400; color: var(--acento); letter-spacing: .02em; }
      .big { font-family: "Anton", sans-serif; font-size: 176px; line-height: 1.14; text-transform: uppercase; margin-top: 28px; }
      .big span { display: block; white-space: nowrap; }
      .big .acc { color: var(--acento); }
      .bees { display: flex; align-items: center; gap: 20px; margin-top: 34px; font-weight: 800; font-size: 50px; color: var(--miel); }
      .hex { width: 104px; height: 60px; position: relative; flex: none; }
      .hex svg { position: absolute; width: 38px; height: 44px; }
      .step { position: absolute; left: 60px; right: 60px; top: 1120px; }
      .num { font-family: "Anton", sans-serif; font-size: 120px; line-height: 1.05; color: var(--acento); }
      .stitle { font-family: "Anton", sans-serif; font-size: 136px; line-height: 1.14; text-transform: uppercase; white-space: nowrap; }
      .stitle.tight { line-height: 1.28; }
      .sdesc { font-weight: 600; font-size: 50px; line-height: 1.2; margin-top: 22px; max-width: 940px; }
      .list-wrap { position: absolute; left: 60px; right: 60px; top: 330px; }
      .count { font-family: "Anton", sans-serif; font-size: 300px; line-height: 1.02; color: var(--acento); white-space: nowrap; }
      .count-l { font-family: "Anton", sans-serif; font-size: 92px; line-height: 1.14; text-transform: uppercase; margin-top: 6px; white-space: nowrap; }
      ul { list-style: none; margin-top: 44px; }
      li { font-weight: 600; font-size: 46px; line-height: 1.2; padding: 20px 0 20px 46px; border-bottom: 2px solid rgba(255,255,255,.14); position: relative; }
      li::before { content: ""; position: absolute; left: 0; top: 0.95em; width: 20px; height: 20px; border-radius: 50%; background: var(--acento); }
      .close { position: absolute; left: 60px; right: 60px; top: 1000px; }
      .close .big { font-size: 160px; }
      .hash { margin-top: 36px; font-weight: 800; font-size: 50px; color: var(--miel); }
      .sting { position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; background: #f6f7fa; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
${html}
      <div id="hud" class="clip" data-start="0" data-duration="${finFotos}" data-track-index="3">
        <div id="logo"><img src="assets/logo-riobamba-blanco.png" alt="Riobamba · Alcaldía de la Gente" /></div>
      </div>
    </div>
    <script>
      // Ajuste automático: ningún título se sale del borde ni se encima.
      function ajustarTextos() {
        document.querySelectorAll(".big span, .stitle, .count, .count-l").forEach((el) => {
          el.style.fontSize = el.dataset.fs0 || el.style.fontSize;
          el.dataset.fs0 = el.style.fontSize;
          let fs = parseFloat(getComputedStyle(el).fontSize);
          const max = el.parentElement.clientWidth;
          while (el.scrollWidth > max && fs > 36) { fs -= 2; el.style.fontSize = fs + "px"; }
        });
        const ul = document.getElementById("streets");
        if (ul) {
          let fs = 46;
          while (ul.getBoundingClientRect().bottom > 1720 && fs > 26) {
            fs -= 2;
            ul.querySelectorAll("li").forEach((li) => { li.style.fontSize = fs + "px"; li.style.paddingTop = li.style.paddingBottom = (fs * 0.38) + "px"; });
          }
        }
      }
      ajustarTextos();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarTextos);

      const tl = gsap.timeline({ paused: true });
${js}
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
}
