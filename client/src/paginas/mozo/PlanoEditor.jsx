import { useEffect, useRef, useState } from 'react';
import {
  ArrowsOutCardinal, Circle, DoorOpen, Plus, Rectangle, Square, Trash, X,
} from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { useToast } from '../../componentes/Toast.jsx';
import { soloNumero } from '../../lib/formato.js';

export const ANCHO = 1000;
export const ALTO = 620;

/**
 * Cien píxeles del lienzo son un metro de la sala.
 *
 * Con esta escala el lienzo entero mide 10 × 6,2 m —un comedor chico de
 * verdad— y las medidas de arranque dan bien: una mesa de cuatro queda en
 * 1,40 × 0,96 m, que es lo que mide una mesa de cuatro. Así el encargado
 * dibuja con números que puede ir a verificar con un metro.
 */
export const PX_POR_METRO = 100;

export const metros = (px) =>
  (px / PX_POR_METRO).toFixed(2).replace('.', ',');

/** Grilla a la que se pega todo: 10 px son 10 cm. */
const PASO = 10;
/** Distancia a la que dos piezas se consideran alineadas. */
const IMAN = 6;
const MINIMO = 30;

const FORMAS = [
  { clave: 'cuadrada', texto: 'Cuadrada', Icono: Square, medida: [92, 92], capacidad: 2 },
  { clave: 'rectangular', texto: 'Larga', Icono: Rectangle, medida: [140, 96], capacidad: 4 },
  { clave: 'redonda', texto: 'Redonda', Icono: Circle, medida: [132, 132], capacidad: 6 },
];

const ZONAS = [
  { nombre: 'Barra', tipo: 'area', medida: [300, 70] },
  { nombre: 'Recepción', tipo: 'area', medida: [160, 90] },
  { nombre: 'Cocina', tipo: 'area', medida: [200, 120] },
  { nombre: 'Entrada', tipo: 'puerta', medida: [100, 30] },
  { nombre: 'Salida', tipo: 'puerta', medida: [100, 30] },
];

const pegar = (v) => Math.round(v / PASO) * PASO;
const acotar = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Editor del plano: se arrastran las mesas y las zonas, y se estiran desde la
 * esquina, como en un editor de dibujo.
 *
 * Cada cambio se guarda al soltar, no hay botón de "guardar todo". Esto se usa
 * cuando se instala el sistema o cuando el local corre el mobiliario, no
 * durante el servicio, y guardar al toque significa que no se puede perder el
 * trabajo a mitad de camino. La contra —que el salón cambie en vivo para
 * todos— la avisa la pantalla.
 */
