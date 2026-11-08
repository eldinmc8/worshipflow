// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { leerSalidaAudio, guardarSalidaAudio, escucharSalidaAudio, resolverSalida, aplicarSalidaAudio, listarSalidasAudio } from "../salidaAudio.js";

const dispositivos = [
  { kind: "audiooutput", deviceId: "default", label: "Predeterminado" },
  { kind: "audiooutput", deviceId: "hdmi", label: "TV Samsung (HDMI)" },
  { kind: "audiooutput", deviceId: "usb", label: "Behringer UMC202HD" },
  { kind: "audioinput", deviceId: "mic", label: "Micrófono" },
];
const enumerar = vi.fn();
beforeEach(() => {
  localStorage.clear();
  enumerar.mockReset().mockResolvedValue(dispositivos);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { enumerateDevices: enumerar } });
});

describe("salida de audio de los videos", () => {
  it("se guarda por computadora y avisa del cambio", () => {
    const fn = vi.fn();
    const quitar = escucharSalidaAudio(fn);
    expect(leerSalidaAudio()).toBeNull();
    guardarSalidaAudio({ deviceId: "usb", label: "Behringer UMC202HD" });
    expect(leerSalidaAudio()).toEqual({ deviceId: "usb", label: "Behringer UMC202HD" });
    expect(fn).toHaveBeenLastCalledWith({ deviceId: "usb", label: "Behringer UMC202HD" });
    guardarSalidaAudio(null);
    expect(leerSalidaAudio()).toBeNull();
    quitar();
  });
  it("encuentra la salida aunque el navegador le haya cambiado el id (por el nombre)", () => {
    expect(resolverSalida({ deviceId: "usb", label: "x" }, dispositivos).deviceId).toBe("usb");
    expect(resolverSalida({ deviceId: "viejo", label: "Behringer UMC202HD" }, dispositivos).deviceId).toBe("usb");
    expect(resolverSalida({ deviceId: "viejo", label: "Otra" }, dispositivos)).toBeNull();
    expect(resolverSalida({ deviceId: "mic", label: "Micrófono" }, dispositivos)).toBeNull();
  });
  it("manda el video a la salida guardada, o a la predeterminada si no está conectada", async () => {
    const video = { sinkId: "", setSinkId: vi.fn(async function (id) { this.sinkId = id; }) };
    guardarSalidaAudio({ deviceId: "usb", label: "Behringer UMC202HD" });
    expect(await aplicarSalidaAudio(video)).toBe(true);
    expect(video.setSinkId).toHaveBeenLastCalledWith("usb");
    enumerar.mockResolvedValue(dispositivos.filter((d) => d.deviceId !== "usb"));
    expect(await aplicarSalidaAudio(video)).toBe(false);
    expect(video.setSinkId).toHaveBeenLastCalledWith("");
  });
  it("si el navegador no deja cambiarla, no rompe el video", async () => {
    const video = { sinkId: "", setSinkId: vi.fn().mockRejectedValue(new Error("NotAllowedError")) };
    guardarSalidaAudio({ deviceId: "usb", label: "Behringer UMC202HD" });
    expect(await aplicarSalidaAudio(video)).toBe(false);
    expect(await aplicarSalidaAudio({})).toBe(false);
  });
  it("lista solo salidas reales; sin nombres pide permiso un instante y lo apaga", async () => {
    const stop = vi.fn();
    enumerar.mockResolvedValueOnce([{ kind: "audiooutput", deviceId: "", label: "" }]).mockResolvedValueOnce(dispositivos);
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    const lista = await listarSalidasAudio({ pedirPermiso: true });
    expect(lista.map((d) => d.deviceId)).toEqual(["hdmi", "usb"]);
    expect(stop).toHaveBeenCalled();
  });
});
