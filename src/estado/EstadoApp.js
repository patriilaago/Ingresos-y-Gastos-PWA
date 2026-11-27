import { desplazarMes, normalizar, obtenerClaveMes } from "../utilidades/formato.js";

/** Estado único de la aplicación y los cálculos derivados (todo en memoria, sin Firestore). */
export class EstadoApp {
  constructor() {
    this.usuario = null;
    this.mesSeleccionado = obtenerClaveMes();
    this.movimientos = [];
    this.presupuestoMensual = null;
    this.presupuestoCargado = false;
    this.errorPresupuesto = "";
    this.textoBusqueda = "";
    this.filtroTipo = "todos"; // "todos" | "gastos" | "ingresos"
    this.cargando = false;
    this.error = "";
    this.nuevoMovimientoId = null;
    this.peticionMes = 0; // descarta respuestas antiguas si cambias de mes rápido

    // Comparativa
    this.vistaActiva = "resumen"; // "resumen" | "comparativa"
    this.rangoComparativa = 6; // 3 | 6 | 12 meses
    this.historial = [];
    this.cargandoHistorial = false;
    this.errorHistorial = "";
    this.peticionHistorial = 0;
    this.mesComparativa = obtenerClaveMes();
  }

  /** Vuelve al estado inicial (al cerrar sesión) e invalida las cargas en curso. */
  reiniciarSesion() {
    const peticionMes = this.peticionMes + 1;
    const peticionHistorial = this.peticionHistorial + 1;
    Object.assign(this, new EstadoApp());
    this.peticionMes = peticionMes;
    this.peticionHistorial = peticionHistorial;
  }

  obtenerTotales() {
    let ingresos = 0;
    let gastos = 0;
    for (const movimiento of this.movimientos) {
      if (movimiento.esIngreso()) ingresos += movimiento.amount;
      else if (movimiento.esGasto()) gastos += movimiento.amount;
    }
    return { ingresos, gastos, balance: ingresos - gastos };
  }

  hayFiltrosActivos() {
    return this.filtroTipo !== "todos" || this.textoBusqueda.trim() !== "";
  }

  limpiarFiltros() {
    this.textoBusqueda = "";
    this.filtroTipo = "todos";
  }

  obtenerMovimientosFiltrados() {
    return this.movimientos.filter((movimiento) => {
      if (this.filtroTipo === "gastos" && !movimiento.esGasto()) return false;
      if (this.filtroTipo === "ingresos" && !movimiento.esIngreso()) return false;
      return movimiento.coincideConBusqueda(this.textoBusqueda);
    });
  }

  /**
   * Agrupa los gastos por categoría (ignorando mayúsculas, tildes y espacios sobrantes),
   * de mayor a menor. Por defecto usa los movimientos del mes seleccionado.
   */
  obtenerGastosPorCategoria(movimientos = this.movimientos) {
    const grupos = new Map();
    for (const movimiento of movimientos) {
      if (!movimiento.esGasto()) continue;
      const etiqueta = movimiento.category.trim().replace(/\s+/g, " ") || "General";
      const clave = normalizar(etiqueta);
      const grupo = grupos.get(clave) || {
        etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1),
        total: 0
      };
      grupo.total += movimiento.amount;
      grupos.set(clave, grupo);
    }

    const lista = [...grupos.values()].sort((a, b) => b.total - a.total);
    const total = lista.reduce((suma, categoria) => suma + categoria.total, 0);
    lista.forEach((categoria) => {
      categoria.porcentaje = total > 0 ? (categoria.total / total) * 100 : 0;
    });
    return { lista, total };
  }

  /** Agrupa movimientos (ya ordenados por fecha) en bloques por día. */
  agruparPorFecha(movimientos = this.obtenerMovimientosFiltrados()) {
    const grupos = [];
    for (const movimiento of movimientos) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.fecha === movimiento.date) {
        ultimo.movimientos.push(movimiento);
      } else {
        grupos.push({ fecha: movimiento.date, movimientos: [movimiento] });
      }
    }
    return grupos;
  }

  /** Una fila por mes del rango de la comparativa, con ingresos, gastos y balance. */
  obtenerFilasComparativa() {
    const actual = obtenerClaveMes();
    const filas = [];
    for (let i = this.rangoComparativa - 1; i >= 0; i--) {
      filas.push({ mes: desplazarMes(actual, -i), ingresos: 0, gastos: 0, balance: 0, cantidad: 0 });
    }
    const porMes = new Map(filas.map((fila) => [fila.mes, fila]));
    for (const movimiento of this.historial) {
      const fila = porMes.get(movimiento.obtenerMes());
      if (!fila) continue;
      if (movimiento.esIngreso()) fila.ingresos += movimiento.amount;
      else if (movimiento.esGasto()) fila.gastos += movimiento.amount;
      fila.cantidad++;
    }
    filas.forEach((fila) => (fila.balance = fila.ingresos - fila.gastos));
    return filas;
  }
}
