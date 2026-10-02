import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errores.js';
import { idParam, numeroQuery, textoQuery } from '../../utils/params.js';
import { autenticar, exigirEncargado, exigirRol } from '../../middlewares/auth.js';
import * as lectura from './lectura.js';
import * as abm from './abm.js';
import * as mods from './mods.js';
import * as disp from './disponibilidad.js';
import {
  agotadoSchema, categoriaSchema, grupoSchema, opcionSchema,
  productoSchema, stockSchema, varianteSchema, vincularSchema,
} from './esquemas.js';

const router = Router();
router.use(autenticar);

const id = idParam;

// ---- Lectura: la usan caja, mozo y cocina ----
router.get('/', asyncHandler(async (_req, res) => res.json(await lectura.cartaCompleta())));
router.get('/favoritos', asyncHandler(async (req, res) =>
  res.json(await lectura.favoritos(numeroQuery(req.query.limite, 'limite', 60) ?? 16))
));
router.get('/buscar', asyncHandler(async (req, res) =>
  res.json(await lectura.buscar(textoQuery(req.query.q, 'q', 80) ?? ''))
));
router.get('/grupos', asyncHandler(async (_req, res) => res.json(await lectura.gruposModificadores())));
router.get('/producto/:id', asyncHandler(async (req, res) =>
  res.json(await lectura.obtenerProducto(id(req.params.id)))
));

// ---- Agotado: también la cocina, que es la que se queda sin bifes ----
router.post(
  '/producto/:id/agotado',
  exigirRol('cocina', 'caja', 'encargado'),
  asyncHandler(async (req, res) => {
    const { agotado, alcance } = agotadoSchema.parse(req.body);
    res.json(await disp.marcarAgotado(id(req.params.id), agotado, alcance, req.usuario!));
  })
);

router.post(
  '/producto/:id/stock',
  exigirRol('cocina', 'caja', 'encargado'),
  asyncHandler(async (req, res) => {
    const { stock_restante } = stockSchema.parse(req.body);
    res.json(await disp.definirStock(id(req.params.id), stock_restante, req.usuario!));
  })
);

// ---- ABM: solo el encargado toca la carta y los precios ----
router.use(exigirEncargado);

router.post('/categorias', asyncHandler(async (req, res) =>
  res.status(201).json(await abm.crearCategoria(categoriaSchema.parse(req.body), req.usuario!))
));
router.put('/categorias/:id', asyncHandler(async (req, res) =>
  res.json(await abm.editarCategoria(id(req.params.id), categoriaSchema.parse(req.body), req.usuario!))
));

router.post('/productos', asyncHandler(async (req, res) =>
  res.status(201).json(await abm.crearProducto(productoSchema.parse(req.body), req.usuario!))
));
router.put('/productos/:id', asyncHandler(async (req, res) =>
  res.json(await abm.editarProducto(id(req.params.id), productoSchema.parse(req.body), req.usuario!))
));

router.post('/productos/:id/variantes', asyncHandler(async (req, res) =>
  res.status(201).json(await abm.crearVariante(id(req.params.id), varianteSchema.parse(req.body), req.usuario!))
));
router.put('/variantes/:id', asyncHandler(async (req, res) =>
  res.json(await abm.editarVariante(id(req.params.id), varianteSchema.parse(req.body), req.usuario!))
));

router.post('/productos/:id/grupos', asyncHandler(async (req, res) => {
  const { grupo_ids } = vincularSchema.parse(req.body);
  res.json(await mods.vincularGrupos(id(req.params.id), grupo_ids, req.usuario!));
}));

router.post('/grupos', asyncHandler(async (req, res) =>
  res.status(201).json(await mods.crearGrupo(grupoSchema.parse(req.body), req.usuario!))
));
router.put('/grupos/:id', asyncHandler(async (req, res) =>
  res.json(await mods.editarGrupo(id(req.params.id), grupoSchema.parse(req.body), req.usuario!))
));
router.post('/grupos/:id/opciones', asyncHandler(async (req, res) =>
  res.status(201).json(await mods.crearOpcion(id(req.params.id), opcionSchema.parse(req.body), req.usuario!))
));
router.put('/opciones/:id', asyncHandler(async (req, res) =>
  res.json(await mods.editarOpcion(id(req.params.id), opcionSchema.parse(req.body), req.usuario!))
));

export default router;
