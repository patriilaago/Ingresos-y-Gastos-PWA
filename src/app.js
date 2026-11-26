import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc
} from "./firebase.js";

const appContainer = document.getElementById("app");

const state = {
  user: null,
  selectedMonth: getCurrentMonthKey(), // Formato "YYYY-MM"
  transactions: [],
  loading: false,
  error: "",
  newTxId: null, // id del último movimiento añadido (para animarlo)
  view: "summary", // "summary" | "compare"
  range: 6, // meses de la comparativa: 3 | 6 | 12
  history: [],
  historyLoading: false,
  historyError: "",
  historyReq: 0,
  cmpMonth: getCurrentMonthKey(), // mes seleccionado en la comparativa
  budget: null, // presupuesto mensual de gastos (€) o null
  budgetLoaded: false,
  budgetEditing: false,
  budgetSaving: false,
  budgetError: "",
  catOpen: true, // desglose por categoría desplegado
  filters: { query: "", type: "all" } // buscador y filtro rápido ("all" | "expense" | "income")
};

/* ---------- Iconos SVG inline ---------- */
function svg(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

const ICONS = {
  cart: svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
  home: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  car: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 11h18M7 21v-4M17 21v-4"/>'),
  film: svg('<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>'),
  heart: svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  work: svg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  down: svg('<line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/>'),
  up: svg('<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>'),
  trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  left: svg('<polyline points="15 18 9 12 15 6"/>'),
  right: svg('<polyline points="9 18 15 12 9 6"/>'),
  wallet: svg('<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>'),
  chart: svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  close: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  chevron: svg('<polyline points="6 9 12 15 18 9"/>'),
  empty: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>')
};

const CATEGORY_RULES = [
  [/super|comida|mercado|restaur|bar\b|cafe|compra|aliment/, "cart"],
  [/casa|alquiler|hogar|hipoteca|luz|agua|internet/, "home"],
  [/transp|gasolina|coche|bus|metro|taxi|tren|parking/, "car"],
  [/ocio|cine|viaje|juego|salida|suscrip/, "film"],
  [/salud|farmac|medic|dentist|gimnas/, "heart"],
  [/nomina|salario|sueldo|trabajo|factura/, "work"]
];

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function categoryIcon(tx) {
  const key = normalize(tx.category);
  for (const [regex, icon] of CATEGORY_RULES) {
    if (regex.test(key)) return ICONS[icon];
  }
  return tx.type === "income" ? ICONS.down : ICONS.up;
}

/* ---------- Utilidades de fecha y formato ---------- */
function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftMonth(monthKey, deltaMonths) {
  const [yearStr, monthStr] = monthKey.split("-");
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + deltaMonths, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthTitle(monthKey) {
  const [yearStr, monthStr] = monthKey.split("-");
  const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function formatEuro(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function formatDayHeader(dateStr) {
  if (!dateStr) return "Sin fecha";
  const today = getTodayDateString();
  if (dateStr === today) return "Hoy";

  const [y, m, d] = dateStr.split("-").map(Number);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr === yesterdayStr) return "Ayer";

  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short"
  });
}

function groupByDate(transactions) {
  const groups = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.date === (tx.date || "")) {
      last.items.push(tx);
    } else {
      groups.push({ date: tx.date || "", items: [tx] });
    }
  }
  return groups;
}

/* ---------- Firebase (sin cambios de lógica) ---------- */
function userTransactionsRef(uid) {
  return collection(db, "users", uid, "transactions");
}

