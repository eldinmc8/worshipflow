// El PNG del logo tiene el azul marino de sus letras/ilustración fijo (es una imagen, no texto real),
// así que no puede recolorearse con CSS — por eso existe logo-iglesia-oscuro.png, la misma imagen con
// esas letras recoloreadas a blanco, y este componente muestra una u otra según el tema (ver
// .logo-claro/.logo-oscuro en index.css). El banner naranja y su texto blanco no cambiaron: ya se ven
// bien en los dos temas.
export default function AppLogo({ width }) {
  return (
    <>
      <img className="logo-claro" src="/logo-iglesia.png" alt="Iglesia Jesús El Buen Pastor" style={{ width, maxWidth: "100%", height: "auto" }} />
      <img className="logo-oscuro" src="/logo-iglesia-oscuro.png" alt="Iglesia Jesús El Buen Pastor" style={{ width, maxWidth: "100%", height: "auto" }} />
    </>
  );
}