export default function PlanoEditor({ mesas, zonas, alCambiar }) {
  const toast = useToast();
  const lienzo = useRef(null);
  // { clase: 'mesa' | 'zona', id }
  const [selec, setSelec] = useState(null);
  const [gesto, setGesto] = useState(null);
  const [guias, setGuias] = useState({ x: [], y: [] });
  const [nombre, setNombre] = useState(null);

  const piezas = [
    ...zonas.map((z) => ({ ...z, clase: 'zona' })),
    ...mesas.map((m) => ({ ...m, clase: 'mesa' })),
  ];
  const sel = selec
    ? piezas.find((p) => p.clase === selec.clase && p.id === selec.id) ?? null
    : null;

  useEffect(() => { setNombre(null); }, [selec?.clase, selec?.id]);

  const misma = (a, b) => a && b && a.clase === b.clase && a.id === b.id;
  const ruta = (p) => (p.clase === 'zona' ? 'zonas' : 'mesas');

  /** Líneas que aparecen cuando la pieza se alinea con otra. */
  const calcularGuias = (pieza, x, y, ancho, alto) => {
    const vx = [];
    const vy = [];
    for (const otra of piezas) {
      if (misma(otra, pieza)) continue;
      for (const o of [otra.pos_x, otra.pos_x + otra.ancho / 2, otra.pos_x + otra.ancho]) {
        if ([x, x + ancho / 2, x + ancho].some((e) => Math.abs(e - o) <= IMAN)) vx.push(o);
      }
      for (const o of [otra.pos_y, otra.pos_y + otra.alto / 2, otra.pos_y + otra.alto]) {
        if ([y, y + alto / 2, y + alto].some((e) => Math.abs(e - o) <= IMAN)) vy.push(o);
      }
    }
    setGuias({ x: [...new Set(vx)], y: [...new Set(vy)] });
  };

  const empezar = (e, pieza, modo) => {
    // Multitáctil: si ya hay un dedo arrastrando, el segundo se ignora. Sin
    // esto la pieza salta al nuevo dedo a mitad del movimiento.
    if (gesto) return;
    e.preventDefault();
    e.stopPropagation();
    const caja = lienzo.current.getBoundingClientRect();
    setSelec({ clase: pieza.clase, id: pieza.id });
    setGesto({
      clase: pieza.clase,
      id: pieza.id,
      modo,
      // Diferencia entre dónde se agarró y la esquina: sin esto la pieza salta
      // al cursor en el primer movimiento.
      dx: e.clientX - caja.left - pieza.pos_x,
      dy: e.clientY - caja.top - pieza.pos_y,
      x: pieza.pos_x,
      y: pieza.pos_y,
      ancho: pieza.ancho,
      alto: pieza.alto,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const mover = (e) => {
    if (!gesto) return;
    const caja = lienzo.current.getBoundingClientRect();
    const px = e.clientX - caja.left;
    const py = e.clientY - caja.top;

    setGesto((g) => {
      if (g.modo === 'mover') {
        const x = acotar(pegar(px - g.dx), 0, ANCHO - g.ancho);
        const y = acotar(pegar(py - g.dy), 0, ALTO - g.alto);
        calcularGuias(g, x, y, g.ancho, g.alto);
        return { ...g, x, y };
      }
      // Estirar desde la esquina de abajo a la derecha: la de arriba queda
      // fija, que es lo que uno espera al agarrar de ahí.
      const ancho = acotar(pegar(px - g.x), MINIMO, ANCHO - g.x);
      const alto = acotar(pegar(py - g.y), MINIMO, ALTO - g.y);
      calcularGuias(g, g.x, g.y, ancho, alto);
      return { ...g, ancho, alto };
    });
  };

  const soltar = async () => {
    if (!gesto) return;
    const { clase, id, x, y, ancho, alto } = gesto;
    const pieza = piezas.find((p) => p.clase === clase && p.id === id);
    setGesto(null);
    setGuias({ x: [], y: [] });
    if (!pieza) return;
    if (pieza.pos_x === x && pieza.pos_y === y && pieza.ancho === ancho && pieza.alto === alto) return;
    try {
      await api.patch(`/salon/${ruta(pieza)}/${id}/posicion`, { pos_x: x, pos_y: y, ancho, alto });
    } catch (e) {
      toast.error(e.message);
    }
    alCambiar();
  };

  const guardar = async (cambios) => {
    if (!sel) return;
    const cuerpo =
      sel.clase === 'zona'
        ? {
            nombre: sel.nombre, pos_x: sel.pos_x, pos_y: sel.pos_y,
            ancho: sel.ancho, alto: sel.alto, tipo: sel.tipo, activa: true, ...cambios,
          }
        : {
            nombre: sel.nombre, capacidad: sel.capacidad, pos_x: sel.pos_x, pos_y: sel.pos_y,
            ancho: sel.ancho, alto: sel.alto, forma: sel.forma, activa: true, ...cambios,
          };
    try {
      await api.put(`/salon/${ruta(sel)}/${sel.id}`, cuerpo);
      alCambiar();
      if (cambios.activa === false) {
        setSelec(null);
        toast.ok(`${sel.nombre} sacada del plano`);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  /**
   * El nombre llega por parámetro y no del estado porque el `blur` puede
   * dispararse después de que el estado ya se limpió al elegir otra pieza.
   */
  const renombrar = async (valor) => {
    setNombre(null);
    const v = (valor ?? '').trim();
    if (!sel || !v || v === sel.nombre) return;
    const choca = piezas.find((p) => !misma(p, sel) && p.clase === sel.clase && p.nombre === v);
    if (choca) {
      toast.error(`Ya hay ${sel.clase === 'zona' ? 'una zona' : 'una mesa'} que se llama “${v}”`);
      return;
    }
    await guardar({ nombre: v });
  };

  /**
   * Alternativa por teclado al arrastre: con la pieza elegida, las flechas la
   * mueven de a 10 cm y con Shift de a un centímetro. Sin esto el editor sería
   * inusable para quien no puede arrastrar con el mouse.
   */
  const teclas = (e) => {
    if (!sel) return;
    const paso = e.shiftKey ? 1 : PASO;
    const delta = {
      ArrowLeft: [-paso, 0], ArrowRight: [paso, 0],
      ArrowUp: [0, -paso], ArrowDown: [0, paso],
    }[e.key];
    if (!delta) return;
    e.preventDefault();
    api
      .patch(`/salon/${ruta(sel)}/${sel.id}/posicion`, {
        pos_x: acotar(sel.pos_x + delta[0], 0, ANCHO - sel.ancho),
        pos_y: acotar(sel.pos_y + delta[1], 0, ALTO - sel.alto),
      })
      .then(alCambiar)
      .catch((err) => toast.error(err.message));
  };

  /** Primer hueco libre, para que lo nuevo no aparezca tapando otra cosa. */
  const hueco = (ancho, alto) => {
    for (let y = 40; y <= ALTO - alto; y += PASO * 2) {
      for (let x = 40; x <= ANCHO - ancho; x += PASO * 2) {
        const choca = piezas.some(
          (p) =>
            x < p.pos_x + p.ancho + 16 && x + ancho + 16 > p.pos_x &&
            y < p.pos_y + p.alto + 16 && y + alto + 16 > p.pos_y
        );
        if (!choca) return { x, y };
      }
    }
    return { x: 40, y: 40 };
  };

  const agregarMesa = async (forma) => {
    const [ancho, alto] = forma.medida;
    const { x, y } = hueco(ancho, alto);
    // El primer número libre, no el siguiente al más alto: si borraste la 12
    // y la 13, la próxima mesa tiene que ser la 12. Con max+1 el salón queda
    // lleno de huecos apenas reordenás una vez.
    const usados = new Set(mesas.map((m) => Number(soloNumero(m.nombre))).filter(Number.isFinite));
    let n = 1;
    while (usados.has(n)) n += 1;
    try {
      const creada = await api.post('/salon/mesas', {
        nombre: `Mesa ${n}`, capacidad: forma.capacidad,
        pos_x: x, pos_y: y, ancho, alto, forma: forma.clave,
      });
      alCambiar();
      setSelec(creada?.id ? { clase: 'mesa', id: creada.id } : null);
      toast.ok(`Mesa ${n} agregada`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const agregarZona = async (z) => {
    const [ancho, alto] = z.medida;
    const { x, y } = hueco(ancho, alto);
    const usados = zonas.filter((o) => o.nombre.startsWith(z.nombre)).length;
    try {
      const creada = await api.post('/salon/zonas', {
        nombre: usados ? `${z.nombre} ${usados + 1}` : z.nombre,
        pos_x: x, pos_y: y, ancho, alto, tipo: z.tipo,
      });
      alCambiar();
      setSelec(creada?.id ? { clase: 'zona', id: creada.id } : null);
      toast.ok(`${z.nombre} agregada`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const medidaDe = (p) => {
    const activo = gesto && gesto.clase === p.clase && gesto.id === p.id;
    return {
      x: activo ? gesto.x : p.pos_x,
      y: activo ? gesto.y : p.pos_y,
      ancho: activo ? gesto.ancho : p.ancho,
      alto: activo ? gesto.alto : p.alto,
      activo,
    };
  };

  return (
    <div className="editor">
      <p className="editor-aviso" role="status">
        <ArrowsOutCardinal size={18} weight="bold" aria-hidden="true" />
        <span>
          Arrastrá las piezas para acomodarlas y estiralas desde la esquina de abajo.
          Cada cambio se guarda solo y el salón lo ve todo el mundo al instante.
        </span>
      </p>

      <div className="editor-barra">
        <span className="rotulo">Mesa</span>
        {FORMAS.map((f) => (
          <button key={f.clave} className="btn btn-chico" onClick={() => agregarMesa(f)}>
            <Plus size={13} weight="bold" aria-hidden="true" />
            <f.Icono size={15} weight="bold" aria-hidden="true" />
            {f.texto}
          </button>
        ))}

        <span className="editor-corte" aria-hidden="true" />

        <span className="rotulo">Zona</span>
        {ZONAS.map((z) => (
          <button key={z.nombre} className="btn btn-chico" onClick={() => agregarZona(z)}>
            <Plus size={13} weight="bold" aria-hidden="true" />
            {z.tipo === 'puerta' ? <DoorOpen size={15} weight="bold" aria-hidden="true" /> : null}
            {z.nombre}
          </button>
        ))}

        <span className="crece" />
        <span className="t12 tenue-3">
          {mesas.length} mesas · {mesas.reduce((a, m) => a + m.capacidad, 0)} lugares ·
          salón de {metros(ANCHO)} × {metros(ALTO)} m
        </span>
      </div>

      <div className="editor-cuerpo">
        <div className="plano-marco">
          <div
            className="plano editor-lienzo"
            ref={lienzo}
            style={{ width: ANCHO, height: ALTO }}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setSelec(null); }}
          >
            {guias.x.map((x) => <span className="editor-guia-v" key={`x${x}`} style={{ left: x }} />)}
            {guias.y.map((y) => <span className="editor-guia-h" key={`y${y}`} style={{ top: y }} />)}

            {piezas.map((p) => {
              const { x, y, ancho, alto, activo } = medidaDe(p);
              const elegida = misma(selec, p);
              const clase =
                p.clase === 'zona'
                  ? `plano-zona zona-${p.tipo}`
                  : `plano-mesa plano-${p.forma}`;
              return (
                <div
                  key={`${p.clase}${p.id}`}
                  className={`${clase} editor-pieza${activo ? ' activo' : ''}${elegida ? ' elegida' : ''}`}
                  style={{ left: x, top: y, width: ancho, height: alto }}
                  onPointerDown={(e) => empezar(e, p, 'mover')}
                  onKeyDown={teclas}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.nombre}, ${metros(ancho)} por ${metros(alto)} metros. Elegila y movela con las flechas.`}
                >
                  {p.clase === 'zona' ? (
                    <span className="plano-zona-nombre">{p.nombre}</span>
                  ) : (
                    <>
                      <span className={`plano-numero${/^\d+$/.test(soloNumero(p.nombre)) ? '' : ' plano-texto'}`}>
                        {soloNumero(p.nombre)}
                      </span>
                      <span className="editor-sillas">{p.capacidad}</span>
                    </>
                  )}

                  {elegida ? (
                    <>
                      <span className="editor-medida">
                        {metros(ancho)} × {metros(alto)} m
                      </span>
                      <span
                        className="editor-tirador"
                        onPointerDown={(e) => empezar(e, p, 'estirar')}
                        role="presentation"
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="editor-panel">
          {sel ? (
            <>
              <div className="fila-sep">
                <h3>{sel.nombre}</h3>
                <button
                  className="btn btn-plano btn-chico btn-icono"
                  onClick={() => setSelec(null)}
                  aria-label="Deseleccionar"
                >
                  <X size={16} weight="bold" aria-hidden="true" />
                </button>
              </div>

              <label className="campo">
                <span>{sel.clase === 'zona' ? 'Cómo se llama' : 'Nombre o número'}</span>
                <input
                  value={nombre ?? sel.nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  /* Se lee del campo y no del estado a propósito: si tocás otra
                     pieza, su `pointerdown` corre ANTES que este `blur` y ya
                     limpió el estado, así que el nombre nuevo se perdía. */
                  onBlur={(e) => renombrar(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                    if (e.key === 'Escape') { setNombre(null); e.currentTarget.blur(); }
                  }}
                  maxLength={sel.clase === 'zona' ? 30 : 20}
                />
              </label>

              {sel.clase === 'mesa' ? (
                <>
                  <div className="campo">
                    <span className="rotulo">Forma</span>
                    <div className="opciones">
                      {FORMAS.map((f) => (
                        <button
                          key={f.clave}
                          className="pildora"
                          aria-pressed={sel.forma === f.clave}
                          onClick={() => guardar({ forma: f.clave })}
                        >
                          <f.Icono size={14} weight="bold" aria-hidden="true" /> {f.texto}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="campo">
                    <span className="rotulo">Cuánta gente entra</span>
                    <div className="opciones">
                      {[2, 4, 6, 8, 10, 12].map((n) => (
                        <button
                          key={n}
                          className="pildora"
                          aria-pressed={sel.capacidad === n}
                          onClick={() => guardar({ capacidad: n })}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="campo-ayuda">
                      Es la capacidad del mueble. El cubierto se cobra por la gente que
                      se sienta, no por esto.
                    </span>
                  </div>
                </>
              ) : (
                <div className="campo">
                  <span className="rotulo">Cómo se dibuja</span>
                  <div className="opciones">
                    <button
                      className="pildora"
                      aria-pressed={sel.tipo === 'area'}
                      onClick={() => guardar({ tipo: 'area' })}
                    >
                      Bloque
                    </button>
                    <button
                      className="pildora"
                      aria-pressed={sel.tipo === 'puerta'}
                      onClick={() => guardar({ tipo: 'puerta' })}
                    >
                      Puerta
                    </button>
                  </div>
                  <span className="campo-ayuda">
                    Bloque para la barra o la cocina. Puerta para una entrada o salida:
                    se dibuja como una marca fina en la pared.
                  </span>
                </div>
              )}

              <div className="campo">
                <span className="rotulo">Medidas</span>
                <p className="t16 mono medio">
                  {metros(sel.ancho)} × {metros(sel.alto)} m
                </p>
                <p className="t12 tenue-3 mono">
                  a {metros(sel.pos_x)} m de la izquierda · {metros(sel.pos_y)} m de arriba
                </p>
                <span className="campo-ayuda">
                  Se cambian arrastrando. Con la pieza elegida, las flechas del teclado
                  la mueven de a 10 cm y con Shift de a un centímetro.
                </span>
              </div>

              <button className="btn btn-peligro btn-ancho" onClick={() => guardar({ activa: false })}>
                <Trash size={16} weight="bold" aria-hidden="true" /> Sacar del plano
              </button>
              {sel.clase === 'mesa' ? (
                <span className="campo-ayuda">
                  No se borra: deja de aparecer en el salón, su historial de ventas queda
                  intacto y su número se libera para otra mesa.
                </span>
              ) : null}
            </>
          ) : (
            <div className="vacio t13">
              <ArrowsOutCardinal size={28} weight="light" aria-hidden="true" />
              <strong>Tocá una mesa o una zona</strong>
              <p>Para cambiarle el nombre, la forma, cuánta gente entra o sacarla.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
