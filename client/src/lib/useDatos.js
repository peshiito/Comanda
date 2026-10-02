import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { obtenerSocket } from './socket.js';

/**
 * Carga una ruta y la vuelve a pedir cuando llega un evento de socket.
 * Así el salón y la cocina se actualizan solos, sin que nadie refresque.
 */
export function useDatos(ruta, eventos = [], intervaloMs = 0) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const vivo = useRef(true);
  const clave = Array.isArray(eventos) ? eventos.join('|') : '';

  const recargar = useCallback(async () => {
    if (!ruta) return;
    try {
      const d = await api.get(ruta);
      if (vivo.current) {
        setDatos(d);
        setError(null);
      }
    } catch (e) {
      if (vivo.current) setError(e);
    } finally {
      if (vivo.current) setCargando(false);
    }
  }, [ruta]);

  useEffect(() => {
    vivo.current = true;
    recargar();
    return () => {
      vivo.current = false;
    };
  }, [recargar]);

  useEffect(() => {
    if (!clave) return undefined;
    const socket = obtenerSocket();
    const lista = clave.split('|');
    const alEvento = () => recargar();
    lista.forEach((e) => socket.on(e, alEvento));
    return () => lista.forEach((e) => socket.off(e, alEvento));
  }, [clave, recargar]);

  useEffect(() => {
    if (!intervaloMs) return undefined;
    const id = setInterval(recargar, intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs, recargar]);

  return { datos, cargando, error, recargar, setDatos };
}

/** Reloj que se refresca solo: los minutos de mesa y de comanda corren en pantalla. */
export function useReloj(segundos = 30) {
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic((t) => t + 1), segundos * 1000);
    return () => clearInterval(id);
  }, [segundos]);
}