async function loadMonthTransactions() {
  if (!state.user) return;
  state.loading = true;
  state.error = "";
  renderApp();

  try {
    const startDate = `${state.selectedMonth}-01`;
    const endDate = `${state.selectedMonth}-31`;

    const q = query(
      userTransactionsRef(state.user.uid),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const snapshot = await getDocs(q);
    state.transactions = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } catch (err) {
    console.error(err);
    state.error = "No se pudieron cargar los movimientos del mes.";
  } finally {
    state.loading = false;
    renderApp();
  }
}

async function handleAddTransaction(txData) {
  if (!state.user) return;
  state.error = "";

  try {
    const ref = await addDoc(userTransactionsRef(state.user.uid), txData);
    state.newTxId = ref.id;
    state.filters = { query: "", type: "all" }; // para que se vea el nuevo movimiento
    const txMonth = txData.date.slice(0, 7);
    if (txMonth !== state.selectedMonth) {
      state.selectedMonth = txMonth;
    }
    await loadMonthTransactions();
  } catch (err) {
    console.error(err);
    state.error = "No se pudo guardar el movimiento.";
    renderApp();
  }
}

async function handleDeleteTransaction(txId) {
  if (!state.user) return;
  state.error = "";

  try {
    await deleteDoc(doc(db, "users", state.user.uid, "transactions", txId));
    await loadMonthTransactions();
  } catch (err) {
    console.error(err);
    state.error = "No se pudo eliminar el movimiento.";
    renderApp();
  }
}

/* ---------- Presupuesto mensual (users/{uid}.monthlyBudget) ---------- */
function getMonthTotals() {
  let income = 0;
  let expense = 0;
  for (const t of state.transactions) {
    const amount = Number(t.amount || 0);
    if (t.type === "income") income += amount;
    else if (t.type === "expense") expense += amount;
  }
  return { income, expense };
}

async function loadUserSettings() {
  if (!state.user) return;
  const uid = state.user.uid;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const value = snap.exists() ? Number(snap.data().monthlyBudget) : NaN;
    state.budget = Number.isFinite(value) && value > 0 ? value : null;
    state.budgetError = "";
  } catch (err) {
    console.error(err);
    state.budgetError = "No se pudo cargar el presupuesto.";
  }
  if (!state.user || state.user.uid !== uid) return; // la sesión cambió mientras cargaba
  state.budgetLoaded = true;
  mountBudgetCard();
}

async function saveBudget(value) {
  if (!state.user) return;
  state.budgetSaving = true;
  state.budgetError = "";
  mountBudgetCard();
  try {
    await setDoc(doc(db, "users", state.user.uid), { monthlyBudget: value }, { merge: true });
    state.budget = value;
    state.budgetEditing = false;
  } catch (err) {
    console.error(err);
    state.budgetError = "No se pudo guardar el presupuesto.";
  } finally {
    state.budgetSaving = false;
    mountBudgetCard();
  }
}

function budgetLevel(pct) {
  if (pct >= 100) return "danger";
  if (pct >= 75) return "warn";
  return "ok";
}

function budgetCardInner() {
  const errorHtml = state.budgetError ? `<p class="error" role="alert">${escapeHtml(state.budgetError)}</p>` : "";

  if (!state.budgetLoaded) {
    return `<div class="budget-head"><h2 class="card-title">Presupuesto mensual</h2></div><div class="budget-skeleton"></div>`;
  }

  if (state.budgetEditing) {
    return `
      <form id="budget-form" class="budget-form">
        <div class="budget-head"><h2 class="card-title">Presupuesto mensual</h2></div>
        <label>
          Límite mensual de gastos (€)
          <input type="number" id="budget-input" step="0.01" min="0.01" required inputmode="decimal" placeholder="800,00" value="${state.budget ?? ""}" />
        </label>
        ${errorHtml}
        <div class="budget-actions">
          <button type="submit" ${state.budgetSaving ? "disabled" : ""}>Guardar</button>
          <button type="button" class="secondary" id="budget-cancel">Cancelar</button>
        </div>
        ${state.budget != null ? `<button type="button" class="link-btn is-destructive" id="budget-remove">Quitar límite</button>` : ""}
      </form>`;
  }

  if (state.budget == null) {
    return `
      <div class="budget-head">
        <div>
          <h2 class="card-title">Presupuesto mensual</h2>
          <p class="subtitle budget-sub">Fija un límite de gasto y sigue tu progreso.</p>
        </div>
        <button type="button" class="link-btn" id="budget-edit-btn">Definir límite</button>
      </div>
      ${errorHtml}`;
  }

  const spent = getMonthTotals().expense;
  const pct = (spent / state.budget) * 100;
  const level = budgetLevel(pct);
  const remaining = state.budget - spent;
  const note =
    remaining > 0 ? `Te quedan ${formatEuro(remaining)}` : remaining === 0 ? "Has alcanzado el límite" : `Te has pasado ${formatEuro(-remaining)}`;

  return `
    <div class="budget-head">
      <h2 class="card-title">Presupuesto mensual</h2>
      <button type="button" class="link-btn" id="budget-edit-btn">Editar</button>
    </div>
    <p class="budget-amounts num"><strong>${formatEuro(spent)}</strong> de ${formatEuro(state.budget)}</p>
    <div class="budget-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(pct))}" aria-label="Gasto del mes frente al presupuesto">
      <div class="budget-fill" data-level="${level}" data-pct="${Math.min(100, pct).toFixed(2)}"></div>
    </div>
    <div class="budget-foot">
      <span class="budget-note" data-level="${level}">${note}</span>
      <span class="num">${Math.round(pct)} %</span>
    </div>
    ${errorHtml}`;
}

