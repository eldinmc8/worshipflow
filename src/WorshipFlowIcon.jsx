// Ícono oficial de WorshipFlow (nota musical naranja sobre cuadro azul marino). Mismo dibujo que
// public/worshipflow-icon.svg, de donde salen también los íconos de la app instalada. Usa colores
// fijos a propósito: es la marca del producto, no la de una iglesia, así que no cambia con los
// colores que cada iglesia elija.
export default function WorshipFlowIcon({ size = 64, style }) {
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} style={{ flexShrink: 0, display: "block", ...style }} aria-label="WorshipFlow" role="img">
      <rect width="1024" height="1024" rx="210" fill="#18324F" />
      <g fill="none" strokeLinecap="round" strokeWidth="24">
        <path d="M502 290 C 560 304, 594 292, 640 238" stroke="#E8821E" />
        <path d="M503 345 C 572 372, 612 354, 660 300" stroke="#E8821E" strokeOpacity="0.6" />
        <path d="M523 405 C 588 428, 628 410, 674 360" stroke="#E8821E" strokeOpacity="0.4" />
      </g>
      <path d="M434 648 C 434 480, 446 370, 488 282" fill="none" stroke="#E8821E" strokeWidth="36" strokeLinecap="round" />
      <ellipse cx="359" cy="664" rx="86" ry="58" transform="rotate(-18 359 664)" fill="#E8821E" />
    </svg>
  );
}
