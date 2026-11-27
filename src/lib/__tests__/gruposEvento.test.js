import { describe, it, expect } from "vitest";
import { limpiarInvitados, gruposDelEvento, eventoEsDelGrupo, lideraGrupoInvitado, invitadosDelEvento, resumenGrupos } from "../gruposEvento.js";

const grupos = [
  { id: "j", name: "Jóvenes" },
  { id: "a", name: "Alabanza" },
  { id: "d", name: "Damas" },
];

describe("varios grupos en un evento", () => {
  it("limpia repetidos, vacíos y el grupo dueño", () => {
    expect(limpiarInvitados(["a", "a", null, "j", ""], "j")).toEqual(["a"]);
    expect(limpiarInvitados(undefined)).toEqual([]);
  });

  it("un evento general con dos grupos invitados sale en ambos, no en otros", () => {
    const ev = { ministryId: null, ministeriosInvitados: ["j", "a"] };
    expect(gruposDelEvento(ev)).toEqual(["j", "a"]);
    expect(eventoEsDelGrupo(ev, "j")).toBe(true);
    expect(eventoEsDelGrupo(ev, "a")).toBe(true);
    expect(eventoEsDelGrupo(ev, "d")).toBe(false);
  });

  it("el dueño cuenta como grupo del evento", () => {
    expect(eventoEsDelGrupo({ ministryId: "d" }, "d")).toBe(true);
    expect(gruposDelEvento({ ministryId: "d", ministeriosInvitados: ["d", "a"] })).toEqual(["d", "a"]);
  });

  it("sabe si la persona lidera un grupo invitado", () => {
    const ev = { ministryId: null, ministeriosInvitados: ["a"] };
    expect(lideraGrupoInvitado(ev, new Set(["a"]))).toBe(true);
    expect(lideraGrupoInvitado(ev, new Set(["j"]))).toBe(false);
  });

  it("resume en orden alfabético e ignora grupos borrados", () => {
    expect(invitadosDelEvento({ ministeriosInvitados: ["j", "x", "a"] }, grupos).map((m) => m.name)).toEqual(["Alabanza", "Jóvenes"]);
    expect(resumenGrupos({ ministryId: null, ministeriosInvitados: ["j", "a"] }, grupos)).toBe("General · Alabanza, Jóvenes");
    expect(resumenGrupos({ ministryId: "d", ministeriosInvitados: ["j"] }, grupos)).toBe("Damas · Jóvenes");
    expect(resumenGrupos({ ministryId: "d" }, grupos)).toBe("");
  });
});
