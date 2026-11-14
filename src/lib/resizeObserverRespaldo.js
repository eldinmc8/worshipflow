// Respaldo de ResizeObserver para navegadores viejos (Safari anterior a 13.1, Smart TV, iPad/Mac
// antiguos). Sin esto la app entera se caía con "Can't find variable: ResizeObserver" apenas se
// montaba una pantalla que ajusta su letra al espacio (escenario, proyección, cuenta regresiva).
// No es un polyfill completo: revisa el tamaño de cada elemento observado al cambiar la ventana y
// cada medio segundo, y avisa solo si cambió — suficiente para lo que la app mide.
export function instalarResizeObserverRespaldo(global = typeof window !== "undefined" ? window : undefined) {
  if (!global || typeof global.ResizeObserver !== "undefined") return false;

  const activos = new Set();
  let intervalo = null;

  const revisarTodos = () => { activos.forEach((o) => o._revisar()); };
  const arrancar = () => {
    if (intervalo != null) return;
    intervalo = global.setInterval(revisarTodos, 500);
    global.addEventListener("resize", revisarTodos);
    global.addEventListener("orientationchange", revisarTodos);
  };
  const parar = () => {
    if (intervalo == null || activos.size) return;
    global.clearInterval(intervalo);
    intervalo = null;
    global.removeEventListener("resize", revisarTodos);
    global.removeEventListener("orientationchange", revisarTodos);
  };

  const medir = (el) => {
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    return { w: el.clientWidth || r.width || 0, h: el.clientHeight || r.height || 0, r };
  };

  class ResizeObserverRespaldo {
    constructor(callback) {
      this._callback = callback;
      this._elementos = new Map();
    }
    observe(el) {
      if (!el || this._elementos.has(el)) return;
      // Tamaño "desconocido" a propósito: el real avisa una vez al empezar a observar, igual aquí.
      this._elementos.set(el, { w: -1, h: -1 });
      activos.add(this);
      arrancar();
      global.setTimeout(() => this._revisar(), 0);
    }
    unobserve(el) {
      this._elementos.delete(el);
      if (!this._elementos.size) { activos.delete(this); parar(); }
    }
    disconnect() {
      this._elementos.clear();
      activos.delete(this);
      parar();
    }
    _revisar() {
      const cambios = [];
      this._elementos.forEach((previo, el) => {
        const { w, h, r } = medir(el);
        if (w === previo.w && h === previo.h) return;
        previo.w = w;
        previo.h = h;
        cambios.push({ target: el, contentRect: { width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0 }, borderRect: r });
      });
      if (!cambios.length) return;
      try { this._callback(cambios, this); } catch { /* una medida fallida no debe tumbar la pantalla */ }
    }
  }

  global.ResizeObserver = ResizeObserverRespaldo;
  return true;
}

instalarResizeObserverRespaldo();
