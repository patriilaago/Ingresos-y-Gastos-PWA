import { formatearEuro, normalizar } from "../utilidades/formato.js";
import { obtenerIconoCategoria } from "../utilidades/iconos.js";

/**
 * Un ingreso o un gasto. Los nombres de los campos (type, amount, title, category, date)
 * se mantienen en inglés porque son los que ya existen en los documentos de Firestore.
 */
export class Movimiento {
  constructor({ id = null, type = "expense", amount = 0, title = "", category = "General", date = "" } = {}) {
    this.id = id;
    this.type = type; // "income" | "expense"
    this.amount = Number(amount) || 0;
    this.title = String(title ?? "");
    this.category = String(category || "General");
    this.date = String(date || ""); // "AAAA-MM-DD"
  }

  /** Crea un Movimiento a partir de un documento de Firestore. */
  static desdeDocumento(documento) {
    return new Movimiento({ id: documento.id, ...documento.data() });
  }

  esIngreso() {
    return this.type === "income";
  }

  esGasto() {
    return this.type === "expense";
  }

  /** Mes del movimiento en formato "AAAA-MM". */
  obtenerMes() {
    return this.date.slice(0, 7);
  }

  obtenerImporteFormateado() {
    return `${this.esIngreso() ? "+" : "−"}${formatearEuro(this.amount)}`;
  }

  obtenerIcono() {
    return obtenerIconoCategoria(this.category, this.esIngreso());
  }

  /** Búsqueda por concepto o categoría, sin distinguir mayúsculas ni tildes. */
  coincideConBusqueda(texto) {
    const fichas = normalizar(texto).split(/\s+/).filter(Boolean);
    if (fichas.length === 0) return true;
    const pajar = normalizar(`${this.title} ${this.category}`);
    return fichas.every((ficha) => pajar.includes(ficha));
  }

  /** Objeto que se guarda en Firestore (sin el id, que lo asigna la base de datos). */
  aObjetoFirestore() {
    return {
      type: this.type,
      amount: this.amount,
      title: this.title,
      category: this.category,
      date: this.date
    };
  }
}
