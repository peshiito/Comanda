import { useState } from 'react';
import Modal from '../../componentes/Modal.jsx';
import { api } from '../../lib/api.js';
import { useDatos } from '../../lib/useDatos.js';
import { useToast } from '../../componentes/Toast.jsx';

const ROLES = { encargado: 'Encargado', caja: 'Caja', mozo: 'Mozo', cocina: 'Cocina' };
const VACIO = { nombre: '', email: '', rol: 'mozo', password: '', pin: '', activo: true };

export default function Usuarios() {
  const toast = useToast();
  const { datos: usuarios, recargar } = useDatos('/admin/usuarios');
  const [editando, setEditando] = useState(null);
  const [credenciales, setCredenciales] = useState(null);

  const guardar = async () => {
    const cuerpo = {
      nombre: editando.nombre,
      email: editando.email || null,
      rol: editando.rol,
      activo: editando.activo,
      ...(editando.id ? {} : { password: editando.password || null, pin: editando.pin || null }),
    };
    try {
      if (editando.id) await api.put(`/admin/usuarios/${editando.id}`, cuerpo);
      else await api.post('/admin/usuarios', cuerpo);
      toast.ok('Empleado guardado');
      setEditando(null);
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const guardarCredenciales = async () => {
    try {
      await api.post(`/admin/usuarios/${credenciales.id}/credenciales`, {
        password: credenciales.password || null,
        pin: credenciales.pin || null,
      });
      toast.ok('Credenciales actualizadas');
      setCredenciales(null);
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="pila">
      <div className="fila-sep">
        <p className="t13 tenue">
          Mozos y cocina entran con PIN desde su propio celular. Caja y encargado con email y contraseña.
        </p>
        <button className="btn btn-primario" onClick={() => setEditando({ ...VACIO })}>+ Empleado</button>
      </div>

      <section className="panel">
        <div className="cuerpo pila">
          {(usuarios ?? []).map((u) => (
            <div className="tarjeta fila-sep" key={u.id}>
              <div className="crece">
                <div className="medio">
                  {u.nombre}
                  {!u.activo ? <span className="eti eti-neutra" style={{ marginLeft: 8 }}>inactivo</span> : null}
                </div>
                <div className="t13 tenue">
                  {ROLES[u.rol]}
                  {u.email ? ` · ${u.email}` : ''}
                  {u.tiene_pin ? ' · PIN' : ''}
                  {u.tiene_password ? ' · contraseña' : ''}
                </div>
              </div>
              <button className="btn btn-chico" onClick={() => setCredenciales({ id: u.id, nombre: u.nombre, password: '', pin: '' })}>
                Credenciales
              </button>
              <button
                className="btn btn-chico"
                onClick={() => setEditando({ ...VACIO, ...u, email: u.email ?? '', activo: Boolean(u.activo) })}
              >
                Editar
              </button>
            </div>
          ))}
        </div>
      </section>

      {editando ? (
        <Modal
          titulo={editando.id ? 'Editar empleado' : 'Nuevo empleado'}
          alCerrar={() => setEditando(null)}
          pie={
            <>
              <button className="btn" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn-primario" onClick={guardar} disabled={editando.nombre.length < 2}>Guardar</button>
            </>
          }
        >
          <div className="pila">
            <label className="campo">
              <span>Nombre</span>
              <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
            </label>
            <label className="campo">
              <span>Rol</span>
              <select value={editando.rol} onChange={(e) => setEditando({ ...editando, rol: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Email {['caja', 'encargado'].includes(editando.rol) ? '(obligatorio)' : '(opcional)'}</span>
              <input type="email" value={editando.email} onChange={(e) => setEditando({ ...editando, email: e.target.value })} />
            </label>
            {!editando.id ? (
              <>
                <label className="campo">
                  <span>Contraseña (para caja y encargado)</span>
                  <input type="password" value={editando.password} onChange={(e) => setEditando({ ...editando, password: e.target.value })} />
                </label>
                <label className="campo">
                  <span>PIN de 4 a 6 dígitos</span>
                  <input className="mono" inputMode="numeric" maxLength={6} value={editando.pin}
                    onChange={(e) => setEditando({ ...editando, pin: e.target.value.replace(/\D/g, '') })} />
                </label>
              </>
            ) : null}
            <label className="casilla">
              <input
                type="checkbox"
                checked={editando.activo}
                onChange={(e) => setEditando({ ...editando, activo: e.target.checked })}
              />
              <span className="marca">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="crece">
                Activo
                <span className="campo-ayuda">
                  Si lo apagás deja de poder entrar, pero su historial queda intacto.
                </span>
              </span>
            </label>
          </div>
        </Modal>
      ) : null}

      {credenciales ? (
        <Modal
          titulo={`Credenciales de ${credenciales.nombre}`}
          alCerrar={() => setCredenciales(null)}
          pie={
            <>
              <button className="btn" onClick={() => setCredenciales(null)}>Cancelar</button>
              <button
                className="btn btn-primario"
                onClick={guardarCredenciales}
                disabled={!credenciales.password && !credenciales.pin}
              >
                Guardar
              </button>
            </>
          }
        >
          <div className="pila">
            <label className="campo">
              <span>Nueva contraseña</span>
              <input type="password" value={credenciales.password}
                onChange={(e) => setCredenciales({ ...credenciales, password: e.target.value })} />
            </label>
            <label className="campo">
              <span>Nuevo PIN</span>
              <input className="mono" inputMode="numeric" maxLength={6} value={credenciales.pin}
                onChange={(e) => setCredenciales({ ...credenciales, pin: e.target.value.replace(/\D/g, '') })} />
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
