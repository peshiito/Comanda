import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errores.js';
import { fechaQuery, numeroQuery } from '../../utils/params.js';
import { autenticar, exigirCaja } from '../../middlewares/auth.js';
import * as v from './ventas.js';
import * as op from './operacion.js';

const router = Router();
// Caja y encargado ven reportes y auditoría por igual.
router.use(autenticar, exigirCaja);

const leerRango = (req: { query: Record<string, unknown> }) =>
  v.rango(fechaQuery(req.query.desde, 'desde'), fechaQuery(req.query.hasta, 'hasta'));

router.get('/resumen', asyncHandler(async (req, res) => res.json(await v.resumen(leerRango(req)))));
router.get('/por-dia', asyncHandler(async (req, res) => res.json(await v.porDia(leerRango(req)))));
router.get('/por-hora', asyncHandler(async (req, res) => res.json(await v.porHora(leerRango(req)))));
router.get('/por-producto', asyncHandler(async (req, res) =>
  res.json(await v.porProducto(leerRango(req), numeroQuery(req.query.limite, 'limite', 500) ?? 50))
));
router.get('/por-categoria', asyncHandler(async (req, res) =>
  res.json(await v.porCategoria(leerRango(req)))
));
router.get('/por-mozo', asyncHandler(async (req, res) => res.json(await v.porMozo(leerRango(req)))));

router.get('/tiempos', asyncHandler(async (req, res) => res.json(await op.tiempos(leerRango(req)))));
router.get('/cocina-por-hora', asyncHandler(async (req, res) =>
  res.json(await op.cocinaPorHora(leerRango(req)))
));
router.get('/perdidas', asyncHandler(async (req, res) => res.json(await op.perdidas(leerRango(req)))));
router.get('/notas-frecuentes', asyncHandler(async (req, res) =>
  res.json(await op.notasFrecuentes(leerRango(req)))
));
router.get('/turnos', asyncHandler(async (req, res) =>
  res.json(await op.turnosCerrados(leerRango(req)))
));

export default router;