// Repinta solo la tarjeta de presupuesto (sin tocar el resto de la pantalla)
function mountBudgetCard() {
  const el = document.getElementById("budget-card");
  if (!el) return;
  el.innerHTML = budgetCardInner();
  bindBudgetCard(el);
  const fill = el.querySelector(".budget-fill");
  if (fill) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fill.style.width = `${fill.dataset.pct}%`;
      })
    );
  }
}

function bindBudgetCard(el) {
  const editBtn = el.querySelector("#budget-edit-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      state.budgetEditing = true;
      state.budgetError = "";
      mountBudgetCard();
      const input = document.getElementById("budget-input");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  const cancelBtn = el.querySelector("#budget-cancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.budgetEditing = false;
      state.budgetError = "";
      mountBudgetCard();
    });
  }

  const removeBtn = el.querySelector("#budget-remove");
  if (removeBtn) removeBtn.addEventListener("click", () => saveBudget(null));

  const form = el.querySelector("#budget-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = Math.round(parseFloat(document.getElementById("budget-input").value) * 100) / 100;
      if (!Number.isFinite(value) || value <= 0) {
        state.budgetError = "Introduce un importe mayor que 0.";
        mountBudgetCard();
        return;
      }
      saveBudget(value);
    });
  }
}

/* ---------- Desglose de gastos por categoría (en memoria) ---------- */
function getMonthExpenseByCategory() {
  const map = new Map();
  for (const tx of state.transactions) {
    if (tx.type !== "expense") continue;
    const label = String(tx.category || "General").trim().replace(/\s+/g, " ") || "General";
    const key = normalize(label);
    const entry = map.get(key) || { label: label.charAt(0).toUpperCase() + label.slice(1), total: 0 };
    entry.total += Number(tx.amount || 0);
    map.set(key, entry);
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total);
  const total = list.reduce((sum, c) => sum + c.total, 0);
  return { list, total };
}

function renderCategoryBreakdown() {
  const { list, total } = getMonthExpenseByCategory();
  if (total <= 0) return "";

  const rows = list
    .map((c, i) => {
      const pct = (c.total / total) * 100;
      const hue = CAT_HUES[i % CAT_HUES.length];
      return `
        <li class="cat-row">
          <div class="cat-head">
            <span class="cat-name"><span class="cat-ico" style="--h:${hue}">${categoryIcon({ category: c.label, type: "expense" })}</span>${escapeHtml(c.label)}</span>
            <span class="cat-amount num">${formatEuro(c.total)} <small>${pct < 1 ? "<1" : Math.round(pct)} %</small></span>
          </div>
          <div class="cat-track"><div class="cat-fill" style="--h:${hue};width:${pct.toFixed(2)}%"></div></div>
        </li>`;
    })
    .join("");

  return `
    <details class="card cat-card" id="cat-details"${state.catOpen ? " open" : ""}>
      <summary>
        <span class="card-title">Gastos por categoría</span>
        <span class="cat-summary-meta">${list.length} ${list.length === 1 ? "categoría" : "categorías"}<span class="chev">${ICONS.chevron}</span></span>
      </summary>
      <ul class="cat-list">${rows}</ul>
    </details>`;
}

/* ---------- Buscador y filtros de movimientos (en memoria) ---------- */
function getFilteredTransactions() {
  const tokens = normalize(state.filters.query).split(/\s+/).filter(Boolean);
  return state.transactions.filter((tx) => {
    if (state.filters.type !== "all" && tx.type !== state.filters.type) return false;
    if (tokens.length === 0) return true;
    const haystack = normalize(`${tx.title || ""} ${tx.category || ""}`);
    return tokens.every((t) => haystack.includes(t));
  });
}

