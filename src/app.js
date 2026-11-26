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
  error: ""
};

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
    await addDoc(userTransactionsRef(state.user.uid), txData);
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

function renderLogin() {
  appContainer.innerHTML = `
    <main class="container">
      <h1>Ingresos y Gastos</h1>
      <p class="subtitle">Inicia sesión para gestionar tu mes</p>

      <form id="auth-form" class="card">
        <label>
          Correo electrónico
          <input type="email" id="email" required placeholder="tu@correo.com" />
        </label>

        <label>
          Contraseña
          <input type="password" id="password" required minlength="6" placeholder="••••••••" />
        </label>

        <div class="actions">
          <button type="submit" id="login-btn">Entrar</button>
          <button type="button" id="register-btn" class="secondary">Crear cuenta</button>
        </div>

        <p id="auth-error" class="error"></p>
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
          <p class="subtitle">${state.user.email}</p>
        </div>
        <button type="button" id="logout-btn" class="secondary">Salir</button>
      </header>

      <div class="month-bar">
        <button type="button" id="prev-month" class="secondary"><</button>
        <span class="month-label">${formatMonthTitle(state.selectedMonth)}</span>
        <button type="button" id="next-month" class="secondary">></button>
      </div>

      <section class="summary-grid">
        <div class="stat">
          <span class="stat-label">Ingresos</span>
          <span class="stat-value income-text">${formatEuro(totalIncome)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Gastos</span>
          <span class="stat-value expense-text">${formatEuro(totalExpense)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Saldo</span>
          <span class="stat-value ${balance >= 0 ? "income-text" : "expense-text"}">${formatEuro(balance)}</span>
        </div>
      </section>

      <section class="card">
        <form id="tx-form">
          <div class="form-row">
            <label>
              Tipo
              <select id="tx-type">
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </label>

            <label>
              Importe (€)
              <input type="number" id="tx-amount" step="0.01" min="0.01" required placeholder="0.00" />
            </label>
          </div>

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

          <button type="submit">Guardar movimiento</button>
        </form>
      </section>

      ${state.error ? `<p class="error">${state.error}</p>` : ""}

      <section class="card">
        ${
          state.loading
            ? `<p class="subtitle">Cargando movimientos...</p>`
            : state.transactions.length === 0
              ? `<p class="subtitle">No hay movimientos en este mes.</p>`
              : `<ul class="tx-list">
                  ${state.transactions
                    .map((tx) => {
                      const isIncome = tx.type === "income";
                      const sign = isIncome ? "+" : "-";
                      return `
                        <li class="tx-item">
                          <div>
                            <div class="tx-title">${escapeHtml(tx.title)}</div>
                            <div class="tx-meta">${escapeHtml(tx.category || "General")} · ${tx.date}</div>
                          </div>
                          <div class="tx-right">
                            <span class="${isIncome ? "income-text" : "expense-text"}">
                              ${sign}${formatEuro(Number(tx.amount || 0))}
                            </span>
                            <button type="button" class="danger delete-btn" data-id="${tx.id}" title="Eliminar">✕</button>
                          </div>
                        </li>
                      `;
                    })
                    .join("")}
                </ul>`
        }
      </section>
    </main>
  `;

  document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

  document.getElementById("prev-month").addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, -1);
    loadMonthTransactions();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    state.selectedMonth = shiftMonth(state.selectedMonth, 1);
    loadMonthTransactions();
  });

  document.getElementById("tx-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("tx-type").value;
    const amount = Math.abs(parseFloat(document.getElementById("tx-amount").value));
    const title = document.getElementById("tx-title").value.trim();
    const category = document.getElementById("tx-category").value.trim() || "General";
    const date = document.getElementById("tx-date").value;

    if (!title || Number.isNaN(amount) || amount <= 0 || !date) return;

    await handleAddTransaction({ type, amount, title, category, date });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteTransaction(btn.dataset.id));
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