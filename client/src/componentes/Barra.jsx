import { NavLink, useNavigate } from 'react-router-dom';
import {
  CaretLeft, ChartBar, ForkKnife, Power, Receipt, Storefront,
} from '@phosphor-icons/react';
import { Isotipo } from './Marca.jsx';
import { useSesion } from '../lib/sesion.jsx';

const ROL = { encargado: 'Encargado', caja: 'Caja', mozo: 'Mozo', cocina: 'Cocina' };

/** Barra superior: dónde estás, a dónde podés ir y quién sos. */
export default function Barra({ titulo, subtitulo, atras, acciones, oscura }) {
  const { usuario, salir, esCaja, esEncargado, esMozo } = useSesion();
  const navegar = useNavigate();

  const destinos = [
    ...(esMozo || esCaja ? [{ a: '/salon', texto: 'Salón', Icono: Storefront }] : []),
    ...(esCaja ? [{ a: '/caja', texto: 'Caja', Icono: Receipt }] : []),
    ...(esCaja ? [{ a: '/cocina', texto: 'Cocina', Icono: ForkKnife }] : []),
    ...(esCaja ? [{ a: '/admin', texto: esEncargado ? 'Admin' : 'Reportes', Icono: ChartBar }] : []),
  ];

  return (
    <header className={`barra${oscura ? ' barra-oscura' : ''}`}>
      {atras ? (
        <button className="btn btn-plano btn-chico btn-icono" onClick={() => navegar(atras)} aria-label="Volver">
          <CaretLeft size={18} />
        </button>
      ) : (
        <span className="marca-signo" style={{ marginRight: -4 }}>
          <Isotipo tamano={24} titulo="Comanda" />
        </span>
      )}

      <div className="crece" style={{ minWidth: 0 }}>
        <h1 className="cortar">{titulo}</h1>
        {subtitulo ? <p className="t12 tenue-3 cortar">{subtitulo}</p> : null}
      </div>

      {destinos.length > 1 ? (
        <nav className="barra-nav" aria-label="Secciones">
          {destinos.map(({ a, texto, Icono }) => (
            <NavLink key={a} to={a}>
              <Icono size={16} weight="bold" />
              <span>{texto}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}

      {acciones}

      <button
        className="btn btn-plano btn-chico"
        onClick={salir}
        title={`${usuario?.nombre} · ${ROL[usuario?.rol] ?? ''} — cerrar sesión`}
      >
        <span className="cortar" style={{ maxWidth: 110 }}>{usuario?.nombre?.split(' ')[0]}</span>
        <Power size={15} weight="bold" />
      </button>
    </header>
  );
}
