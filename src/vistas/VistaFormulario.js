import { Movimiento } from "../modelos/Movimiento.js";
import { obtenerClaveMes, obtenerFechaIso } from "../utilidades/formato.js";

/** Formulario para añadir un ingreso o un gasto. */
export class VistaFormulario {
  /** alGuardar(movimiento) devuelve una promesa; la vista bloquea el botón mientras tanto. */
  constructor(estado, { alGuardar }) {
    this.estado = estado;
    this.alGuardar = alGuardar;
  }

  montar(elemento) {
    const fechaPorDefecto =
      obtenerClaveMes() === this.estado.mesSeleccionado ? obtenerFechaIso() : `${this.estado.mesSeleccionado}-01`;

    elemento.innerHTML = `
      <form id="tx-form">
        <div class="field">
          <span class="field-label">Tipo</span>
          <input type="hidden" id="tx-type" value="expense" />
          <div class="segmented" data-value="expense" role="radiogroup" aria-label="Tipo de movimiento" style="margin-top:6px">
            <span class="seg-thumb" aria-hidden="true"></span>
            <button type="button" class="seg-btn is-active" data-type="expense" role="radio" aria-checked="true">Gasto</button>
            <button type="button" class="seg-btn" data-type="income" role="radio" aria-checked="false">Ingreso</button>
          </div>
        </div>

        <label>
          Importe (€)
          <input type="number" id="tx-amount" step="0.01" min="0.01" required placeholder="0,00" inputmode="decimal" />
        </label>

        <label>
          Concepto
          <input type="text" id="tx-title" required placeholder="Ej. Supermercado, Nómina..." />
        </label>

        <div class="form-row">
          <label>
            Categoría
            <input type="text" id="tx-category" value="General" required />
          </label>

          <label>
            Fecha
            <input type="date" id="tx-date" value="${fechaPorDefecto}" required />
          </label>
        </div>

        <button type="submit" id="tx-submit">Guardar movimiento</button>
      </form>`;

    this.#enlazar(elemento);
  }

  #enlazar(elemento) {
    const segmentado = elemento.querySelector(".segmented");
    const campoTipo = elemento.querySelector("#tx-type");

    segmentado.querySelectorAll(".seg-btn").forEach((boton) => {
      boton.addEventListener("click", () => {
        campoTipo.value = boton.dataset.type;
        segmentado.dataset.value = boton.dataset.type;
        segmentado.querySelectorAll(".seg-btn").forEach((otro) => {
          const activo = otro === boton;
          otro.classList.toggle("is-active", activo);
          otro.setAttribute("aria-checked", String(activo));
        });
      });
    });

    elemento.querySelector("#tx-form").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const importe = Math.abs(parseFloat(elemento.querySelector("#tx-amount").value));
      const concepto = elemento.querySelector("#tx-title").value.trim();
      const categoria = elemento.querySelector("#tx-category").value.trim() || "General";
      const fecha = elemento.querySelector("#tx-date").value;

      if (!concepto || Number.isNaN(importe) || importe <= 0 || !fecha) return;

      elemento.querySelector("#tx-submit").disabled = true; // evita dobles envíos
      await this.alGuardar(
        new Movimiento({ type: campoTipo.value, amount: importe, title: concepto, category: categoria, date: fecha })
      );
    });
  }
}
