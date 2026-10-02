import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { inicioDeRol, useSesion } from './lib/sesion.jsx';
import Login from './paginas/Login.jsx';

import Riel from './componentes/Riel.jsx';

/**
 * Las pantallas del personal se bajan recién cuando alguien entra a ellas.
 * Quien escanea el QR de la mesa sólo quiere ver la carta: no tiene por qué
 * descargarse la caja, la cocina y la administración en el wifi del local.
 */
const Salon = lazy(() => import('./paginas/mozo/Salon.jsx'));
const Mesa = lazy(() => import('./paginas/mozo/Mesa.jsx'));
const Cocina = lazy(() => import('./paginas/cocina/Cocina.jsx'));
const Caja = lazy(() => import('./paginas/caja/Caja.jsx'));
const Cuenta = lazy(() => import('./paginas/caja/Cuenta.jsx'));
const Turno = lazy(() => import('./paginas/caja/Turno.jsx'));
const Admin = lazy(() => import('./paginas/admin/Admin.jsx'));
const Imprimir = lazy(() => import('./paginas/caja/Imprimir.jsx'));

/**
 * Además de cuidar la ruta, monta el riel lateral. `suelta` lo deja afuera:
 * la cocina va a pantalla completa en un televisor y no navega a ningún lado.
 */
function Protegida({ roles, suelta, children }) {
  const { usuario, cargando } = useSesion();
  if (cargando) return <div className="cargando">Cargando…</div>;
  if (!usuario) return <Navigate to="/entrar" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to={inicioDeRol(usuario.rol)} replace />;
  return (
    <>
      {suelta ? null : <Riel />}
      {children}
    </>
  );
}

const SALON = ['mozo', 'caja', 'encargado'];
const CAJA = ['caja', 'encargado'];

export default function App() {
  const { usuario, cargando } = useSesion();

  return (
    <Suspense fallback={<div className="cargando">Cargando…</div>}>
    <Routes>
      {/* Pública: la carta que escanea el cliente en la mesa */}
      <Route
        path="/entrar"
        element={cargando ? <div className="cargando">Cargando…</div> : usuario ? <Navigate to={inicioDeRol(usuario.rol)} replace /> : <Login />}
      />

      <Route path="/salon" element={<Protegida roles={SALON}><Salon /></Protegida>} />
      <Route path="/mesa/:mesaId" element={<Protegida roles={SALON}><Mesa /></Protegida>} />
      <Route path="/cocina" element={<Protegida roles={['cocina', 'caja', 'encargado']} suelta><Cocina /></Protegida>} />
      <Route path="/caja" element={<Protegida roles={CAJA}><Caja /></Protegida>} />
      <Route path="/caja/turno" element={<Protegida roles={CAJA}><Turno /></Protegida>} />
      <Route path="/cuenta/:cuentaId" element={<Protegida roles={CAJA}><Cuenta /></Protegida>} />
      {/* Se abre en pestaña aparte: va sin riel para no imprimirlo. */}
      <Route path="/imprimir/:cuentaId" element={<Protegida roles={CAJA} suelta><Imprimir /></Protegida>} />
      <Route path="/admin/*" element={<Protegida roles={CAJA}><Admin /></Protegida>} />

      <Route path="*" element={<Navigate to={usuario ? inicioDeRol(usuario.rol) : '/entrar'} replace />} />
    </Routes>
    </Suspense>
  );
}
