import { ServicioAuth } from "./servicios/ServicioAuth.js";
import { ServicioFinanzas } from "./servicios/ServicioFinanzas.js";
import { EstadoApp } from "./estado/EstadoApp.js";
import { VistaAcceso } from "./vistas/VistaAcceso.js";
import { VistaPresupuesto } from "./vistas/VistaPresupuesto.js";
import { VistaCategorias } from "./vistas/VistaCategorias.js";
import { VistaMovimientos } from "./vistas/VistaMovimientos.js";
import { VistaFormulario } from "./vistas/VistaFormulario.js";
import { VistaComparativa } from "./vistas/VistaComparativa.js";
import { ICONOS } from "./utilidades/iconos.js";
import {
  desplazarMes,
  escaparHtml,
  formatearEuro,
  formatearTituloMes,
  obtenerClaveMes
} from "./utilidades/formato.js";

/** Clase coordinadora: crea servicios, estado y vistas, y reparte el trabajo entre ellos. */
export class AplicacionFinanzas {
  constructor(contenedor = document.getElementById("app")) {
    this.contenedor = contenedor;

    this.servicioAuth = new ServicioAuth();
    this.servicioFinanzas = new ServicioFinanzas();
    this.estado = new EstadoApp();

    this.vistaAcceso = new VistaAcceso(this.contenedor, this.servicioAuth);
    this.vistaPresupuesto = new VistaPresupuesto(this.estado, {
      alGuardar: (importe) => this.guardarPresupuesto(importe)
    });
    this.vistaCategorias = new VistaCategorias(this.estado);
    this.vistaFormulario = new VistaFormulario(this.estado, {
      alGuardar: (movimiento) => this.agregarMovimiento(movimiento)
    });
    this.vistaMovimientos = new VistaMovimientos(this.estado, {
      alEliminar: (id) => this.eliminarMovimiento(id)
    });
    this.vistaComparativa = new VistaComparativa(this.estado, {
      alCambiarRango: (rango) => this.cambiarRango(rango),
      alElegirMes: (mes) => this.elegirMesComparativa(mes)
    });
  }

  /** Arranca la app: reacciona a la sesión del usuario. */
  iniciar() {
    this.servicioAuth.alCambiarUsuario((usuario) => this.#alCambiarUsuario(usuario));
  }

  /* ---------- Sesión ---------- */
  async #alCambiarUsuario(usuario) {
    if (usuario) {
      this.estado.usuario = usuario;
      this.estado.presupuestoCargado = false;
      this.cargarPresupuesto(); // en paralelo: no retrasa la primera carga
      await this.cargarMovimientosMes();
    } else {
      this.estado.reiniciarSesion();
      this.renderizar();
    }
  }

  /* ---------- Operaciones con datos ---------- */
  async cargarMovimientosMes() {
    const { usuario } = this.estado;
    if (!usuario) return;

    const peticion = ++this.estado.peticionMes;
    this.estado.cargando = true;
    this.estado.error = "";
    this.renderizar();

    try {
      const movimientos = await this.servicioFinanzas.obtenerMovimientosMes(usuario.uid, this.estado.mesSeleccionado);
      if (peticion !== this.estado.peticionMes) return; // llegó tarde: ya hay otra petición
      this.estado.movimientos = movimientos;
    } catch (fallo) {
      if (peticion !== this.estado.peticionMes) return;
      console.error(fallo);
      this.estado.error = "No se pudieron cargar los movimientos del mes.";
    } finally {
      if (peticion === this.estado.peticionMes) {
        this.estado.cargando = false;
        this.renderizar();
      }
    }
  }

  async cargarPresupuesto() {
    const { usuario } = this.estado;
    if (!usuario) return;

    try {
      this.estado.presupuestoMensual = await this.servicioFinanzas.obtenerPresupuesto(usuario.uid);
      this.estado.errorPresupuesto = "";
    } catch (fallo) {
      console.error(fallo);
      this.estado.errorPresupuesto = "No se pudo cargar el presupuesto.";
    }
    if (this.estado.usuario?.uid !== usuario.uid) return; // la sesión cambió mientras cargaba
    this.estado.presupuestoCargado = true;
    this.vistaPresupuesto.actualizar();
  }

