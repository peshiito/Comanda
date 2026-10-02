import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errores.js';
import { fechaQuery, idParam } from '../../utils/params.js';
import { autenticar, exigirEncargado, exigirSalon } from '../../middlewares/auth.js';
import { vistaSalon } from './estado.js';
import { prioridades } from './prioridades.js';
import { cambiarPrincipal, desunirMesa, unirMesas } from './mesas.js';
import { crearMesa, editarMesa, moverMesa } from './layout.js';
import { cambiarEstadoReserva, crearReserva, listarReservas } from './reservas.js';
import { estadoReservaSchema, mesaSchema, posicionSchema, reservaSchema, unirSchema , zonaSchema } from './esquemas.js';
import { crearZona, editarZona, moverZona, zonasActivas } from './zonas.js';

const router = Router();
router.use(autenticar);

const id = idParam;

router.get('/', asyncHandler(async (_req, res) => res.json(await vistaSalon())));

/** El mozo ve sus prioridades; caja y encargado ven todas. */
router.get(
  '/prioridades',
  asyncHandler(async (req, res) => {
    const soloMias = req.usuario!.rol === 'mozo';
    res.json(await prioridades(soloMias ? req.usuario!.id : undefined));
  })
);

router.get('/reservas', asyncHandler(async (req, res) =>
  res.json(await listarReservas(fechaQuery(req.query.desde, 'desde'), fechaQuery(req.query.hasta, 'hasta')))
));

// ---- Salón: el mozo también puede, unir mesas no toca plata ----
router.use(exigirSalon);

router.post('/mesas/:id/unir', asyncHandler(async (req, res) => {
  const { mesa_ids } = unirSchema.parse(req.body);
  res.json(await unirMesas(id(req.params.id), mesa_ids, req.usuario!));
}));

router.post('/mesas/:id/desunir', asyncHandler(async (req, res) =>
  res.json(await desunirMesa(id(req.params.id), req.usuario!))
));

router.post('/mesas/:id/principal', asyncHandler(async (req, res) =>
  res.json(await cambiarPrincipal(id(req.params.id), req.usuario!))
));

router.post('/reservas', asyncHandler(async (req, res) =>
  res.status(201).json(await crearReserva(reservaSchema.parse(req.body), req.usuario!))
));

router.post('/reservas/:id/estado', asyncHandler(async (req, res) => {
  const { estado } = estadoReservaSchema.parse(req.body);
  res.json(await cambiarEstadoReserva(id(req.params.id), estado, req.usuario!));
}));

// ---- Layout del salón: solo el encargado ----
router.post('/mesas', exigirEncargado, asyncHandler(async (req, res) =>
  res.status(201).json(await crearMesa(mesaSchema.parse(req.body), req.usuario!))
));

router.put('/mesas/:id', exigirEncargado, asyncHandler(async (req, res) =>
  res.json(await editarMesa(id(req.params.id), mesaSchema.parse(req.body), req.usuario!))
));

router.patch('/mesas/:id/posicion', exigirEncargado, asyncHandler(async (req, res) =>
  res.json(await moverMesa(id(req.params.id), posicionSchema.parse(req.body)))
));

// ---- Zonas del salón: barra, recepción, puertas. Sólo el encargado ----
router.post('/zonas', exigirEncargado, asyncHandler(async (req, res) =>
  res.status(201).json(await crearZona(zonaSchema.parse(req.body), req.usuario!))
));

router.put('/zonas/:id', exigirEncargado, asyncHandler(async (req, res) =>
  res.json(await editarZona(id(req.params.id), zonaSchema.parse(req.body), req.usuario!))
));

router.patch('/zonas/:id/posicion', exigirEncargado, asyncHandler(async (req, res) =>
  res.json(await moverZona(id(req.params.id), posicionSchema.parse(req.body)))
));

export default router;
