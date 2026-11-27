/** Iconos SVG inline y reglas para asignar un icono a cada categoría. */
import { normalizar } from "./formato.js";

function crearSvg(contenido) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenido}</svg>`;
}

export const ICONOS = {
  carrito: crearSvg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
  casa: crearSvg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  coche: crearSvg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 11h18M7 21v-4M17 21v-4"/>'),
  cine: crearSvg('<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>'),
  corazon: crearSvg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  trabajo: crearSvg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  entrada: crearSvg('<line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/>'),
  salida: crearSvg('<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>'),
  papelera: crearSvg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  izquierda: crearSvg('<polyline points="15 18 9 12 15 6"/>'),
  derecha: crearSvg('<polyline points="9 18 15 12 9 6"/>'),
  cartera: crearSvg('<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>'),
  grafico: crearSvg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  buscar: crearSvg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  cerrar: crearSvg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  chevron: crearSvg('<polyline points="6 9 12 15 18 9"/>'),
  vacio: crearSvg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>')
};

const REGLAS_CATEGORIA = [
  [/super|comida|mercado|restaur|bar\b|cafe|compra|aliment/, "carrito"],
  [/casa|alquiler|hogar|hipoteca|luz|agua|internet/, "casa"],
  [/transp|gasolina|coche|bus|metro|taxi|tren|parking/, "coche"],
  [/ocio|cine|viaje|juego|salida|suscrip/, "cine"],
  [/salud|farmac|medic|dentist|gimnas/, "corazon"],
  [/nomina|salario|sueldo|trabajo|factura/, "trabajo"]
];

/** Tonos (HSL) para distinguir categorías en barras y puntos. */
export const TONOS_CATEGORIA = [211, 152, 35, 280, 350, 190, 45];

export function obtenerIconoCategoria(categoria, esIngreso = false) {
  const clave = normalizar(categoria);
  for (const [expresion, icono] of REGLAS_CATEGORIA) {
    if (expresion.test(clave)) return ICONOS[icono];
  }
  return esIngreso ? ICONOS.entrada : ICONOS.salida;
}
