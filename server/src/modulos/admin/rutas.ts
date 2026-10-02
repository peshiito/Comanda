import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middlewares/errores.js';
import { fechaQuery, idParam, numeroQuery, textoQuery } from '../../utils/params.js';
import { autenticar, exigirCaja, exigirEncargado } from '../../middlewares/auth.js';
import { CONFIG_DEFECTO, guardarConfig, leerConfig } from '../../servicios/config.js';
import { auditar } from '../../servicios/auditoria.js';
import {
  cambiarCredenciales, credencialesSchema, crearUsuario, editarUsuario,
  listarUsuarios, mozosActivos, usuarioSchema,
} from './usuarios.js';
import { accionesDisponibles, consultarAuditoria, resumenSensible } from './auditoria-consulta.js';
import { rango } from '../reportes/ventas.js';

const router = Router();
router.use(autenticar);

const id = idParam;

const configSchema = z.record(z.string(), z.string().max(255));

/** La lista de mozos la necesita cualquiera que asigne una mesa. */
router.get('/mozos', asyncHandler(async (_req, res) => res.json(await mozosActivos())));

// ---- Auditoría: caja y encargado ----
router.get(
  '/auditoria',
  exigirCaja,
  asyncHandler(async (req, res) => {
    res.json(
      await consultarAuditoria({
        desde: fechaQuery(req.query.desde, 'desde'),
        hasta: fechaQuery(req.query.hasta, 'hasta'),
        accion: textoQuery(req.query.accion, 'accion', 60),
        actor_id: numeroQuery(req.query.actor_id, 'actor_id'),
        entidad: textoQuery(req.query.entidad, 'entidad', 60),
        entidad_id: numeroQuery(req.query.entidad_id, 'entidad_id'),
        limite: numeroQuery(req.query.limite, 'limite', 500),
      })
    );
  })
);

router.get(
  '/auditoria/resumen',
  exigirCaja,
  asyncHandler(async (req, res) => {
    const r = rango(fechaQuery(req.query.desde, 'desde'), fechaQuery(req.query.hasta, 'hasta'));
    res.json(await resumenSensible(r.desde, r.hasta));
  })
);

router.get('/auditoria/acciones', exigirCaja, asyncHandler(async (_req, res) =>
  res.json(await accionesDisponibles())
));

// ---- Configuración y empleados: solo el encargado ----
router.use(exigirEncargado);

router.get('/config', asyncHandler(async (_req, res) =>
  res.json({ valores: await leerConfig(), defecto: CONFIG_DEFECTO })
));

router.put(
  '/config',
  asyncHandler(async (req, res) => {
    const cambios = configSchema.parse(req.body);
    await guardarConfig(cambios);
    await auditar({
      actor: req.usuario!, accion: 'config_cambiada', entidad: 'config',
      datos: Object.keys(cambios),
    });
    res.json(await leerConfig());
  })
);

router.get('/usuarios', asyncHandler(async (_req, res) => res.json(await listarUsuarios())));

router.post('/usuarios', asyncHandler(async (req, res) =>
  res.status(201).json(await crearUsuario(usuarioSchema.parse(req.body), req.usuario!))
));

router.put('/usuarios/:id', asyncHandler(async (req, res) =>
  res.json(await editarUsuario(id(req.params.id), usuarioSchema.parse(req.body), req.usuario!))
));

router.post('/usuarios/:id/credenciales', asyncHandler(async (req, res) =>
  res.json(await cambiarCredenciales(id(req.params.id), credencialesSchema.parse(req.body), req.usuario!))
));

export default router;
