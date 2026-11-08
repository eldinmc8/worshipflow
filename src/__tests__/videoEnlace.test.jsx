// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { tipoDeVideo, urlIncrustada, esVideoSolo, avisoDeEnlace } from "../lib/videoEnlace.js";
import VideoProyectado from "../components/VideoProyectado.jsx";
afterEach(cleanup);

// Arreglo del 2026-11-08: "pego el enlace del video y en la proyección no pasa nada". Un enlace de
// YouTube es una página, no un archivo: el <video> de siempre no lo podía reproducir.
describe("videos por enlace", () => {
  it("reconoce YouTube en todas sus formas", () => {
    for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://youtu.be/dQw4w9WgXcQ?si=abc", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/live/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
      expect(tipoDeVideo(url)).toMatchObject({ tipo: "youtube", id: "dQw4w9WgXcQ" });
    }
  });

  it("reconoce Vimeo, Google Drive, archivos directos y los que no se pueden", () => {
    expect(tipoDeVideo("https://vimeo.com/76979871")).toMatchObject({ tipo: "vimeo", id: "76979871" });
    expect(tipoDeVideo("https://drive.google.com/file/d/ABC123/view?usp=sharing")).toMatchObject({ tipo: "archivo", drive: true, src: "https://drive.google.com/uc?export=download&id=ABC123" });
    expect(tipoDeVideo("https://xyz.supabase.co/storage/v1/object/public/fondos/video/a.mp4")).toMatchObject({ tipo: "archivo" });
    expect(tipoDeVideo("https://www.facebook.com/watch?v=123").tipo).toBe("no-soportado");
    expect(tipoDeVideo("https://www.tiktok.com/@x/video/1").tipo).toBe("no-soportado");
    expect(avisoDeEnlace("https://www.instagram.com/reel/abc").ok).toBe(false);
    expect(avisoDeEnlace("https://youtu.be/dQw4w9WgXcQ").ok).toBe(true);
  });

  it("un video solo suena y se ve una vez; de fondo va sin sonido y en bucle", () => {
    const info = tipoDeVideo("https://youtu.be/dQw4w9WgXcQ");
    expect(urlIncrustada(info, { conSonido: true })).toContain("mute=0");
    expect(urlIncrustada(info, { conSonido: true })).not.toContain("loop=1");
    expect(urlIncrustada(info, { conSonido: false })).toContain("mute=1");
    expect(urlIncrustada(info, { conSonido: false })).toContain("loop=1&playlist=dQw4w9WgXcQ");
    expect(esVideoSolo({ type: "slide", bgType: "video", videoUrl: "https://x/a.mp4", title: "", subtitle: "" })).toBe(true);
    expect(esVideoSolo({ type: "slide", bgType: "video", videoUrl: "https://x/a.mp4", title: "Bienvenidos" })).toBe(false);
  });

  it("en la proyección YouTube va en su reproductor; en las miniaturas solo su imagen (sin sonido)", () => {
    const { container, rerender } = render(<VideoProyectado url="https://youtu.be/dQw4w9WgXcQ" conSonido />);
    expect(container.querySelector("iframe").getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(container.querySelector("iframe").getAttribute("allow")).toContain("autoplay");
    rerender(<VideoProyectado url="https://youtu.be/dQw4w9WgXcQ" conSonido miniatura />);
    expect(container.querySelector("iframe")).toBeNull();
    rerender(<VideoProyectado url="https://x.supabase.co/v.mp4" />);
    const video = container.querySelector("video");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
  });
});

describe("agregar un video al Setlist", () => {
  it("el formulario arma una diapositiva de video con nombre y no deja agregar un enlace de Facebook", async () => {
    const { vi } = await import("vitest");
    const { fireEvent, screen } = await import("@testing-library/react");
    vi.doMock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
    const { VideoModal } = await import("../pantallas/ventanas.jsx");
    const onAdd = vi.fn();
    render(<VideoModal iglesiaId="ig" onClose={() => {}} onAdd={onAdd} />);
    const enlace = screen.getByPlaceholderText(/enlace de YouTube/);
    fireEvent.change(enlace, { target: { value: "https://www.facebook.com/watch?v=1" } });
    expect(screen.getByText(/no se pueden proyectar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar al setlist" }));
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(enlace, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.change(screen.getByPlaceholderText(/Testimonio de Juan/), { target: { value: "Testimonio" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar al setlist" }));
    expect(onAdd).toHaveBeenCalledWith({ videoUrl: "https://youtu.be/dQw4w9WgXcQ", name: "Testimonio" });
  });
});
