# Auditoría de Comanda — 1 de octubre de 2026

Revisión capa por capa del sistema completo, buscando vulnerabilidades y
errores. Son 14 hallazgos, todos arreglados. Los que se pueden probar desde
afuera quedaron con su caso en la suite de ataque, que pasó de 63 a 94, para
que no puedan volver sin que la suite lo cante. Dos no tienen test: el 14
(cómo se propaga un error de rollback) no se puede provocar sin tirar MySQL a
mitad de una transacción, y el 9 (el algoritmo del JWT) está establecido por
lectura de código — digo abajo por qué.

**Cómo se verificó cada cosa.** Lectura de código más sondas reales contra la
API en `localhost:4000`. Los que dicen "confirmado por sonda" se reprodujeron
contra el sistema corriendo antes de tocarlos. El navegador no se pudo usar:
el servidor MCP de Playwright no levantó en esta sesión (`CONNECT_TIMEOUT`),
así que la capa visual no está cubierta acá.

Suites: `prueba-flujo.sh` (23 pasos, el servicio de punta a punta) y
`ataque.sh` (94 casos, el pentest propio). Las dos en verde.

---

## Lo que importa más

Cuatro hallazgos justifican la revisión entera. Los cuatro son de la misma
familia: el sistema **decía** tener un control que en realidad no tenía.

### 1. Al empleado dado de baja le quedaban 12 horas de poder cobrar

**Dónde:** `server/src/middlewares/auth.ts`, y `server/src/sockets/index.ts`.

`activo` se chequeaba sólo al iniciar sesión. El JWT dura 12 horas y no se
podía revocar, así que el que echabas a las 21:00 seguía cobrando, aplicando
descuentos y mandando a cocina hasta las 9:00 del día siguiente — con sólo no
cerrar la pestaña.

Lo peor es que la pantalla de Empleados decía textualmente *"Si lo apagás deja
de poder entrar, pero su historial queda intacto"*. Era mentira a medias: no
podía volver a **entrar**, pero no dejaba de **operar**.

**Arreglo:** `server/src/servicios/sesiones.ts` revisa `activo` en cada pedido,
con una caché de 30 segundos para no sumarle una consulta a cada request del
salón. Al desactivar o cambiar credenciales se invalida la entrada a mano, así
que desde la pantalla el corte es inmediato. En el socket, que se autenticaba
una sola vez y después vivía horas, hay un barrido cada 30 segundos que avisa
(`sesion:cerrada`) y desconecta.

**Verificado:** casos 17 y 20 de `ataque.sh`, más una prueba con socket real:
el mozo conectado recibe el aviso y se cae en menos de 30 segundos.

### 2. Bajarle el rango a alguien no le quitaba nada por 12 horas

**Dónde:** `server/src/middlewares/auth.ts`, `server/src/sockets/index.ts`.

El hermano del anterior, y lo encontré arreglando ese. `exigirRol` leía el rol
de `req.usuario`, que venía **firmado dentro del token**. El rol se edita en la
misma pantalla que `activo`, así que pasaba lo mismo: degradabas de encargado a
mozo al que estabas vigilando justamente por los descuentos, y seguía entrando
a reportes, a auditoría y a Empleados hasta que venciera el token.

En el socket era peor todavía, porque las salas se eligen al conectar: al
degradado le seguían llegando los eventos de caja aunque ya fuera mozo.

**Arreglo:** `estadoDeSesion()` devuelve el rol de la base y `autenticar` lo
usa en lugar del que venía en el token (`req.usuario = { ...usuario, rol }`).
El barrido de sockets compara el rol y, si cambió, corta para que las salas se
rearmen al reconectar; el cliente recibe `sesion:rol`, vuelve a leer
`/auth/yo` y actualiza qué pantallas muestra.

**Verificado:** caso 21 de `ataque.sh`: la mozo no entra a reportes; la asciendo
y **con el mismo token** ya entra; la degrado y con el mismo token ya no.

### 3. El reporte del día marcaba cero justo cuando cerrás el turno

**Dónde:** `server/src/modulos/reportes/ventas.ts` y `client/src/lib/formato.js`.

Este no es de seguridad, es peor: el sistema mentía los números. `rango()`
calculaba "hoy" con `new Date().toISOString()`, que da la fecha **en UTC**.
En Argentina (UTC-3), a partir de las 21:00 esa fecha ya es la de mañana,
mientras MySQL guarda `cerrada_at` en hora local. El reporte quedaba
preguntando por mañana:

```
DATE(cerrada_at) BETWEEN '2026-10-02' AND '2026-10-02'   -- ninguna fila
cerrada_at real:  2026-10-01 22:39                        -- la venta de hoy
```

