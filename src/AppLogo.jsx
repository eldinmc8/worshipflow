import MarkCircle from "./MarkCircle.jsx";

// Fase 5 (identidad por iglesia): antes esto mostraba SIEMPRE el logo de Jesús El Buen Pastor (dos
// PNGs fijos, uno para tema claro y otro para oscuro, swapeados por CSS). Ahora recibe logoUrl —
// Buen Pastor ya tiene el suyo guardado en iglesias.logo_url (ver migración
// 20260930000700_logo_y_colores_buen_pastor.sql), así que para su propio equipo esto se ve
// exactamente igual que antes. Sin logoUrl (iglesia nueva que todavía no subió el suyo, o una
// pantalla que corre ANTES de iniciar sesión y por lo tanto no sabe de qué iglesia es — ver
// GenericMark.jsx, que es el que de verdad se usa ahí) se cae a un trazo de báculo genérico en vez
// de mostrarle a cualquiera el logo de una iglesia que no es la suya.
//
// Un logo personalizado es una sola imagen (no dos, una por tema) — a diferencia del PNG viejo, una
// iglesia normalmente no va a subir una versión aparte "para modo oscuro", así que se muestra igual
// en los dos temas; en la práctica la mayoría de logos se ven bien sobre cualquier fondo.
export default function AppLogo({ width, logoUrl }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" style={{ width, maxWidth: "100%", height: "auto", objectFit: "contain" }} />;
  }
  return <MarkCircle size={width} />;
}
