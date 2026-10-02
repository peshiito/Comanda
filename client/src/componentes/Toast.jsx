import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';

const Ctx = createContext(null);
let siguienteId = 1;

const ICONO = {
  ok: CheckCircle,
  error: WarningCircle,
  info: Info,
};

export function ProveedorToast({ children }) {
  const [toasts, setToasts] = useState([]);

  const quitar = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const avisar = useCallback(
    (texto, tipo = 'info', duracion = 3800) => {
      const id = siguienteId++;
      setToasts((t) => [...t.slice(-3), { id, texto, tipo }]);
      setTimeout(() => quitar(id), duracion);
      return id;
    },
    [quitar]
  );

  const valor = useMemo(
    () => ({
      avisar,
      ok: (t) => avisar(t, 'ok'),
      error: (t) => avisar(t, 'error', 5600),
    }),
    [avisar]
  );

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icono = ICONO[t.tipo] ?? Info;
          return (
            <div
              key={t.id}
              className={`toast toast-${t.tipo}`}
              onClick={() => quitar(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && quitar(t.id)}
            >
              <Icono size={18} weight="fill" className="toast-icono" />
              <span className="crece">{t.texto}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast fuera del proveedor');
  return ctx;
}
