import { useEffect, useState } from 'react';
import { CaretLeft, ChefHat, Receipt, ShieldCheck, User } from '@phosphor-icons/react';
import { api } from '../lib/api.js';
import { useSesion } from '../lib/sesion.jsx';
import { useToast } from '../componentes/Toast.jsx';
import PinPad from '../componentes/PinPad.jsx';
import Marca from '../componentes/Marca.jsx';
import { Bloque } from '../componentes/Esqueleto.jsx';
import './login.css';

const ROL = {
  mozo: { texto: 'Mozo', Icono: User },
  cocina: { texto: 'Cocina', Icono: ChefHat },
  caja: { texto: 'Caja', Icono: Receipt },
  encargado: { texto: 'Encargado', Icono: ShieldCheck },
};

export default function Login() {
  const { entrar } = useSesion();
  const toast = useToast();
  const [modo, setModo] = useState('pin');
  const [usuarios, setUsuarios] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  // null mientras no sabemos; el cartel de abajo no puede afirmar nada antes.
  const [conectado, setConectado] = useState(null);

  useEffect(() => {
    api
      .get('/auth/usuarios-pin')
      .then((u) => {
        setUsuarios(u);
        setConectado(true);
      })
      .catch(() => {
        setUsuarios([]);
        setConectado(false);
      });
  }, []);

  const entrarConPin = async (pinFinal = pin) => {
    if (!elegido || pinFinal.length < 4 || enviando) return;
    setEnviando(true);
    try {
      entrar(await api.post('/auth/pin', { usuario_id: elegido.id, pin: pinFinal }));
    } catch (e) {
      toast.error(e.message);
      setPin('');
    } finally {
      setEnviando(false);
    }
  };

  const entrarConPassword = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      entrar(await api.post('/auth/login', { email, password }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      {/* Panel editorial: sólo escritorio, donde entran caja y encargado */}
      <aside className="login-editorial">
        <Marca tamano={40} subtitulo="Gestión gastronómica" />
        <p className="login-lema">
          El sistema del local.
          <br />
          <span>Anda aunque se corte internet.</span>
        </p>
        <p className="login-version">
          El núcleo corre en el local, no en la nube. Si se cae la conexión,
          el salón sigue tomando pedidos y la caja sigue cobrando.
        </p>
      </aside>

      <main className="login-panel">
      <div className="login-caja">
        <div className="login-titulo">
          <h1>Entrar al sistema</h1>
          <p>Elegí cómo entrás según tu puesto.</p>
        </div>

        <div className="tabs" role="tablist">
          <button
            className="tab crece" role="tab" aria-selected={modo === 'pin'}
            onClick={() => setModo('pin')}
          >
            Salón y cocina
          </button>
          <button
            className="tab crece" role="tab" aria-selected={modo === 'password'}
            onClick={() => setModo('password')}
          >
            Caja y encargado
          </button>
        </div>

        {modo === 'pin' ? (
          elegido ? (
            <div className="pila">
              <button className="btn btn-plano btn-chico" onClick={() => { setElegido(null); setPin(''); }}>
                <CaretLeft size={15} /> {elegido.nombre}
              </button>
              <PinPad
                valor={pin}
                alCambiar={(v) => {
                  setPin(v);
                  if (v.length === 4) entrarConPin(v);
                }}
                alConfirmar={() => entrarConPin()}
                deshabilitado={enviando}
              />
            </div>
          ) : (
            <div className="login-usuarios">
              {usuarios === null
                ? Array.from({ length: 5 }, (_, i) => <Bloque key={i} alto={58} radio="var(--r2)" />)
                : usuarios.map((u) => {
                    const { texto, Icono } = ROL[u.rol] ?? ROL.mozo;
                    return (
                      <button key={u.id} className="btn login-usuario" onClick={() => setElegido(u)}>
                        <span className="login-avatar"><Icono size={18} weight="bold" /></span>
                        <span className="crece" style={{ textAlign: 'left' }}>
                          <span className="login-nombre">{u.nombre}</span>
                          <span className="t12 tenue-3">{texto}</span>
                        </span>
                      </button>
                    );
                  })}
              {usuarios?.length === 0 ? (
                <p className="vacio t13">Todavía no hay usuarios con PIN cargados.</p>
              ) : null}
            </div>
          )
        ) : (
          <form className="pila" onSubmit={entrarConPassword}>
            <label className="campo">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </label>
            <label className="campo">
              <span>Contraseña</span>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
              />
            </label>
            <button className="btn btn-primario btn-grande btn-ancho" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        {conectado === null ? null : (
          <p className={`login-local${conectado ? '' : ' login-local-caido'}`} aria-live="polite">
            <span className="punto" aria-hidden="true" />
            {conectado
              ? 'Conectado al servidor del local'
              : 'No responde el servidor del local'}
          </p>
        )}
      </div>

      <p className="login-pie t12">
        El sistema corre en el local. Sin internet seguís tomando pedidos y cobrando.
      </p>
      </main>
    </div>
  );
}
