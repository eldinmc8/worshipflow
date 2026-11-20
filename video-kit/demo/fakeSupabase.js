// Cliente Supabase FALSO para grabar videos de demostración. Nada sale a internet.
import { SEED, USER_ID } from "./seed.js";

const LS = "wf_demo_db_v1";
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("wf_demo") : null;
let DB;
try { DB = JSON.parse(localStorage.getItem(LS) || "null"); } catch { DB = null; }
if (!DB || new URLSearchParams(location.search).has("reset")) DB = JSON.parse(JSON.stringify(SEED));
const save = () => { try { localStorage.setItem(LS, JSON.stringify(DB)); } catch {} };
save();
const T = (name) => (DB[name] ||= []);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2));
window.__wfdb = DB;

const SING = { canciones: "cancion", iglesias: "iglesia", ministerios: "ministerio", usuarios: "usuario", eventos: "evento", roles_evento: "rol", roles_app: "rol", items_servicio: "item_servicio", secciones_cancion: "seccion", bosquejos: "bosquejo" };
const sing = (t) => SING[t] || t.replace(/s$/, "");

function splitTop(s) {
  const out = []; let d = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") d++; if (ch === ")") d--;
    if (ch === "," && d === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function project(table, row, sel) {
  if (!sel || sel.trim() === "") sel = "*";
  const parts = splitTop(sel.replace(/\s+/g, " "));
  let out = {};
  for (const p of parts) {
    const m = p.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?(?:!inner)?\((.*)\)$/s);
    if (!m) {
      if (p === "*") out = { ...out, ...row };
      else { const [c, alias] = p.split(":").reverse(); out[alias ? p.split(":")[0] : c] = row[c] ?? null; }
      continue;
    }
    const [, alias, rel, fk, inner] = m;
    let val;
    let col = fk ? (fk.match(/^\w+?_(\w+_id)_fkey$/)?.[1] || null) : null;
    if (!col && fk && row[fk] !== undefined) col = fk;
    if (!col && row[`${sing(rel)}_id`] !== undefined) col = `${sing(rel)}_id`;
    if (col) {
      const r = T(rel).find((x) => x.id === row[col] || (rel === "bosquejos" && x.item_servicio_id === row[col]));
      val = r ? project(rel, r, inner) : null;
    } else {
      const back = `${sing(table)}_id`;
      val = T(rel).filter((x) => x[back] === row.id).map((x) => project(rel, x, inner));
    }
    out[alias || rel] = val;
  }
  return out;
}

const parseVal = (v) => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);
function cmp(op, a, b) {
  switch (op) {
    case "eq": return a == b && !(a == null && b != null);
    case "neq": return a != b;
    case "gt": return a > b; case "gte": return a >= b; case "lt": return a < b; case "lte": return a <= b;
    case "in": return (Array.isArray(b) ? b : String(b).replace(/[()]/g, "").split(",")).includes(a);
    case "is": return b === null ? a == null : a === b;
    case "like": case "ilike": return new RegExp("^" + String(b).replace(/%/g, ".*") + "$", op === "ilike" ? "i" : "").test(String(a ?? ""));
    case "contains": return Array.isArray(a) ? [].concat(b).every((x) => a.includes(x)) : Object.entries(b || {}).every(([k, v]) => a?.[k] === v);
    default: return true;
  }
}

class Q {
  constructor(table) { this.t = table; this.f = []; this.op = "select"; this.sel = "*"; this.ord = []; this.lim = null; this.one = null; this.wantRows = false; }
  select(s = "*", o) { if (this.op === "select") this.sel = s; else { this.wantRows = true; this.sel = s; } this.head = o?.head; this.count = o?.count; return this; }
  insert(v) { this.op = "insert"; this.val = v; return this; }
  upsert(v, o) { this.op = "upsert"; this.val = v; this.conf = o?.onConflict; return this; }
  update(v) { this.op = "update"; this.val = v; return this; }
  delete() { this.op = "delete"; return this; }
  _f(op, c, v) { this.f.push((r) => cmp(op, r[c], v)); return this; }
  eq(c, v) { return this._f("eq", c, v); } neq(c, v) { return this._f("neq", c, v); }
  gt(c, v) { return this._f("gt", c, v); } gte(c, v) { return this._f("gte", c, v); }
  lt(c, v) { return this._f("lt", c, v); } lte(c, v) { return this._f("lte", c, v); }
  in(c, v) { return this._f("in", c, v); } is(c, v) { return this._f("is", c, v); }
  like(c, v) { return this._f("like", c, v); } ilike(c, v) { return this._f("ilike", c, v); }
  contains(c, v) { return this._f("contains", c, v); }
  match(o) { Object.entries(o).forEach(([c, v]) => this.eq(c, v)); return this; }
  not(c, op, v) { this.f.push((r) => !cmp(op, r[c], parseVal(v))); return this; }
  filter(c, op, v) { return this._f(op, c, parseVal(v)); }
  or() { return this; } textSearch() { return this; } overlaps() { return this; }
  order(c, o = {}) { this.ord.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; } range(a, b) { this.rng = [a, b]; return this; }
  single() { this.one = "single"; return this; } maybeSingle() { this.one = "maybe"; return this; }
  abortSignal() { return this; } throwOnError() { return this; } returns() { return this; }
  _run() {
    const tab = T(this.t);
    const match = (r) => this.f.every((fn) => fn(r));
    let rows = [];
    if (this.op === "select") rows = tab.filter(match);
    else if (this.op === "insert" || this.op === "upsert") {
      for (const v of [].concat(this.val)) {
        const keys = this.conf ? this.conf.split(",") : ["id"];
        const ex = this.op === "upsert" && tab.find((r) => keys.every((k) => v[k] !== undefined && r[k] === v[k]));
        if (ex) { Object.assign(ex, v, { updated_at: new Date().toISOString() }); rows.push(ex); }
        else { const r = { id: uid(), created_at: new Date().toISOString(), iglesia_id: "igl-demo", ...v }; tab.push(r); rows.push(r); }
      }
      save(); bc?.postMessage({ t: this.t, ev: this.op === 'insert' ? 'INSERT' : 'UPDATE', row: rows[rows.length - 1] });
    } else if (this.op === "update") { rows = tab.filter(match); rows.forEach((r) => Object.assign(r, this.val)); save(); bc?.postMessage({ t: this.t }); }
    else if (this.op === "delete") { rows = tab.filter(match); DB[this.t] = tab.filter((r) => !match(r)); save(); bc?.postMessage({ t: this.t }); }
    if (this.op === "select" || this.wantRows) {
      for (const [c, asc] of this.ord.slice().reverse()) rows = rows.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      let data = rows.map((r) => project(this.t, r, this.sel));
      if (this.head) data = null;
      if (this.one) {
        if (!data.length) return this.one === "single" ? { data: null, error: { code: "PGRST116", message: "no rows" } } : { data: null, error: null };
        return { data: data[0], error: null };
      }
      return { data, error: null, count: rows.length };
    }
    return { data: null, error: null };
  }
  then(res, rej) {
    let out; try { out = this._run(); } catch (e) { console.warn("[fake]", this.t, e); out = { data: null, error: { message: String(e) } }; }
    return new Promise((r) => setTimeout(r, 5)).then(() => out).then(res, rej);
  }
}

