import { supabase } from "./supabaseClient.js";

export const CATEGORIAS = [
  { value: "himno", label: "Himno" },
  { value: "corito", label: "Corito" },
  { value: "especial", label: "Canto especial" },
  { value: "adoracion", label: "Adoración" },
];

export async function listCanciones() {
  const { data, error } = await supabase.from("canciones").select("*").order("titulo", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getCancionCompleta(id) {
  const [cancion, secciones, estructura, diapositivas] = await Promise.all([
    supabase.from("canciones").select("*").eq("id", id).single(),
    supabase.from("secciones_cancion").select("*").eq("cancion_id", id),
    supabase.from("estructura_cancion").select("*").eq("cancion_id", id).order("orden", { ascending: true }),
    supabase.from("diapositivas_letra").select("*").eq("cancion_id", id).order("orden", { ascending: true }),
  ]);
  if (cancion.error) throw cancion.error;
  if (secciones.error) throw secciones.error;
  if (estructura.error) throw estructura.error;
  if (diapositivas.error) throw diapositivas.error;
  return { cancion: cancion.data, secciones: secciones.data, estructura: estructura.data, diapositivas: diapositivas.data };
}

export async function createCancion(datos, creadoPor) {
  const { data, error } = await supabase.from("canciones").insert({ ...datos, creado_por: creadoPor }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCancion(id, datos) {
  const { error } = await supabase.from("canciones").update({ ...datos, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteCancion(id) {
  const { error } = await supabase.from("canciones").delete().eq("id", id);
  if (error) throw error;
}

// Reemplaza por completo las secciones/estructura/diapositivas de una canción con las que se
// traen del editor — más simple y confiable que calcular diffs, y el volumen por canción es chico.
export async function guardarSecciones(cancionId, secciones) {
  const { error: delErr } = await supabase.from("secciones_cancion").delete().eq("cancion_id", cancionId);
  if (delErr) throw delErr;
  if (secciones.length === 0) return;
  const { error } = await supabase.from("secciones_cancion").insert(secciones.map((s) => ({ ...s, cancion_id: cancionId })));
  if (error) throw error;
}

export async function guardarEstructura(cancionId, estructura) {
  const { error: delErr } = await supabase.from("estructura_cancion").delete().eq("cancion_id", cancionId);
  if (delErr) throw delErr;
  if (estructura.length === 0) return;
  const { error } = await supabase.from("estructura_cancion").insert(
    estructura.map((e, i) => ({ cancion_id: cancionId, orden: i, seccion_clave: e.seccion_clave, multiplicador: e.multiplicador }))
  );
  if (error) throw error;
}

export async function guardarDiapositivas(cancionId, diapositivas) {
  const { error: delErr } = await supabase.from("diapositivas_letra").delete().eq("cancion_id", cancionId);
  if (delErr) throw delErr;
  if (diapositivas.length === 0) return;
  const { error } = await supabase.from("diapositivas_letra").insert(
    diapositivas.map((d, i) => ({ cancion_id: cancionId, seccion_clave: d.seccion_clave, orden_en_seccion: d.orden_en_seccion, texto: d.texto, orden: i }))
  );
  if (error) throw error;
}

// ---- Conversión entre el formato normalizado de Supabase (4 tablas) y el formato en memoria que
// usa el editor de canciones del prototipo (bloques por clave + estructura plana + letra agrupada
// por sección) — así el prototipo completo (editor de acordes, estructura, letra, Setlist, En vivo,
// Modo Músico...) puede seguir funcionando exactamente igual, solo que ahora sobre datos reales. ----
function stripChordsLocal(line) {
  return line.replace(/\[[^\]]+\]/g, "");
}

export function cancionCompletaAFormatoEditor({ cancion, secciones, estructura, diapositivas }) {
  const blocks = {};
  secciones.forEach((s) => {
    blocks[s.clave] = { badge: s.distintivo || "", label: s.etiqueta, bars: s.compases || 8, lines: (s.contenido || "").split("\n") };
  });
  const defaultStructure = [];
  estructura.forEach((e) => { for (let i = 0; i < (e.multiplicador || 1); i++) defaultStructure.push(e.seccion_clave); });
  const letra = {};
  diapositivas.forEach((d) => {
    if (!letra[d.seccion_clave]) letra[d.seccion_clave] = [];
    letra[d.seccion_clave].push((d.texto || "").split("\n"));
  });
  // El respaldo "derivar una diapositiva del Contenido" solo aplica si la canción JAMÁS ha pasado por
  // el editor de Letra (cero diapositivas guardadas en TODA la canción — típico de canciones de antes
  // de que existiera esta pestaña). Si ya se guardó aunque sea una vez, una sección sin diapositivas
  // significa que el usuario las borró todas a propósito (ej. una sección instrumental que no debe
  // proyectar nada) — no hay que resucitarlas solas en cada recarga.
  if (diapositivas.length === 0) {
    Object.keys(blocks).forEach((k) => { letra[k] = [blocks[k].lines.map(stripChordsLocal)]; });
  } else {
    Object.keys(blocks).forEach((k) => { if (!letra[k]) letra[k] = []; });
  }
  return {
    id: cancion.id, title: cancion.titulo, key: cancion.tonalidad, tempo: cancion.tempo || "",
    artist: cancion.artista || "", themes: cancion.temas || "", category: cancion.categoria,
    favorite: cancion.favorito, hasAttachment: false,
    defaultStructure, blocks, letra,
  };
}

export async function listCancionesCompletas() {
  const filas = await listCanciones();
  const completas = await Promise.all(filas.map((f) => getCancionCompleta(f.id)));
  return completas.map(cancionCompletaAFormatoEditor);
}

// Agrupa un array plano ['v1','c','v2','c'] en entradas {seccion_clave, multiplicador} consecutivas.
function agruparEstructura(flat) {
  const out = [];
  flat.forEach((clave) => {
    const last = out[out.length - 1];
    if (last && last.seccion_clave === clave) last.multiplicador += 1;
    else out.push({ seccion_clave: clave, multiplicador: 1 });
  });
  return out;
}

// Guarda una canción completa desde el formato en memoria del editor del prototipo — crea o
// actualiza según ya exista o no en la biblioteca cargada — y devuelve el id real en Supabase.
export async function guardarCancionDesdeEditor(draft, existeEnDb, userId) {
  const datosBase = {
    titulo: draft.title, artista: draft.artist || null, tonalidad: draft.key,
    tempo: draft.tempo ? Number(draft.tempo) : null, temas: draft.themes || null,
    categoria: draft.category, favorito: !!draft.favorite,
  };
  let id = draft.id;
  if (existeEnDb) {
    await updateCancion(id, datosBase);
  } else {
    const creada = await createCancion(datosBase, userId);
    id = creada.id;
  }
  const secciones = Object.entries(draft.blocks).map(([clave, b]) => ({
    clave, etiqueta: b.label, distintivo: b.badge, compases: b.bars || 8, contenido: (b.lines || []).join("\n"),
  }));
  const estructura = agruparEstructura(draft.defaultStructure);
  const diapositivas = [];
  Object.entries(draft.letra || {}).forEach(([clave, slides]) => {
    (slides || []).forEach((lines) => diapositivas.push({ seccion_clave: clave, orden_en_seccion: 0, texto: (lines || []).join("\n") }));
  });
  await guardarSecciones(id, secciones);
  await guardarEstructura(id, estructura);
  await guardarDiapositivas(id, diapositivas);
  return id;
}
