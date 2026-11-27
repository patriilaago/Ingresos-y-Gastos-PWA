/** Utilidades de formato, texto y fechas compartidas por el modelo, el estado y las vistas. */

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

export function escaparAtributo(texto) {
  return escaparHtml(texto).replace(/"/g, "&quot;");
}

export function formatearEuro(valor) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(valor);
}

export function formatearCompacto(valor) {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
}

const dosDigitos = (numero) => String(numero).padStart(2, "0");

/** Devuelve "AAAA-MM" para una fecha (por defecto, hoy). */
export function obtenerClaveMes(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}`;
}

/** Devuelve "AAAA-MM-DD" para una fecha (por defecto, hoy). */
export function obtenerFechaIso(fecha = new Date()) {
  return `${obtenerClaveMes(fecha)}-${dosDigitos(fecha.getDate())}`;
}

export function desplazarMes(claveMes, delta) {
  const [anio, mes] = claveMes.split("-").map(Number);
  return obtenerClaveMes(new Date(anio, mes - 1 + delta, 1));
}

export function formatearTituloMes(claveMes) {
  const [anio, mes] = claveMes.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export function formatearMesCorto(claveMes) {
  const [anio, mes] = claveMes.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}

export function formatearEncabezadoDia(fechaIso) {
  if (!fechaIso) return "Sin fecha";
  if (fechaIso === obtenerFechaIso()) return "Hoy";

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (fechaIso === obtenerFechaIso(ayer)) return "Ayer";

  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short"
  });
}