O sea: **de 21:00 a medianoche, todas las noches, el resumen del día daba
cero.** Justo la franja en la que el encargado cierra la caja y mira cuánto
vendió. El arqueo del turno sí daba bien (no usa fechas), con lo cual las dos
pantallas se contradecían.

Lo encontré porque la suite lo imprimía desde hace rato —
`tickets 0 | venta 0.00` al lado de un arqueo de $53.400 — pero el paso no
afirmaba nada, así que pasaba en verde.

**Arreglo:** `server/src/utils/fechas.ts` con `hoyLocal()`, que lee los
componentes locales; y `fechaLocal()` del lado del cliente, para los filtros y
los atajos de rango de Reportes. El servidor corre en el mini PC del local, así
que su hora local es la del restaurante.

**Verificado:** caso 18 de `ataque.sh`, y el paso 21 de `prueba-flujo.sh` ahora
**afirma** que el reporte ve las ventas de hoy en vez de sólo imprimirlas.

### 4. El `.env` con el `JWT_SECRET` se iba al primer repositorio

**Dónde:** `.gitignore`, `server/.env`, `server/src/config/env.ts`.

El proyecto todavía no es un repositorio git, así que no hubo filtración. Pero
no había `.gitignore` que cubriera `.env`, y el `JWT_SECRET` era un valor de
relleno: el primer `git init` del portafolio se llevaba el secreto con el que
se firman todas las sesiones, y las contraseñas de la base.

**Arreglo:** `.gitignore` cubre `.env`, `server/.env`, `client/.env` y
`server/uploads/`; el secreto es uno aleatorio de 64 caracteres;
`server/.env.example` queda como plantilla; y `env.ts` se niega a arrancar en
producción si el secreto sigue siendo el de relleno.

---

## Los otros diez (del 5 al 14)

### 5. Basura en el `?query=` devolvía 500 con el mensaje de MySQL

Confirmado por sonda. Cuatro endpoints:

```
/admin/auditoria?limite=abc        → 500 {"detalle":"Undeclared variable: NaN"}
/admin/auditoria?desde=xx&hasta=yy → 500 {"detalle":"Incorrect DATE value: 'xx'"}
/caja/movimientos?turno_id=abc     → 500 {"detalle":"Unknown column 'NaN' in 'where clause'"}
/caja/pagos?turno_id=abc           → 500 {"detalle":"Unknown column 'NaN' in 'where clause'"}
```

No era inyección: `Number()` ya impedía meter SQL. Eran dos cosas. Una, que
`Number('abc')` da `NaN` y ese `NaN` viajaba hasta la consulta — y en
auditoría, hasta un `LIMIT ${limite}` interpolado. La otra, que
`?limite=1&limite=2` hace que Express entregue un **array**, así que el
`as string` de las rutas era mentira. Y el 500 le devolvía al cliente el
mensaje interno del motor, que es justo lo que no querés regalar: te dice qué
base usás y cómo se llaman las columnas.

`utils/params.ts` ya había resuelto exactamente esto para los parámetros de la
URL (`idParam`), pero nunca se había extendido al query.

**Arreglo:** `numeroQuery`, `fechaQuery` y `textoQuery` en `utils/params.ts`,
usados en los 17 lugares que leen `req.query`: no quedó ninguno crudo. `fechaQuery` además verifica que
la fecha exista en el calendario: `2026-02-31` pasa cualquier regex y la rechaza
MySQL con un 500.

**Verificado:** caso 16 de `ataque.sh`, 12 sondas, todas 400 y ninguna con el
mensaje del motor.

### 6. Al borrador ya pasado a caja le podía borrar líneas cualquiera

**Dónde:** `server/src/modulos/borradores/servicio.ts`.

`verificarDuenio` sólo mira el dueño **mientras el borrador es privado**. Eso
está bien para el borrador privado, pero `agregarItem` tenía además un chequeo
de estado y `quitarItem` y `editarNota` no. Resultado: una vez que el mozo
pasaba el pedido a caja, cualquiera del salón podía borrarle una línea o
reescribirle la nota — y eso no se audita en ninguna parte, porque el borrador
no es una cuenta todavía.

Es justo el control que vende el sistema: esa línea ya es plata esperando a que
caja la cargue.

**Arreglo:** una sola puerta, `verificarEditable`, que exige las dos cosas —
ser el dueño y que siga siendo privado. Pasado el borrador se corrige sobre la
cuenta, que sí queda auditada. Nada del cliente editaba un borrador pasado, así
que no se rompe ningún flujo.

