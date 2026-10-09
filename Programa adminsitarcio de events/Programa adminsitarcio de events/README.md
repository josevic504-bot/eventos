# Sistema de eventos — Guía de publicación

Este repositorio tiene dos archivos:

- **`index.html`**: la aplicación web, publicada con GitHub Pages.
- **`Code.gs`**: el servidor. Va en Google Apps Script y se encarga de cuentas, datos en la nube y licencias.

## Cómo funciona

- La app funciona **solo en línea**: la persona entra con el enlace. **Los datos viven en la nube**, en tu Google Drive, no en el teléfono.
- **Primera vez:** la persona escribe el nombre de su negocio, su WhatsApp y un **PIN de 4 a 6 números**. Así arranca la **prueba gratis de 7 días**.
- **Otro teléfono o computadora:** toca *"Ya tengo cuenta · Ingresar"* y entra con su **WhatsApp + PIN**. Ve exactamente los mismos datos. Puede usar varios equipos a la vez; los cambios se combinan solos.
- **Guardado:** todo se guarda en la nube unos segundos después de cada cambio. El icono de nube del encabezado indica el estado (✓ guardado, parpadeando = guardando, tachado = sin conexión). Si se va el internet un momento, los cambios se suben al volver.
- **Durante la prueba** aparece un aviso flotante: *"Versión de prueba · vence en X días"* con el botón **Activar**.
- **Al terminar la prueba** la app se bloquea (los datos quedan guardados) y ofrece pedir la activación por WhatsApp o activarla con contraseña.
- **Activación de por vida**, de dos formas:
  1. En el equipo del cliente: **Activar**, escribís tu contraseña.
  2. A distancia: en tu Google Sheet cambiás el **Estado** de esa cuenta a **Activa**, y el cliente toca **"Ya pagué · verificar"** o vuelve a abrir la app.

La contraseña **nunca** está en el HTML; solo la conoce tu Apps Script. Los PIN se guardan cifrados: ni siquiera vos los ves.

---

## Paso 1 — Crear la hoja y el Apps Script

1. Creá una hoja nueva en Google Sheets, por ejemplo **"Clientes – Sistema de eventos"**.
2. Menú **Extensiones → Apps Script**.
3. Borrá el contenido de `Código.gs` y pegá todo el contenido de **`Code.gs`**. Guardá.
4. Engranaje **Configuración del proyecto** → **Propiedades del script** → **Agregar propiedad**:
   - Propiedad: `ADMIN_PASSWORD`
   - Valor: tu contraseña de activación (larga y que solo vos sepás).
   - Guardar.

## Paso 2 — Publicar el Apps Script

1. **Implementar → Nueva implementación** → tipo **Aplicación web**.
2. **Ejecutar como:** Yo. **Quién tiene acceso:** Cualquier persona.
3. **Implementar** → autorizá los permisos. Google pide acceso a **Hojas de cálculo** y a **Drive**; Drive es donde se guardan los datos de cada negocio.
4. Copiá la **URL de la aplicación web** (termina en `/exec`).

> Si después cambiás el código: **Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión**. Así la URL no cambia.

## Paso 3 — Conectar la app

En `index.html` buscá `LIC_URL` (Ctrl+F) y pegá tu URL entre las comillas:

```js
const LIC_URL='https://script.google.com/macros/s/AKfycb.../exec';
```

> Si `LIC_URL` queda vacío, la app funciona en **modo local**: sin nube ni licencia, con los datos guardados en el navegador. Te sirve para pruebas.

## Paso 4 — Publicar en GitHub Pages

1. GitHub → **New repository** → nombre, por ejemplo `eventos` → **Public** → **Create repository**.
2. **Add file → Upload files** → subí `index.html` → **Commit changes**.
3. **Settings → Pages** → *Deploy from a branch* → `main` / `/ (root)` → **Save**.
4. En uno o dos minutos queda en: `https://TU-USUARIO.github.io/eventos/`

Ese enlace es lo que le mandás a tus clientes. En el teléfono pueden tocar **"Agregar a pantalla de inicio"** para tenerla como una app.

## Paso 5 — Administrar a tus clientes

En la hoja aparece la pestaña **Licencias**, con una fila por cuenta:

| Columna | Para qué sirve |
|---|---|
| **Código** | El código que el cliente ve en Ajustes y que llega en su mensaje de WhatsApp. Con él ubicás su fila. |
| **Negocio / WhatsApp** | Datos de la cuenta. El WhatsApp es el usuario para ingresar. |
| **Vence prueba** | Cambiá la fecha para **extender** una prueba. |
| **Estado** | `Prueba`, `Activa` (de por vida) o `Bloqueada` (suspende el acceso). |
| **Última conexión** | Cuándo usó la app por última vez. |
| **Intentos fallidos** | Después de 10 intentos fallidos (PIN o contraseña) se bloquea el ingreso. Ponelo en **0** para desbloquear. |
| **PIN (protegido)** | Si un cliente **olvidó su PIN**, borrá esta celda y avisale. Entra con su WhatsApp y el PIN nuevo que quiera; ese queda como su PIN. Hacelo solo cuando el cliente te lo pida, porque mientras la celda esté vacía, el primer PIN que se use con ese WhatsApp queda guardado. |
| **Versión datos / Archivo de datos** | Control interno. **No los modifiqués.** El archivo está en tu Drive, en la carpeta *"Datos – Sistema de eventos"*. |

## Bueno saber

- **Copias de seguridad:** los datos de todos tus clientes quedan en tu Drive, uno por archivo. Cada cliente puede además descargar su copia desde **Ajustes**, y también importar un respaldo de la versión anterior (sin nube) para subirlo a su cuenta.
- **Capacidad:** Apps Script con una cuenta de Google gratuita aguanta sin problema decenas de negocios usando la app al mismo tiempo. Si crece mucho, se puede pasar a una base de datos más robusta.
- **Protección:** suficiente para uso normal. Alguien con conocimientos técnicos podría copiar el HTML, pero sin tu Apps Script no tiene acceso a ninguna cuenta ni a ningún dato.

---

Software creado por José Vicdonio Molina · WhatsApp +504 3313-0265
