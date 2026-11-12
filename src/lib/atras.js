import { useEffect, useRef } from "react";

// Botón "atrás" del teléfono o del navegador (pedido de Eldin, 2026-11-12: "a veces estoy en la consola,
// le doy atrás y me lleva hasta Inicio; no quiero eso en ninguna parte, pero con una lógica").
//
// La lógica, en orden:
//  1. Si hay una ventana abierta (un modal, el buscador de canciones, el asistente del bosquejo, una
//     confirmación…), atrás la CIERRA y no mueve la pantalla de abajo. Cada ventana abierta es una
//     "capa": al abrirse agrega una entrada al historial; atrás la quita y cierra la ventana.
//  2. Sin ventanas abiertas, atrás regresa a la pantalla anterior (ver la navegación en
//     PrototipoWorshipFlow.jsx).
//  3. Un "bloqueo" (ej. la consola mientras se transmite) es una capa que no se cierra: atrás avisa
//     (alIntentar) y la vuelve a poner, así no se sale de la consola por accidente en pleno culto.
//
// Cuando una ventana se cierra con su propio botón, su entrada del historial sobra: se quita con
// history.back(). Ese "atrás" lo hace la app, no la persona, así que los demás oyentes de popstate
// (la navegación, AuthGate, Usuarios) lo ignoran con esPopPropio(). Mientras ese atrás no termina,
// cualquier otro cambio del historial espera (cuandoListo) — si no, history.back() se llevaría la
// pantalla nueva en vez de la entrada sobrante.

const capas = []; // [{ id, cerrar }] — la última es la de arriba
let retrocesosPendientes = 0;
const enEspera = [];
let ultimoPopPropio = false;
let siguienteId = 1;

function alPop(e) {
  ultimoPopPropio = false;
  if (retrocesosPendientes > 0) {
    retrocesosPendientes--;
    ultimoPopPropio = true;
    if (retrocesosPendientes === 0) enEspera.splice(0).forEach((fn) => fn());
    return;
  }
  const arriba = capas.pop();
  if (arriba) {
    ultimoPopPropio = true;
    arriba.cerrar();
    return;
  }
  // Entrada sobrante de una ventana que ya se cerró (quedó debajo de una pantalla nueva, ver quitar()):
  // muestra la pantalla que había debajo de esa ventana (la navegación la atiende normal) y se salta la
  // copia idéntica que tiene abajo, para que no haga falta dar atrás dos veces.
  const capa = e?.state?.capa;
  if (capa != null && !capas.some((c) => c.id === capa)) {
    retrocesosPendientes++;
    setTimeout(() => window.history.back(), 0);
  }
}
if (typeof window !== "undefined") window.addEventListener("popstate", alPop);

// true si el popstate que se está atendiendo ya lo resolvió una capa (o fue un atrás de la propia app):
// la navegación no debe hacer nada con él.
export const esPopPropio = () => ultimoPopPropio;

// Corre fn ya, o apenas termine el history.back() que la app tenga pendiente.
export function cuandoListo(fn) {
  if (retrocesosPendientes === 0) fn();
  else enEspera.push(fn);
}

// Abre una capa: cerrar() se llama si la persona da atrás. Devuelve quitar(), para cuando la ventana
// se cierra por su cuenta (botón, guardar…): quita la entrada sobrante del historial.
export function abrirCapa(cerrar) {
  const id = siguienteId++;
  capas.push({ id, cerrar });
  cuandoListo(() => window.history.pushState({ ...(window.history.state || {}), capa: id }, ""));
  return function quitar() {
    const i = capas.findIndex((c) => c.id === id);
    if (i === -1) return; // ya la quitó un atrás
    capas.splice(i, 1);
    cuandoListo(() => {
      // Solo si arriba del historial sigue una entrada de ventana. Si en el mismo toque se abrió otra
      // pantalla (ya quedó encima), history.back() se la llevaría: la entrada sobrante se queda abajo y
      // alPop la salta cuando se llegue a ella.
      if (window.history.state?.capa == null) return;
      retrocesosPendientes++;
      window.history.back();
    });
  };
}

export const hayCapasAbiertas = () => capas.length > 0;

// Hook: mientras `abierta`, atrás llama onCerrar en vez de navegar. Si onCerrar no llega a cerrar la
// ventana (ej. pregunta "¿salir sin guardar?" y la persona dice que no), la capa se vuelve a poner.
export function useCerrarConAtras(abierta, onCerrar) {
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  useEffect(() => {
    if (!abierta) return undefined;
    let montada = true;
    let quitar = null;
    const poner = () => {
      quitar = abrirCapa(() => {
        quitar = null; // su entrada ya la quitó el atrás
        Promise.resolve(onCerrarRef.current?.()).finally(() => {
          setTimeout(() => { if (montada && !quitar) poner(); }, 150);
        });
      });
    };
    poner();
    return () => { montada = false; quitar?.(); };
  }, [abierta]);
}

// Hook: mientras `activo`, atrás no sale de esta pantalla: llama alIntentar (ej. un aviso) y se queda.
export function useBloquearAtras(activo, alIntentar) {
  const alIntentarRef = useRef(alIntentar);
  alIntentarRef.current = alIntentar;
  useEffect(() => {
    if (!activo) return undefined;
    let montado = true;
    let quitar = null;
    const poner = () => {
      quitar = abrirCapa(() => {
        quitar = null;
        alIntentarRef.current?.();
        if (montado) poner();
      });
    };
    poner();
    return () => { montado = false; quitar?.(); };
  }, [activo]);
}

// Solo para pruebas: deja el módulo como recién cargado.
export function _reiniciarAtras() {
  capas.length = 0; retrocesosPendientes = 0; enEspera.length = 0; ultimoPopPropio = false;
}
