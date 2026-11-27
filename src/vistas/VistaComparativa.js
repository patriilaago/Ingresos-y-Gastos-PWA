import {
  escaparHtml,
  formatearCompacto,
  formatearEuro,
  formatearMesCorto,
  formatearTituloMes
} from "../utilidades/formato.js";
import { ICONOS, TONOS_CATEGORIA } from "../utilidades/iconos.js";

/** Pestaña «Comparativa»: evolución mes a mes con gráficos SVG propios. */
export class VistaComparativa {
  /** alCambiarRango(3|6|12) y alElegirMes("AAAA-MM") los gestiona el coordinador. */
  constructor(estado, { alCambiarRango, alElegirMes }) {
    this.estado = estado;
    this.alCambiarRango = alCambiarRango;
    this.alElegirMes = alElegirMes;
  }

  montar(elemento) {
    const { estado } = this;
    const filas = estado.obtenerFilasComparativa();
    if (!filas.some((fila) => fila.mes === estado.mesComparativa)) {
      estado.mesComparativa = filas[filas.length - 1].mes;
    }

    elemento.innerHTML = `
      <header class="topbar">
        <div>
          <h1>Comparativa</h1>
          <p class="subtitle">Evolución mes a mes</p>
        </div>
      </header>

      <div class="segmented three" data-value="${estado.rangoComparativa}" role="radiogroup" aria-label="Rango de meses">
        <span class="seg-thumb" aria-hidden="true"></span>
        ${[3, 6, 12]
          .map(
            (n) =>
              `<button type="button" class="seg-btn range-btn${estado.rangoComparativa === n ? " is-active" : ""}" data-range="${n}" role="radio" aria-checked="${estado.rangoComparativa === n}">${n} meses</button>`
          )
          .join("")}
      </div>

      <div class="compare-body">${this.#htmlCuerpo(filas)}</div>`;

    elemento.querySelectorAll(".range-btn").forEach((boton) => {
      boton.addEventListener("click", () => {
        const rango = Number(boton.dataset.range);
        if (rango !== estado.rangoComparativa) this.alCambiarRango(rango);
      });
    });

    elemento.querySelectorAll(".chart-group").forEach((grupo) => {
      grupo.addEventListener("click", () => this.alElegirMes(grupo.dataset.month));
    });
  }

  /* ---------- Cuerpo ---------- */
  #htmlCuerpo(filas) {
    const { estado } = this;

    if (estado.cargandoHistorial) {
      return `<div class="loading-row" role="status"><span class="spinner" aria-hidden="true"></span><p>Calculando comparativa…</p></div>`;
    }
    if (estado.errorHistorial) return `<p class="error" role="alert">${escaparHtml(estado.errorHistorial)}</p>`;

    const activas = filas.filter((fila) => fila.cantidad > 0);
    if (activas.length === 0) {
      return `
        <section class="card empty">
          <div class="empty-icon">${ICONOS.grafico}</div>
          <h2>Aún no hay datos que comparar</h2>
          <p>Registra movimientos en la pestaña Resumen y aquí verás la evolución mes a mes.</p>
        </section>`;
    }

    const gastoMedio = activas.reduce((suma, fila) => suma + fila.gastos, 0) / activas.length;
    const mejor = activas.reduce((a, b) => (b.balance > a.balance ? b : a));
    const peor = activas.reduce((a, b) => (b.balance < a.balance ? b : a));

    const indice = filas.findIndex((fila) => fila.mes === estado.mesComparativa);
    const anterior = indice > 0 ? filas[indice - 1] : null;
    let variacion = `<span class="stat-value num">—</span>`;
    if (anterior && anterior.gastos > 0) {
      const porcentaje = ((filas[indice].gastos - anterior.gastos) / anterior.gastos) * 100;
      const sube = porcentaje > 0;
      variacion = `<span class="stat-value num ${sube ? "expense-text" : "income-text"}">${sube ? "+" : "−"}${Math.abs(porcentaje).toFixed(0)} %</span>`;
    }

    const delMes = estado.historial.filter((m) => m.obtenerMes() === estado.mesComparativa);
    const { lista, total } = estado.obtenerGastosPorCategoria(delMes);
    const categorias = this.#condensar(lista);

