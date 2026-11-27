import { ICONOS } from "../utilidades/iconos.js";

/** Pantalla de inicio de sesión y registro. */
export class VistaAcceso {
  constructor(contenedor, servicioAuth) {
    this.contenedor = contenedor;
    this.servicioAuth = servicioAuth;
  }

  renderizar() {
    this.contenedor.innerHTML = `
      <main class="container auth">
        <div>
          <div class="brand">${ICONOS.cartera}</div>
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
    this.#enlazar();
  }

  #enlazar() {
    const formulario = this.contenedor.querySelector("#auth-form");
    const correo = this.contenedor.querySelector("#email");
    const contrasena = this.contenedor.querySelector("#password");
    const botonRegistro = this.contenedor.querySelector("#register-btn");
    const error = this.contenedor.querySelector("#auth-error");

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      error.textContent = "";
      try {
        await this.servicioAuth.iniciarSesion(correo.value, contrasena.value);
      } catch (fallo) {
        console.error(fallo);
        error.textContent = "Revisa tu correo y contraseña.";
      }
    });

    botonRegistro.addEventListener("click", async () => {
      error.textContent = "";
      try {
        await this.servicioAuth.registrar(correo.value, contrasena.value);
      } catch (fallo) {
        console.error(fallo);
        error.textContent = "No se pudo crear la cuenta (mínimo 6 caracteres).";
      }
    });
  }
}
