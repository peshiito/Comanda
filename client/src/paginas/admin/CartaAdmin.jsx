import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import ModalProducto, { ModalGrupos } from './ModalProducto.jsx';
import { EsqueletoLista } from '../../componentes/Esqueleto.jsx';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';
import { plata } from '../../lib/formato.js';

const VACIO = {
  categoria_id: 0, nombre: '', descripcion: '', codigo_corto: '', precio: 0, costo: 0,
  iva_alicuota: 21, visible_qr: true, va_a_cocina: true, apto_celiaco: false, apto_vegetariano: false,
  apto_vegano: false, horario_desde: '', horario_hasta: '', orden: 0, activo: true,
};

/** Normaliza un producto de la API al formato del formulario. */
const aFormulario = (p) => ({
  ...VACIO, ...p,
  descripcion: p.descripcion ?? '',
  codigo_corto: p.codigo_corto ?? '',
  horario_desde: p.horario_desde ?? '',
  horario_hasta: p.horario_hasta ?? '',
  visible_qr: Boolean(p.visible_qr),
  va_a_cocina: Boolean(p.va_a_cocina),
  apto_celiaco: Boolean(p.apto_celiaco),
  apto_vegetariano: Boolean(p.apto_vegetariano),
  apto_vegano: Boolean(p.apto_vegano),
  activo: true,
});

export default function CartaAdmin() {
  const toast = useToast();
  const { datos: carta, cargando, recargar } = useDatos('/carta', ['carta:cambio']);
  const [editando, setEditando] = useState(null);
  const [gruposDe, setGruposDe] = useState(null);
  const [elegidos, setElegidos] = useState([]);

  const categorias = carta?.categorias ?? [];
  const grupos = carta?.grupos ?? [];

  const guardar = async () => {
    const cuerpo = {
      ...editando,
      descripcion: editando.descripcion || null,
      codigo_corto: editando.codigo_corto || null,
      horario_desde: editando.horario_desde || null,
      horario_hasta: editando.horario_hasta || null,
    };
    try {
      if (editando.id) await api.put(`/carta/productos/${editando.id}`, cuerpo);
      else await api.post('/carta/productos', cuerpo);
      toast.ok('Producto guardado');
      setEditando(null);
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const agotar = async (p) => {
    try {
      await api.post(`/carta/producto/${p.id}/agotado`, { agotado: p.disponible, alcance: 'hoy' });
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const vincular = async () => {
    try {
      await api.post(`/carta/productos/${gruposDe.id}/grupos`, { grupo_ids: elegidos });
      toast.ok('Modificadores actualizados');
      setGruposDe(null);
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (cargando) return <EsqueletoLista filas={6} />;

  return (
    <div className="pila">
      <div className="fila-sep envolver">
        <div>
          <h2>Carta</h2>
          <p className="t13 tenue" style={{ maxWidth: '58ch' }}>
            Los grupos de modificadores se enganchan por referencia: cambiás “Punto de carne”
            una vez y cambia en todos los cortes.
          </p>
        </div>
        <button
          className="btn btn-primario btn-grande"
          onClick={() => setEditando({ ...VACIO, categoria_id: categorias[0]?.id ?? 0 })}
        >
          <Plus size={18} weight="bold" /> Nuevo producto
        </button>
      </div>

      {categorias.map((c) => (
        <section className="panel" key={c.id}>
          <header>
            <span className="rotulo">{c.nombre}</span>
            <span className="eti eti-neutra">{c.productos.length}</span>
          </header>
          <div className="cuerpo pila-2">
            {c.productos.map((p) => (
              <div className="tarjeta fila envolver" key={p.id}>
                <div className="crece">
                  <div className="medio">
                    {p.codigo_corto ? <span className="mono tenue-3">{p.codigo_corto} </span> : null}
                    {p.nombre}
                    {!p.disponible ? (
                      <span className="eti eti-roja" style={{ marginLeft: 8 }}>agotado</span>
                    ) : null}
                  </div>
                  <div className="t12 tenue-3">
                    {plata(p.precio)}
                    {p.variantes.length ? ` · ${p.variantes.length} variantes` : ''}
                    {p.grupos.length ? ` · ${p.grupos.length} grupos` : ''}
                    {p.horario_desde ? ` · ${p.horario_desde.slice(0, 5)}–${p.horario_hasta.slice(0, 5)}` : ''}
                  </div>
                </div>
                <button className="btn btn-chico" onClick={() => agotar(p)}>
                  {p.disponible ? 'Agotar hoy' : 'Reponer'}
                </button>
                <button
                  className="btn btn-chico"
                  onClick={() => { setGruposDe(p); setElegidos(p.grupos ?? []); }}
                >
                  Modificadores
                </button>
                <button className="btn btn-chico" onClick={() => setEditando(aFormulario(p))}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {editando ? (
        <ModalProducto
          producto={editando}
          categorias={categorias}
          onCambiar={setEditando}
          onGuardar={guardar}
          onCerrar={() => setEditando(null)}
        />
      ) : null}

      {gruposDe ? (
        <ModalGrupos
          producto={gruposDe}
          grupos={grupos}
          elegidos={elegidos}
          onCambiar={setElegidos}
          onGuardar={vincular}
          onCerrar={() => setGruposDe(null)}
        />
      ) : null}
    </div>
  );
}
