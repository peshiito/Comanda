# Comanda

Sistema de gestión para restaurantes: salón, comandas a cocina en tiempo real,
caja con arqueo y facturación.

No es un sitio web con panel. Es la herramienta con la que el local trabaja
todos los días: si se cae, el local no puede cobrar. Eso manda todas las
decisiones técnicas del proyecto.

---

## Qué resuelve

| Quién | Dónde | Qué hace |
|---|---|---|
| **Mozo** | su propio celular | ve el salón ordenado por urgencia, marca mesas ocupadas, arma su libreta y se la pasa a caja |
| **Cocina** | una pantalla fija | recibe las comandas solas, con reloj y semáforo. Un botón: *Terminada* |
| **Caja** | escritorio con teclado | revisa lo del mozo, manda a cocina, cobra, factura, cierra el turno |
| **Encargado** | donde sea | reportes, auditoría, carta y precios, empleados, configuración |

---

## Las cuatro decisiones que definen el sistema

**1. El mozo no manda a cocina.** Arma una libreta privada, sin precios, y la
pasa a caja. Caja la revisa, corrige y es la única que dispara la comanda. El
pedido se escribe una sola vez —en la mesa, por quien lo escuchó— pero quien
decide qué entra a la cocina sigue siendo caja.

**2. La cocina tiene un solo botón.** El reloj, el semáforo de demora y los
tiempos los calcula el sistema. Al cocinero no se le pide ningún dato: lo único
extra que puede hacer es avisar que algo se agotó.

**3. La mesa es un contenedor de cuentas.** Puede tener varias abiertas a la vez:
el postre de después, los que llegaron más tarde, el que paga aparte. Por eso
*unir mesas* (el espacio) y *fusionar cuentas* (la plata) son operaciones
distintas, igual que *anular* (error de carga) y *devolver* (comida perdida).

**4. Nada se borra.** Una venta que no se cobró se cierra como pérdida con
motivo, autor y PIN del encargado. La bitácora es append-only. Ese registro es
lo que el dueño está comprando.

---

## Arquitectura

El núcleo corre **en el local**, no en la nube:

```
              ┌──────────────── Red del local ────────────────┐
 Celular mozo ┤                                               │
 Tablet cocina┤   Node + Express + Socket.IO   ·   MySQL 8    │
 PC de caja   ┤   Nginx sirviendo el frontend                 │
              └───────────────────┬───────────────────────────┘
                                  │ internet (opcional)
                             ARCA · backups       
```

Si se corta internet un viernes a las 21, el local sigue tomando pedidos,
mandando comandas y cobrando. Solo se degradan las funciones que dependen de
afuera, y esas se encolan.

**Backend** — Node + Express + TypeScript, MVC por módulos. JWT, Zod, Helmet,
rate limit, bcrypt. Socket.IO con salas por rol.
**Base** — MySQL 8 en Docker, corriendo en la hora del local (los reportes
agrupan por hora: en UTC la "hora pico" sale corrida).
**Frontend** — React + Vite, CSS propio con tokens. Fuentes e íconos
empaquetados: el local no depende de internet para verse bien.

---

## Levantarlo

Los secretos no están en el repo. Primero copiá las plantillas y poné tus
propias contraseñas:

```bash
cp .env.example .env               # Docker: usuario y clave de MySQL, puertos
cp server/.env.example server/.env # API: misma clave + JWT_SECRET
```

El `JWT_SECRET` lo generás con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Después:

```bash
DOCKER_CONTEXT=default docker compose up -d   # MySQL :3308 · phpMyAdmin :8082
cd server && npm install && npm run db:reset && npm run dev   # API :4000
cd client && npm install && npm run dev                       # Front :5173
```

`db:reset` rehace el esquema y siembra el local: 10 categorías, 94 productos
con 19 variantes, 11 grupos de modificadores, 18 mesas y 4 zonas.

**Y un solo usuario.** Arranca con el encargado que instala el sistema, y desde
Admin → Empleados él carga a su gente. Un sistema que se entrega con seis
cuentas de prueba adentro es un sistema con seis puertas que nadie cerró.

| Entra con | |
|---|---|
| `encargado@local.test` / `encargado1234` | PIN 1111 |

### Opcional: fotos y servicio simulado

Las fotos de la carta no van en el repo —son 15 MB y se vuelven a bajar solas—
así que la carta arranca sin imágenes:

```bash
cd server && npm run db:fotos   # 90 fotos de Wikimedia Commons, con licencia
```

Baja de internet, respeta un allowlist de licencias y deja la atribución de
cada una en `server/uploads/carta/CREDITOS.md`. Es lo único que necesita
conexión; el sistema funciona sin esto.

Para ver el local en pleno servicio —mesas en distintos estados, comandas con
demora, una devolución, ventas cerradas, una pérdida y el resto del personal:

```bash
cd server && npm run db:demo
```

Ahí sí aparecen caja (PIN 2222), los mozos (Diego 3333 · Carla 4444 ·
Nahuel 5555) y cocina (PIN 6666).

---

## Reglas del dominio

Estas no son detalles de implementación: son las que separan un POS de juguete
de uno que un contador puede auditar.

1. **La plata va en `DECIMAL(12,2)` y se calcula en centavos enteros.** Nunca
   floats de pesos. El total lo hace el servidor; lo que manda el cliente es
   intención.
2. **Precio congelado.** El ítem guarda nombre y precio del momento. Si mañana
   sube la milanesa, la cuenta de ayer no cambia.
3. **Concurrencia real.** `SELECT … FOR UPDATE` al tocar una cuenta, más
   `version` para detectar edición en paralelo.
4. **Cobro idempotente.** Cada pago lleva una clave única: dos toques al botón
   no cobran dos veces.