  /** La vista del presupuesto captura el error si esto falla. */
  async guardarPresupuesto(importe) {
    const { usuario } = this.estado;
    if (!usuario) return;
    await this.servicioFinanzas.guardarPresupuesto(usuario.uid, importe);
    this.estado.presupuestoMensual = importe;
    this.estado.errorPresupuesto = "";
  }

  async agregarMovimiento(movimiento) {
    const { usuario } = this.estado;
    if (!usuario) return;
    this.estado.error = "";

    try {
      this.estado.nuevoMovimientoId = await this.servicioFinanzas.guardarMovimiento(usuario.uid, movimiento);
      this.estado.limpiarFiltros(); // para que se vea el movimiento recién añadido
      this.estado.mesSeleccionado = movimiento.obtenerMes();
      await this.cargarMovimientosMes();
    } catch (fallo) {
      console.error(fallo);
      this.estado.error = "No se pudo guardar el movimiento.";
      this.renderizar();
    }
  }

  async eliminarMovimiento(idMovimiento) {
    const { usuario } = this.estado;
    if (!usuario) return;
    this.estado.error = "";

    try {
      await this.servicioFinanzas.eliminarMovimiento(usuario.uid, idMovimiento);
      await this.cargarMovimientosMes();
    } catch (fallo) {
      console.error(fallo);
      this.estado.error = "No se pudo eliminar el movimiento.";
      this.renderizar();
    }
  }

  cambiarMes(delta) {
    this.estado.mesSeleccionado = desplazarMes(this.estado.mesSeleccionado, delta);
    return this.cargarMovimientosMes();
  }

  /* ---------- Comparativa ---------- */
  cambiarVista(vista) {
    this.estado.vistaActiva = vista;
    if (vista === "comparativa") return this.cargarHistorial();
    this.renderizar();
  }

  async cargarHistorial() {
    const { usuario } = this.estado;
    if (!usuario) return;

    const peticion = ++this.estado.peticionHistorial;
    this.estado.cargandoHistorial = true;
    this.estado.errorHistorial = "";
    if (this.estado.vistaActiva === "comparativa") this.renderizar();

    try {
      const actual = obtenerClaveMes();
      const desde = `${desplazarMes(actual, -(this.estado.rangoComparativa - 1))}-01`;
      const hasta = `${actual}-31`;
      const historial = await this.servicioFinanzas.obtenerMovimientosRango(usuario.uid, desde, hasta);
      if (peticion !== this.estado.peticionHistorial) return;
      this.estado.historial = historial;
    } catch (fallo) {
      if (peticion !== this.estado.peticionHistorial) return;
      console.error(fallo);
      this.estado.errorHistorial = "No se pudo cargar la comparativa.";
    } finally {
      if (peticion === this.estado.peticionHistorial) {
        this.estado.cargandoHistorial = false;
        if (this.estado.vistaActiva === "comparativa") this.renderizar();
      }
    }
  }

  cambiarRango(rango) {
    this.estado.rangoComparativa = rango;
    return this.cargarHistorial();
  }

  elegirMesComparativa(mes) {
    this.estado.mesComparativa = mes;
    this.renderizar();
  }

  /* ---------- Renderizado ---------- */
  renderizar() {
    if (!this.estado.usuario) {
      this.vistaAcceso.renderizar();
    } else if (this.estado.vistaActiva === "comparativa") {
      this.#renderizarComparativa();
    } else {
      this.#renderizarResumen();
    }
  }

  #renderizarResumen() {
    const { estado } = this;
    const { ingresos, gastos, balance } = estado.obtenerTotales();