const RPC = {
  soy_super_admin: false,
  iglesia_id_por_defecto: "igl-demo",
  iglesia_id_por_slug: "igl-demo",
  codigo_pantalla_actual: "k7q2xm",
  sesion_en_vivo_publica: () => T("sesiones_en_vivo")[0] || null,
  tv_pedir_codigo: "483921",
  usuarios_con_push: () => T("usuarios").map((u) => ({ usuario_id: u.id })),
  tv_vincular: () => { localStorage.setItem("wf_demo_tv", "1"); return true; },
  tv_estado: () => localStorage.getItem("wf_demo_tv") ? { estado: "vinculado", slug: "demo", tipo: "proyeccion", codigo: null } : { estado: "pendiente", codigo: "483921" },
};

const listeners = [];
bc && (bc.onmessage = (e) => {
  if (e.data && e.data.t) { try { const fresh = JSON.parse(localStorage.getItem(LS) || "null"); if (fresh) { for (const k of Object.keys(DB)) delete DB[k]; Object.assign(DB, fresh); } } catch {} }
  listeners.forEach((l) => l(e.data));
});
function channel(name) {
  const ch = {
    _h: [],
    on(type, filter, cb) { if (typeof filter === "function") cb = filter; this._h.push({ type, filter, cb }); return this; },
    subscribe(cb) { cb?.("SUBSCRIBED"); const l = (m) => this._h.forEach((h) => {
      if (h.type === "broadcast" && m.bc && m.ch === name && (!h.filter?.event || h.filter.event === m.event)) h.cb({ event: m.event, payload: m.payload });
      if (h.type === "postgres_changes" && m.t && (!h.filter?.table || h.filter.table === m.t)) {
        const row = m.row || T(m.t)[0];
        h.cb({ eventType: m.ev || "UPDATE", new: row || {}, old: {}, table: m.t });
      }
    }); listeners.push(l); this._l = l; return this; },
    send(m) { bc?.postMessage({ bc: true, ch: name, event: m.event, payload: m.payload }); return Promise.resolve("ok"); },
    track() { return Promise.resolve("ok"); }, untrack() { return Promise.resolve("ok"); },
    presenceState() { return {}; },
    unsubscribe() { const i = listeners.indexOf(this._l); if (i >= 0) listeners.splice(i, 1); return Promise.resolve("ok"); },
  };
  return ch;
}

const AS_USER = (() => { try { return sessionStorage.getItem("wf_as"); } catch { return null; } })();
const session = { access_token: "demo", user: { id: AS_USER || USER_ID, email: "demo@iglesia.test", identities: [{ provider: "email" }], app_metadata: {}, user_metadata: {} } };

export function createClient() {
  return {
    from: (t) => new Q(t),
    rpc: (n, args) => { const v = RPC[n]; const data = typeof v === "function" ? v(args) : v ?? null; return Object.assign(Promise.resolve({ data, error: null }), { single() { return this; } }); },
    channel, removeChannel: (c) => c?.unsubscribe?.(), getChannels: () => [],
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session.user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }), updateUser: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      getUserIdentities: async () => ({ data: { identities: session.user.identities }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      refreshSession: async () => ({ data: { session }, error: null }),
    },
    storage: { from: () => ({ upload: async () => ({ data: {}, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }), remove: async () => ({}) }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
  };
}
export default { createClient };