**Verificado:** caso 19 de `ataque.sh`, seis sondas.

### 7. Cualquiera en la red del local escuchaba los sockets

**Dónde:** `server/src/sockets/index.ts`.

La sala `publico` existía para la carta que se escaneaba con QR. La carta pasó
a papel y la carta digital se borró, pero la sala quedó: un socket **sin token**
entraba igual, y ahí se emitía `caja:turno` con el id del turno. Cualquiera
conectado al WiFi del local se enteraba de que se abrió la caja sin presentar
nada.

**Arreglo:** sin token no se entra (`io.use`), la sala `publico` ya no existe y
se la saqué a los tres emisores que la usaban. Del lado del cliente,
`connect_error` con un motivo de autenticación tira el token y cae al login, en
vez de reintentar para siempre mostrando datos viejos — que en la pantalla de
cocina son comandas y en la de caja, plata.

**Verificado:** caso 20 de `ataque.sh`: sin token → `no_autenticado`, token
basura → `sesion_invalida`, token válido → conecta.

### 8. El doble toque en "cobrar" devolvía un 409 que se leía como error

**Dónde:** `server/src/modulos/caja/cobro.ts`.

La idempotencia funcionaba — el `UNIQUE` sobre `idempotency_key` impedía el
doble cobro, y eso ya lo probaba el caso 9. Pero el chequeo previo
(`yaAplicado`) corre **fuera** de la transacción: si los dos pedidos entran en
el mismo instante, los dos lo pasan y el segundo choca con el índice. La plata
quedaba bien, la transacción se deshacía entera; lo que estaba mal era la
respuesta. El cliente recibía `409 "Ese registro ya existe"`, que en la pantalla
de caja se lee como si el cobro hubiera fallado — y lo que hace quien ve eso es
cobrar otra vez.

**Arreglo:** el `ER_DUP_ENTRY` sobre `idempotency_key` devuelve la misma
respuesta que cualquier repetición (`repetido: true` con el estado actual de la
cuenta). De paso el cobro quedó partido en `yaEstaba` y `aplicarCobro`, que se
lee mejor.

**Verificado:** el caso 9 de `ataque.sh` ahora manda los dos cobros **a la vez**
y no sólo uno después del otro, comprueba que la clave repetida nunca conteste
409 y mide el delta de `pagado` para confirmar que se cobró una sola vez. Antes
comparaba contra el total absoluto, así que correr la suite dos veces sin
resembrar hacía fallar un caso que estaba bien.

### 9. `jwt.verify` aceptaba cualquier algoritmo

**Dónde:** `server/src/middlewares/auth.ts`.

Sin la opción `algorithms`, `jsonwebtoken` acepta cualquiera de los que
soporta, que es donde vive la familia de ataques de confusión de algoritmo. Acá
no hay claves asimétricas, así que el riesgo concreto es bajo, pero no hay
razón para dejarlo abierto.

**Arreglo:** `HS256` fijado explícitamente de los dos lados, al firmar y al
verificar.

Nota honesta: este quedó establecido por lectura de código. El comando con el
que iba a forjar un token para probarlo fue interrumpido por un clasificador de
seguridad y no lo reintenté.

### 10. La suite de ataque reportaba 60 fallas falsas

**Dónde:** `ataque.sh`.

El caso 13 fuerza PIN a propósito y quema la ventana del limitador (20 intentos
cada 10 minutos). Si corrés la suite dos veces seguidas, el login devuelve 429,
`jget` reventaba con un `KeyError` y todos los tokens salían vacíos — así que
los 60 casos siguientes daban 401 y se leían como **60 fallas de seguridad**.
Una suite que miente así es peor que no tenerla.

**Arreglo:** `jget` e `id_de` toleran un cuerpo de error; una guarda al inicio
aborta con el motivo real ("esperá diez minutos"); y
`SIN_FUERZA_BRUTA=1 bash ataque.sh` saltea el caso 13 para poder iterar sobre
el resto.

### 11. El paso de reportes pasaba en verde sin verificar nada

**Dónde:** `prueba-flujo.sh`, paso 21.

Imprimía los números pero no afirmaba nada, que es cómo el hallazgo 3 se quedó
escondido ahí a la vista. Ahora afirma que el reporte del día ve las ventas que
se acababan de cobrar, y el mensaje de error muestra el rango que usó.

### 12. `carta:cambio` y `caja:turno` salían a una sala que ya no existía

Colateral de borrar la carta QR: tres emisores seguían mandando a `publico`.
Limpiado junto con el hallazgo 7.

---

### 13. El cobro existía un instante sin su rastro en la bitácora

