import { escaparHtml, formatearEuro } from "../utilidades/formato.js";

/** Tarjeta de presupuesto mensual: muestra el progreso y permite definirlo, editarlo o quitarlo. */
export class VistaPresupuesto {
  #editando = false;
  #guardando = false;
  #error = "";

  /** alGuardar(importe|null) debe devolver una promesa y lanzar un error si falla. */
  constructor(estado, { alGuardar }) {
    this.estado = estado;
    this.alGuardar = alGuardar;
    this.elemento = null;
  }

  montar(elemento) {
    this.elemento = elemento;
    this.actualizar();
  }

  /** Repinta solo esta tarjeta (no toca el resto de la pantalla). */
  actualizar() {
    const elemento = this.elemento;
    if (!elemento || !elemento.isConnected) return;

    elemento.innerHTML = this.#html();
    this.#enlazar(elemento);

    const relleno = elemento.querySelector(".budget-fill");
    if (relleno) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          relleno.style.width = `${relleno.dataset.pct}%`;
        })
      );
    }
  }

  #nivel(porcentaje) {
    if (porcentaje >= 100) return "danger";
    if (porcentaje >= 75) return "warn";
    return "ok";
  }

  #html() {
    const { presupuestoMensual, presupuestoCargado, errorPresupuesto } = this.estado;
    const mensajeError = this.#error || errorPresupuesto;
    const htmlError = mensajeError ? `<p class="error" role="alert">${escaparHtml(mensajeError)}</p>` : "";

    if (!presupuestoCargado) {
      return `<div class="budget-head"><h2 class="card-title">Presupuesto mensual</h2></div><div class="budget-skeleton"></div>`;
    }

    if (this.#editando) {
      return `
        <form id="budget-form" class="budget-form">
          <div class="budget-head"><h2 class="card-title">Presupuesto mensual</h2></div>
          <label>
            Límite mensual de gastos (€)
            <input type="number" id="budget-input" step="0.01" min="0.01" required inputmode="decimal" placeholder="800,00" value="${presupuestoMensual ?? ""}" />
          </label>
          ${htmlError}
          <div class="budget-actions">
            <button type="submit" ${this.#guardando ? "disabled" : ""}>Guardar</button>
            <button type="button" class="secondary" id="budget-cancel">Cancelar</button>
          </div>
          ${presupuestoMensual != null ? `<button type="button" class="link-btn is-destructive" id="budget-remove">Quitar límite</button>` : ""}
        </form>`;
    }

    if (presupuestoMensual == null) {
      return `
        <div class="budget-head">
          <div>
            <h2 class="card-title">Presupuesto mensual</h2>
            <p class="subtitle budget-sub">Fija un límite de gasto y sigue tu progreso.</p>
          </div>
          <button type="button" class="link-btn" id="budget-edit-btn">Definir límite</button>
        </div>
        ${htmlError}`;
    }

    const { gastos } = this.estado.obtenerTotales();
    const porcentaje = (gastos / presupuestoMensual) * 100;
    const nivel = this.#nivel(porcentaje);
    const restante = presupuestoMensual - gastos;
    const nota =
      restante > 0
        ? `Te quedan ${formatearEuro(restante)}`
        : restante === 0
          ? "Has alcanzado el límite"
          : `Te has pasado ${formatearEuro(-restante)}`;

    return `
      <div class="budget-head">
        <h2 class="card-title">Presupuesto mensual</h2>
        <button type="button" class="link-btn" id="budget-edit-btn">Editar</button>
      </div>
      <p class="budget-amounts num"><strong>${formatearEuro(gastos)}</strong> de ${formatearEuro(presupuestoMensual)}</p>
      <div class="budget-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(porcentaje))}" aria-label="Gasto del mes frente al presupuesto">
        <div class="budget-fill" data-level="${nivel}" data-pct="${Math.min(100, porcentaje).toFixed(2)}"></div>
      </div>
      <div class="budget-foot">
        <span class="budget-note" data-level="${nivel}">${nota}</span>
        <span class="num">${Math.round(porcentaje)} %</span>
      </div>
      ${htmlError}`;
  }

  #enlazar(elemento) {
    elemento.querySelector("#budget-edit-btn")?.addEventListener("click", () => {
      this.#editando = true;
      this.#error = "";
      this.actualizar();
      const entrada = elemento.querySelector("#budget-input");
      if (entrada) {
        entrada.focus();
        entrada.select();
      }
    });

    elemento.querySelector("#budget-cancel")?.addEventListener("click", () => {
      this.#editando = false;
      this.#error = "";
      this.actualizar();
    });

    elemento.querySelector("#budget-remove")?.addEventListener("click", () => this.#guardar(null));

    elemento.querySelector("#budget-form")?.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const importe = Math.round(parseFloat(elemento.querySelector("#budget-input").value) * 100) / 100;
      if (!Number.isFinite(importe) || importe <= 0) {
        this.#error = "Introduce un importe mayor que 0.";
        this.actualizar();
        return;
      }
      this.#guardar(importe);
    });
  }

  async #guardar(importe) {
    this.#guardando = true;
    this.#error = "";
    this.actualizar();
    try {
      await this.alGuardar(importe);
      this.#editando = false;
    } catch (fallo) {
      console.error(fallo);
      this.#error = "No se pudo guardar el presupuesto.";
    } finally {
      this.#guardando = false;
      this.actualizar();
    }
  }
}
