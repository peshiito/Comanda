import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, Star } from '@phosphor-icons/react';
import ElegirModificadores from './ElegirModificadores.jsx';
import { Bloque } from './Esqueleto.jsx';
import { useDatos } from '../lib/useDatos.js';
import { plata, urlFoto } from '../lib/formato.js';
import './selector.css';

/**
 * Carga rápida. Tres atajos, en orden de impacto real:
 *  1. buscador siempre enfocado — escribir tres letras le gana a cualquier grilla
 *  2. código corto — el cajero veterano tipea "24" y Enter sin mirar
 *  3. más vendidos primero — son el 70% de lo que se pide
 */
export default function SelectorProductos({ alElegir, mostrarPrecios = true }) {
  const { datos: carta, cargando } = useDatos('/carta', ['carta:cambio']);
  const { datos: favoritos } = useDatos('/carta/favoritos', ['carta:cambio']);
  const [texto, setTexto] = useState('');
  const [catId, setCatId] = useState('favoritos');
  const [eligiendo, setEligiendo] = useState(null);
  const buscador = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(min-width: 900px)').matches) buscador.current?.focus();
  }, []);

  const grupos = carta?.grupos ?? [];
  const categorias = carta?.categorias ?? [];
  const todos = useMemo(() => categorias.flatMap((c) => c.productos), [categorias]);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (t) {
      const exacto = todos.filter((p) => p.codigo_corto?.toLowerCase() === t);
      if (exacto.length) return exacto;
      return todos.filter((p) => p.nombre.toLowerCase().includes(t)).slice(0, 40);
    }
    if (catId === 'favoritos') return favoritos?.length ? favoritos : todos.slice(0, 18);
    return categorias.find((c) => c.id === catId)?.productos ?? [];
  }, [texto, catId, todos, favoritos, categorias]);

  const elegir = (p) => {
    if (!p.disponible) return;
    if ((p.grupos?.length ?? 0) > 0 || (p.variantes?.length ?? 0) > 1) {
      setEligiendo(p);
      return;
    }
    alElegir({
      producto_id: p.id,
      variante_id: p.variantes?.[0]?.id ?? null,
      cantidad: 1,
      nota: null,
      opcion_ids: [],
    });
  };

  const alTeclaBuscador = (e) => {
    if (e.key === 'Enter' && visibles.length) {
      elegir(visibles[0]);
      setTexto('');
    }
    if (e.key === 'Escape') setTexto('');
  };

  if (cargando) {
    return (
      <div className="selector">
        <Bloque alto={44} radio="var(--r2)" />
        <Bloque alto={40} radio="var(--r2)" />
        <div className="grilla-productos">
          {Array.from({ length: 12 }, (_, i) => (
            <Bloque key={i} alto={76} radio="var(--r2)" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="selector">
      <div className="buscador">
        <MagnifyingGlass size={17} weight="bold" />
        <input
          ref={buscador}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alTeclaBuscador}
          placeholder="Buscar por nombre o código — Enter carga el primero"
          aria-label="Buscar producto"
          autoComplete="off"
        />
        {texto ? (
          <button className="btn btn-plano btn-chico" onClick={() => setTexto('')}>Limpiar</button>
        ) : null}
      </div>

      {!texto ? (
        <div className="tabs" role="tablist" aria-label="Categorías">
          <button className="tab" role="tab" aria-selected={catId === 'favoritos'} onClick={() => setCatId('favoritos')}>
            <Star size={14} weight={catId === 'favoritos' ? 'fill' : 'bold'} /> Más vendidos
          </button>
          {categorias.map((c) => (
            <button key={c.id} className="tab" role="tab" aria-selected={catId === c.id} onClick={() => setCatId(c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grilla-productos">
        {visibles.map((p) => (
          <button
            key={p.id}
            className={`producto${p.disponible ? '' : ' agotado'}`}
            onClick={() => elegir(p)}
            disabled={!p.disponible}
          >
            {p.foto ? (
              <img
                className="producto-foto"
                src={urlFoto(p.foto)}
                alt=""
                loading="lazy"
                width="160"
                height="96"
              />
            ) : null}
            <span className="producto-nombre dos-lineas">{p.nombre}</span>
            {p.variantes?.length > 1 ? (
              <span className="producto-variantes cortar">
                {p.variantes.map((v) => v.nombre).join(' · ')}
              </span>
            ) : null}

            <span className="producto-pie">
              {mostrarPrecios ? <span className="mono">{plata(p.precio)}</span> : <span />}
              {!p.disponible ? (
                <span className="eti eti-roja">Agotado</span>
              ) : p.codigo_corto ? (
                <span className="mono tenue-3 t11">{p.codigo_corto}</span>
              ) : null}
            </span>
          </button>
        ))}
        {!visibles.length ? (
          <p className="vacio t13" style={{ gridColumn: '1 / -1' }}>
            Nada con “{texto}”.
          </p>
        ) : null}
      </div>

      {eligiendo ? (
        <ElegirModificadores
          producto={eligiendo}
          grupos={grupos}
          mostrarPrecios={mostrarPrecios}
          alCerrar={() => setEligiendo(null)}
          alConfirmar={(item) => {
            alElegir(item);
            setEligiendo(null);
            setTexto('');
            buscador.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
