import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { env } from '../config/env.js';
import { leerToken } from '../middlewares/auth.js';
import { estadoDeSesion } from '../servicios/sesiones.js';
import type { UsuarioToken } from '../types/express.js';

let io: SocketServer | null = null;

/**
 * Cada cuánto se repasa que los conectados sigan habilitados y con su rol.
 *
 * En HTTP la baja se nota al pedido siguiente, pero un socket se autentica una
 * sola vez, al conectarse, y después vive horas: al que daban de baja le
 * seguían llegando las comandas de cocina y los movimientos de caja mientras
 * no cerrara la pestaña. Lo mismo con el rol, porque las salas se eligen al
 * conectar: al que bajabas de encargado a mozo le seguía llegando caja. Son
 * diez sockets en un local, repasarlos es gratis.
 */
const REPASO_MS = 30_000;

/** Salas: cocina, caja, salon, mozo:<id>, usuario:<id>. */
export function iniciarSockets(servidor: HttpServer): SocketServer {
  io = new SocketServer(servidor, {
    cors: { origin: env.CORS_ORIGEN.split(',').map((o) => o.trim()), credentials: true },
  });

  /**
   * Sin token no se entra. Antes existía una sala `publico` para la carta que
   * se escaneaba con QR; la carta es de papel y la sala quedó huérfana, pero
   * seguía recibiendo `caja:turno` — o sea que cualquiera en la red del local
   * se enteraba de que se abrió el turno, y con qué id, sin presentar nada.
   */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('no_autenticado'));

    let usuario: UsuarioToken;
    try {
      usuario = leerToken(token);
    } catch {
      return next(new Error('sesion_invalida'));
    }

    estadoDeSesion(usuario.id)
      .then((estado) => {
        if (!estado) return next(new Error('usuario_inactivo'));
        // El rol que manda es el de la base: el del token puede estar viejo.
        socket.data.usuario = { ...usuario, rol: estado.rol };
        next();
      })
      .catch(() => next(new Error('no_autenticado')));
  });

  io.on('connection', (socket) => {
    const usuario = socket.data.usuario as UsuarioToken;
    socket.join('salon');
    socket.join(`usuario:${usuario.id}`);
    if (usuario.rol === 'cocina') socket.join('cocina');
    if (usuario.rol === 'caja' || usuario.rol === 'encargado') {
      socket.join('caja');
      socket.join('cocina');
    }
    if (usuario.rol === 'mozo') socket.join(`mozo:${usuario.id}`);
  });

  const repaso = setInterval(() => void echarInactivos(), REPASO_MS);
  // Que el intervalo no sea lo que mantiene vivo al proceso.
  repaso.unref();

  return io;
}

/** Echa a los que dejaron de estar activos o cambiaron de rol. */
async function echarInactivos(): Promise<void> {
  if (!io) return;
  const sockets = await io.fetchSockets();
  for (const s of sockets) {
    const usuario = s.data.usuario as UsuarioToken | undefined;
    if (!usuario) {
      s.disconnect(true);
      continue;
    }
    const estado = await estadoDeSesion(usuario.id);
    if (!estado) {
      s.emit('sesion:cerrada', { motivo: 'Tu usuario ya no está activo' });
      s.disconnect(true);
      continue;
    }
    if (estado.rol !== usuario.rol) {
      // Las salas se eligieron al conectar: que vuelva a entrar y las rearme.
      s.emit('sesion:rol', { rol: estado.rol });
      s.disconnect(true);
    }
  }
}

type Sala = 'cocina' | 'caja' | 'salon' | `mozo:${number}` | `usuario:${number}`;

export function emitir(sala: Sala | Sala[], evento: string, datos?: unknown): void {
  if (!io) return;
  const salas = Array.isArray(sala) ? sala : [sala];
  io.to(salas).emit(evento, datos ?? {});
}

export function obtenerIo(): SocketServer | null {
  return io;
}
