import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errores.js';
import { autenticar } from '../../middlewares/auth.js';
import { limitadorLogin } from '../../middlewares/limites.js';
import { loginSchema, pinSchema } from './esquemas.js';
import { loginPassword, loginPin, usuariosConPin } from './servicio.js';

const router = Router();

router.post(
  '/login',
  limitadorLogin,
  asyncHandler(async (req, res) => {
    res.json(await loginPassword(loginSchema.parse(req.body)));
  })
);

router.post(
  '/pin',
  limitadorLogin,
  asyncHandler(async (req, res) => {
    res.json(await loginPin(pinSchema.parse(req.body)));
  })
);

/** Lista de nombres para la pantalla de PIN del salón (red local). */
router.get(
  '/usuarios-pin',
  limitadorLogin,
  asyncHandler(async (_req, res) => {
    res.json(await usuariosConPin());
  })
);

router.get('/yo', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

export default router;
