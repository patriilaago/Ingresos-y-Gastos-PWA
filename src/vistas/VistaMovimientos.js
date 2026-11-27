import { escaparAtributo, escaparHtml, formatearEncabezadoDia, formatearTituloMes } from "../utilidades/formato.js";
import { ICONOS } from "../utilidades/iconos.js";

const OPCIONES_FILTRO = [
  ["todos", "Todos"],
  ["gastos", "Gastos"],
  ["ingresos", "Ingresos"]
];

/** Buscador, filtros rápidos y lista diaria de movimientos (con borrado en dos toques). */
export class VistaMovimientos {
  /** alEliminar(idMovimiento) se llama tras el segundo toque. */
  constructor(estado, { alEliminar }) {
    this.estado = estado;
    this.alEliminar = alEliminar;
    this.elemento = null;
  }

  montar(elemento) {
    this.elemento = elemento;
    const barra = this.estado.movimientos.length > 0 ? this.#htmlBarra() : "";
    elemento.innerHTML = `${barra}<div id="tx-results">${this.#htmlResultados()}</div>`;
    this.#enlazarBarra();
    this.#enlazarResultados();
  }

  /* ---------- Plantillas ---------- */
  #htmlBarra() {
    const { textoBusqueda, filtroTipo } = this.estado;
    return `
      <div class="tx-toolbar">
        <div class="search-field">
          <span class="search-icon">${ICONOS.buscar}</span>
          <input type="search" id="tx-search" placeholder="Buscar movimientos" value="${escaparAtributo(textoBusqueda)}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar movimientos" />
          <button type="button" id="tx-search-clear" class="search-clear${textoBusqueda ? "" : " is-hidden"}" aria-label="Borrar búsqueda">${ICONOS.cerrar}</button>
        </div>
        <div class="segmented three" id="tx-filter" data-value="${filtroTipo}" role="radiogroup" aria-label="Filtrar movimientos">
          <span class="seg-thumb" aria-hidden="true"></span>
          ${OPCIONES_FILTRO.map(
            ([valor, etiqueta]) =>
              `<button type="button" class="seg-btn filter-btn${filtroTipo === valor ? " is-active" : ""}" data-filter="${valor}" role="radio" aria-checked="${filtroTipo === valor}">${etiqueta}</button>`
          ).join("")}
        </div>
      </div>`;
  }

  #htmlResultados() {
    const { estado } = this;

    if (estado.cargando) {
      return `
        <div class="loading-row" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <p>Cargando movimientos…</p>
        </div>`;
    }

    if (estado.movimientos.length === 0) {
      return `
        <section class="card empty">
          <div class="empty-icon">${ICONOS.vacio}</div>
          <h2>Sin movimientos</h2>
          <p>Añade tu primer ingreso o gasto de ${formatearTituloMes(estado.mesSeleccionado)}.</p>
        </section>`;
    }

    const filtrados = estado.obtenerMovimientosFiltrados();

    if (filtrados.length === 0) {
      const texto = estado.textoBusqueda.trim();
      const detalle = texto
        ? `Ningún movimiento coincide con “${escaparHtml(texto)}”${estado.filtroTipo !== "todos" ? " en este filtro" : ""}.`
        : `No hay ${estado.filtroTipo === "ingresos" ? "ingresos" : "gastos"} en este mes.`;
      return `
        <section class="card empty">
          <div class="empty-icon">${ICONOS.buscar}</div>
          <h2>Sin resultados</h2>
          <p>${detalle}</p>
          <button type="button" class="secondary" id="clear-filters-btn">Limpiar filtros</button>
        </section>`;
    }

    const contador = estado.hayFiltrosActivos()
      ? `<p class="result-count">${filtrados.length} ${filtrados.length === 1 ? "resultado" : "resultados"}</p>`
      : "";

    const grupos = estado
      .agruparPorFecha(filtrados)
      .map(
        (grupo) => `
          <section>
            <h2 class="day-title">${escaparHtml(formatearEncabezadoDia(grupo.fecha))}</h2>
            <ul class="tx-list">${grupo.movimientos.map((m) => this.#htmlMovimiento(m)).join("")}</ul>
          </section>`
      )
      .join("");

    return contador + grupos;
  }

  #htmlMovimiento(movimiento) {
    const esNuevo = movimiento.id === this.estado.nuevoMovimientoId;
    return `
      <li class="tx-item${esNuevo ? " is-new" : ""}">
        <span class="tx-icon ${movimiento.esIngreso() ? "is-income" : "is-expense"}">${movimiento.obtenerIcono()}</span>
        <div class="tx-main">
          <div class="tx-title">${escaparHtml(movimiento.title)}</div>
          <div class="tx-meta">${escaparHtml(movimiento.category)}</div>
        </div>
        <div class="tx-right">
          <span class="tx-amount ${movimiento.esIngreso() ? "income-text" : "expense-text"}">${movimiento.obtenerImporteFormateado()}</span>
          <button type="button" class="danger delete-btn" data-id="${escaparAtributo(movimiento.id)}" title="Eliminar" aria-label="Eliminar movimiento">${ICONOS.papelera}</button>
        </div>
      </li>`;
  }

  /* ---------- Eventos ---------- */
  #enlazarBarra() {
    const entrada = this.elemento.querySelector("#tx-search");
    if (!entrada) return;
    const botonBorrar = this.elemento.querySelector("#tx-search-clear");

    // Solo se repinta la lista: el <input> no se recrea, así que no pierde el foco.
    entrada.addEventListener("input", () => {
      this.estado.textoBusqueda = entrada.value;
      botonBorrar.classList.toggle("is-hidden", entrada.value === "");
      this.#actualizarResultados();
    });

    entrada.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") entrada.blur(); // cierra el teclado en iPhone
    });

    botonBorrar.addEventListener("click", () => {
      this.estado.textoBusqueda = "";
      this.#sincronizarControles();
      this.#actualizarResultados();
      entrada.focus();
    });

    this.elemento.querySelectorAll(".filter-btn").forEach((boton) => {
      boton.addEventListener("click", () => {
        this.estado.filtroTipo = boton.dataset.filter;
        this.#sincronizarControles();
        this.#actualizarResultados();
      });
    });
  }

  #enlazarResultados() {
    const contenedor = this.elemento.querySelector("#tx-results");
    if (!contenedor) return;

    contenedor.querySelectorAll(".delete-btn").forEach((boton) => {
      const htmlOriginal = boton.innerHTML;
      let temporizador;

      const desarmar = () => {
        boton.classList.remove("armed");
        boton.innerHTML = htmlOriginal;
        boton.setAttribute("aria-label", "Eliminar movimiento");
      };

      boton.addEventListener("click", () => {
        if (!boton.classList.contains("armed")) {
          // Primer toque: pide confirmación durante 3 segundos
          boton.classList.add("armed");
          boton.textContent = "¿Borrar?";
          boton.setAttribute("aria-label", "Confirmar eliminación");
          temporizador = setTimeout(desarmar, 3000);
          return;
        }
        // Segundo toque: borra con animación de salida
        clearTimeout(temporizador);
        boton.closest(".tx-item")?.classList.add("removing");
        setTimeout(() => this.alEliminar(boton.dataset.id), 220);
      });
    });

    contenedor.querySelector("#clear-filters-btn")?.addEventListener("click", () => {
      this.estado.limpiarFiltros();
      this.#sincronizarControles();
      this.#actualizarResultados();
    });
  }

  /** Repinta solo la lista de resultados. */
  #actualizarResultados() {
    const contenedor = this.elemento.querySelector("#tx-results");
    if (!contenedor) return;
    contenedor.innerHTML = this.#htmlResultados();
    this.#enlazarResultados();
  }

  /** Alinea el buscador y las píldoras con el estado sin recrearlos. */
  #sincronizarControles() {
    const entrada = this.elemento.querySelector("#tx-search");
    if (!entrada) return;
    if (entrada.value !== this.estado.textoBusqueda) entrada.value = this.estado.textoBusqueda;
    this.elemento.querySelector("#tx-search-clear").classList.toggle("is-hidden", this.estado.textoBusqueda === "");

    const segmentado = this.elemento.querySelector("#tx-filter");
    segmentado.dataset.value = this.estado.filtroTipo;
    segmentado.querySelectorAll(".filter-btn").forEach((boton) => {
      const activo = boton.dataset.filter === this.estado.filtroTipo;
      boton.classList.toggle("is-active", activo);
      boton.setAttribute("aria-checked", String(activo));
    });
  }
}
