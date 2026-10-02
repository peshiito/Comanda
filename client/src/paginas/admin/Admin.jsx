import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  ChartBar, ClipboardText, ForkKnife, Gear, Users, Wallet,
} from '@phosphor-icons/react';
import Barra from '../../componentes/Barra.jsx';
import { useSesion } from '../../lib/sesion.jsx';
import Reportes from './Reportes.jsx';
import Auditoria from './Auditoria.jsx';
import CartaAdmin from './CartaAdmin.jsx';
import Usuarios from './Usuarios.jsx';
import Config from './Config.jsx';
import Caja from './Caja.jsx';

export default function Admin() {
  const { esEncargado } = useSesion();

  const secciones = [
    { ruta: 'reportes', texto: 'Reportes', Icono: ChartBar },
    // La caja la ve también el cajero: es el cajón que tiene adelante.
    { ruta: 'caja', texto: 'Caja', Icono: Wallet },
    { ruta: 'auditoria', texto: 'Auditoría', Icono: ClipboardText },
    ...(esEncargado
      ? [
          { ruta: 'carta', texto: 'Carta', Icono: ForkKnife },
          { ruta: 'usuarios', texto: 'Empleados', Icono: Users },
          { ruta: 'config', texto: 'Configuración', Icono: Gear },
        ]
      : []),
  ];

  return (
    <>
      <Barra titulo={esEncargado ? 'Administración' : 'Reportes'} atras="/caja" />
      <div className="contenido pila">
        <nav className="tabs" aria-label="Secciones de administración">
          {secciones.map(({ ruta, texto, Icono }) => (
            <NavLink key={ruta} to={`/admin/${ruta}`} className="tab">
              {({ isActive }) => (
                <>
                  <Icono size={15} weight={isActive ? 'fill' : 'bold'} />
                  {texto}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <Routes>
          <Route index element={<Navigate to="reportes" replace />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="caja" element={<Caja />} />
          <Route path="auditoria" element={<Auditoria />} />
          {esEncargado ? <Route path="carta" element={<CartaAdmin />} /> : null}
          {esEncargado ? <Route path="usuarios" element={<Usuarios />} /> : null}
          {esEncargado ? <Route path="config" element={<Config />} /> : null}
          <Route path="*" element={<Navigate to="reportes" replace />} />
        </Routes>
      </div>
    </>
  );
}