5. **Los pagos son varios registros** contra una cuenta, no un campo "forma de
   pago". Sin eso, el que se va antes de pagar rompe el arqueo.
6. **El PIN firma lo que duele**: anular algo que ya está en cocina, devolver,
   descontar, marcar una cuenta como no cobrada.
7. **No se cierra el turno con mesas sin cobrar.** Si se permite, el arqueo no
   cuadra nunca.
8. **El IVA se discrimina hacia atrás** por alícuota: los precios de la carta
   son finales.

---

## Facturación

Dos drivers detrás de la misma interfaz, elegidos con `FISCAL_DRIVER`:

- **`ticket`** (por defecto) — comprobante numerado no fiscal, sin huecos.
- **`arca`** — WSAA + WSFEv1. **Pendiente de credenciales**: necesita el
  certificado X.509 y el CUIT del local dados de alta en ARCA, más el punto de
  venta tipo Web Services. Nada de eso se puede generar desde el código: son
  datos del contribuyente. Mientras tanto la venta **se cierra igual** y el
  comprobante queda en cola — un problema en ARCA no puede dejar al local sin
  poder cobrar.

---

## Pruebas

Cada suite necesita su propio estado de base. Este orden las corre las dos en
una sola pasada:

```bash
cd server && npm run db:reset && cd ..
bash prueba-flujo.sh   # 23 pasos: el ciclo completo de una mesa

cd server && npm run db:demo && cd ..
bash ataque.sh         # 94 casos de seguridad contra la propia API
```

`ataque.sh` fuerza PIN a propósito, así que al terminar **el limitador de login
queda contando unos 10 minutos** y hasta que pase no se puede volver a entrar.
Es el limitador haciendo su trabajo, no un error: los tres scripts lo detectan y
lo dicen con todas las letras en vez de fallar raro. Para iterar sobre los otros
casos sin esperar:

```bash
SIN_FUERZA_BRUTA=1 bash ataque.sh
```

El primero recorre el ciclo real: el mozo abre la mesa, arma la libreta, la pasa
a caja, caja manda a cocina, cocina termina, el mozo apaga el aviso, se devuelve
un plato con reposición, se aplica un descuento con PIN, se cobra con pago mixto
y factura B, se verifica la idempotencia, se unen y fusionan mesas, se marca una
pérdida y se cierra el turno con diferencia.

El segundo prueba que el sistema se defienda, en 21 secciones: acceso sin
token, cruce de roles, IDOR entre borradores de mozos, JWT manipulado,
inyección SQL, manipulación de montos, doble cobro —incluida la carrera de los
dos pedidos a la vez—, campos de más, estados imposibles, fuerza bruta de PIN,
cabeceras, fugas de información, basura en los parámetros de consulta, y que
dar de baja o degradar a un empleado le corte la sesión en el acto.

Las últimas seis secciones salieron de la auditoría de octubre: están en
[AUDITORIA.md](AUDITORIA.md), con los 14 hallazgos, cómo se verificó cada uno y
qué quedó fuera.

---

## Estructura

```
server/src/
  config/        variables de entorno validadas con Zod
  db/            pool, esquema SQL, seed y simulación de servicio
  middlewares/   auth, roles, errores, límites de tasa
  modulos/       auth · carta · salon · borradores · cuentas ·
                 comandas · caja · fiscal · reportes · admin
  servicios/     auditoría, autorización por PIN, configuración,
                 vigencia de sesión contra la base
  sockets/       salas por rol, con token obligatorio
  utils/         dinero en centavos, errores, validación de parámetros,
                 fechas en la hora del local

client/src/
  estilos/       tokens y componentes (un archivo por familia)
  componentes/   marca, riel lateral, esqueletos, modal, toasts, selector
  lib/           api, socket, sesión, formato
  paginas/       mozo · cocina · caja · admin
```

---

## Sistema de diseño

Minimalismo culinario editorial sobre SaaS cálido. La jerarquía la arma el
color de fondo —una tarjeta blanca sobre el lienzo de tiza ya se lee como
elevada— y la sombra sólo la reafirma.

Los tokens viven en `client/src/estilos/tokens.css` en tres capas: primitivas
(valores crudos) → semánticas (propósito) → uso en componentes. **Ninguna hoja
de componente lleva un hex suelto**, salvo el blanco de los rellenos sólidos.

| | |
|---|---|
| Lienzo · tarjeta · borde | `#F6F6F4` · `#FFFFFF` · `#ECECE8` |
| Marca y acción | `#EA580C` (contenedor `#FEF0E8`) |
| Semáforo | verde `#16A34A` · ámbar `#F59E0B` · rojo `#E5484D` · azul `#3B82F6` |
| Tipografías | Epilogue (títulos) · Plus Jakarta Sans (cuerpo) |
| Radios | 10px en controles · 14px en contenedores · píldora en chips |
| Toque | 44px mínimo en todo lo que se toca |

Dos reglas que conviene no romper:

- **Cada color teñido tiene su variante `-texto` más oscura.** El texto de una
  píldora nunca usa el color del `-600`: sobre el contenedor claro da 1.8:1 y no
  se lee. Para eso están `--verde-texto`, `--amarillo-texto` y compañía.
- **`--tinta-4` es decorativo.** Da 2.6:1 sobre blanco. Sirve para separadores,
  placeholders y el número de una mesa libre; nunca para algo que haya que leer.

Las fuentes van **empaquetadas** con `@fontsource`, no desde Google Fonts: el
local trabaja sin internet y la tipografía no puede depender de la conexión.

---

## Fuera de alcance por ahora

Delivery, multi-local, app nativa, reservas online, stock con recetas,
integración con apps de pedidos. El take away sí está.
