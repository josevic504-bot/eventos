/**
 * Sistema de eventos — Cuentas, datos en la nube y licencias
 * ------------------------------------------------------------
 * • Cada negocio crea su cuenta con: nombre del negocio, WhatsApp y PIN.
 * • Sus datos se guardan en un archivo .json dentro de tu Google Drive
 *   (carpeta "Datos – Sistema de eventos"), ligado a su fila en la hoja.
 * • Prueba gratis de 7 días. Se activa de por vida con tu contraseña
 *   o cambiando la columna Estado a "Activa".
 *
 * La contraseña de activación NO va aquí: se guarda en
 * Configuración del proyecto → Propiedades del script → ADMIN_PASSWORD.
 */
const HOJA = 'Licencias';
const CARPETA = 'Datos – Sistema de eventos';
const DIAS_PRUEBA = 7;
const MAX_INTENTOS = 10;
const ENC = ['Código', 'ID', 'Negocio', 'WhatsApp', 'Inicio prueba', 'Vence prueba', 'Estado', 'Activado el',
  'Última conexión', 'Intentos fallidos', 'Notas', 'PIN (protegido)', 'Versión datos', 'Archivo de datos', 'Datos actualizados'];
const C = { CODIGO: 1, ID: 2, NEGOCIO: 3, WHATSAPP: 4, INICIO: 5, VENCE: 6, ESTADO: 7, ACTIVADO: 8, ULTIMA: 9,
  FALLOS: 10, NOTAS: 11, PIN: 12, VERSION: 13, ARCHIVO: 14, ACTUALIZADO: 15 };

function doPost(e) {
  let r;
  try { r = atender(JSON.parse((e && e.postData && e.postData.contents) || '{}')); }
  catch (err) { r = { ok: false, error: 'servidor', msg: 'Error del servidor: ' + err.message }; }
  return salida(r);
}
function doGet() { return salida({ ok: true, servicio: 'sistema-eventos', hora: Date.now() }); }
function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- utilidades ---------- */
function hoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.setFrozenRows(1);
    sh.getRange('G2:G').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Prueba', 'Activa', 'Bloqueada'], true).build());
  }
  if (sh.getLastColumn() < ENC.length || sh.getRange(1, 1).getValue() !== ENC[0]) {
    sh.getRange(1, 1, 1, ENC.length).setValues([ENC]).setFontWeight('bold');
  }
  return sh;
}
function filas(sh) {
  const n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, 1, n, ENC.length).getValues();
}
function buscarFila(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = sh.getRange(2, C.ID, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}
const recortar = s => String(s || '').slice(0, 80);
const normal = s => String(s || 'Prueba').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tel = s => { let d = String(s || '').replace(/\D/g, ''); if (d.length === 8) d = '504' + d; return d; };
const pinValido = p => /^\d{4,6}$/.test(String(p || ''));
const hashPin = (id, pin) => Utilities.base64Encode(
  Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id + ':' + pin, Utilities.Charset.UTF_8));

