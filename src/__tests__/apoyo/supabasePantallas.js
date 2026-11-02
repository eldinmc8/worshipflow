// Supabase falso para las pruebas de "¿abre la pantalla?" (src/__tests__/pantallas.test.jsx): responde
// cualquier consulta con datos de ejemplo en memoria, sin internet. A diferencia de lib/__tests__/
// fakeSupabase.js (preciso, para probar guardados), aquí lo importante es que NINGUNA llamada falle:
// cualquier método desconocido del query builder simplemente se encadena.
export function crearSupabaseFalso(tablas = {}) {
  const db = Object.fromEntries(Object.entries(tablas).map(([k, v]) => [k, v.map((f) => ({ ...f }))]));
  const filasDe = (t) => (db[t] ||= []);

  function consulta(tabla) {
    const filtros = [];
    let unaSola = false;
    let rango = null;
    let escritura = null;
    const ejecutar = () => {
      if (escritura) {
        const filas = filasDe(tabla);
        if (escritura.op === "insert" || escritura.op === "upsert") {
          escritura.datos.forEach((r) => {
            const i = filas.findIndex((f) => f.id && f.id === r.id);
            if (i >= 0) filas[i] = { ...filas[i], ...r }; else filas.push({ ...r });
          });
          const data = escritura.datos.map((r) => ({ ...r }));
          return { data: unaSola ? data[0] ?? null : data, error: null };
        }
        return { data: unaSola ? null : [], error: null };
      }
      let r = filasDe(tabla).filter((f) => filtros.every((fn) => fn(f))).map((f) => ({ ...f }));
      if (rango) r = r.slice(rango[0], rango[1] + 1);
      return { data: unaSola ? r[0] ?? null : r, error: null, count: r.length };
    };
    const api = new Proxy({}, {
      get(_, prop) {
        if (prop === "then") return (ok, mal) => Promise.resolve(ejecutar()).then(ok, mal);
        if (prop === "eq") return (c, v) => { filtros.push((f) => !(c in f) || f[c] === v); return api; };
        if (prop === "in") return (c, v) => { filtros.push((f) => !(c in f) || v.includes(f[c])); return api; };
        if (prop === "range") return (a, b) => { rango = [a, b]; return api; };
        if (prop === "single" || prop === "maybeSingle") return () => { unaSola = true; return api; };
        if (prop === "insert" || prop === "upsert") return (d) => { escritura = { op: prop, datos: Array.isArray(d) ? d : [d] }; return api; };
        if (prop === "update" || prop === "delete") return () => { escritura = { op: prop, datos: [] }; return api; };
        return () => api; // select, order, not, is, ilike, or, gte, lte, limit, returns…
      },
    });
    return api;
  }

  const canal = () => {
    const c = {
      on: () => c, subscribe: (cb) => { if (typeof cb === "function") cb("SUBSCRIBED"); return c; },
      send: () => Promise.resolve("ok"), track: () => Promise.resolve("ok"), untrack: () => Promise.resolve("ok"),
      presenceState: () => ({}), unsubscribe: () => Promise.resolve("ok"),
    };
    return c;
  };

  return {
    db,
    from: (t) => consulta(t),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: canal,
    removeChannel: () => Promise.resolve("ok"),
    removeAllChannels: () => Promise.resolve([]),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "u-admin", email: "admin@iglesia.org" } }, error: null }),
      getSession: () => Promise.resolve({ data: { session: { access_token: "x", user: { id: "u-admin" } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
      getUserIdentities: () => Promise.resolve({ data: { identities: [] }, error: null }),
      linkIdentity: () => Promise.resolve({ data: {}, error: null }),
      unlinkIdentity: () => Promise.resolve({ data: {}, error: null }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: "x" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: [], error: null }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "" }, error: null }),
      }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  };
}
