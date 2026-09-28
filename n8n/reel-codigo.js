// ============ REEL · va antes de "Procesar mensaje" ============
// /reel <datos>  → arma un Reel con las fotos recientes (GitHub Actions + HyperFrames)
// Webhook Reel   → recibe el video listo y lo envía a Telegram para aprobar
// Botones        → ✅ publica en Instagram (Reel) y Facebook (video) · 🗑️ descarta
// Todo lo demás pasa sin cambios a "Procesar mensaje".
const cfg = $('Config').first().json;
const store = $getWorkflowStaticData('global');
const H = this.helpers;
const TG = `https://api.telegram.org/bot${cfg.tgToken}`;
const REPO = cfg.githubRepo || 'fborjaf07/reels-riobamba';
const WEBHOOK = cfg.reelWebhook || 'https://betoborja07.app.n8n.cloud/webhook/reel-listo-569028c8af58edbc';
const G = `https://graph.facebook.com/${cfg.graphVersion || 'v23.0'}`;
const GI = `https://graph.instagram.com/${cfg.graphVersion || 'v23.0'}`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const http = (o) => H.httpRequest({ json: true, timeout: 90000, ...o });
const post = (url, body) => http({ method: 'POST', url, body, headers: { 'Content-Type': 'application/json' } });
const tg = (metodo, body) => http({ method: 'POST', url: `${TG}/${metodo}`, body });
const decir = (chat, text, extra = {}) => tg('sendMessage', { chat_id: chat, text, ...extra });
const errMsg = (e) => { const d = e?.response?.data || e?.response?.body || e?.cause?.response?.data || e?.cause?.response?.body || e?.description; let t = d ? (d.error?.message || d.description || d.message || (typeof d === 'string' ? d : JSON.stringify(d))) : (e?.message || String(e)); return String(t).slice(0, 400); };
const paso = (nombre, p) => p.catch((e) => { throw new Error(`${nombre}: ${errMsg(e)}`); });
const CLD = `https://api.cloudinary.com/v1_1/${cfg.cloudinaryCloud}`;
const tagReel = (from) => `reel_${from}`;
store.reels = store.reels || {};
store.reelCorte = store.reelCorte || {};

// Limpieza: reels de más de 7 días
for (const [k, r] of Object.entries(store.reels)) if (Date.now() - (r.t || 0) > 7 * 864e5) delete store.reels[k];

// ---------- ¿De dónde viene esta ejecución? ----------
let webhook = null;
try { webhook = $('Webhook Reel').first().json; } catch (e) { webhook = null; }

// ======================= 1) Llega el video desde GitHub =======================
if (webhook) {
  const b = webhook.body || {};
  const r = store.reels[b.id];
  if (!r) return [];
  if (!b.ok) {
    r.estado = 'error';
    await decir(r.chat, `⚠️ No se pudo armar el Reel. Revisa el detalle aquí: ${b.run || 'GitHub Actions'}\n\nPuedes volver a intentarlo con /reel.`);
    return [];
  }
  if (!new RegExp(`^https://res\\.cloudinary\\.com/${cfg.cloudinaryCloud}/video/upload/`).test(b.video_url || '')) return [];
  r.video = b.video_url;
  r.estado = 'listo';
  await tg('sendVideo', { chat_id: r.chat, video: r.video, supports_streaming: true, caption: `🎬 Reel listo · ${Math.round(b.duracion || 0)} s` });
  const dudas = (r.dudas || []).length ? `\n\n⚠️ *Revisa:*\n${r.dudas.map((d) => `• ${d}`).join('\n')}` : '';
  const texto = `*INSTAGRAM*\n${r.instagram}\n\n*FACEBOOK*\n${r.facebook}${dudas}`.slice(0, 4000);
  await decir(r.chat, texto, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '✅ Publicar Reel', callback_data: `rpub:${b.id}` }, { text: '🗑️ Descartar', callback_data: `rno:${b.id}` }]] },
  }).catch(() => decir(r.chat, texto.replace(/\*/g, ''), { reply_markup: { inline_keyboard: [[{ text: '✅ Publicar Reel', callback_data: `rpub:${b.id}` }, { text: '🗑️ Descartar', callback_data: `rno:${b.id}` }]] } }));
  return [];
}

