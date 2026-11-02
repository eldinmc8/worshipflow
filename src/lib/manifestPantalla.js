// Manifest de la pantalla de proyección / escenario, con la dirección exacta que se está viendo como
// start_url (ver main.jsx). Va como data: URL, así que todas las direcciones deben ser absolutas.
export function datosManifestPantalla(tipo, href, origen) {
  const escenario = tipo === "escenario";
  return {
    name: escenario ? "WorshipFlow — Escenario" : "WorshipFlow — Pantalla",
    short_name: escenario ? "Escenario" : "Pantalla",
    description: escenario ? "Pantalla de escenario de WorshipFlow para la plataforma" : "Pantalla de proyección de WorshipFlow para la iglesia",
    lang: "es",
    id: escenario ? `${origen}/e/` : `${origen}/p/`,
    start_url: href,
    scope: `${origen}/`,
    display: "standalone",
    background_color: "#0a0e14",
    theme_color: "#16324F",
    icons: [
      { src: `${origen}/pwa-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${origen}/pwa-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

export function manifestDePantalla(tipo, loc = window.location) {
  const datos = datosManifestPantalla(tipo, loc.href, loc.origin);
  return `data:application/manifest+json,${encodeURIComponent(JSON.stringify(datos))}`;
}