    this.contenedor.innerHTML = `
      <main class="container has-tabbar">
        <header class="topbar">
          <div>
            <h1>Mis Finanzas</h1>
            <p class="subtitle">${escaparHtml(estado.usuario.email)}</p>
          </div>
          <button type="button" id="logout-btn" class="secondary">Salir</button>
        </header>

        <div class="month-bar">
          <button type="button" id="prev-month" class="secondary" aria-label="Mes anterior">${ICONOS.izquierda}</button>
          <span class="month-label">${formatearTituloMes(estado.mesSeleccionado)}</span>
          <button type="button" id="next-month" class="secondary" aria-label="Mes siguiente">${ICONOS.derecha}</button>
        </div>

        <section class="hero${balance < 0 ? " is-negative" : ""}">
          <span class="hero-label">Balance del mes</span>
          <span class="hero-amount num">${formatearEuro(balance)}</span>
        </section>

        <section class="summary-grid">
          <div class="stat">
            <div class="stat-head">
              <span class="stat-icon is-income">${ICONOS.entrada}</span>
              <span class="stat-label">Ingresos</span>
            </div>
            <span class="stat-value income-text num">${formatearEuro(ingresos)}</span>
          </div>
          <div class="stat">
            <div class="stat-head">
              <span class="stat-icon is-expense">${ICONOS.salida}</span>
              <span class="stat-label">Gastos</span>
            </div>
            <span class="stat-value expense-text num">${formatearEuro(gastos)}</span>
          </div>
        </section>

        <section class="card budget" id="presupuesto-contenedor"></section>
        <div id="categorias-contenedor"></div>
        <section class="card" id="formulario-contenedor"></section>
        ${estado.error ? `<p class="error" role="alert">${escaparHtml(estado.error)}</p>` : ""}
        <div id="movimientos-contenedor"></div>
      </main>
      ${this.#htmlBarraPestanas("resumen")}
    `;

    this.#enlazarCabecera();
    this.vistaPresupuesto.montar(this.contenedor.querySelector("#presupuesto-contenedor"));
    this.vistaCategorias.montar(this.contenedor.querySelector("#categorias-contenedor"));
    this.vistaFormulario.montar(this.contenedor.querySelector("#formulario-contenedor"));
    this.vistaMovimientos.montar(this.contenedor.querySelector("#movimientos-contenedor"));
    this.#enlazarPestanas();

    // El resaltado del movimiento nuevo solo se consume cuando la lista ya se ha pintado
    if (!estado.cargando) estado.nuevoMovimientoId = null;
  }

  #renderizarComparativa() {
    this.contenedor.innerHTML = `
      <main class="container has-tabbar" id="comparativa-contenedor"></main>
      ${this.#htmlBarraPestanas("comparativa")}
    `;
    this.vistaComparativa.montar(this.contenedor.querySelector("#comparativa-contenedor"));
    this.#enlazarPestanas();
  }

  #enlazarCabecera() {
    this.contenedor.querySelector("#logout-btn").addEventListener("click", () => this.servicioAuth.cerrarSesion());
    this.contenedor.querySelector("#prev-month").addEventListener("click", () => this.cambiarMes(-1));
    this.contenedor.querySelector("#next-month").addEventListener("click", () => this.cambiarMes(1));
  }

  #htmlBarraPestanas(activa) {
    const pestana = (id, vista, icono, etiqueta) =>
      `<button type="button" id="${id}" class="tab${activa === vista ? " is-active" : ""}" ${activa === vista ? 'aria-current="page"' : ""}>${icono}<span>${etiqueta}</span></button>`;
    return `<nav class="tabbar" aria-label="Secciones">
      ${pestana("tab-summary", "resumen", ICONOS.cartera, "Resumen")}
      ${pestana("tab-compare", "comparativa", ICONOS.grafico, "Comparativa")}
    </nav>`;
  }

  #enlazarPestanas() {
    this.contenedor.querySelector("#tab-summary").addEventListener("click", () => {
      if (this.estado.vistaActiva !== "resumen") this.cambiarVista("resumen");
    });
    this.contenedor.querySelector("#tab-compare").addEventListener("click", () => {
      if (this.estado.vistaActiva !== "comparativa") this.cambiarVista("comparativa");
    });
  }
}