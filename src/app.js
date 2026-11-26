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
  getDocs
} from "./firebase.js";

const appContainer = document.getElementById("app");

const state = {
  user: null,
  selectedMonth: getCurrentMonthKey(), // Formato "YYYY-MM"
  transactions: [],
  loading: false,
  error: "",
  newTxId: null // id del último movimiento añadido (para animarlo)
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

function renderTransactionsSection() {
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

  return groupByDate(state.transactions)
    .map(
      (group) => `
        <section>
          <h2 class="day-title">${escapeHtml(formatDayHeader(group.date))}</h2>
          <ul class="tx-list">${group.items.map(renderTxItem).join("")}</ul>
        </section>`
    )
    .join("");
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
    <main class="container">
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
  `;

  // El resaltado de "nuevo" solo se consume cuando la lista ya se ha pintado
  if (!state.loading) state.newTxId = null;

  document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

  document.getElementById("prev-month").addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, -1);
    loadMonthTransactions();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, 1);
    loadMonthTransactions();
  });

  // Control segmentado Gasto / Ingreso (escribe en #tx-type, que app.js ya lee)
  const segmented = document.querySelector(".segmented");
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

  // Eliminar con doble toque: el primero pide confirmación, el segundo borra
  document.querySelectorAll(".delete-btn").forEach((btn) => {
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
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderApp() {
  if (!state.user) {
    renderLogin();
  } else {
    renderDashboard();
  }
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    await loadMonthTransactions();
  } else {
    state.transactions = [];
    renderApp();
  }
});