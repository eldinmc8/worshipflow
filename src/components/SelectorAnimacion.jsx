import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Copy, Globe2 } from "lucide-react";
import { ANIMACIONES, GRUPOS_ANIMACION, animacionActiva, definicionDeReceta, MiniaturaAnimada, precargarFuentesAnimacion } from "./LetrasAnimadas.jsx";
import EditorAnimacion from "./EditorAnimacion.jsx";
import { listarAnimaciones, guardarAnimacion, borrarAnimacion } from "../lib/animacionesIglesia.js";
import { confirmDialog } from "../lib/confirm.js";
import { showToast } from "../lib/toast.js";

// Menú de "Letra animada" (panel de Estilo): estilos de fábrica, los de la iglesia ("De mi iglesia",
// creados en EditorAnimacion) y la galería de animaciones que otras iglesias compartieron.
// Al pasar el cursor por una tarjeta se ve la animación en vivo (como las miniaturas de YouTube).
export function SelectorAnimacion({ liveStyle, setLiveStyle, columnas = 3, iglesiaId, iglesiaNombre, usuarioId }) {
  const actual = animacionActiva(liveStyle);
  const fondoPropio = liveStyle?.animFondo === "propio";
  const [enVista, setEnVista] = useState(null);
  const [lista, setLista] = useState(undefined); // undefined = cargando · null = falta activar la tabla
  const [editando, setEditando] = useState(null); // { id?, nombre, receta, compartida }
  const [verGaleria, setVerGaleria] = useState(false);

  useEffect(() => { precargarFuentesAnimacion(); }, []);
  const recargar = useCallback(async () => {
    if (!iglesiaId) { setLista(null); return; }
    try { setLista(await listarAnimaciones(iglesiaId)); } catch { setLista(null); }
  }, [iglesiaId]);
  useEffect(() => { recargar(); }, [recargar]);

  const usarPropia = (fila) => setLiveStyle((s) => ({ ...s, animacion: `mia:${fila.id}`, animReceta: fila.receta, animNombre: fila.nombre }));
  const borrar = async (fila) => {
    if (!(await confirmDialog(`¿Borrar la animación "${fila.nombre}"?`, { textoConfirmar: "Borrar", danger: true }))) return;
    try {
      await borrarAnimacion(fila.id);
      if (actual === `mia:${fila.id}`) setLiveStyle((s) => ({ ...s, animacion: null }));
      showToast("Animación borrada", "info");
      recargar();
    } catch (e) { showToast(`No se pudo borrar: ${e.message || e}`, "error"); }
  };
  const copiar = async (fila) => {
    try {
      const nueva = await guardarAnimacion({ iglesiaId, nombre: fila.nombre, receta: fila.receta, compartida: false, autorIglesia: iglesiaNombre, usuarioId });
      showToast(`"${fila.nombre}" quedó en De mi iglesia`, "info");
      await recargar();
      usarPropia({ ...nueva, receta: fila.receta });
    } catch (e) { showToast(`No se pudo copiar: ${e.message || e}`, "error"); }
  };

  const tarjeta = (activo) => ({
    display: "flex", flexDirection: "column", gap: 4, padding: 5, borderRadius: 12, cursor: "pointer", textAlign: "left", minWidth: 0, position: "relative",
    background: "var(--wf-card)", border: activo ? "2px solid #B15EA0" : "1px solid var(--wf-border)", boxShadow: activo ? "0 3px 12px rgba(177,94,160,.25)" : "none",
  });
  const eventosVista = (id) => ({
    onMouseEnter: () => setEnVista(id), onMouseLeave: () => setEnVista((v) => (v === id ? null : v)),
    onFocus: () => setEnVista(id), onBlur: () => setEnVista((v) => (v === id ? null : v)),
  });
  // Miniatura quieta con "Aleluya" en la letra del estilo; al pasar el cursor, la animación de verdad.
  const miniatura = (id, a) => (
    <span style={{ position: "relative", aspectRatio: "16 / 9", width: "100%", borderRadius: 8, background: a.muestra, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <span className={id && !String(id).startsWith("mia") && !String(id).startsWith("gal") ? `wfa-muestra wfa-muestra-${id}` : undefined} style={{ fontFamily: a.fuente.family, fontWeight: a.fuente.weight, textTransform: a.fuente.transform || "none", color: a.degradado ? undefined : (a.colores ? a.colores[0] : a.color === "rgba(255,255,255,.3)" ? "#FFFFFF" : a.color), textShadow: a.sombra, fontSize: 17, lineHeight: 1 }}>Aleluya</span>
      {enVista === id && <MiniaturaAnimada clave={a.receta ? "mia:vista" : id} def={a.receta ? a : undefined} />}
    </span>
  );
  const pie = (nombre, desc) => (
    <>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text)", padding: "0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</span>
      {desc && <span style={{ fontSize: 10.5, color: "var(--wf-muted)", lineHeight: 1.3, padding: "0 2px 2px" }}>{desc}</span>}
    </>
  );
  const botonMini = (Icon, titulo, onClick, peligro) => (
    <span role="button" tabIndex={0} title={titulo} aria-label={titulo}
      onClick={(e) => { e.stopPropagation(); onClick(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClick(); } }}
      style={{ width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.92)", color: peligro ? "#C23B32" : "#16324F", boxShadow: "0 1px 4px rgba(0,0,0,.25)", cursor: "pointer" }}><Icon size={13} /></span>
  );
  const grid = (hijos) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gap: 7 }}>{hijos}</div>;
  const tituloGrupo = (t, extra) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4 }}>{t.toUpperCase()}</span>
      {extra}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" onClick={() => setLiveStyle((s) => ({ ...s, animacion: null }))} style={{ ...tarjeta(!actual), flexDirection: "row", alignItems: "center", gap: 8, padding: "7px 10px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wf-text)" }}>Sin animación</span>
        <span style={{ fontSize: 11, color: "var(--wf-muted)" }}>La letra como siempre</span>
      </button>

      {/* De mi iglesia */}
      {lista !== null && (
        <div>
          {tituloGrupo("De mi iglesia", lista?.galeria?.length ? (
            <button type="button" onClick={() => setVerGaleria((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#B15EA0", background: "transparent", border: "none", cursor: "pointer" }}>
              <Globe2 size={13} /> {verGaleria ? "Ocultar galería" : `Galería de otras iglesias (${lista.galeria.length})`}
            </button>
          ) : null)}
          {grid(<>
            <button type="button" onClick={() => setEditando({ nombre: "", receta: null, compartida: false })} style={{ ...tarjeta(false), alignItems: "center", justifyContent: "center", minHeight: 96, borderStyle: "dashed", color: "#B15EA0", gap: 6 }}>
              <Plus size={20} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Crear animación</span>
              <span style={{ fontSize: 10.5, color: "var(--wf-muted)", textAlign: "center" }}>Tu propio estilo, con tu letra y tu fondo</span>
            </button>
            {(lista?.mias || []).map((f) => {
              const id = `mia:${f.id}`;
              const def = definicionDeReceta(f.receta, f.nombre);
              return (
                <button type="button" key={f.id} onClick={() => usarPropia(f)} title={f.nombre} style={tarjeta(actual === id)} {...eventosVista(id)}>
                  {miniatura(id, def)}
                  {pie(f.nombre, f.compartida ? "Compartida en la galería" : "De tu iglesia")}
                  <span style={{ position: "absolute", top: 9, right: 9, display: "flex", gap: 4 }}>
                    {botonMini(Pencil, "Editar", () => setEditando(f))}
                    {botonMini(Trash2, "Borrar", () => borrar(f), true)}
                  </span>
                </button>
              );
            })}
          </>)}
          {lista === undefined && <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Cargando…</div>}
        </div>
      )}
      {lista === null && (
        <div style={{ fontSize: 11, color: "var(--wf-muted)", lineHeight: 1.45, background: "var(--wf-hover)", borderRadius: 10, padding: "8px 10px" }}>
          Crear animaciones propias se activa con una actualización de la base de datos que todavía falta aplicar.
        </div>
      )}

      {/* Galería */}
      {verGaleria && lista?.galeria?.length > 0 && (
        <div>
          {tituloGrupo("Galería de otras iglesias")}
          {grid(lista.galeria.map((f) => {
            const id = `gal:${f.id}`;
            const def = definicionDeReceta(f.receta, f.nombre);
            const usando = actual === `mia:${f.id}`;
            return (
              <button type="button" key={f.id} onClick={() => usarPropia(f)} title={`Usar "${f.nombre}" sin copiarla`} style={tarjeta(usando)} {...eventosVista(id)}>
                {miniatura(id, def)}
                {pie(f.nombre, f.autor_iglesia ? `De ${f.autor_iglesia}` : "De otra iglesia")}
                <span style={{ position: "absolute", top: 9, right: 9 }}>{botonMini(Copy, "Copiar a mi iglesia", () => copiar(f))}</span>
              </button>
            );
          }))}
        </div>
      )}

      {/* De fábrica */}
      {GRUPOS_ANIMACION.map((g) => (
        <div key={g}>
          {tituloGrupo(g)}
          {grid(Object.entries(ANIMACIONES).filter(([, a]) => a.grupo === g).map(([k, a]) => (
            <button type="button" key={k} onClick={() => setLiveStyle((s) => ({ ...s, animacion: k }))} title={a.desc} style={tarjeta(actual === k)} {...eventosVista(k)}>
              {miniatura(k, a)}
              {pie(a.nombre, a.desc)}
            </button>
          )))}
        </div>
      ))}

      {actual && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
          {tituloGrupo("Fondo")}
          <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 10, padding: 3, width: "fit-content", flexWrap: "wrap" }}>
            {[["estilo", "Fondo animado del estilo"], ["propio", "Mi fondo (colores, imagen o video)"]].map(([v, l]) => {
              const on = (fondoPropio ? "propio" : "estilo") === v;
              return (
                <button type="button" key={v} onClick={() => setLiveStyle((s) => ({ ...s, animFondo: v }))}
                  style={{ fontSize: 11.5, fontWeight: 600, border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", background: on ? "var(--wf-card)" : "transparent", boxShadow: on ? "0 1px 3px rgba(22,50,79,0.15)" : "none", color: "var(--wf-text)" }}>{l}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--wf-muted)", lineHeight: 1.45 }}>
            El estilo trae su propia letra y colores. Se anima la letra de las canciones; los versículos y las diapositivas se ven como siempre sobre el mismo fondo.
          </div>
        </div>
      )}

      {editando && (
        <EditorAnimacion
          inicial={editando} iglesiaId={iglesiaId} iglesiaNombre={iglesiaNombre} usuarioId={usuarioId}
          onCerrar={() => setEditando(null)}
          onGuardado={async (fila) => {
            setEditando(null);
            await recargar();
            usarPropia(fila);
          }}
        />
      )}
    </div>
  );
}

export default SelectorAnimacion;
