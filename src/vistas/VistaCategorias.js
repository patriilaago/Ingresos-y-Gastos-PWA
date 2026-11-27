import { escaparHtml, formatearEuro } from "../utilidades/formato.js";
import { ICONOS, TONOS_CATEGORIA, obtenerIconoCategoria } from "../utilidades/iconos.js";

/** Bloque plegable «Gastos por categoría» del mes seleccionado. */
export class VistaCategorias {
  #abierto = true;

  constructor(estado) {
    this.estado = estado;
    this.elemento = null;
  }

  montar(elemento) {
    this.elemento = elemento;
    elemento.innerHTML = this.#html();
    const detalles = elemento.querySelector("details");
    if (detalles) {
      detalles.addEventListener("toggle", () => {
        this.#abierto = detalles.open; // se recuerda entre repintados
      });
    }
  }

  #html() {
    const { lista, total } = this.estado.obtenerGastosPorCategoria();
    if (total <= 0) return "";

    const filas = lista
      .map((categoria, indice) => {
        const tono = TONOS_CATEGORIA[indice % TONOS_CATEGORIA.length];
        const porcentaje = categoria.porcentaje;
        return `
          <li class="cat-row">
            <div class="cat-head">
              <span class="cat-name"><span class="cat-ico" style="--h:${tono}">${obtenerIconoCategoria(categoria.etiqueta)}</span>${escaparHtml(categoria.etiqueta)}</span>
              <span class="cat-amount num">${formatearEuro(categoria.total)} <small>${porcentaje < 1 ? "<1" : Math.round(porcentaje)} %</small></span>
            </div>
            <div class="cat-track"><div class="cat-fill" style="--h:${tono};width:${porcentaje.toFixed(2)}%"></div></div>
          </li>`;
      })
      .join("");

    return `
      <details class="card cat-card" id="cat-details"${this.#abierto ? " open" : ""}>
        <summary>
          <span class="card-title">Gastos por categoría</span>
          <span class="cat-summary-meta">${lista.length} ${lista.length === 1 ? "categoría" : "categorías"}<span class="chev">${ICONOS.chevron}</span></span>
        </summary>
        <ul class="cat-list">${filas}</ul>
      </details>`;
  }
}
