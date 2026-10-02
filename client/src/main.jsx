import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ProveedorSesion } from './lib/sesion.jsx';
import { ProveedorToast } from './componentes/Toast.jsx';

// Fuentes empaquetadas: el local no depende de internet para verse bien.
import '@fontsource-variable/epilogue';
import '@fontsource-variable/plus-jakarta-sans';

import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/marca.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorToast>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </ProveedorToast>
    </BrowserRouter>
  </StrictMode>
);
