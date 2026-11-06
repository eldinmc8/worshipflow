// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
const { esDiapositivaPrivada, puedeVerDiapositivasEvento, decidirVisibilidadSetlist } = await import("../pantallas/eventos.jsx");
import { PERMISOS_APP, permisoIncluidoPor, PLANTILLAS_ROL } from "../lib/roles.js";

// Pedido de Eldin (2026-11-06): un músico no ve las slides ni el bosquejo del Setlist; sí el
// Administrador, el Supervisor, Multimedia y el predicador asignados ese día, o un rol con permiso.
const evento = {
  id: "ev1",
  worshipRoles: [{ id: "r1", name: "Guitarra", members: [{ usuarioId: "musico" }] }],
  serviceOrder: [
    { id: "b1", type: "seccion", title: "Alabanza", encargados: [] },
    { id: "c1", type: "cancion", songId: "s1" },
    { id: "b2", type: "seccion", title: "Multimedia", encargados: [{ usuarioId: "multi" }] },
    { id: "b3", type: "seccion", title: "Predicación", encargados: [{ usuarioId: "pastor" }] },
    { id: "v1", type: "biblia", reference: "Juan 3:16" },
    { id: "sl1", type: "slide", title: "Bienvenidos" },
    { id: "bq1", type: "slide", title: "El buen pastor", bosquejoDe: "b3", isSermonPoint: true },
    { id: "bq2", type: "biblia", reference: "Salmo 23:1", bosquejoDe: "b3" },
  ],
};
const ids = (d) => (d.modo === "todo" ? evento.serviceOrder : d.visibleOrder || d.blocks).map((it) => it.id);

describe("diapositivas privadas del Setlist", () => {
  it("son las slides y lo que salió del bosquejo, no las canciones ni los versículos de lectura", () => {
    expect(evento.serviceOrder.filter(esDiapositivaPrivada).map((it) => it.id)).toEqual(["sl1", "bq1", "bq2"]);
  });

  it("solo las ve quien está asignado ese día a Multimedia o a la Predicación, o tiene el permiso general", () => {
    expect(puedeVerDiapositivasEvento(evento, "musico")).toBe(false);
    expect(puedeVerDiapositivasEvento(evento, "multi")).toBe(true);
    expect(puedeVerDiapositivasEvento(evento, "pastor")).toBe(true);
    expect(puedeVerDiapositivasEvento(evento, "musico", true)).toBe(true);
  });

  it("el músico sigue viendo canciones y su bloque, pero no las diapositivas", () => {
    const d = decidirVisibilidadSetlist(evento, false, "musico", false, null, false);
    expect(ids(d)).toEqual(["b1", "c1", "b2", "v1"]);
  });

  it("el Supervisor y Multimedia asignado las siguen viendo", () => {
    expect(ids(decidirVisibilidadSetlist(evento, false, "sup", true, null, true))).toContain("bq1");
    expect(ids(decidirVisibilidadSetlist(evento, false, "multi", false, null, true))).toEqual(expect.arrayContaining(["sl1", "bq1", "bq2"]));
  });

  it("existe como permiso de rol, incluido al editar el Setlist y en la plantilla de Pastor / Supervisor", () => {
    expect(PERMISOS_APP.some((p) => p.clave === "ver_diapositivas")).toBe(true);
    expect(permisoIncluidoPor("ver_diapositivas", { editar_setlist: true })?.clave).toBe("editar_setlist");
    expect(PLANTILLAS_ROL.find((p) => p.nombre === "Pastor / Supervisor").permisos.ver_diapositivas).toBe(true);
  });
});