function hasActiveFilters() {
  return state.filters.type !== "all" || state.filters.query.trim() !== "";
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function renderTxToolbar() {
  const { query, type } = state.filters;
  const options = [
    ["all", "Todos"],
    ["expense", "Gastos"],
    ["income", "Ingresos"]
  ];
  return `
    <div class="tx-toolbar">
      <div class="search-field">
        <span class="search-icon">${ICONS.search}</span>
        <input type="search" id="tx-search" placeholder="Buscar movimientos" value="${escapeAttr(query)}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar movimientos" />
        <button type="button" id="tx-search-clear" class="search-clear${query ? "" : " is-hidden"}" aria-label="Borrar búsqueda">${ICONS.close}</button>
      </div>
      <div class="segmented three" id="tx-filter" data-value="${type}" role="radiogroup" aria-label="Filtrar movimientos">
        <span class="seg-thumb" aria-hidden="true"></span>
        ${options
          .map(
            ([value, label]) =>
              `<button type="button" class="seg-btn filter-btn${type === value ? " is-active" : ""}" data-filter="${value}" role="radio" aria-checked="${type === value}">${label}</button>`
          )
          .join("")}
      </div>
    </div>`;
}

// Sincroniza los controles con state.filters sin recrear el <input> (mantiene el foco)
function syncFilterControls() {
  const input = document.getElementById("tx-search");
  if (!input) return;
  if (input.value !== state.filters.query) input.value = state.filters.query;
  document.getElementById("tx-search-clear").classList.toggle("is-hidden", state.filters.query === "");
  const seg = document.getElementById("tx-filter");
  seg.dataset.value = state.filters.type;
  seg.querySelectorAll(".filter-btn").forEach((btn) => {
    const active = btn.dataset.filter === state.filters.type;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

// Repinta solo la lista de resultados
function refreshTxResults() {
  const el = document.getElementById("tx-results");
  if (!el) return;
  el.innerHTML = renderTxResults();
  bindTxResults(el);
}

function clearFilters() {
  state.filters = { query: "", type: "all" };
  syncFilterControls();
  refreshTxResults();
}

function bindTxToolbar() {
  const input = document.getElementById("tx-search");
  if (!input) return;
  const clearBtn = document.getElementById("tx-search-clear");

  input.addEventListener("input", () => {
    state.filters.query = input.value;
    clearBtn.classList.toggle("is-hidden", input.value === "");
    refreshTxResults();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur(); // cierra el teclado en iPhone
  });

  clearBtn.addEventListener("click", () => {
    state.filters.query = "";
    syncFilterControls();
    refreshTxResults();
    input.focus();
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filters.type = btn.dataset.filter;
      syncFilterControls();
      refreshTxResults();
    });
  });
}

/* ---------- Comparativa ---------- */
const CAT_HUES = [211, 152, 35, 280, 350, 190, 45];

function formatCompact(value) {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function monthShort(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}

function niceCeil(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

async function loadHistory() {
  if (!state.user) return;
  const req = ++state.historyReq;
  state.historyLoading = true;
  state.historyError = "";
  if (state.view === "compare") renderApp();

  try {
    const current = getCurrentMonthKey();
    const start = `${shiftMonth(current, -(state.range - 1))}-01`;
    const end = `${current}-31`;
    const q = query(
      userTransactionsRef(state.user.uid),
      where("date", ">=", start),
      where("date", "<=", end)
    );
    const snapshot = await getDocs(q);
    if (req !== state.historyReq) return;
    state.history = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (req !== state.historyReq) return;
    console.error(err);
    state.historyError = "No se pudo cargar la comparativa.";
  } finally {
    if (req === state.historyReq) {
      state.historyLoading = false;
      if (state.view === "compare") renderApp();
    }
  }
}

function setView(view) {
  state.view = view;
  if (view === "compare") {
    loadHistory();
  } else {
    renderApp();
  }
}

function buildCompareRows() {
  const current = getCurrentMonthKey();
  const rows = [];
  for (let i = state.range - 1; i >= 0; i--) {
    rows.push({ key: shiftMonth(current, -i), income: 0, expense: 0, balance: 0, count: 0 });
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const tx of state.history) {
    const row = byKey.get((tx.date || "").slice(0, 7));
    if (!row) continue;
    const amount = Number(tx.amount || 0);
    if (tx.type === "income") row.income += amount;
    else if (tx.type === "expense") row.expense += amount;
    row.count++;
  }
  rows.forEach((r) => (r.balance = r.income - r.expense));
  return rows;
}

function expenseByCategory(monthKey) {
  const map = new Map();
  for (const tx of state.history) {
    if (tx.type !== "expense" || !(tx.date || "").startsWith(monthKey)) continue;
    const label = (tx.category || "General").trim() || "General";
    const key = normalize(label);
    const entry = map.get(key) || { label: label.charAt(0).toUpperCase() + label.slice(1), total: 0 };
    entry.total += Number(tx.amount || 0);
    map.set(key, entry);
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total);
  if (list.length > 6) {
    const rest = list.slice(5).reduce((s, e) => s + e.total, 0);
    return [...list.slice(0, 5), { label: "Otras", total: rest }];
  }
  return list;
}

function monthAxisLabel(rows, i, x, y) {
  const key = rows[i].key;
  const showYear = i === 0 || key.endsWith("-01");
  return `<text class="chart-label" x="${x}" y="${y}" text-anchor="middle">${monthShort(key)}</text>${
    showYear ? `<text class="chart-label chart-year" x="${x}" y="${y + 11}" text-anchor="middle">’${key.slice(2, 4)}</text>` : ""
  }`;
}

function renderBarChart(rows) {
  const W = 340, H = 196, padL = 36, padR = 6, padT = 10, padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = niceCeil(Math.max(1, ...rows.flatMap((r) => [r.income, r.expense])));
  const gw = plotW / rows.length;
  const bw = Math.min(14, gw * 0.32);
  const y = (v) => padT + plotH - (v / max) * plotH;

  const grid = [0, 0.5, 1]
    .map((t) => {
      const yy = y(max * t);
      return `<line class="chart-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>
        <text class="chart-label" x="${padL - 6}" y="${yy + 3}" text-anchor="end">${formatCompact(max * t)}</text>`;
    })
    .join("");

  const groups = rows
    .map((r, i) => {
      const cx = padL + gw * i + gw / 2;
      const base = padT + plotH;
      return `<g class="chart-group" data-month="${r.key}">
        <rect class="chart-hit${r.key === state.cmpMonth ? " is-selected" : ""}" x="${padL + gw * i + 1}" y="${padT}" width="${gw - 2}" height="${plotH + padB - 6}" rx="6"/>
        <rect class="bar-income" x="${cx - bw - 1}" y="${y(r.income)}" width="${bw}" height="${base - y(r.income)}" rx="3"/>
        <rect class="bar-expense" x="${cx + 1}" y="${y(r.expense)}" width="${bw}" height="${base - y(r.expense)}" rx="3"/>
        ${monthAxisLabel(rows, i, cx, H - padB + 14)}
      </g>`;
    })
    .join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos por mes">${grid}${groups}</svg>`;
}

function renderBalanceChart(rows) {
  const W = 340, H = 170, padL = 36, padR = 14, padT = 14, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const vals = rows.map((r) => r.balance);
  const lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  if (hi === lo) hi = lo + 1;
  const y = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const x = (i) => (rows.length === 1 ? padL + plotW / 2 : padL + 10 + ((plotW - 20) * i) / (rows.length - 1));

  const points = rows.map((r, i) => `${x(i)},${y(r.balance)}`);
  const area = `${x(0)},${y(0)} ${points.join(" ")} ${x(rows.length - 1)},${y(0)}`;

  const labels = [hi > 0 ? hi : null, 0, lo < 0 ? lo : null]
    .filter((v) => v !== null)
    .map((v) => `<text class="chart-label" x="${padL - 6}" y="${y(v) + 3}" text-anchor="end">${formatCompact(v)}</text>`)
    .join("");

  const dots = rows
    .map(
      (r, i) => `<g class="chart-group" data-month="${r.key}">
        <circle class="line-dot${r.key === state.cmpMonth ? " is-selected" : ""}" cx="${x(i)}" cy="${y(r.balance)}" r="${r.key === state.cmpMonth ? 5 : 3.5}"/>
        <circle class="chart-tap" cx="${x(i)}" cy="${y(r.balance)}" r="14"/>
        ${monthAxisLabel(rows, i, x(i), H - padB + 14)}
      </g>`
    )
    .join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance mensual">
    <line class="chart-zero" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>
    ${labels}
    <polygon class="line-area" points="${area}"/>
    <polyline class="line-path" points="${points.join(" ")}"/>
    ${dots}
  </svg>`;
}

function renderCompareBody(rows) {
  if (state.historyLoading) {
    return `<div class="loading-row" role="status"><span class="spinner" aria-hidden="true"></span><p>Calculando comparativa…</p></div>`;
  }
  if (state.historyError) return `<p class="error" role="alert">${state.historyError}</p>`;

  const active = rows.filter((r) => r.count > 0);
  if (active.length === 0) {
    return `
      <section class="card empty">
        <div class="empty-icon">${ICONS.chart}</div>
        <h2>Aún no hay datos que comparar</h2>
        <p>Registra movimientos en la pestaña Resumen y aquí verás la evolución mes a mes.</p>
      </section>`;
  }

  const avgExpense = active.reduce((s, r) => s + r.expense, 0) / active.length;
  const best = active.reduce((a, b) => (b.balance > a.balance ? b : a));
  const worst = active.reduce((a, b) => (b.balance < a.balance ? b : a));

  const idx = rows.findIndex((r) => r.key === state.cmpMonth);
  const prev = idx > 0 ? rows[idx - 1] : null;
  let variation = `<span class="stat-value num">—</span>`;
  if (prev && prev.expense > 0) {
    const pct = ((rows[idx].expense - prev.expense) / prev.expense) * 100;
    const up = pct > 0;
    variation = `<span class="stat-value num ${up ? "expense-text" : "income-text"}">${up ? "+" : "−"}${Math.abs(pct).toFixed(0)} %</span>`;
  }

  const cats = expenseByCategory(state.cmpMonth);
  const catTotal = cats.reduce((s, c) => s + c.total, 0);
  const catList = cats.length
    ? `<ul class="cat-list">${cats
        .map((c, i) => {
          const pct = catTotal ? (c.total / catTotal) * 100 : 0;
          const hue = CAT_HUES[i % CAT_HUES.length];
          return `<li class="cat-row">
            <div class="cat-head">
              <span class="cat-name"><i class="cat-dot" style="--h:${hue}"></i>${escapeHtml(c.label)}</span>
              <span class="cat-amount num">${formatEuro(c.total)} <small>${pct.toFixed(0)} %</small></span>
            </div>
            <div class="cat-track"><div class="cat-fill" style="--h:${hue};width:${pct}%"></div></div>
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="subtitle">Sin gastos en este mes.</p>`;

  return `
    <section class="summary-grid">
      <div class="stat"><span class="stat-label">Gasto medio al mes</span><span class="stat-value num">${formatEuro(avgExpense)}</span></div>
      <div class="stat"><span class="stat-label">Gastos vs. mes anterior</span>${variation}<span class="stat-note">${escapeHtml(formatMonthTitle(state.cmpMonth))}</span></div>
      <div class="stat"><span class="stat-label">Mejor mes</span><span class="stat-value num income-text">${formatEuro(best.balance)}</span><span class="stat-note">${escapeHtml(formatMonthTitle(best.key))}</span></div>
      <div class="stat"><span class="stat-label">Peor mes</span><span class="stat-value num ${worst.balance < 0 ? "expense-text" : ""}">${formatEuro(worst.balance)}</span><span class="stat-note">${escapeHtml(formatMonthTitle(worst.key))}</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">Ingresos y gastos</h2>
      ${renderBarChart(rows)}
      <div class="legend"><span><i class="bar-income-dot"></i>Ingresos</span><span><i class="bar-expense-dot"></i>Gastos</span><span class="legend-hint">Toca un mes para ver su detalle</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">Balance mensual</h2>
      ${renderBalanceChart(rows)}
    </section>

    <section class="card">
      <h2 class="card-title">Gastos por categoría</h2>
      <p class="subtitle cat-sub">${escapeHtml(formatMonthTitle(state.cmpMonth))} · ${formatEuro(catTotal)}</p>
      ${catList}
    </section>`;
}

function renderTabbar(active) {
  const tab = (id, view, icon, label) =>
    `<button type="button" id="${id}" class="tab${active === view ? " is-active" : ""}" ${active === view ? 'aria-current="page"' : ""}>${icon}<span>${label}</span></button>`;
  return `<nav class="tabbar" aria-label="Secciones">
    ${tab("tab-summary", "summary", ICONS.wallet, "Resumen")}
    ${tab("tab-compare", "compare", ICONS.chart, "Comparativa")}
  </nav>`;
}

function bindTabs() {
  document.getElementById("tab-summary").addEventListener("click", () => {
    if (state.view !== "summary") setView("summary");
  });
  document.getElementById("tab-compare").addEventListener("click", () => {
    if (state.view !== "compare") setView("compare");
  });
}

function renderCompare() {
  const rows = buildCompareRows();
  if (!rows.some((r) => r.key === state.cmpMonth)) state.cmpMonth = rows[rows.length - 1].key;

  appContainer.innerHTML = `
    <main class="container has-tabbar">
      <header class="topbar">
        <div>
          <h1>Comparativa</h1>
          <p class="subtitle">Evolución mes a mes</p>
        </div>
      </header>

      <div class="segmented three" data-value="${state.range}" role="radiogroup" aria-label="Rango de meses">
        <span class="seg-thumb" aria-hidden="true"></span>
        ${[3, 6, 12]
          .map(
            (n) =>
              `<button type="button" class="seg-btn range-btn${state.range === n ? " is-active" : ""}" data-range="${n}" role="radio" aria-checked="${state.range === n}">${n} meses</button>`
          )
          .join("")}
      </div>

      <div class="compare-body">${renderCompareBody(rows)}</div>
    </main>
    ${renderTabbar("compare")}
  `;

  bindTabs();

  document.querySelectorAll(".range-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.range);
      if (next === state.range) return;
      state.range = next;
      loadHistory();
    });
  });

  document.querySelectorAll(".chart-group").forEach((g) => {
    g.addEventListener("click", () => {
      state.cmpMonth = g.dataset.month;
      renderCompare();
    });
  });
}

/* ---------- Vistas ---------- */
function renderLogin() {
  appContainer.innerHTML = `
    <main class="container auth">
      <div>
        <div class="brand">${ICONS.wallet}</div>
        <h1>Ingresos y Gastos</h1>
        <p class="subtitle">Inicia sesión para gestionar tu mes</p>
      </div>

      <form id="auth-form" class="card">
        <label>
          Correo electrónico
          <input type="email" id="email" required placeholder="tu@correo.com" autocomplete="email" inputmode="email" autocapitalize="none" />
        </label>

        <label>
          Contraseña
          <input type="password" id="password" required minlength="6" placeholder="••••••••" autocomplete="current-password" />
        </label>

        <p id="auth-error" class="error" role="alert"></p>

        <div class="actions">
          <button type="submit" id="login-btn">Entrar</button>
          <button type="button" id="register-btn" class="secondary">Crear cuenta</button>
        </div>
      </form>
    </main>
  `;

  const form = document.getElementById("auth-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const registerBtn = document.getElementById("register-btn");
  const errorEl = document.getElementById("auth-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    try {
      await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    } catch (err) {
      errorEl.textContent = "Revisa tu correo y contraseña.";
      console.error(err);
    }
  });

  registerBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    try {
      await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    } catch (err) {
      errorEl.textContent = "No se pudo crear la cuenta (mínimo 6 caracteres).";
      console.error(err);
    }
  });
}

function renderTxItem(tx) {
  const isIncome = tx.type === "income";
  const sign = isIncome ? "+" : "−";
  const isNew = tx.id === state.newTxId;
  return `
    <li class="tx-item${isNew ? " is-new" : ""}">
      <span class="tx-icon ${isIncome ? "is-income" : "is-expense"}">${categoryIcon(tx)}</span>
      <div class="tx-main">
        <div class="tx-title">${escapeHtml(tx.title)}</div>
        <div class="tx-meta">${escapeHtml(tx.category || "General")}</div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${isIncome ? "income-text" : "expense-text"}">
          ${sign}${formatEuro(Number(tx.amount || 0))}
        </span>
        <button type="button" class="danger delete-btn" data-id="${tx.id}" title="Eliminar" aria-label="Eliminar movimiento">${ICONS.trash}</button>
      </div>
    </li>
  `;
}

function renderTxResults() {
  if (state.loading) {
    return `
      <div class="loading-row" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>Cargando movimientos…</p>
      </div>`;
  }

  if (state.transactions.length === 0) {
    return `
      <section class="card empty">
        <div class="empty-icon">${ICONS.empty}</div>
        <h2>Sin movimientos</h2>
        <p>Añade tu primer ingreso o gasto de ${formatMonthTitle(state.selectedMonth)}.</p>
      </section>`;
  }

  const filtered = getFilteredTransactions();

  if (filtered.length === 0) {
    const q = state.filters.query.trim();
    const detail = q
      ? `Ningún movimiento coincide con “${escapeHtml(q)}”${state.filters.type !== "all" ? " en este filtro" : ""}.`
      : `No hay ${state.filters.type === "income" ? "ingresos" : "gastos"} en este mes.`;
    return `
      <section class="card empty">
        <div class="empty-icon">${ICONS.search}</div>
        <h2>Sin resultados</h2>
        <p>${detail}</p>
        <button type="button" class="secondary" id="clear-filters-btn">Limpiar filtros</button>
      </section>`;
  }

  const count = hasActiveFilters()
    ? `<p class="result-count">${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}</p>`
    : "";

  return (
    count +
    groupByDate(filtered)
      .map(
        (group) => `
        <section>
          <h2 class="day-title">${escapeHtml(formatDayHeader(group.date))}</h2>
          <ul class="tx-list">${group.items.map(renderTxItem).join("")}</ul>
        </section>`
      )
      .join("")
  );
}

function renderTransactionsSection() {
  const toolbar = state.transactions.length > 0 ? renderTxToolbar() : "";
  return `${toolbar}<div id="tx-results">${renderTxResults()}</div>`;
}

function renderDashboard() {
  const totalIncome = state.transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = state.transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const balance = totalIncome - totalExpense;
  const defaultDate =
    getCurrentMonthKey() === state.selectedMonth
      ? getTodayDateString()
      : `${state.selectedMonth}-01`;

  appContainer.innerHTML = `
    <main class="container has-tabbar">
      <header class="topbar">
        <div>
          <h1>Mis Finanzas</h1>
          <p class="subtitle">${escapeHtml(state.user.email)}</p>
        </div>
        <button type="button" id="logout-btn" class="secondary">Salir</button>
      </header>

      <div class="month-bar">
        <button type="button" id="prev-month" class="secondary" aria-label="Mes anterior">${ICONS.left}</button>
        <span class="month-label">${formatMonthTitle(state.selectedMonth)}</span>
        <button type="button" id="next-month" class="secondary" aria-label="Mes siguiente">${ICONS.right}</button>
      </div>

      <section class="hero${balance < 0 ? " is-negative" : ""}">
        <span class="hero-label">Balance del mes</span>
        <span class="hero-amount num">${formatEuro(balance)}</span>
      </section>

      <section class="summary-grid">
        <div class="stat">
          <div class="stat-head">
            <span class="stat-icon is-income">${ICONS.down}</span>
            <span class="stat-label">Ingresos</span>
          </div>
          <span class="stat-value income-text num">${formatEuro(totalIncome)}</span>
        </div>
        <div class="stat">
          <div class="stat-head">
            <span class="stat-icon is-expense">${ICONS.up}</span>
            <span class="stat-label">Gastos</span>
          </div>
          <span class="stat-value expense-text num">${formatEuro(totalExpense)}</span>
        </div>
      </section>

      <section class="card budget" id="budget-card"></section>

      ${renderCategoryBreakdown()}

      <section class="card">
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
              <input type="date" id="tx-date" value="${defaultDate}" required />
            </label>
          </div>

          <button type="submit" id="tx-submit">Guardar movimiento</button>
        </form>
      </section>

      ${state.error ? `<p class="error" role="alert">${state.error}</p>` : ""}

      ${renderTransactionsSection()}
    </main>
    ${renderTabbar("summary")}
  `;

  // El resaltado de "nuevo" solo se consume cuando la lista ya se ha pintado
  if (!state.loading) state.newTxId = null;

  document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));
  bindTabs();

  document.getElementById("prev-month").addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, -1);
    loadMonthTransactions();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, 1);
    loadMonthTransactions();
  });

  // Control segmentado Gasto / Ingreso (escribe en #tx-type, que app.js ya lee)
  const segmented = document.querySelector("#tx-form .segmented");
  const typeInput = document.getElementById("tx-type");
  segmented.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      typeInput.value = btn.dataset.type;
      segmented.dataset.value = btn.dataset.type;
      segmented.querySelectorAll(".seg-btn").forEach((other) => {
        const active = other === btn;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-checked", String(active));
      });
    });
  });

  document.getElementById("tx-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("tx-type").value;
    const amount = Math.abs(parseFloat(document.getElementById("tx-amount").value));
    const title = document.getElementById("tx-title").value.trim();
    const category = document.getElementById("tx-category").value.trim() || "General";
    const date = document.getElementById("tx-date").value;

    if (!title || Number.isNaN(amount) || amount <= 0 || !date) return;

    document.getElementById("tx-submit").disabled = true; // evita dobles envíos
    await handleAddTransaction({ type, amount, title, category, date });
  });

  // Módulos nuevos
  mountBudgetCard();
  const catDetails = document.getElementById("cat-details");
  if (catDetails) {
    catDetails.addEventListener("toggle", () => {
      state.catOpen = catDetails.open;
    });
  }
  bindTxToolbar();
  bindTxResults(document.getElementById("tx-results"));
}

