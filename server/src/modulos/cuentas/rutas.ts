import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errores.js';
import { idParam } from '../../utils/params.js';
import { autenticar, exigirCaja, exigirSalon } from '../../middlewares/auth.js';
import { limitadorPin } from '../../middlewares/limites.js';
import { abrirCuenta, cuentasAbiertas, obtenerCuenta, pedirCuenta } from './servicio.js';
import { agregarItems, enviarACocina } from './items.js';
import { anularItem, devolverItem, moverItem } from './acciones-item.js';
import * as acc from './acciones-cuenta.js';
import {
  abrirCuentaSchema, agregarItemsSchema, anularSchema, asignarMozoSchema, comensalesSchema,
  descuentoSchema, devolverSchema, enviarSchema, fusionarSchema, moverItemSchema,
  moverSchema, perdidaSchema,
} from './esquemas.js';

const router = Router();
router.use(autenticar);

const id = idParam;

router.get('/', exigirCaja, asyncHandler(async (_req, res) => res.json(await cuentasAbiertas())));
router.get('/:id', asyncHandler(async (req, res) => res.json(await obtenerCuenta(id(req.params.id)))));

/** Abrir mesa: el mozo también, es del salón. */
router.post('/', exigirSalon, asyncHandler(async (req, res) =>
  res.status(201).json(await abrirCuenta(abrirCuentaSchema.parse(req.body), req.usuario!))
));

router.post('/:id/pedir-cuenta', exigirSalon, asyncHandler(async (req, res) =>
  res.json(await pedirCuenta(id(req.params.id), req.usuario!))
));

router.post('/:id/comensales', exigirSalon, asyncHandler(async (req, res) => {
  const { comensales } = comensalesSchema.parse(req.body);
  res.json(await acc.definirComensales(id(req.params.id), comensales, req.usuario!));
}));

router.post('/:id/mover', exigirSalon, asyncHandler(async (req, res) => {
  const { mesa_id } = moverSchema.parse(req.body);
  res.json(await acc.moverCuenta(id(req.params.id), mesa_id, req.usuario!));
}));

router.post('/:id/mozo', exigirSalon, asyncHandler(async (req, res) => {
  const { mozo_id } = asignarMozoSchema.parse(req.body);
  res.json(await acc.asignarMozo(id(req.params.id), mozo_id, req.usuario!));
}));

// ---- Cargar y mandar a cocina: solo caja y encargado ----
router.post('/:id/items', exigirCaja, asyncHandler(async (req, res) =>
  res.json(await agregarItems(id(req.params.id), agregarItemsSchema.parse(req.body), req.usuario!))
));

router.post('/:id/enviar', exigirCaja, asyncHandler(async (req, res) => {
  const datos = enviarSchema.parse(req.body);
  res.json(await enviarACocina(id(req.params.id), datos, req.usuario!));
}));

router.post('/:id/items/:itemId/anular', exigirCaja, limitadorPin, asyncHandler(async (req, res) =>
  res.json(await anularItem(id(req.params.id), id(req.params.itemId), anularSchema.parse(req.body), req.usuario!))
));

router.post('/:id/items/:itemId/devolver', exigirCaja, limitadorPin, asyncHandler(async (req, res) =>
  res.json(await devolverItem(id(req.params.id), id(req.params.itemId), devolverSchema.parse(req.body), req.usuario!))
));

router.post('/:id/items/:itemId/mover', exigirCaja, asyncHandler(async (req, res) => {
  const { cuenta_destino_id } = moverItemSchema.parse(req.body);
  res.json(await moverItem(id(req.params.id), id(req.params.itemId), cuenta_destino_id, req.usuario!));
}));

router.post('/:id/descuento', exigirCaja, limitadorPin, asyncHandler(async (req, res) =>
  res.json(await acc.aplicarDescuento(id(req.params.id), descuentoSchema.parse(req.body), req.usuario!))
));

router.post('/:id/fusionar', exigirCaja, asyncHandler(async (req, res) => {
  const { destino_id } = fusionarSchema.parse(req.body);
  res.json(await acc.fusionarCuentas(id(req.params.id), destino_id, req.usuario!));
}));

router.post('/:id/perdida', exigirCaja, limitadorPin, asyncHandler(async (req, res) =>
  res.json(await acc.marcarPerdida(id(req.params.id), perdidaSchema.parse(req.body), req.usuario!))
));

export default router;
