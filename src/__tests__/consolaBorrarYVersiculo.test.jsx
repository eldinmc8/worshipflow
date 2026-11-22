// @vitest-environment jsdom
// Consola de transmisión (2026-11-22, pedido de Eldin): 1) un bote de basura en cada fila del orden del
// culto que lo borra del setlist (el ojo solo lo oculta en la consola); 2) "+ Agregar → Versículo" abre
// el buscador de la Biblia para dejarlo en el orden (antes solo cambiaba a la pestaña Biblia y, si ya
// se estaba ahí, no pasaba nada).
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) };
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; }, send: async () => {} }), removeChannel: () => {}, storage: { from: () => ({ list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }, auth: { getSession: async () => ({ data: { session: null } }) } }, callUsersFunction: async () => ({}) };
});
vi.mock("../lib/confirm.js", () => ({ confirmDialog: vi.fn(async () => true) }));
globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
const { MultimediaControl } = await import("../pantallas/envivo.jsx");
afterEach(cleanup);
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };

const orden = [
  { id: "b1", type: "seccion", title: "Bienvenida" },
  { id: "t1", type: "slide", title: "Aviso de ayuno", subtitle: "", bg: "#1B2029", bgType: "color" },
  { id: "t2", type: "slide", title: "Ofrenda", subtitle: "", bg: "#1B2029", bgType: "color" },
];
const aviso = { slideId: "t1", type: "slide", title: "Aviso de ayuno", subtitle: "", bg: "#1B2029", bgType: "color" };

function Consola({ onQuitar = () => {}, onInsertar = () => {} }) {
  const [liveStyle, setLiveStyle] = useState({ theme: "stage", font: "elegante" });
  return <MultimediaControl eventTitle="Culto" serviceOrder={orden} library={[]} slides={[aviso]} activeIdx={0} adHocIdx={0} goto={() => {}} gotoPlanSlide={() => {}} blanked={false} setBlanked={() => {}} current={aviso} next={null} onEnd={() => {}} canEnd liveOwner="yo" liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={false} myIglesiaId="igl" onOpenPublicScreen={() => {}} onReordenarOrden={() => {}} onAddLiveSlide={() => {}} onEditLiveSlide={() => {}} onOcultar={() => {}} onQuitarDelOrden={onQuitar} onInsertarItems={onInsertar} />;
}

describe("Consola: borrar del setlist y agregar versículo", () => {
  it("el bote de basura borra el elemento del setlist (con confirmación)", async () => {
    const onQuitar = vi.fn();
    render(<Consola onQuitar={onQuitar} />);
    const fila = within(screen.getByLabelText("Orden del culto")).getByText("Ofrenda").closest(".orden-fila");
    fireEvent.click(within(fila).getByLabelText("Borrar del setlist"));
    await vi.waitFor(() => expect(onQuitar).toHaveBeenCalledWith("t2"));
  });
  it("+ Agregar → Versículo abre el buscador de la Biblia", () => {
    render(<Consola />);
    fireEvent.click(within(screen.getByLabelText("Orden del culto")).getByText("Agregar"));
    fireEvent.click(screen.getByText("Versículo"));
    expect(screen.getByText("Agregar versículo")).toBeTruthy();
  });
});