// ======================= 2) Mensajes y botones de Telegram =======================
const u = $('Telegram Trigger').first().json;
const pasar = () => $input.all();
const autorizado = (id) => (cfg.usuariosAutorizados || []).map(String).includes(String(id));

// ---------- Botones del Reel ----------
const cq = u.callback_query;
if (cq && /^r(pub|no):/.test(cq.data || '')) {
  const [accion, id] = cq.data.split(':');
  const chat = cq.message?.chat?.id;
  if (!autorizado(cq.from?.id)) { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'No autorizado' }); return []; }
  const r = store.reels[id];
  const quitarBotones = () => tg('editMessageReplyMarkup', { chat_id: chat, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  if (!r || !r.video) { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ese Reel ya no está disponible' }); await quitarBotones(); return []; }
  if (accion === 'rno') {
    r.estado = 'descartado';
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Descartado' });
    await quitarBotones();
    await decir(chat, '🗑️ Reel descartado.');
    return [];
  }
  if (r.estado === 'publicando' || r.estado === 'publicado') { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ya se está publicando' }); return []; }
  r.estado = 'publicando';
  await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Publicando…' });
  await quitarBotones();
  await decir(chat, '⏳ Publicando el Reel en Instagram y Facebook… (1–3 min)');

  const res = [];
  // Instagram · Reel
  try {
    const tk = store.igTok?.valor || cfg.igToken;
    const c = await post(`${GI}/${cfg.igUserId}/media`, { media_type: 'REELS', video_url: r.video, caption: r.instagram, share_to_feed: 'true', access_token: tk });
    let estado = '';
    for (let i = 0; i < 40; i++) {
      await dormir(6000);
      const s = await http({ url: `${GI}/${c.id}`, qs: { fields: 'status_code,status', access_token: tk } });
      estado = s.status_code;
      if (estado === 'FINISHED') break;
      if (estado === 'ERROR' || estado === 'EXPIRED') throw new Error(`Instagram no pudo procesar el video (${s.status || estado})`);
    }
    if (estado !== 'FINISHED') throw new Error('Instagram tardó demasiado en procesar el video');
    const p = await post(`${GI}/${cfg.igUserId}/media_publish`, { creation_id: c.id, access_token: tk });
    let link = '';
    try { link = (await http({ url: `${GI}/${p.id}`, qs: { fields: 'permalink', access_token: tk } })).permalink || ''; } catch (e) {}
    res.push(`✅ Instagram: publicado ${link}`.trim());
  } catch (e) { res.push(`❌ Instagram: ${errMsg(e)}`); }
  // Facebook · video en la Página
  try {
    const f = await post(`${G}/${cfg.pageId}/videos`, { file_url: r.video, description: r.facebook, access_token: cfg.pageToken });
    res.push(`✅ Facebook: publicado https://www.facebook.com/${f.id}`);
  } catch (e) { res.push(`❌ Facebook: ${errMsg(e)}`); }

  r.estado = res.some((x) => x.startsWith('✅')) ? 'publicado' : 'listo';
  await decir(chat, `${res.join('\n')}\n\n📲 TikTok: descarga el video de arriba y súbelo desde la app con este texto:\n${r.tiktok || ''}`);
  return [];
}

// ---------- Mensajes ----------
const m = u.message || u.edited_message;
if (!m || !autorizado(m.from?.id)) return pasar();
const from = String(m.from.id);
const chat = m.chat.id;

// Registrar fotos para el Reel (y dejarlas pasar para el flujo normal)
const img = m.photo?.length ? m.photo[m.photo.length - 1].file_id : (m.document && /^image\//.test(m.document.mime_type || '') ? m.document.file_id : null);
if (img) {
  try {
    const g = await tg('getFile', { file_id: img });
    await post(`${CLD}/image/upload`, { file: `https://api.telegram.org/file/bot${cfg.tgToken}/${g.result.file_path}`, upload_preset: cfg.cloudinaryPreset, folder: 'reels/fotos', tags: tagReel(from) });
  } catch (e) { /* si falla, el flujo normal de fotos sigue igual */ }
  return pasar();
}

const txt = (m.text || '').trim();
if (!/^\/reel\b/i.test(txt)) return pasar();

// ======================= 3) /reel → armar el video =======================
const AYUDA = `🎬 *Cómo pedir un Reel*
1. Envía 3 a 8 fotos de la jornada.
2. Escribe /reel seguido de los datos, por ejemplo:

/reel Bacheo en la Plataforma M: calles México, Carabobo, Luz Elisa Borja y Av. Cordovez. Hicimos fresado, asfalto y compactación. Próxima: Plataforma C, sector Hospital Andino.

En unos 3 minutos te llega el video para aprobar.`;
const datosTxt = txt.replace(/^\/reel(@\w+)?/i, '').trim();
let lista = [];
if (datosTxt) {
  try {
    const r = await http({ url: `${CLD}/resources/image/tags/${tagReel(from)}`, qs: { max_results: 50 }, auth: { username: cfg.cloudinaryKey, password: cfg.cloudinarySecret } });
    const desde = Math.max(Date.now() - 48 * 3600e3, store.reelCorte[from] || 0);
    lista = (r.resources || []).map((x) => ({ url: x.secure_url, t: Date.parse(x.created_at) })).filter((x) => x.t > desde).sort((a, b) => a.t - b.t);
  } catch (e) { await decir(chat, `⚠️ No pude leer tus fotos en Cloudinary: ${errMsg(e)}`); return []; }
}
if (!datosTxt) { await decir(chat, AYUDA, { parse_mode: 'Markdown' }); return []; }
if (lista.length < 3) { await decir(chat, `📷 Necesito al menos 3 fotos recientes para el Reel (tengo ${lista.length}). Envíalas y repite /reel.`); return []; }
if (!cfg.githubToken) { await decir(chat, '⚠️ Falta configurar githubToken en el nodo Config para poder armar Reels.'); return []; }

await decir(chat, `🎬 Armando tu Reel con ${Math.min(lista.length, 8)} fotos… te aviso en unos 3 minutos.`);
try {
  // 1. Fotos ya subidas (las 8 más recientes)
  const fotos = lista.slice(-8).map((x) => x.url);

  // 2. Claude ordena los datos, elige qué foto va en cada escena y redacta los textos
  const system = `${cfg.estilo || ''}
Preparas un Reel de la campaña "Riobamba en Construcción" (Alcaldía de la Gente de Riobamba, Dirección de Gestión de Obras Públicas). La cuadrilla se llama "Escuadrón Panal" y el equipo completo "Colmena Vial". Las "plataformas" son los sectores de la ciudad donde se atiende (ej. Plataforma M, Plataforma C · sector Hospital Andino).
Recibes fotos numeradas desde 0 y los datos del día. Devuelve SOLO un objeto JSON válido, sin texto adicional, con esta forma:
{"tema":{"linea1":"Bacheo de","linea2":"la semana"},
 "portada":0,
 "pasos":[{"foto":1,"titulo":"Fresado","texto":"Retiramos el asfalto dañado"}],
 "equipo":{"foto":2},
 "atendida":{"frase":"Atendimos la","plataforma":"M","sector":"","calles":["Calle México"],"foto":3},
 "proxima":{"plataforma":"C","sector":"Sector Hospital Andino","foto":4},
 "instagram":"...","facebook":"...","tiktok":"...","dudas":["..."]}
Reglas:
- tema: dos líneas cortas (máx. 14 caracteres cada una) según el trabajo; por defecto "Bacheo de" / "la semana".
- pasos: 1 a 3 etapas que se vean en las fotos o estén en los datos (título de 1–2 palabras, texto de máximo 40 caracteres). No inventes etapas.
- Usa cada foto en la escena que mejor la represente; la portada debe ser la más llamativa. Puedes repetir foto solo si no alcanzan.
- calles: sin repetir (una intersección nombrada de dos formas es la misma), nombres propios corregidos (tildes, mayúsculas: García Moreno, Cordovez), con prefijo "Calle" o "Av.". Las calles que solo delimitan un tramo ("entre X y Y") no se listan como intervenidas.
- atendida.frase: "Atendimos la" si el trabajo terminó, "Hoy atendemos la" si está en curso, "Comenzamos en la" si recién empieza (según los datos). Si no dan calles, "calles": [] y pon en "sector" el barrio o referencia si lo mencionan.
- plataforma: solo la letra o nombre tal como lo dan (ej. "M"). Si no hay próxima plataforma en los datos, "proxima": null.
- Textos en español de Ecuador, dirigidos a jóvenes de 12 a 24 años, siempre con "ustedes". instagram: gancho + 60–120 palabras + 8–15 hashtags (incluye #RiobambaEnConstrucción). facebook: 80–150 palabras, máx. 3 hashtags. tiktok: máx. 150 caracteres con 3–5 hashtags.
- No inventes cifras, fechas, nombres ni lugares. Si algo es ambiguo, anótalo en "dudas".`;
  const content = fotos.map((url) => ({ type: 'image', source: { type: 'url', url: url.replace('/upload/', '/upload/w_900,f_jpg/') } }));
  content.push({ type: 'text', text: `Datos del día:\n${datosTxt}` });
  const ai = await paso('Claude', http({
    method: 'POST', url: 'https://api.anthropic.com/v1/messages',
    headers: { 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: { model: cfg.model || 'claude-sonnet-5', max_tokens: 3000, system, messages: [{ role: 'user', content }] },
  }));
  const t = (ai.content || []).map((c) => c.text || '').join('');
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  const F = (i) => fotos[Math.min(Math.max(0, Number(i) || 0), fotos.length - 1)];

  // 3. Datos para la plantilla
  const id = 'r' + Date.now().toString(36);
  const datos = {
    id,
    tema: j.tema,
    etiqueta: 'Escuadrón Panal en acción',
    portada: F(j.portada),
    pasos: (j.pasos || []).slice(0, 3).map((p) => ({ foto: F(p.foto), titulo: p.titulo, texto: p.texto })),
    equipo: { foto: F(j.equipo?.foto ?? fotos.length - 1) },
    atendida: j.atendida ? { frase: j.atendida.frase || 'Atendimos la', plataforma: j.atendida.plataforma, sector: j.atendida.sector || '', calles: [...new Set(j.atendida.calles || [])], foto: F(j.atendida.foto) } : undefined,
    proxima: j.proxima && j.proxima.plataforma ? { plataforma: j.proxima.plataforma, sector: j.proxima.sector || '', foto: F(j.proxima.foto) } : undefined,
    hashtag: '#RiobambaEnConstrucción',
  };

  // 4. Encargar el video a GitHub
  await paso('GitHub', http({
    method: 'POST', url: `https://api.github.com/repos/${REPO}/actions/workflows/reel.yml/dispatches`,
    headers: { Authorization: `Bearer ${cfg.githubToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'n8n-reels-riobamba' },
    body: { ref: 'main', inputs: { datos: JSON.stringify(datos), callback: WEBHOOK } },
  }));

  store.reels[id] = { t: Date.now(), chat, from, estado: 'armando', instagram: j.instagram, facebook: j.facebook, tiktok: j.tiktok, dudas: j.dudas || [] };
  store.reelCorte[from] = lista[lista.length - 1].t;
  store.corte = { ...(store.corte || {}), [from]: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };

  const a = datos.atendida;
  await decir(chat, [
    '📝 Esto entendí para el Reel:',
    a ? `• ${a.frase} Plataforma ${a.plataforma}${a.sector ? ` (${a.sector})` : ''}${a.calles.length ? `: ${a.calles.join(', ')}` : ''}` : '',
    datos.pasos.length ? `• Etapas: ${datos.pasos.map((p) => p.titulo).join(' → ')}` : '',
    datos.proxima ? `• Próxima: Plataforma ${datos.proxima.plataforma}${datos.proxima.sector ? ` (${datos.proxima.sector})` : ''}` : '• Sin próxima parada',
    (j.dudas || []).length ? `\n⚠️ Dudas: ${j.dudas.join(' · ')}` : '',
    '\nSi algo está mal, descártalo cuando llegue y repite /reel con la corrección.',
  ].filter(Boolean).join('\n'));
} catch (e) {
  await decir(chat, `⚠️ No pude armar el Reel: ${errMsg(e)}`);
}
return [];
