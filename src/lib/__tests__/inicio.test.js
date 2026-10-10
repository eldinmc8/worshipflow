import { describe, it, expect } from "vitest";
import { misCargos, estadoGeneral, misProximosServicios, cuandoEs, companeros, indicaciones, cancionesParaEnsayar, necesitaAtencion, estaSemana } from "../inicio.js";

const library = [
  { id: "s1", title: "Te alabo", key: "G", tempo: 72 },
  { id: "s2", title: "Alabaré", key: "G", tempo: 120 },
];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = new Date(2030, 0, 9); // miércoles
const enDias = (n) => iso(new Date(2030, 0, 9 + n));

const domingo = {
  id: "e1", title: "Domingo AM", date: "2099-01-12", hora: "10:00",
  worshipRoles: [
    { id: "r1", name: "Piano", members: [{ id: "m1", n: "Eldin", usuarioId: "yo", status: "pendiente" }] },
    { id: "r2", name: "Voz", members: [{ id: "m2", n: "Ana", usuarioId: "ana", status: "confirmado", lead: true }] },
    { id: "r3", name: "Bajo", members: [] },
  ],
  serviceOrder: [
    { id: "b1", type: "seccion", title: "Bloque de Alabanza", encargados: [] },
    { id: "c1", type: "cancion", songId: "s1" },
    { id: "c2", type: "cancion", songId: "s2", keyOverride: "A" },
    { id: "b2", type: "seccion", title: "Limpieza", ministryId: "min1", description: "Salón", encargados: [
      { id: "m3", n: "Marta", usuarioId: "marta", status: "pendiente" },
      { id: "m4", n: "Rosa", usuarioId: "rosa", status: "confirmado", lead: true },
    ] },
  ],
};
const ministries = [{ id: "min1", leaderName: "Rosa", plan: [{ date: "2099-01-12", title: "Turno", detail: "Baños y salón principal" }] }];

describe("misCargos y estadoGeneral", () => {
  it("encuentra roles de alabanza y bloques", () => {
    expect(misCargos(domingo, "yo", library)).toEqual([{ tipo: "rol", miembroId: "m1", nombre: "Piano", estado: "pendiente", lead: false, rolId: "r1" }]);
    expect(misCargos(domingo, "marta", library).map((c) => c.nombre)).toEqual(["Limpieza"]);
    expect(misCargos(domingo, "nadie", library)).toEqual([]);
  });
  it("resume el estado", () => {
    expect(estadoGeneral([{ estado: "confirmado" }, { estado: "pendiente" }])).toBe("pendiente");
    expect(estadoGeneral([{ estado: "confirmado" }])).toBe("confirmado");
    expect(estadoGeneral([{ estado: "confirmado" }, { estado: "rechazado" }])).toBe("rechazado");
    expect(estadoGeneral([])).toBeNull();
  });
});

describe("misProximosServicios", () => {
  it("solo eventos futuros donde tengo cargo, en orden", () => {
    const pasado = { ...domingo, id: "e0", date: "2000-01-01" };
    const otro = { ...domingo, id: "e2", date: "2099-01-05" };
    const plantilla = { ...domingo, id: "e3", esPlantilla: true };
    expect(misProximosServicios([domingo, pasado, otro, plantilla], "yo", library).map((x) => x.event.id)).toEqual(["e2", "e1"]);
  });
});

describe("cuandoEs", () => {
  it("dice hoy, mañana, en N días y semanas", () => {
    expect(cuandoEs(enDias(0), hoy)).toBe("hoy");
    expect(cuandoEs(enDias(1), hoy)).toBe("mañana");
    expect(cuandoEs(enDias(3), hoy)).toBe("en 3 días");
    expect(cuandoEs(enDias(7), hoy)).toBe("en 1 semana");
    expect(cuandoEs(enDias(21), hoy)).toBe("en 3 semanas");
    expect(cuandoEs(null, hoy)).toBeNull();
  });
});

describe("companeros", () => {
  it("músico: ve a todo el equipo de alabanza, quien dirige primero, sin él mismo", () => {
    expect(companeros(domingo, "yo", library)).toEqual([{ nombre: "Ana", cargos: ["Voz"], estado: "confirmado", lead: true }]);
  });
  it("limpieza: ve a los demás encargados de su bloque, no al equipo de alabanza", () => {
    expect(companeros(domingo, "marta", library)).toEqual([{ nombre: "Rosa", cargos: ["Limpieza"], estado: "confirmado", lead: true }]);
  });
});

describe("indicaciones", () => {
  it("usa la planificación del ministerio para esa fecha", () => {
    expect(indicaciones(domingo, "marta", ministries, library)).toEqual([{ bloque: "Limpieza", texto: "Baños y salón principal", autor: "Rosa" }]);
  });
  it("sin planificación, usa la descripción del bloque", () => {
    expect(indicaciones(domingo, "marta", [], library)).toEqual([{ bloque: "Limpieza", texto: "Salón", autor: "" }]);
  });
  it("un músico sin bloques no tiene indicaciones", () => {
    expect(indicaciones(domingo, "yo", ministries, library)).toEqual([]);
  });
});

describe("cancionesParaEnsayar", () => {
  it("solo para el equipo de alabanza, marcando el tono cambiado", () => {
    expect(cancionesParaEnsayar(domingo, "yo", library)).toEqual([
      { itemId: "c1", songId: "s1", titulo: "Te alabo", tono: "G", tonoOriginal: "G", cambiado: false, tempo: 72 },
      { itemId: "c2", songId: "s2", titulo: "Alabaré", tono: "A", tonoOriginal: "G", cambiado: true, tempo: 120 },
    ]);
    expect(cancionesParaEnsayar(domingo, "marta", library)).toEqual([]);
  });
});

describe("necesitaAtencion", () => {
  it("avisa de roles vacíos, setlist sin canciones y quien no puede", () => {
    const cerca = { ...domingo, date: iso(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3)), hora: null };
    const conRechazo = { ...cerca, id: "e5", title: "Miércoles", serviceOrder: [{ id: "b", type: "seccion", title: "Bloque de Alabanza", encargados: [] }],
      worshipRoles: [{ id: "r", name: "Piano", members: [{ id: "x", n: "Luis", status: "rechazado" }] }] };
    const textos = necesitaAtencion([cerca, conRechazo], library).map((a) => a.texto);
    expect(textos).toContain("Domingo AM: falta bajo");
    expect(textos).toContain("Miércoles: el setlist no tiene canciones");
    expect(textos).toContain("Miércoles: no puede Luis (Piano)");
  });
  it("ignora lo que está lejos", () => {
    expect(necesitaAtencion([domingo], library)).toEqual([]);
  });
});

describe("estaSemana", () => {
  it("lunes a domingo, con hoy marcado y los días que me tocan", () => {
    const e = { ...domingo, date: "2030-01-13" };
    const semana = estaSemana([e], "yo", library, hoy);
    expect(semana).toHaveLength(7);
    expect(semana[0].fecha.getDay()).toBe(1);
    expect(semana.find((d) => d.esHoy).iso).toBe("2030-01-09");
    expect(semana[6].meToca).toBe(true);
    expect(semana[6].eventos).toHaveLength(1);
  });
});