function carpeta() {
  const pr = PropertiesService.getScriptProperties();
  const id = pr.getProperty('DATA_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(CARPETA);
  pr.setProperty('DATA_FOLDER', f.getId());
  return f;
}
function leerDatos(fid) {
  if (!fid) return null;
  try { return JSON.parse(DriveApp.getFileById(fid).getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}
function escribirDatos(sh, fila, r, data) {
  const txt = JSON.stringify(data || {});
  let fid = r[C.ARCHIVO - 1];
  if (fid) { try { DriveApp.getFileById(fid).setContent(txt); return; } catch (e) {} }
  const f = carpeta().createFile((r[C.CODIGO - 1] || r[C.ID - 1]) + ' - ' + (r[C.NEGOCIO - 1] || 'negocio') + '.json', txt, MimeType.PLAIN_TEXT);
  sh.getRange(fila, C.ARCHIVO).setValue(f.getId());
}
function respuesta(r, ahora, extra) {
  const o = {
    ok: true, estado: normal(r[C.ESTADO - 1]),
    vence: r[C.VENCE - 1] ? new Date(r[C.VENCE - 1]).getTime() : ahora.getTime(),
    ahora: ahora.getTime(), negocio: r[C.NEGOCIO - 1], whatsapp: String(r[C.WHATSAPP - 1] || ''),
    tienePin: !!r[C.PIN - 1], version: Number(r[C.VERSION - 1] || 0)
  };
  return Object.assign(o, extra || {});
}

/* ---------- acciones ---------- */
function atender(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja();
    const ahora = new Date();
    if (b.accion === 'ingresar') return ingresar(sh, b, ahora);

    const id = String(b.id || '').trim();
    if (!/^[a-z0-9-]{8,80}$/i.test(id)) return { ok: false, error: 'id' };
    let fila = buscarFila(sh, id);

    if (b.accion === 'registrar' && !fila) {
      if (!pinValido(b.pin)) return { ok: false, msg: 'El PIN debe tener de 4 a 6 números' };
      const vence = new Date(ahora.getTime() + DIAS_PRUEBA * 864e5);
      sh.appendRow([recortar(b.codigo), id, recortar(b.negocio), "'" + recortar(b.whatsapp), ahora, vence, 'Prueba', '',
        ahora, 0, '', hashPin(id, b.pin), 0, '', '']);
      fila = sh.getLastRow();
      if (b.data) {
        const r0 = sh.getRange(fila, 1, 1, ENC.length).getValues()[0];
        escribirDatos(sh, fila, r0, b.data);
        sh.getRange(fila, C.VERSION).setValue(1);
        sh.getRange(fila, C.ACTUALIZADO).setValue(ahora);
      }
    }
    if (!fila) return { ok: true, estado: 'nuevo', ahora: ahora.getTime() };

    const r = sh.getRange(fila, 1, 1, ENC.length).getValues()[0];
    const ver = Number(r[C.VERSION - 1] || 0);
    sh.getRange(fila, C.ULTIMA).setValue(ahora);

    switch (b.accion) {
      case 'registrar':
      case 'cargar': {
        const v = Number(b.version);
        const data = (isNaN(v) || v < 0 || ver > v) ? (leerDatos(r[C.ARCHIVO - 1]) || {}) : null;
        return respuesta(r, ahora, { data: data });
      }
      case 'guardar': {
        if (normal(r[C.ESTADO - 1]) === 'bloqueada') return { ok: false, msg: 'Cuenta suspendida. Escribinos por WhatsApp.' };
        if (Number(b.base || 0) !== ver) return { ok: false, conflicto: true, version: ver, data: leerDatos(r[C.ARCHIVO - 1]) || {} };
        escribirDatos(sh, fila, r, b.data);
        sh.getRange(fila, C.VERSION).setValue(ver + 1);
        sh.getRange(fila, C.ACTUALIZADO).setValue(ahora);
        if (b.data && b.data.negocio && b.data.negocio !== r[C.NEGOCIO - 1]) sh.getRange(fila, C.NEGOCIO).setValue(recortar(b.data.negocio));
        return { ok: true, version: ver + 1 };
      }
      case 'pin': {
        if (r[C.PIN - 1]) return { ok: false, msg: 'Esta cuenta ya tiene PIN' };
        if (!pinValido(b.pin)) return { ok: false, msg: 'El PIN debe tener de 4 a 6 números' };
        sh.getRange(fila, C.PIN).setValue(hashPin(id, b.pin));
        return { ok: true };
      }
      case 'activar': {
        const fallos = Number(r[C.FALLOS - 1] || 0);
        if (fallos >= MAX_INTENTOS) return { ok: false, msg: 'Demasiados intentos. Escribinos por WhatsApp.' };
        const clave = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
        if (!clave) return { ok: false, msg: 'Falta configurar la contraseña en el Apps Script.' };
        if (String(b.clave || '') !== clave) {
          sh.getRange(fila, C.FALLOS).setValue(fallos + 1);
          return { ok: false, msg: 'Contraseña incorrecta' };
        }
        sh.getRange(fila, C.ESTADO).setValue('Activa');
        sh.getRange(fila, C.ACTIVADO).setValue(ahora);
        sh.getRange(fila, C.FALLOS).setValue(0);
        r[C.ESTADO - 1] = 'Activa';
        return respuesta(r, ahora);
      }
      default:
        return respuesta(r, ahora);
    }
  } finally {
    lock.releaseLock();
  }
}

function ingresar(sh, b, ahora) {
  const wa = tel(b.whatsapp);
  if (wa.length < 8 || !pinValido(b.pin)) return { ok: false, msg: 'Revisá tu WhatsApp y PIN' };
  const todas = filas(sh);
  const cand = [];
  for (let i = todas.length - 1; i >= 0; i--) if (tel(todas[i][C.WHATSAPP - 1]) === wa) cand.push(i + 2);
  if (!cand.length) return { ok: false, msg: 'No encontramos una cuenta con ese WhatsApp' };
  for (const fila of cand) {
    const r = todas[fila - 2];
    if (Number(r[C.FALLOS - 1] || 0) >= MAX_INTENTOS) continue;
    if (!r[C.PIN - 1]) {
      // PIN borrado por el administrador: el primer ingreso con este WhatsApp define el PIN nuevo.
      sh.getRange(fila, C.PIN).setValue(hashPin(String(r[C.ID - 1]), b.pin));
      sh.getRange(fila, C.FALLOS).setValue(0);
      sh.getRange(fila, C.ULTIMA).setValue(ahora);
      r[C.PIN - 1] = 'x';
      return respuesta(r, ahora, { id: String(r[C.ID - 1]), data: leerDatos(r[C.ARCHIVO - 1]) || {} });
    }
    if (r[C.PIN - 1] && hashPin(String(r[C.ID - 1]), b.pin) === r[C.PIN - 1]) {
      sh.getRange(fila, C.FALLOS).setValue(0);
      sh.getRange(fila, C.ULTIMA).setValue(ahora);
      return respuesta(r, ahora, { id: String(r[C.ID - 1]), data: leerDatos(r[C.ARCHIVO - 1]) || {} });
    }
  }
  cand.forEach(f => { const r = todas[f - 2]; sh.getRange(f, C.FALLOS).setValue(Number(r[C.FALLOS - 1] || 0) + 1); });
  const bloqueadas = cand.every(f => Number(todas[f - 2][C.FALLOS - 1] || 0) + 1 >= MAX_INTENTOS);
  return { ok: false, msg: bloqueadas ? 'Demasiados intentos. Escribinos por WhatsApp.' : 'PIN incorrecto' };
}
