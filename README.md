# 💰 Mis Finanzas — Ingresos y Gastos PWA

Aplicación Web Progresiva (**PWA**) minimalista y optimizada para **iPhone (iOS)** que permite llevar el control mensual de ingresos, gastos y balance neto de forma rápida, intuitiva y sincronizada en la nube mediante **Firebase**.

---

## ✨ Características principales

- 📱 **Experiencia nativa en iPhone (iOS):** Adaptada a *Safe Areas* (notch / Dynamic Island), modo claro y oscuro automático (`prefers-color-scheme`), tipografía nativa de Apple y soporte completo para instalar en pantalla de inicio desde Safari.
- 🔐 **Autenticación privada:** Registro e inicio de sesión seguro por usuario con **Firebase Authentication** (correo y contraseña).
- ☁️ **Sincronización en tiempo real:** Cada usuario accede únicamente a sus propios movimientos almacenados en **Cloud Firestore** (`users/{uid}/transactions`).
- 📅 **Navegación mensual y resumen visual:** Balance neto del mes con indicador visual dinámico, totales de ingresos y gastos, y agrupación diaria (*Hoy*, *Ayer* o fecha formateada).
- 🏷️ **Iconografía inteligente por categoría:** Detección automática de iconos según la categoría introducida (alimentación, hogar, transporte, ocio, salud, nómina, etc.).
- 🛡️ **Borrado seguro en dos toques:** Confirmación rápida en el propio botón para evitar eliminaciones accidentales.
- ⚡ **Arquitectura ligera sin frameworks:** Construida con HTML5, CSS3 moderno y JavaScript modular (ES Modules), sin dependencias externas pesadas.

---

## 🛠️ Tecnologías utilizadas

- **Frontend:** HTML5, CSS3 (Variables CSS, Grid/Flexbox, `tabular-nums`), JavaScript Vanilla (ES Modules).
- **PWA:** Web App Manifest (`manifest.json`) + Service Worker (`sw.js`).
- **Backend & Hosting:**
  - [Firebase Authentication](https://firebase.google.com/docs/auth)
  - [Cloud Firestore](https://firebase.google.com/docs/firestore)
  - [Firebase Hosting](https://firebase.google.com/docs/hosting)

---

## 📂 Estructura del proyecto

```text
Ingresos-y-Gastos-PWA/
├── index.html          # Estructura principal, metadatos PWA/iOS y registro del Service Worker
├── manifest.json       # Configuración de instalación de la PWA (nombre, iconos, tema)
├── sw.js               # Service Worker para ciclo de vida y actualización de la app
├── firebase.json       # Configuración de despliegue en Firebase Hosting
├── .firebaserc         # Vinculación con el proyecto de Firebase (ingresosygastos-cf281)
├── .gitignore          # Exclusión de archivos locales y auxiliares del repositorio
└── src/
    ├── firebase.js     # Inicialización y exportación de SDKs de Firebase (Auth y Firestore)
    ├── app.js          # Lógica de estado, vistas, eventos y consultas a Firestore
    └── style.css       # Sistema de diseño estilo iOS (modo claro/oscuro y responsive)
```

---

## 🚀 Cómo ejecutar y desplegar el proyecto

### 1. Requisitos previos
- [Node.js](https://nodejs.org/) (versión LTS recomendada).
- [Firebase CLI](https://firebase.google.com/docs/cli) instalado de forma global:
  ```bash
  npm install -g firebase-tools
  ```
- Iniciar sesión en tu cuenta de Google vinculada a Firebase (solo la primera vez):
  ```bash
  firebase login
  ```

### 2. Probar en local (opcional)
Puedes levantar un servidor local desde la carpeta raíz del proyecto para probar cambios antes de publicar:
```bash
firebase serve --only hosting
```
*(También puedes usar la extensión **Live Server** de Visual Studio Code abriendo `index.html`).*

### 3. Flujo de trabajo cada vez que hagas cambios
1. **Guarda** todos los archivos editados en Visual Studio Code (`Ctrl + S`).
2. *(Opcional)* Si modificaste el diseño o scripts y quieres forzar actualización inmediata en navegadores, incrementa el comentario de versión en `sw.js`.
3. **Publica en Firebase Hosting:**
   ```bash
   firebase deploy --only hosting
   ```
4. **Guarda tus cambios en GitHub:**
   ```bash
   git add .
   git commit -m "Descripción breve de los cambios"
   git push
   ```

---

## 📲 Cómo instalar la app en tu iPhone

1. Abre **Safari** en tu iPhone y entra en la URL pública de la aplicación:  
   👉 `https://ingresosygastos-cf281.web.app`
2. Pulsa el botón **Compartir** (el cuadrado con la flecha hacia arriba en la barra inferior).
3. Desliza hacia abajo y selecciona **Añadir a pantalla de inicio**.
4. Confirma el nombre (**Finanzas**) y pulsa **Añadir**.

---

## 🔒 Estructura de datos en Firestore

Los movimientos se organizan de forma aislada por usuario bajo la siguiente ruta:

```text
users/{uid}/transactions/{transactionId}
```

Cada documento contiene:
- `type`: `"income"` | `"expense"`
- `amount`: `number`
- `title`: `string`
- `category`: `string`
- `date`: `string` (formato `"YYYY-MM-DD"`)

---

## 📄 Licencia

Proyecto personal bajo licencia incluida en el archivo `LICENSE`.