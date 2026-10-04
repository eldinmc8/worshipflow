// Cliente de Supabase simulado, en memoria, para probar src/lib/eventos.js y src/lib/recordatorios.js
// sin tocar la base real. Implementa solo el subconjunto del query builder que esos dos archivos usan
// de verdad (ver grep de "supabase.from(" en ellos): from/select/insert/update/upsert/delete/eq/in/
// not/order/single/maybeSingle, encadenables y "awaitable" (con .then) igual que el cliente real de supabase-js.
//
// No es un reemplazo general de PostgREST -- por ejemplo no resuelve selects anidados tipo
// "canciones(titulo)". Solo cubre lo que getEventoCompleto/sincronizarServiceOrder/etc. necesitan.
export function makeFakeSupabase(tablasIniciales = {}) {
  const db = {};
  for (const [tabla, filas] of Object.entries(tablasIniciales)) db[tabla] = filas.map((f) => ({ ...f }));
  const tabla = (nombre) => (db[nombre] ||= []);

  function builder(nombreTabla) {
    let op = null;
    let payload = null;
    let single = false;
    let upsertOnConflict = null;
    const filtros = [];

    const aplicaFiltros = (filas) =>
      filas.filter((fila) =>
        filtros.every((f) => {
          if (f.tipo === "eq") return fila[f.col] === f.val;
          if (f.tipo === "in") return f.val.includes(fila[f.col]);
          if (f.tipo === "not-is-null") return fila[f.col] != null;
          return true;
        })
      );

    function ejecutar() {
      const filas = tabla(nombreTabla);
      if (op === "insert") {
        payload.forEach((r) => filas.push({ ...r }));
        const data = payload.map((r) => ({ ...r }));
        return { data: single ? data[0] ?? null : data, error: null };
      }
      if (op === "upsert") {
        // Igual que supabase-js real: sin onConflict, el choque se detecta por id (la llave primaria
        // de casi todas las tablas de esta app, generada por el cliente). Con onConflict (ej. la tabla
        // de resumen mensual, que no trae id propio -- lo genera la base), se matchea por esas columnas.
        payload.forEach((r) => {
          const idx = upsertOnConflict
            ? filas.findIndex((f) => upsertOnConflict.every((col) => f[col] === r[col]))
            : filas.findIndex((f) => f.id === r.id);
          if (idx >= 0) filas[idx] = { ...filas[idx], ...r };
          else filas.push({ id: r.id ?? `fake-id-${Math.random().toString(36).slice(2)}`, ...r });
        });
        return { data: payload.map((r) => ({ ...r })), error: null };
      }
      if (op === "update") {
        const afectadas = aplicaFiltros(filas);
        afectadas.forEach((fila) => Object.assign(fila, payload));
        return { data: afectadas.map((f) => ({ ...f })), error: null };
      }
      if (op === "delete") {
        const afectadas = aplicaFiltros(filas);
        const idsAfectados = new Set(afectadas.map((f) => f.id));
        db[nombreTabla] = filas.filter((f) => !idsAfectados.has(f.id));
        return { data: afectadas.map((f) => ({ ...f })), error: null };
      }
      // select (op === "select" o null -- .eq() sola, sin .select() antes, también cuenta como lectura)
      const resultado = aplicaFiltros(filas).map((f) => ({ ...f }));
      if (single) return { data: resultado[0] ?? null, error: null };
      return { data: resultado, error: null };
    }

    const api = {
      select() { if (!op) op = "select"; return api; },
      insert(filasNuevas) { op = "insert"; payload = Array.isArray(filasNuevas) ? filasNuevas : [filasNuevas]; return api; },
      update(patch) { op = "update"; payload = patch; return api; },
      upsert(filasNuevas, opciones) { op = "upsert"; payload = Array.isArray(filasNuevas) ? filasNuevas : [filasNuevas]; upsertOnConflict = opciones?.onConflict ? opciones.onConflict.split(",") : null; return api; },
      delete() { op = "delete"; return api; },
      eq(col, val) { filtros.push({ tipo: "eq", col, val }); return api; },
      in(col, val) { filtros.push({ tipo: "in", col, val }); return api; },
      not(col, tipoOp, val) { if (tipoOp === "is" && val === null) filtros.push({ tipo: "not-is-null", col }); return api; },
      order() { return api; },
      single() { single = true; return api; },
      maybeSingle() { single = true; return api; }, // el fake nunca lanza por 0/N filas -- mismo simplificado que single()
      then(onResolve, onReject) {
        try { return Promise.resolve(onResolve(ejecutar())); }
        catch (e) { return onReject ? Promise.resolve(onReject(e)) : Promise.reject(e); }
      },
      catch(onReject) { return this.then(undefined, onReject); },
      finally(onFinally) { return this.then((v) => { onFinally?.(); return v; }, (e) => { onFinally?.(); throw e; }); },
    };
    return api;
  }

  return {
    client: { from: builder },
    db, // acceso directo al "contenido de la base" en memoria, para preparar/inspeccionar en las pruebas
  };
}
