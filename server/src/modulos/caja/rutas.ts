import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middlewares/errores.js';
import { idParam, numeroQuery } from '../../utils/params.js';
import { autenticar, exigirCaja } from '../../middlewares/auth.js';
import * as turnos from './turnos.js';
import { documentoDeCuenta } from './documento.js';
import { cobrar, dividirEnPartes, pagosDelTurno } from './cobro.js';
import { comprobantesPendientes, driverActivo, emitirComprobante } from '../fiscal/servicio.js';
import { calcularImpuestos } from '../fiscal/calculo.js';
import { aPesos } from '../../utils/dinero.js';
import {
  abrirTurnoSchema, cerrarTurnoSchema, cobrarSchema, comprobanteSchema, movimientoSchema,
} from './esquemas.js';

const router = Router();
router.use(autenticar, exigirCaja);

const id = idParam;

// ---- Turno ----
router.get('/turno', asyncHandler(async (_req, res) =>
  res.json({ turno: await turnos.turnoAbierto(), driver_fiscal: driverActivo() })
));

router.post('/turno/abrir', asyncHandler(async (req, res) => {
  const { fondo_inicial } = abrirTurnoSchema.parse(req.body);
  res.status(201).json(await turnos.abrirTurno(fondo_inicial, req.usuario!));
}));

router.get('/turno/arqueo', asyncHandler(async (req, res) =>
  res.json(await turnos.arqueo(numeroQuery(req.query.turno_id, 'turno_id')))
));

router.post('/turno/cerrar', asyncHandler(async (req, res) => {
  const { total_declarado, nota } = cerrarTurnoSchema.parse(req.body);
  res.json(await turnos.cerrarTurno(total_declarado, nota ?? null, req.usuario!));
}));

// ---- Movimientos ----
router.get('/movimientos', asyncHandler(async (req, res) =>
  res.json(await turnos.movimientosDelTurno(numeroQuery(req.query.turno_id, 'turno_id')))
));

router.post('/movimientos', asyncHandler(async (req, res) => {
  const d = movimientoSchema.parse(req.body);
  res.status(201).json(await turnos.registrarMovimiento(d, req.usuario!));
}));

// ---- Cobro ----
router.post('/cuentas/:id/cobrar', asyncHandler(async (req, res) =>
  res.json(await cobrar(id(req.params.id), cobrarSchema.parse(req.body), req.usuario!))
));

router.get('/cuentas/:id/dividir', asyncHandler(async (req, res) => {
  const partes = Math.min(numeroQuery(req.query.partes, 'partes', 40) ?? 2, 40);
  res.json(await dividirEnPartes(id(req.params.id), partes));
}));

router.get('/pagos', asyncHandler(async (req, res) =>
  res.json(await pagosDelTurno(numeroQuery(req.query.turno_id, 'turno_id')))
));

// ---- Comprobantes ----
router.get('/cuentas/:id/impuestos', asyncHandler(async (req, res) => {
  const imp = await calcularImpuestos(id(req.params.id));
  res.json({
    neto: aPesos(imp.neto),
    iva: aPesos(imp.iva),
    total: aPesos(imp.total),
    por_alicuota: imp.por_alicuota.map((a) => ({
      alicuota: a.alicuota, base: aPesos(a.base), iva: aPesos(a.iva),
    })),
  });
}));

/** Todo junto para la pantalla de impresión: local, cuenta, pagos y fiscal. */
router.get('/cuentas/:id/documento', asyncHandler(async (req, res) =>
  res.json(await documentoDeCuenta(id(req.params.id)))
));

router.post('/cuentas/:id/comprobante', asyncHandler(async (req, res) =>
  res.status(201).json(await emitirComprobante(id(req.params.id), comprobanteSchema.parse(req.body), req.usuario!))
));

router.get('/comprobantes/pendientes', asyncHandler(async (_req, res) =>
  res.json(await comprobantesPendientes())
));

export default router;
