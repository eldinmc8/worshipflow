import { describe, expect, it, vi } from "vitest";
import { pausarActualizacion, actualizacionEnPausa, alReanudar, ESPERA_AL_REANUDAR_MS } from "../pausaActualizacion.js";

describe("no actualizar en pleno culto", () => {
  it("mientras transmite no se aplica; al terminar se aplica unos segundos después", () => {
    vi.useFakeTimers();
    const aplicar = vi.fn();
    alReanudar(aplicar);
    pausarActualizacion(true);
    expect(actualizacionEnPausa()).toBe(true);
    vi.advanceTimersByTime(60000);
    expect(aplicar).not.toHaveBeenCalled();
    pausarActualizacion(false);
    expect(actualizacionEnPausa()).toBe(false);
    vi.advanceTimersByTime(ESPERA_AL_REANUDAR_MS - 1);
    expect(aplicar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(aplicar).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("si vuelve a transmitir antes de que pase la espera, no se aplica", () => {
    vi.useFakeTimers();
    const aplicar = vi.fn();
    alReanudar(aplicar);
    pausarActualizacion(false);
    pausarActualizacion(true);
    vi.advanceTimersByTime(ESPERA_AL_REANUDAR_MS * 3);
    expect(aplicar).not.toHaveBeenCalled();
    pausarActualizacion(false);
    vi.useRealTimers();
  });
});