// Eliminar con doble toque (el primero pide confirmación, el segundo borra) y "Limpiar filtros"
function bindTxResults(scope) {
  if (!scope) return;

  scope.querySelectorAll(".delete-btn").forEach((btn) => {
    const originalHtml = btn.innerHTML;
    let timer;

    const disarm = () => {
      btn.classList.remove("armed");
      btn.innerHTML = originalHtml;
      btn.setAttribute("aria-label", "Eliminar movimiento");
    };

    btn.addEventListener("click", () => {
      if (!btn.classList.contains("armed")) {
        btn.classList.add("armed");
        btn.textContent = "¿Borrar?";
        btn.setAttribute("aria-label", "Confirmar eliminación");
        timer = setTimeout(disarm, 3000);
        return;
      }
      clearTimeout(timer);
      const item = btn.closest(".tx-item");
      if (item) item.classList.add("removing");
      setTimeout(() => handleDeleteTransaction(btn.dataset.id), 220);
    });
  });

  const clearBtn = scope.querySelector("#clear-filters-btn");
  if (clearBtn) clearBtn.addEventListener("click", clearFilters);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderApp() {
  if (!state.user) {
    renderLogin();
  } else if (state.view === "compare") {
    renderCompare();
  } else {
    renderDashboard();
  }
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.budgetLoaded = false;
    loadUserSettings(); // en paralelo: no retrasa la primera carga
    await loadMonthTransactions();
  } else {
    state.transactions = [];
    state.history = [];
    state.view = "summary";
    state.budget = null;
    state.budgetLoaded = false;
    state.budgetEditing = false;
    state.filters = { query: "", type: "all" };
    renderApp();
  }
});