# 💰 Mis Finanzas — Ingresos y Gastos PWA

Aplicación Web Progresiva (**PWA**) minimalista y optimizada para **iPhone (iOS)** que permite llevar el control mensual de ingresos, gastos y balance neto de forma rápida, intuitiva y sincronizada en la nube mediante **Firebase**.

---

## ✨ Características principales

- 📱 **Experiencia nativa en iPhone (iOS):** Adaptada a *Safe Areas* (notch / Dynamic Island), modo claro y oscuro automático (`prefers-color-scheme`), tipografía nativa de Apple, cifras tabulares y soporte completo para instalar en pantalla de inicio desde Safari.
- 🔐 **Autenticación privada:** Registro e inicio de sesión seguro por usuario con **Firebase Authentication** (correo y contraseña).
- ☁️ **Datos en la nube por usuario:** Cada usuario accede únicamente a sus propios movimientos almacenados en **Cloud Firestore** (`users/{uid}/transactions`).
- 📅 **Navegación mensual y resumen visual:** Balance neto del mes con indicador visual dinámico, totales de ingresos y gastos, y agrupación diaria (*Hoy*, *Ayer* o fecha formateada).
- 🎯 **Presupuesto mensual:** Define un límite de gasto y sigue tu progreso con una barra de colores semánticos (verde por debajo del 75 %, ámbar del 75 % al 99 % y rojo al alcanzar o superar el 100 %).
- 📊 **Gastos por categoría:** Desglose plegable del mes, ordenado de mayor a menor, con icono, porcentaje, importe y barra proporcional. Agrupa «comida», «Comida» y « comida » como una sola categoría.
- 🔎 **Buscador y filtros rápidos:** Búsqueda en tiempo real por concepto o categoría (sin distinguir mayúsculas ni tildes) y selector *Todos / Gastos / Ingresos*, sin consultar Firestore al teclear y sin perder el foco del teclado en iPhone.
- 📈 **Pestaña Comparativa:** Evolución de 3, 6 o 12 meses con gráficos SVG propios (ingresos y gastos, balance mensual y gastos por categoría), gasto medio, variación frente al mes anterior y mejor/peor mes.
- 🏷️ **Iconografía inteligente por categoría:** Detección automática de iconos según la categoría introducida (alimentación, hogar, transporte, ocio, salud, nómina, etc.).
- 🛡️ **Borrado seguro en dos toques:** Confirmación rápida en el propio botón para evitar eliminaciones accidentales.
- ⚡ **Arquitectura ligera sin frameworks:** Programación orientada a objetos con clases de JavaScript y ES Modules nativos, sin bundlers ni dependencias externas.

---

## 🛠️ Tecnologías utilizadas

