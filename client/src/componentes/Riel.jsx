import { NavLink } from 'react-router-dom';
import {
  ChartBar, ForkKnife, Power, Receipt, Storefront,
} from '@phosphor-icons/react';
import { Isotipo } from './Marca.jsx';
import { useSesion } from '../lib/sesion.jsx';

const ROL = { encargado: 'Encargado', caja: 'Caja', mozo: 'Mozo', cocina: 'Cocina' };

/**
 * Riel lateral de 72px, sólo en escritorio. En celular la navegación sigue
 * viviendo en la barra de arriba: el mozo trabaja con una mano y el pulgar
 * no llega a un costado fijo.
 */
export default function Riel() {
  const { usuario, salir, esCaja, esEncargado, esMozo } = useSesion();

  const destinos = [
    ...(esMozo || esCaja ? [{ a: '/salon', texto: 'Salón', Icono: Storefront }] : []),
    ...(esCaja ? [{ a: '/caja', texto: 'Caja', Icono: Receipt }] : []),
    ...(esCaja ? [{ a: '/cocina', texto: 'Cocina', Icono: ForkKnife }] : []),
    ...(esCaja ? [{ a: '/admin', texto: esEncargado ? 'Admin' : 'Reportes', Icono: ChartBar }] : []),
  ];

  if (destinos.length < 2) return null;

  const iniciales = (usuario?.nombre ?? '')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <aside className="riel" aria-label="Secciones">
      <span className="riel-marca">
        <Isotipo tamano={26} titulo="Comanda" />
      </span>

      <nav className="riel-nav">
        {destinos.map(({ a, texto, Icono }) => (
          <NavLink key={a} to={a} className="riel-link" title={texto}>
            <Icono size={22} weight="regular" aria-hidden="true" />
            <span className="riel-texto">{texto}</span>
          </NavLink>
        ))}
      </nav>

      <div className="riel-pie">
        <span className="riel-avatar" title={`${usuario?.nombre} · ${ROL[usuario?.rol] ?? ''}`}>
          {iniciales}
        </span>
        <button className="riel-salir" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión">
          <Power size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
