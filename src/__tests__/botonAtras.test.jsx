// @vitest-environment jsdom
// Botón atrás del teléfono (2026-11-12): primero cierra la ventana abierta; sin ventanas, regresa a la
// pantalla anterior; en la consola transmitiendo, no sale. Ver lib/atras.js.
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { useCerrarConAtras, useBloquearAtras, esPopPropio, cuandoListo, _reiniciarAtras } from "../lib/atras.js";

// Espera a que jsdom entregue el popstate de history.back() (es asíncrono, como en un navegador).
const esperar = () => act(() => new Promise((r) => setTimeout(r, 30)));
const atras = async () => { await act(async () => { window.history.back(); }); await esperar(); };

// Una "app" mínima con el mismo trato que PrototipoWorshipFlow: cada pantalla es una entrada del historial
// y un oyente de popstate que ignora los atrás que ya resolvió una ventana.
function App({ onPantalla }) {
  const [pantalla, setPantalla] = useState("inicio");
  const [modal, setModal] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  React.useEffect(() => {
    window.history.replaceState({ pantalla: "inicio" }, "");
    const alPop = (e) => { if (esPopPropio()) return; setPantalla(e.state?.pantalla || "inicio"); onPantalla?.(e.state?.pantalla); };
    window.addEventListener("popstate", alPop);
    return () => window.removeEventListener("popstate", alPop);
  }, [onPantalla]);
  const ir = (p) => { setPantalla(p); cuandoListo(() => window.history.pushState({ pantalla: p }, "")); };
  return (
    <div>
      <div>Pantalla: {pantalla}</div>
      <button onClick={() => ir("eventos")}>Eventos</button>
      <button onClick={() => ir("consola")}>Consola</button>
      <button onClick={() => setModal(true)}>Abrir modal</button>
      {modal && <Modal onCerrar={() => setModal(false)} onIr={(p) => { setModal(false); ir(p); }} pedirConfirmacion={confirmar} setConfirmar={setConfirmar} />}
    </div>
  );
}
function Modal({ onCerrar, onIr }) {
  useCerrarConAtras(true, onCerrar);
  return (
    <div role="dialog">
      Modal abierto
      <button onClick={onCerrar}>Cerrar modal</button>
      <button onClick={() => onIr("ministerios")}>Ir a Ministerios desde el modal</button>
    </div>
  );
}

beforeEach(() => { _reiniciarAtras(); });
afterEach(() => cleanup());

describe("botón atrás", () => {
  it("con una ventana abierta, atrás la cierra y NO cambia la pantalla de abajo", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Eventos"));
    fireEvent.click(screen.getByText("Abrir modal"));
    await esperar();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await atras();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Pantalla: eventos")).toBeTruthy();
    // El siguiente atrás ya sí navega a la pantalla anterior.
    await atras();
    expect(screen.getByText("Pantalla: inicio")).toBeTruthy();
  });

  it("cerrar la ventana con su botón no deja una entrada sobrante (el siguiente atrás navega de una)", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Eventos"));
    fireEvent.click(screen.getByText("Abrir modal"));
    await esperar();
    fireEvent.click(screen.getByText("Cerrar modal"));
    await esperar();
    expect(screen.getByText("Pantalla: eventos")).toBeTruthy();
    await atras();
    expect(screen.getByText("Pantalla: inicio")).toBeTruthy();
  });

  it("cerrar la ventana y navegar al mismo tiempo no se come la pantalla nueva", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Abrir modal"));
    await esperar();
    fireEvent.click(screen.getByText("Ir a Ministerios desde el modal"));
    await esperar();
    expect(window.history.state.pantalla).toBe("ministerios");
    expect(screen.getByText("Pantalla: ministerios")).toBeTruthy();
    await atras();
    expect(screen.getByText("Pantalla: inicio")).toBeTruthy();
  });

  it("si cerrar pregunta y la persona dice que no, la ventana sigue y atrás la vuelve a intentar cerrar", async () => {
    const intentos = vi.fn(async () => false); // "¿Salir sin guardar?" → No
    function Editor() { useCerrarConAtras(true, intentos); return <div role="dialog">Editor</div>; }
    render(<Editor />);
    await esperar();
    await atras();
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(intentos).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await atras();
    expect(intentos).toHaveBeenCalledTimes(2);
  });

  it("bloqueo (consola transmitiendo): atrás avisa y se queda en la misma pantalla", async () => {
    const aviso = vi.fn();
    const navego = vi.fn();
    function Consola() { useBloquearAtras(true, aviso); return <div>Consola en vivo</div>; }
    function Raiz() {
      React.useEffect(() => {
        const alPop = () => { if (!esPopPropio()) navego(); };
        window.addEventListener("popstate", alPop);
        return () => window.removeEventListener("popstate", alPop);
      }, []);
      return <Consola />;
    }
    render(<Raiz />);
    await esperar();
    await atras();
    await atras();
    expect(aviso).toHaveBeenCalledTimes(2);
    expect(navego).not.toHaveBeenCalled();
    expect(screen.getByText("Consola en vivo")).toBeTruthy();
  });
});