- **Frontend:** HTML5, CSS3 (Variables CSS, Grid/Flexbox, `tabular-nums`), JavaScript Vanilla (ES Modules y clases con campos privados `#`).
- **PWA:** Web App Manifest (`manifest.json`) + Service Worker (`sw.js`).
- **Backend & Hosting:**
  - [Firebase Authentication](https://firebase.google.com/docs/auth)
  - [Cloud Firestore](https://firebase.google.com/docs/firestore)
  - [Firebase Hosting](https://firebase.google.com/docs/hosting)

> Requiere **Safari 15 o posterior** en iPhone (por los campos privados de clase).

---

## 📂 Estructura del proyecto

```text
Ingresos-y-Gastos-PWA/
├── index.html              # Estructura principal, metadatos PWA/iOS, arranque de la app y registro del Service Worker
├── manifest.json           # Configuración de instalación de la PWA (nombre, iconos, tema)
├── sw.js                   # Service Worker para ciclo de vida y actualización de la app
├── firebase.json           # Configuración de despliegue en Firebase Hosting
├── .firebaserc             # Vinculación con el proyecto de Firebase (ingresosygastos-cf281)
├── .gitignore              # Exclusión de archivos locales y auxiliares del repositorio
└── src/
    ├── app.js              # AplicacionFinanzas: clase coordinadora que arranca y conecta todo
    ├── firebase.js         # Inicialización y exportación de SDKs de Firebase (Auth y Firestore)
    ├── style.css           # Sistema de diseño estilo iOS (modo claro/oscuro y responsive)
    ├── modelos/
    │   └── Movimiento.js           # Un ingreso o un gasto y su comportamiento
    ├── servicios/
    │   ├── ServicioAuth.js         # Inicio de sesión, registro y cierre de sesión
    │   └── ServicioFinanzas.js     # Todas las operaciones con Cloud Firestore
    ├── estado/
    │   └── EstadoApp.js            # Estado único de la aplicación y cálculos derivados
    ├── vistas/
    │   ├── VistaAcceso.js          # Pantalla de inicio de sesión y registro
    │   ├── VistaPresupuesto.js     # Tarjeta de presupuesto mensual
    │   ├── VistaCategorias.js      # Bloque plegable de gastos por categoría
    │   ├── VistaMovimientos.js     # Buscador, filtros rápidos y lista diaria
    │   ├── VistaFormulario.js      # Alta de ingresos y gastos
    │   └── VistaComparativa.js     # Pestaña de comparativa con gráficos SVG
    └── utilidades/
        ├── formato.js              # Euros, fechas, normalización y escape de texto
        └── iconos.js               # Iconos SVG y reglas de icono por categoría
```

---

## 🏗️ Arquitectura

La aplicación sigue una separación por capas. Cada clase tiene una única responsabilidad y las dependencias van siempre en la misma dirección:

```text
        index.html
            │  new AplicacionFinanzas().iniciar()
            ▼
     AplicacionFinanzas  ──────────────►  Vistas  ──────►  EstadoApp ──► Movimiento
     (src/app.js)                      (src/vistas)       (lee y calcula)
            │                              │
            ▼                              ▼
   ServicioAuth · ServicioFinanzas     utilidades (formato, iconos)
            │
            ▼
        firebase.js  ──►  Firebase Auth + Cloud Firestore
```

**Regla principal:** solo los servicios hablan con Firebase. Las vistas no conocen Firestore: pintan el estado y avisan al coordinador mediante *callbacks*.

### Clases

| Clase | Archivo | Responsabilidad |
|---|---|---|
| `Movimiento` | `modelos/Movimiento.js` | Encapsula `id`, `type`, `amount`, `title`, `category` y `date`. Métodos: `esIngreso()`, `esGasto()`, `obtenerMes()`, `obtenerImporteFormateado()`, `obtenerIcono()`, `coincideConBusqueda()` y `aObjetoFirestore()`. |
| `ServicioAuth` | `servicios/ServicioAuth.js` | Envuelve Firebase Auth: `iniciarSesion()`, `registrar()`, `cerrarSesion()` y `alCambiarUsuario()`. |
| `ServicioFinanzas` | `servicios/ServicioFinanzas.js` | Operaciones con Firestore: `obtenerMovimientosMes()`, `obtenerMovimientosRango()`, `guardarMovimiento()`, `eliminarMovimiento()`, `obtenerPresupuesto()` y `guardarPresupuesto()`. |
| `EstadoApp` | `estado/EstadoApp.js` | Guarda usuario, mes, movimientos, presupuesto, búsqueda, filtro, carga y errores. Calcula en memoria: `obtenerTotales()`, `obtenerMovimientosFiltrados()`, `obtenerGastosPorCategoria()`, `agruparPorFecha()` y `obtenerFilasComparativa()`. |
| `VistaAcceso` | `vistas/VistaAcceso.js` | Pinta y gestiona la pantalla de acceso. |
| `VistaPresupuesto` | `vistas/VistaPresupuesto.js` | Tarjeta de presupuesto: progreso, edición inline y quitar límite. Se repinta sola, sin tocar el resto. |
| `VistaCategorias` | `vistas/VistaCategorias.js` | Desglose plegable de gastos por categoría del mes. |
| `VistaMovimientos` | `vistas/VistaMovimientos.js` | Buscador, píldoras de filtro, lista agrupada por día y borrado en dos toques. Al escribir solo se repinta la lista, así que el `<input>` mantiene el foco. |
| `VistaFormulario` | `vistas/VistaFormulario.js` | Formulario de nuevo movimiento con control segmentado Gasto/Ingreso. |
| `VistaComparativa` | `vistas/VistaComparativa.js` | Gráficos SVG, tarjetas de resumen y categorías de la comparativa. |
| `AplicacionFinanzas` | `app.js` | Instancia servicios, estado y vistas; escucha la sesión; carga y guarda datos; decide qué pantalla se muestra. |

### Flujo de una operación (ejemplo: añadir un gasto)

1. `VistaFormulario` valida el formulario y crea un `Movimiento`.
2. Llama al *callback* `alGuardar`, que ejecuta `AplicacionFinanzas.agregarMovimiento()`.
3. El coordinador pide a `ServicioFinanzas.guardarMovimiento()` que lo escriba en Firestore (usa `movimiento.aObjetoFirestore()`).
4. Se actualiza `EstadoApp` y se recargan los movimientos del mes.
5. `AplicacionFinanzas.renderizar()` vuelve a montar las vistas con el nuevo estado.

### Cómo añadir una funcionalidad nueva

- **Nueva consulta o dato en Firestore:** añade un método a `ServicioFinanzas`.
- **Nuevo cálculo:** añade un método a `EstadoApp` (así queda probado y reutilizable por varias vistas).
- **Nuevo bloque de pantalla:** crea una `Vista…` con un método `montar(elemento)`, instánciala en el constructor de `AplicacionFinanzas` y monta su contenedor en `renderizar()`.
- **Imports:** todos llevan la extensión `.js` (por ejemplo, `import { Movimiento } from "./modelos/Movimiento.js";`), porque la app se ejecuta directamente en el navegador, sin bundler.

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
*(También puedes usar la extensión **Live Server** de Visual Studio Code abriendo `index.html`. Hay que servir la app por HTTP: abrir el archivo directamente con `file://` no funciona con ES Modules).*

### 3. Flujo de trabajo cada vez que hagas cambios
1. **Guarda** todos los archivos editados en Visual Studio Code (`Ctrl + S`).
2. *(Recomendado)* Si añadiste, moviste o modificaste archivos de `src/`, incrementa el comentario de versión en `sw.js` (y, si precacheas archivos, incluye los nuevos) para forzar la actualización inmediata en los dispositivos.
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

Los datos se organizan de forma aislada por usuario:

```text
users/{uid}                              # Documento del usuario
users/{uid}/transactions/{transactionId} # Movimientos
```

**Documento `users/{uid}`**
- `monthlyBudget`: `number` | `null` (presupuesto mensual de gastos en euros; `null` o ausente si no hay límite)

**Documento `users/{uid}/transactions/{transactionId}`**
- `type`: `"income"` | `"expense"`
- `amount`: `number`
- `title`: `string`
- `category`: `string`
- `date`: `string` (formato `"YYYY-MM-DD"`)

> Los nombres de los campos se mantienen en inglés por compatibilidad con los datos existentes; la clase `Movimiento` los traduce a métodos en castellano.

### Reglas de seguridad de Firestore

Cada usuario solo debe poder leer y escribir sus propios datos, incluido el documento `users/{uid}` donde se guarda el presupuesto:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /transactions/{transactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 📄 Licencia

Proyecto personal bajo licencia incluida en el archivo `LICENSE`.