**Dónde:** `server/src/modulos/caja/cobro.ts`.

La auditoría del cobro corría **después** del commit. La ventana es de
milisegundos, pero si el proceso se cae ahí —o falla la conexión justo
entonces— queda un cobro hecho sin ningún registro de quién lo hizo. En un
sistema que se vende por el control, ese es precisamente el registro que no
puede faltar.

**Arreglo:** el `INSERT` en `auditoria` va dentro de la misma transacción que
los pagos, pasándole la conexión (`auditar(entrada, conn)`, que ya lo
soportaba). `auditar` sigue sin lanzar: una falla de bitácora no tumba una
venta, que es la decisión correcta para un local que tiene que poder cobrar.

**Verificado:** `prueba-flujo.sh` cobra y después lee
`/admin/auditoria?accion=cuenta_cobrada`; la entrada está, con medios, monto,
propina y turno.

### 14. Si el rollback fallaba, tapaba el error que lo causó

**Dónde:** `server/src/db/pool.ts`.

`transaccion()` hacía `await conn.rollback()` dentro del `catch` y después
relanzaba. Si la conexión se cayó —que es un motivo bastante común para que la
transacción falle en primer lugar—, el `rollback` lanza su propio error, y ese
es el que se propaga: la causa real se pierde. Depurar un cobro fallido con el
error equivocado en el log es perder la tarde.

**Arreglo:** el `rollback` va en su propio `try`, se loguea aparte, y el error
original se relanza siempre.

## Lo que revisé y está bien

Que algo no tenga hallazgo también es información:

- **SQL.** Todas las consultas van con marcadores. Los `${}` que aparecen en
  los templates son generadores de marcadores (`items.map(() => '?')`) o
  fragmentos constantes — ningún dato del usuario se concatena. El único valor
  interpolado es el `LIMIT` de auditoría, que ahora es un entero validado y
  acotado a 500.
- **Subida de archivos.** No existe el endpoint. Las fotos entran sólo por el
  script offline `db:fotos`, y el campo `foto` no está en el esquema del ABM de
  productos, así que no se puede setear desde la API. `/fotos` sirve estático
  con `index: false`, sin listado de directorio.
- **Autorización vertical.** Los 9 módulos de la API tienen guardia de rol a
  nivel de router. Las únicas rutas sin autenticar son las tres que tienen que
  estarlo: `/auth/login`, `/auth/pin` y `/auth/usuarios-pin`. Casos 1 a 8 de
  `ataque.sh`: el mozo no toca la plata, cocina no cobra, caja no crea
  empleados.
- **Dinero.** Centavos enteros, `DECIMAL(12,2)`, snapshots de precio y nombre,
  bloqueo optimista por `version` más `SELECT … FOR UPDATE`. El arqueo sólo
  mueve el cajón con los movimientos en efectivo. `decimalNumbers` queda en
  `false` a propósito: los `DECIMAL` llegan como string y se convierten a
  centavos, así no hay coma flotante en el medio.
- **Transacciones.** `transaccion()` hace rollback ante cualquier error y
  libera la conexión en el `finally`, también cuando el rollback falla.
- **Campos de más.** Casos 10 y 11: no se puede abrir una cuenta ya cerrada ni
  ya pagada, y el `id` que mandés en el cuerpo no pisa a otro usuario.
- **Fugas.** La API nunca devuelve hashes, ni en `/admin/usuarios` ni en la
  lista de PIN; los errores no traen SQL ni stack. El 500 con el mensaje de
  MySQL del hallazgo 5 era la excepción, y ya no está.
- **Cabeceras y CORS.** Helmet puesto, `x-powered-by` apagado, CORS con lista
  de orígenes en vez de `*`.

Una decisión que dejo marcada, no es un hallazgo: **`/auth/usuarios-pin` es
público y lista los nombres del personal**. Hace falta para la pantalla de PIN,
y no expone hashes. Para un sistema en la red del local me parece bien; si algún
día esto sale a internet, hay que repensarlo.

---

## Lo que queda fuera de esta auditoría

- **La capa visual.** El MCP de Playwright no conectó (`CONNECT_TIMEOUT`), así
  que no hubo verificación en navegador: foco, teclado, lectores de pantalla,
  contraste real sobre las pantallas armadas. Pendiente para cuando levante.
- **Lo fiscal de verdad.** Los comprobantes tienen el formato legal argentino,
  pero el CAE es simulado: no hay homologación con ARCA. Eso es trámite, no
  código.
- **HTTPS.** El sistema corre en LAN sobre HTTP. Para el mini PC del local es
  razonable; vale saberlo.