    const htmlCategorias = categorias.length
      ? `<ul class="cat-list">${categorias
          .map((categoria, i) => {
            const tono = TONOS_CATEGORIA[i % TONOS_CATEGORIA.length];
            return `<li class="cat-row">
              <div class="cat-head">
                <span class="cat-name"><i class="cat-dot" style="--h:${tono}"></i>${escaparHtml(categoria.etiqueta)}</span>
                <span class="cat-amount num">${formatearEuro(categoria.total)} <small>${categoria.porcentaje.toFixed(0)} %</small></span>
              </div>
              <div class="cat-track"><div class="cat-fill" style="--h:${tono};width:${categoria.porcentaje}%"></div></div>
            </li>`;
          })
          .join("")}</ul>`
      : `<p class="subtitle">Sin gastos en este mes.</p>`;

    const nota = (mes) => `<span class="stat-note">${escaparHtml(formatearTituloMes(mes))}</span>`;

    return `
      <section class="summary-grid">
        <div class="stat"><span class="stat-label">Gasto medio al mes</span><span class="stat-value num">${formatearEuro(gastoMedio)}</span></div>
        <div class="stat"><span class="stat-label">Gastos vs. mes anterior</span>${variacion}${nota(estado.mesComparativa)}</div>
        <div class="stat"><span class="stat-label">Mejor mes</span><span class="stat-value num income-text">${formatearEuro(mejor.balance)}</span>${nota(mejor.mes)}</div>
        <div class="stat"><span class="stat-label">Peor mes</span><span class="stat-value num ${peor.balance < 0 ? "expense-text" : ""}">${formatearEuro(peor.balance)}</span>${nota(peor.mes)}</div>
      </section>

      <section class="card">
        <h2 class="card-title">Ingresos y gastos</h2>
        ${this.#graficoBarras(filas)}
        <div class="legend"><span><i class="bar-income-dot"></i>Ingresos</span><span><i class="bar-expense-dot"></i>Gastos</span><span class="legend-hint">Toca un mes para ver su detalle</span></div>
      </section>

      <section class="card">
        <h2 class="card-title">Balance mensual</h2>
        ${this.#graficoBalance(filas)}
      </section>

      <section class="card">
        <h2 class="card-title">Gastos por categoría</h2>
        <p class="subtitle cat-sub">${escaparHtml(formatearTituloMes(estado.mesComparativa))} · ${formatearEuro(total)}</p>
        ${htmlCategorias}
      </section>`;
  }

  /** Muestra las 5 mayores categorías y agrupa el resto en «Otras». */
  #condensar(lista) {
    if (lista.length <= 6) return lista;
    const resto = lista.slice(5);
    return [
      ...lista.slice(0, 5),
      {
        etiqueta: "Otras",
        total: resto.reduce((s, c) => s + c.total, 0),
        porcentaje: resto.reduce((s, c) => s + c.porcentaje, 0)
      }
    ];
  }

  /* ---------- Gráficos SVG ---------- */
  #techoRedondo(valor) {
    const potencia = Math.pow(10, Math.floor(Math.log10(valor)));
    const n = valor / potencia;
    const multiplo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return multiplo * potencia;
  }

  #etiquetaMes(filas, i, x, y) {
    const mes = filas[i].mes;
    const mostrarAnio = i === 0 || mes.endsWith("-01");
    return `<text class="chart-label" x="${x}" y="${y}" text-anchor="middle">${formatearMesCorto(mes)}</text>${
      mostrarAnio ? `<text class="chart-label chart-year" x="${x}" y="${y + 11}" text-anchor="middle">’${mes.slice(2, 4)}</text>` : ""
    }`;
  }

  #graficoBarras(filas) {
    const ANCHO = 340, ALTO = 196, izq = 36, der = 6, arriba = 10, abajo = 38;
    const anchoUtil = ANCHO - izq - der;
    const altoUtil = ALTO - arriba - abajo;
    const maximo = this.#techoRedondo(Math.max(1, ...filas.flatMap((f) => [f.ingresos, f.gastos])));
    const anchoGrupo = anchoUtil / filas.length;
    const anchoBarra = Math.min(14, anchoGrupo * 0.32);
    const y = (valor) => arriba + altoUtil - (valor / maximo) * altoUtil;
    const base = arriba + altoUtil;

    const cuadricula = [0, 0.5, 1]
      .map((t) => {
        const yy = y(maximo * t);
        return `<line class="chart-grid" x1="${izq}" x2="${ANCHO - der}" y1="${yy}" y2="${yy}"/>
          <text class="chart-label" x="${izq - 6}" y="${yy + 3}" text-anchor="end">${formatearCompacto(maximo * t)}</text>`;
      })
      .join("");

    const grupos = filas
      .map((fila, i) => {
        const cx = izq + anchoGrupo * i + anchoGrupo / 2;
        const seleccionado = fila.mes === this.estado.mesComparativa;
        return `<g class="chart-group" data-month="${fila.mes}">
          <rect class="chart-hit${seleccionado ? " is-selected" : ""}" x="${izq + anchoGrupo * i + 1}" y="${arriba}" width="${anchoGrupo - 2}" height="${altoUtil + abajo - 6}" rx="6"/>
          <rect class="bar-income" x="${cx - anchoBarra - 1}" y="${y(fila.ingresos)}" width="${anchoBarra}" height="${base - y(fila.ingresos)}" rx="3"/>
          <rect class="bar-expense" x="${cx + 1}" y="${y(fila.gastos)}" width="${anchoBarra}" height="${base - y(fila.gastos)}" rx="3"/>
          ${this.#etiquetaMes(filas, i, cx, ALTO - abajo + 14)}
        </g>`;
      })
      .join("");

    return `<svg class="chart" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Ingresos y gastos por mes">${cuadricula}${grupos}</svg>`;
  }

  #graficoBalance(filas) {
    const ANCHO = 340, ALTO = 170, izq = 36, der = 14, arriba = 14, abajo = 34;
    const anchoUtil = ANCHO - izq - der;
    const altoUtil = ALTO - arriba - abajo;
    const valores = filas.map((f) => f.balance);
    const minimo = Math.min(0, ...valores);
    let maximo = Math.max(0, ...valores);
    if (maximo === minimo) maximo = minimo + 1;
    const y = (valor) => arriba + altoUtil - ((valor - minimo) / (maximo - minimo)) * altoUtil;
    const x = (i) => (filas.length === 1 ? izq + anchoUtil / 2 : izq + 10 + ((anchoUtil - 20) * i) / (filas.length - 1));

    const puntos = filas.map((f, i) => `${x(i)},${y(f.balance)}`);
    const area = `${x(0)},${y(0)} ${puntos.join(" ")} ${x(filas.length - 1)},${y(0)}`;

    const etiquetas = [maximo > 0 ? maximo : null, 0, minimo < 0 ? minimo : null]
      .filter((v) => v !== null)
      .map((v) => `<text class="chart-label" x="${izq - 6}" y="${y(v) + 3}" text-anchor="end">${formatearCompacto(v)}</text>`)
      .join("");

    const marcas = filas
      .map((fila, i) => {
        const seleccionado = fila.mes === this.estado.mesComparativa;
        return `<g class="chart-group" data-month="${fila.mes}">
          <circle class="line-dot${seleccionado ? " is-selected" : ""}" cx="${x(i)}" cy="${y(fila.balance)}" r="${seleccionado ? 5 : 3.5}"/>
          <circle class="chart-tap" cx="${x(i)}" cy="${y(fila.balance)}" r="14"/>
          ${this.#etiquetaMes(filas, i, x(i), ALTO - abajo + 14)}
        </g>`;
      })
      .join("");

    return `<svg class="chart" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Balance mensual">
      <line class="chart-zero" x1="${izq}" x2="${ANCHO - der}" y1="${y(0)}" y2="${y(0)}"/>
      ${etiquetas}
      <polygon class="line-area" points="${area}"/>
      <polyline class="line-path" points="${puntos.join(" ")}"/>
      ${marcas}
    </svg>`;
  }
}
