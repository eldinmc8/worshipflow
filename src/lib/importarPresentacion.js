// Importar presentaciones para proyectar (pedido de Eldin, 2026-10-08): que un predicador invitado o el
// pastor traiga su presentación, o que alguien haga letras bonitas en Canva, y se pueda usar en la app.
//
// Dos caminos, según el archivo:
// - PDF o imágenes (Canva, PowerPoint/Keynote/Google Slides exportados a PDF, PNG/JPG): cada página se
//   vuelve una imagen y cada imagen una diapositiva que se proyecta tal cual, con su propio diseño.
// - Word (.docx) o texto (.txt): se lee el texto y se separa en diapositivas de texto que SÍ se pueden
//   corregir y que usan el estilo en vivo de la iglesia.
// PowerPoint directo (.pptx) no: las letras y efectos casi nunca salen igual — se pide exportarlo a PDF,
// que todos esos programas hacen con un clic.
//
// Las librerías pesadas (pdf.js, mammoth) se cargan solo al importar, no con la app.

// Una página importada es una diapositiva más del Setlist ("slide") con su imagen y la marca
// bg = "presentacion". Se marca en fondo_color (texto libre) y no en fondo_tipo a propósito: fondo_tipo
// tiene una restricción en la base de datos que solo acepta "color" o "video", y así esto funciona sin
// tener que cambiar la base. El título guarda "Nombre (3/12)" solo para reconocerla en el orden del
// culto: en pantalla no se escribe nada encima de la página (ver ProjectionPanel).
export const MARCA_PRESENTACION = "presentacion";
export const esPaginaPresentacion = (s) => !!s && s.type === "slide" && s.bg === MARCA_PRESENTACION && !!s.imageUrl;

// Lo que entra al orden del culto. paginas: [{ url }] o textos: [string]. Con agrupar, todo va debajo
// de un bloque con el nombre de la presentación, para que se vea junto y se pueda mover como unidad.
export function itemsDeImportacion({ nombre, paginas = [], textos = [], agrupar = true, nuevoId }) {
  const titulo = (nombre || "Presentación").replace(/\.[a-z0-9]+$/i, "");
  const items = [];
  if (agrupar) items.push({ id: nuevoId(), type: "seccion", title: titulo, description: "", ministryId: null });
  paginas.forEach(({ url }, k) => items.push({
    id: nuevoId(), type: "slide", title: `${titulo} (${k + 1}/${paginas.length})`, subtitle: "",
    bg: MARCA_PRESENTACION, bgType: "color", imageUrl: url, videoUrl: "",
  }));
  // Texto de un bosquejo: puntos del predicador (isSermonPoint), con el estilo en vivo de la iglesia.
  textos.forEach((texto) => items.push({ id: nuevoId(), type: "slide", title: texto, subtitle: "", bg: "#1B2029", bgType: "color", isSermonPoint: true }));
  return items;
}

export const ACEPTA =".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.pptx,.ppt,.key";
const ANCHO_MAXIMO = 1920; // Full HD: se ve nítido en cualquier proyector o TV y no pesa de más.

export function tipoDeArchivo(file) {
  const nombre = (file?.name || "").toLowerCase();
  const tipo = file?.type || "";
  if (tipo === "application/pdf" || nombre.endsWith(".pdf")) return "pdf";
  if (/^image\/(png|jpe?g|webp)$/.test(tipo) || /\.(png|jpe?g|webp)$/.test(nombre)) return "imagen";
  if (nombre.endsWith(".docx")) return "docx";
  if (tipo === "text/plain" || nombre.endsWith(".txt")) return "texto";
  if (/\.(pptx?|key)$/.test(nombre)) return "presentacion-sin-pdf";
  return null;
}

// Separa un texto en diapositivas.
// - "parrafo": cada párrafo (línea con texto) es una diapositiva.
// - "bloque": lo que esté entre líneas en blanco va junto, con sus saltos de línea.
// Viñetas y numeraciones de Word ("•", "-", "1.") se respetan tal cual: son parte del bosquejo.
export function dividirEnDiapositivas(texto, modo = "bloque") {
  const limpio = String(texto ?? "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (!limpio) return [];
  if (modo === "parrafo") return limpio.split("\n").map((l) => l.trim()).filter(Boolean);
  return limpio.split(/\n\s*\n+/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")).filter(Boolean);
}

async function canvasABlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo convertir la página en imagen."))), "image/jpeg", 0.9));
}

// Cada página del PDF como imagen JPG de hasta 1920 px de ancho, en orden. onProgreso(hechas, total).
export async function paginasDePdf(file, onProgreso) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: Math.min(4, ANCHO_MAXIMO / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000"; // páginas con fondo transparente: negro, como el escenario
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    paginas.push(await canvasABlob(canvas));
    onProgreso?.(n, pdf.numPages);
  }
  return paginas;
}

// Una imagen suelta, llevada al mismo formato que las páginas de PDF (JPG de hasta 1920 px).
export async function imagenNormalizada(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`No se pudo abrir la imagen "${file.name}".`));
      i.src = url;
    });
    const escala = Math.min(1, ANCHO_MAXIMO / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasABlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// El texto de un Word o de un .txt. De Word se toma solo el texto (sin formato): cada párrafo en su
// línea y una línea en blanco entre párrafos, que es lo que después usa dividirEnDiapositivas.
export async function textoDeArchivo(file, tipo) {
  if (tipo === "docx") {
    const modulo = await import("mammoth/mammoth.browser.js");
    const mammoth = modulo.extractRawText ? modulo : modulo.default; // módulo antiguo (UMD): a veces viene bajo "default"
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  return file.text();
}
