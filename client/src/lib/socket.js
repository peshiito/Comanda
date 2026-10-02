import { io } from 'socket.io-client';
import { guardarToken, leerToken } from './api.js';

let socket = null;

/** Los motivos por los que no tiene sentido reintentar: hay que volver a entrar. */
const RECHAZOS = new Set(['no_autenticado', 'sesion_invalida', 'usuario_inactivo']);

export function conectarSocket() {
  if (socket) {
    socket.auth = { token: leerToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io({
    auth: { token: leerToken() },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 700,
    reconnectionDelayMax: 4000,
  });

  /**
   * El servidor rechaza el socket cuando el token no sirve o el empleado dejó
   * de estar activo. Sin esto, socket.io reintentaría para siempre y la
   * pantalla se quedaría mostrando lo último que recibió — que en la de cocina
   * son comandas viejas, y en la de caja, plata. Mejor caer al login.
   */
  socket.on('connect_error', (err) => {
    if (RECHAZOS.has(err?.message)) {
      guardarToken(null);
      socket.disconnect();
      window.dispatchEvent(new CustomEvent('sesion-vencida'));
    }
  });

  /**
   * Cambio de rol con el socket abierto: el servidor corta para que las salas
   * se rearmen al reconectar, y acá hay que volver a leer quién es, porque de
   * eso dependen las pantallas que se muestran.
   */
  socket.on('sesion:rol', () => {
    window.dispatchEvent(new CustomEvent('sesion-cambiada'));
  });

  // Baja mientras el socket ya estaba conectado: el servidor avisa y corta.
  socket.on('sesion:cerrada', () => {
    guardarToken(null);
    socket.disconnect();
    window.dispatchEvent(new CustomEvent('sesion-vencida'));
  });

  return socket;
}

export function desconectarSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function obtenerSocket() {
  return socket ?? conectarSocket();
}

/** Suena un aviso corto sin archivos: dos tonos con WebAudio. */
export function sonarAviso(agudo = false) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(agudo ? 880 : 620, ctx.currentTime);
    osc.frequency.setValueAtTime(agudo ? 1180 : 820, ctx.currentTime + 0.12);
    gan.gain.setValueAtTime(0.0001, ctx.currentTime);
    gan.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gan).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 900);
  } catch {
    /* sin audio disponible */
  }
}
