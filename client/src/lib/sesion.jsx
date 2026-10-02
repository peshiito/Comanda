import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, guardarToken, leerToken } from './api.js';
import { conectarSocket, desconectarSocket } from './socket.js';

const Ctx = createContext(null);

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const salir = useCallback(() => {
    guardarToken(null);
    desconectarSocket();
    setUsuario(null);
  }, []);

  const entrar = useCallback((sesion) => {
    guardarToken(sesion.token);
    setUsuario(sesion.usuario);
    conectarSocket();
  }, []);

  useEffect(() => {
    let vivo = true;
    if (!leerToken()) {
      setCargando(false);
      return undefined;
    }
    api
      .get('/auth/yo')
      .then((d) => {
        if (!vivo) return;
        setUsuario(d.usuario);
        conectarSocket();
      })
      .catch(() => guardarToken(null))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const alVencer = () => setUsuario(null);
    // El encargado le cambió el rol: hay que volver a leer qué puede ver.
    const alCambiar = () => {
      api.get('/auth/yo').then((d) => setUsuario(d.usuario)).catch(() => setUsuario(null));
    };
    window.addEventListener('sesion-vencida', alVencer);
    window.addEventListener('sesion-cambiada', alCambiar);
    return () => {
      window.removeEventListener('sesion-vencida', alVencer);
      window.removeEventListener('sesion-cambiada', alCambiar);
    };
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      entrar,
      salir,
      esCaja: usuario?.rol === 'caja' || usuario?.rol === 'encargado',
      esEncargado: usuario?.rol === 'encargado',
      esMozo: usuario?.rol === 'mozo',
      esCocina: usuario?.rol === 'cocina',
    }),
    [usuario, cargando, entrar, salir]
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSesion fuera del proveedor');
  return ctx;
}

/** A dónde manda el sistema a cada rol cuando entra. */
export function inicioDeRol(rol) {
  if (rol === 'cocina') return '/cocina';
  if (rol === 'mozo') return '/salon';
  return '/caja';
}
