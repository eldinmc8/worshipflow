import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { levantarBaseDePrueba } from "./pgliteHarness.js";

// La migración que junta páginas sueltas de presentaciones viejas en un solo elemento.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL = fs.readFileSync(path.join(__dirname, "..", "..", "..", "supabase", "migrations", "20261010010000_agrupar_paginas_presentacion.sql"), "utf8");

describe("agrupar páginas de presentación", () => {
  let db;
  const A = "11111111-1111-1111-1111-111111111111";
  let ev;
  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`insert into public.iglesias (id, nombre, slug) values ('${A}', 'A', 'a');`);
    ev = (await db.query(`insert into public.eventos (titulo, iglesia_id) values ('Culto', $1) returning id`, [A])).rows[0].id;
    const fila = (orden, tipo, titulo, color = "#000", url = null) =>
      db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, fondo_color, fondo_imagen_url, iglesia_id) values ($1,$2,$3,$4,$5,$6,$7)`, [ev, tipo, titulo, orden, color, url, A]);
    await fila(0, "bloque", "Bienvenida");
    await fila(1, "slide", "Bienvenida (1/3)", "presentacion", "u1");
    await fila(2, "slide", "Bienvenida (2/3)", "presentacion", "u2");
    await fila(3, "slide", "Bienvenida (3/3)", "presentacion", "u3");
    await fila(4, "slide", "9 requerimientos", "#112233");
    await fila(5, "slide", "Ofrenda (1/2)", "presentacion", "o1");
    await fila(6, "slide", "Ofrenda (2/2)", "presentacion", "o2");
    await fila(7, "slide", "Suelta (1/1)", "presentacion", "s1");
    await db.exec(SQL);
  });

  it("junta las seguidas con el mismo nombre y deja lo demás igual", async () => {
    const { rows } = await db.query(`select titulo, estructura from public.items_servicio where evento_id = $1 order by orden`, [ev]);
    expect(rows.map((r) => r.titulo)).toEqual(["Bienvenida", "Bienvenida", "9 requerimientos", "Ofrenda", "Suelta (1/1)"]);
    expect(rows[1].estructura.diapositivas.map((d) => d.fondo.url)).toEqual(["u1", "u2", "u3"]);
    expect(rows[3].estructura.diapositivas.map((d) => d.fondo.url)).toEqual(["o1", "o2"]);
    expect(Array.isArray(rows[4].estructura)).toBe(true); // una sola página se queda como estaba
  });

  it("correrla otra vez no cambia nada", async () => {
    const antes = (await db.query(`select id, titulo, estructura from public.items_servicio where evento_id = $1 order by orden`, [ev])).rows;
    await db.exec(SQL);
    const despues = (await db.query(`select id, titulo, estructura from public.items_servicio where evento_id = $1 order by orden`, [ev])).rows;
    expect(despues).toEqual(antes);
  });
});
