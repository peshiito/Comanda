#!/usr/bin/env bash
# Pentest propio contra la API de Comanda (localhost, sistema del propio autor).
# Cada caso imprime PASA cuando el sistema se defiende como corresponde.
API=http://localhost:4000/api
ok=0; mal=0

py() { python3 -c "$1"; }
jget() { py "
import sys,json
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
try: print($1)
except Exception: pass"; }

check() { # check "nombre" "esperado" "obtenido"
  if [ "$2" = "$3" ]; then echo "  PASA  $1"; ok=$((ok+1));
  else echo "  FALLA $1  (esperaba $2, dio $3)"; mal=$((mal+1)); fi
}

codigo() { # codigo METODO RUTA TOKEN [JSON]
  if [ -n "${4:-}" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API$2" \
      ${3:+--oauth2-bearer "$3"} -H 'Content-Type: application/json' -d "$4"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API$2" \
      ${3:+--oauth2-bearer "$3"} -H 'Content-Type: application/json'
  fi
}

cuerpo() {
  if [ -n "${4:-}" ]; then
    curl -s -X "$1" "$API$2" ${3:+--oauth2-bearer "$3"} -H 'Content-Type: application/json' -d "$4"
  else
    curl -s -X "$1" "$API$2" ${3:+--oauth2-bearer "$3"} -H 'Content-Type: application/json'
  fi
}

echo "=== Tokens ==="
TK_CAJA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"caja@local.test","password":"caja1234"}' | jget "d['token']")
TK_ENC=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"encargado@local.test","password":"encargado1234"}' | jget "d['token']")
USUARIOS=$(curl -s $API/auth/usuarios-pin)
id_de() { echo "$USUARIOS" | py "
import sys,json
try: us = json.load(sys.stdin)
except Exception: sys.exit(0)
if isinstance(us, list):
  for u in us:
    if u.get('nombre') == '$1': print(u['id']); break"; }
TK_DIEGO=$(curl -s -X POST $API/auth/pin -H 'Content-Type: application/json' \
  -d "{\"usuario_id\":$(id_de 'Diego Sosa'),\"pin\":\"3333\"}" | jget "d['token']")
TK_CARLA=$(curl -s -X POST $API/auth/pin -H 'Content-Type: application/json' \
  -d "{\"usuario_id\":$(id_de 'Carla Vega'),\"pin\":\"4444\"}" | jget "d['token']")
TK_COC=$(curl -s -X POST $API/auth/pin -H 'Content-Type: application/json' \
  -d "{\"usuario_id\":$(id_de 'Cocina'),\"pin\":\"6666\"}" | jget "d['token']")
# El caso 13 fuerza PIN a propósito y quema la ventana del limitador (20
# intentos / 10 min). Si se corre la suite dos veces seguida, el login da 429 y
# todos los tokens salen vacíos: sin esta guarda, eso se leía como 60 fallas de
# seguridad en vez de "esperá diez minutos".
for par in "caja:$TK_CAJA" "encargado:$TK_ENC" "Diego:$TK_DIEGO" "Carla:$TK_CARLA" "cocina:$TK_COC"; do
  if [ -z "${par#*:}" ]; then
    echo "  ABORTA  no se pudo obtener el token de ${par%%:*}."
    echo "          Si el login responde 429, el limitador todavía está contando:"
    echo "          son 10 minutos desde el caso 13 de la corrida anterior."
    exit 2
  fi
done
echo "  obtenidos"

echo
echo "=== 1. Acceso sin autenticar ==="
check "GET /salon sin token" 401 "$(codigo GET /salon '')"
check "GET /cuentas sin token" 401 "$(codigo GET /cuentas '')"
check "POST /caja/turno/abrir sin token" 401 "$(codigo POST /caja/turno/abrir '' '{"fondo_inicial":1}')"
check "GET /admin/usuarios sin token" 401 "$(codigo GET /admin/usuarios '')"
check "GET /reportes/resumen sin token" 401 "$(codigo GET /reportes/resumen '')"

echo
echo "=== 2. El mozo no puede tocar la plata ==="
check "mozo abre caja" 403 "$(codigo POST /caja/turno/abrir "$TK_DIEGO" '{"fondo_inicial":1}')"
check "mozo lista cuentas de caja" 403 "$(codigo GET /cuentas "$TK_DIEGO")"
check "mozo carga ítems" 403 "$(codigo POST /cuentas/1/items "$TK_DIEGO" '{"items":[{"producto_id":1,"cantidad":1}]}')"
check "mozo manda a cocina" 403 "$(codigo POST /cuentas/1/enviar "$TK_DIEGO" '{}')"
check "mozo cobra" 403 "$(codigo POST /caja/cuentas/1/cobrar "$TK_DIEGO" '{"pagos":[{"medio":"efectivo","monto":1}],"idempotency_key":"ataque-mozo-01"}')"
check "mozo aplica descuento" 403 "$(codigo POST /cuentas/1/descuento "$TK_DIEGO" '{"monto":1,"motivo":"nada"}')"
check "mozo marca pérdida" 403 "$(codigo POST /cuentas/1/perdida "$TK_DIEGO" '{"motivo":"se fueron"}')"
check "mozo ve reportes" 403 "$(codigo GET /reportes/resumen "$TK_DIEGO")"
check "mozo ve auditoría" 403 "$(codigo GET /admin/auditoria "$TK_DIEGO")"
check "mozo edita la carta" 403 "$(codigo POST /carta/productos "$TK_DIEGO" '{"categoria_id":1,"nombre":"trucho","precio":1}')"

echo
echo "=== 3. La cocina solo cocina ==="
check "cocina lista cuentas" 403 "$(codigo GET /cuentas "$TK_COC")"
check "cocina cobra" 403 "$(codigo POST /caja/cuentas/1/cobrar "$TK_COC" '{"pagos":[{"medio":"efectivo","monto":1}],"idempotency_key":"ataque-coc-01"}')"
check "cocina ve reportes" 403 "$(codigo GET /reportes/resumen "$TK_COC")"
check "cocina abre mesa" 403 "$(codigo POST /cuentas "$TK_COC" '{"tipo":"salon","mesa_id":1}')"

echo
echo "=== 4. Caja no es encargado ==="
check "caja crea usuarios" 403 "$(codigo POST /admin/usuarios "$TK_CAJA" '{"nombre":"Trucho","rol":"encargado","password":"123456"}')"
check "caja cambia configuración" 403 "$(codigo PUT /admin/config "$TK_CAJA" '{"descuento_tope_sin_pin":"999999"}')"
check "caja edita precios" 403 "$(codigo PUT /carta/productos/1 "$TK_CAJA" '{"categoria_id":1,"nombre":"x","precio":1}')"
check "caja cambia credenciales ajenas" 403 "$(codigo POST /admin/usuarios/1/credenciales "$TK_CAJA" '{"pin":"9999"}')"

echo
echo "=== 5. IDOR: borrador privado de otro mozo ==="
MESA=$(cuerpo GET /salon "$TK_DIEGO" | py "import sys,json;print([m['id'] for m in json.load(sys.stdin)['mesas'] if m['estado']=='libre'][0])")
CTA=$(cuerpo POST /cuentas "$TK_DIEGO" "{\"tipo\":\"salon\",\"mesa_id\":$MESA,\"comensales\":2}" | jget "d['id']")
BORR=$(cuerpo POST /borradores/mio "$TK_DIEGO" "{\"mesa_id\":$MESA,\"cuenta_id\":$CTA}" | jget "d['id']")
check "Carla agrega al borrador de Diego" 403 "$(codigo POST /borradores/$BORR/items "$TK_CARLA" '{"producto_id":1,"cantidad":1}')"
check "Carla borra ítems del borrador de Diego" 403 "$(codigo DELETE /borradores/$BORR/items/1 "$TK_CARLA")"
check "Carla edita la nota del borrador de Diego" 403 "$(codigo PATCH /borradores/$BORR "$TK_CARLA" '{"nota":"robado"}')"

echo
echo "=== 6. JWT manipulado ==="
SIN_FIRMA=$(py "
import base64,json
h=base64.urlsafe_b64encode(json.dumps({'alg':'none','typ':'JWT'}).encode()).decode().rstrip('=')
p=base64.urlsafe_b64encode(json.dumps({'id':1,'nombre':'x','rol':'encargado'}).encode()).decode().rstrip('=')
print(h+'.'+p+'.')")
check "alg=none" 401 "$(codigo GET /admin/usuarios "$SIN_FIRMA")"
ESCALADO=$(py "
import base64,json
t='''$TK_DIEGO'''.split('.')
p=json.loads(base64.urlsafe_b64decode(t[1]+'=='))
p['rol']='encargado'
t[1]=base64.urlsafe_b64encode(json.dumps(p).encode()).decode().rstrip('=')
print('.'.join(t))")
check "payload con rol cambiado" 401 "$(codigo GET /admin/usuarios "$ESCALADO")"
check "token basura" 401 "$(codigo GET /salon 'abc.def.ghi')"

echo
echo "=== 7. Inyección SQL ==="
INY=$(cuerpo GET "/carta/buscar?q=%27%20OR%201%3D1%20--%20" "$TK_CAJA" | py "import sys,json;print(len(json.load(sys.stdin)))")
check "buscar con ' OR 1=1 -- devuelve 0" 0 "$INY"
check "DROP TABLE en el buscador" 200 "$(codigo GET "/carta/buscar?q=x%27%3B%20DROP%20TABLE%20cuentas%3B%20--" "$TK_CAJA")"
check "las tablas siguen" 200 "$(codigo GET /cuentas "$TK_CAJA")"
check "inyección en filtro de auditoría" 200 "$(codigo GET "/admin/auditoria?accion=x%27%20OR%20%271%27%3D%271" "$TK_ENC")"
check "id no numérico rechazado" 400 "$(codigo GET "/cuentas/1%20OR%201%3D1" "$TK_CAJA")"
check "id con texto rechazado" 400 "$(codigo GET "/cuentas/abc" "$TK_CAJA")"

echo
echo "=== 8. Manipulación de montos ==="
CTA2=$(cuerpo GET /cuentas "$TK_CAJA" | py "import sys,json;d=json.load(sys.stdin);print([c['id'] for c in d if float(c['total'])>0][0])")
check "pago negativo" 400 "$(codigo POST /caja/cuentas/$CTA2/cobrar "$TK_CAJA" '{"pagos":[{"medio":"efectivo","monto":-5000}],"idempotency_key":"ataque-neg-01"}')"
check "pago mayor al saldo" 400 "$(codigo POST /caja/cuentas/$CTA2/cobrar "$TK_CAJA" '{"pagos":[{"medio":"efectivo","monto":99999999}],"idempotency_key":"ataque-exceso-01"}')"
check "descuento mayor al consumo" 400 "$(codigo POST /cuentas/$CTA2/descuento "$TK_CAJA" '{"monto":99999999,"motivo":"prueba de ataque","pin":"1111"}')"
check "descuento sin PIN" 403 "$(codigo POST /cuentas/$CTA2/descuento "$TK_CAJA" '{"monto":100,"motivo":"prueba de ataque"}')"
check "PIN inventado" 403 "$(codigo POST /cuentas/$CTA2/perdida "$TK_CAJA" '{"motivo":"probando el pin","pin":"0000"}')"

echo "  -- el cliente manda su propio precio: el servidor lo tiene que ignorar --"
PROD=$(cuerpo GET /carta "$TK_CAJA" | py "import sys,json;d=json.load(sys.stdin);print([p['id'] for c in d['categorias'] for p in c['productos'] if not p['grupos'] and len(p['variantes'])<2][0])")
PRECIO_REAL=$(cuerpo GET "/carta/producto/$PROD" "$TK_CAJA" | jget "d['precio']")
ANTES=$(cuerpo GET "/cuentas/$CTA" "$TK_CAJA" | jget "d['subtotal']")
cuerpo POST "/cuentas/$CTA/items" "$TK_CAJA" \
  "{\"items\":[{\"producto_id\":$PROD,\"cantidad\":1,\"precio\":1,\"precio_snapshot\":1,\"total_linea\":1}]}" > /dev/null
DESPUES=$(cuerpo GET "/cuentas/$CTA" "$TK_CAJA" | jget "d['subtotal']")
SUMADO=$(py "print(f'{float('$DESPUES')-float('$ANTES'):.2f}')")
check "el precio lo pone el servidor" "$(py "print(f'{float('$PRECIO_REAL'):.2f}')")" "$SUMADO"

echo
echo "=== 9. Idempotencia: doble cobro ==="
SALDO=$(cuerpo GET "/cuentas/$CTA2" "$TK_CAJA" | jget "d['saldo']")
MITAD=$(py "print(round(float('$SALDO')/2,2))")
# Contra el delta y no contra el total: la cuenta puede traer pagos de antes,
# y si no, correr la suite dos veces sin resembrar hace fallar un caso que está
# bien — que es justo la clase de falla falsa que no sirve a nadie.
ANTES=$(cuerpo GET "/cuentas/$CTA2" "$TK_CAJA" | jget "d['pagado']")
CLAVE="ataque-doble-$(date +%s)"
cuerpo POST "/caja/cuentas/$CTA2/cobrar" "$TK_CAJA" \
  "{\"pagos\":[{\"medio\":\"efectivo\",\"monto\":$MITAD}],\"idempotency_key\":\"$CLAVE\"}" > /dev/null
REP=$(cuerpo POST "/caja/cuentas/$CTA2/cobrar" "$TK_CAJA" \
  "{\"pagos\":[{\"medio\":\"efectivo\",\"monto\":$MITAD}],\"idempotency_key\":\"$CLAVE\"}" | jget "d['repetido']")
check "segundo envío con la misma clave" "True" "$REP"
PAGADO=$(cuerpo GET "/cuentas/$CTA2" "$TK_CAJA" | jget "d['pagado']")
check "se cobró una sola vez" "True" \
  "$(py "print(abs((float('$PAGADO')-float('$ANTES'))-float('$MITAD'))<0.01)")"

# Y la carrera: las dos iguales a la vez, que es el doble toque real. El chequeo
# previo no es atómico, así que la segunda choca con el UNIQUE — tiene que
# contestar 'repetido', no un 409 que en la pantalla se lee como cobro fallido.
SALDO2=$(cuerpo GET "/cuentas/$CTA2" "$TK_CAJA" | jget "d['saldo']")
CUARTO=$(py "print(round(float('$SALDO2')/2,2))")
ANTES2=$(cuerpo GET "/cuentas/$CTA2" "$TK_CAJA" | jget "d['pagado']")
CLAVE2="ataque-carrera-$(date +%s)"
CUERPO2="{\"pagos\":[{\"medio\":\"efectivo\",\"monto\":$CUARTO}],\"idempotency_key\":\"$CLAVE2\"}"
C1=$(codigo POST "/caja/cuentas/$CTA2/cobrar" "$TK_CAJA" "$CUERPO2") &
C2=$(codigo POST "/caja/cuentas/$CTA2/cobrar" "$TK_CAJA" "$CUERPO2") &
wait
AMBAS=$(codigo POST "/caja/cuentas/$CTA2/cobrar" "$TK_CAJA" "$CUERPO2")
check "la clave repetida nunca da 409" "True" "$(py "print('$AMBAS' != '409')")"
DESPUES2=$(cuerpo GET "/cuentas/$CTA2" "$TK_CAJA" | jget "d['pagado']")
check "la carrera cobró una sola vez" "True" \
  "$(py "print(abs((float('$DESPUES2')-float('$ANTES2'))-float('$CUARTO'))<0.01)")"

echo
echo "=== 10. Campos de más (mass assignment) ==="
NUEVA=$(cuerpo POST /cuentas "$TK_CAJA" '{"tipo":"take_away","referencia":"ataque","estado":"cerrada","pagado":"999999","total":"0"}' | jget "d['id']")
EST=$(cuerpo GET "/cuentas/$NUEVA" "$TK_CAJA" | jget "d['estado']")
PAG=$(cuerpo GET "/cuentas/$NUEVA" "$TK_CAJA" | jget "d['pagado']")
check "no se puede nacer cerrada" "abierta" "$EST"
check "no se puede nacer pagada" "0.00" "$PAG"
ROL=$(cuerpo POST /admin/usuarios "$TK_ENC" '{"nombre":"Prueba Ataque","rol":"mozo","pin":"7777","activo":true,"id":1}' | jget "d['id']")
check "el id enviado no pisa a otro usuario" "True" "$(py "print($ROL != 1)")"

echo
echo "=== 11. Estados imposibles ==="
CERRADA=$(cuerpo GET "/reportes/por-dia" "$TK_CAJA" > /dev/null; curl -s "$API/admin/auditoria?accion=cuenta_perdida" --oauth2-bearer "$TK_ENC" | py "import sys,json;d=json.load(sys.stdin);print(d[0]['entidad_id'] if d else 1)")
check "cobrar una cuenta ya cerrada" 409 "$(codigo POST /caja/cuentas/$CERRADA/cobrar "$TK_CAJA" '{"pagos":[{"medio":"efectivo","monto":1}],"idempotency_key":"ataque-cerrada-01"}')"
check "unir una mesa a sí misma" 400 "$(codigo POST /salon/mesas/1/unir "$TK_CAJA" '{"mesa_ids":[1]}')"
check "fusionar una cuenta consigo misma" 400 "$(codigo POST /cuentas/$CTA/fusionar "$TK_CAJA" "{\"destino_id\":$CTA}")"
check "abrir un segundo turno" 409 "$(codigo POST /caja/turno/abrir "$TK_CAJA" '{"fondo_inicial":1000}')"
check "cerrar turno con mesas abiertas" 409 "$(codigo POST /caja/turno/cerrar "$TK_CAJA" '{"total_declarado":1000}')"

echo
echo "=== 12. Validación de entrada ==="
check "PIN de 2 dígitos" 400 "$(codigo POST /auth/pin '' '{"usuario_id":1,"pin":"12"}')"
check "email inválido" 400 "$(codigo POST /auth/login '' '{"email":"no-es-email","password":"x"}')"
check "cantidad absurda" 400 "$(codigo POST /cuentas/$CTA/items "$TK_CAJA" '{"items":[{"producto_id":1,"cantidad":99999}]}')"
check "cuerpo que no es JSON" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d 'no-json')"
check "producto inexistente" 400 "$(codigo POST /cuentas/$CTA/items "$TK_CAJA" '{"items":[{"producto_id":999999,"cantidad":1}]}')"

echo
echo "=== 13. Fuerza bruta de PIN ==="
# Este caso quema la ventana del limitador (20 intentos / 10 min) y deja la
# suite sin poder loguearse hasta que pase. Para iterar sobre los otros casos:
#   SIN_FUERZA_BRUTA=1 bash ataque.sh
if [ -n "${SIN_FUERZA_BRUTA:-}" ]; then
  echo "  (salteado por SIN_FUERZA_BRUTA: no se quema la ventana del limitador)"
else
DIEGO_ID=$(id_de 'Diego Sosa')
FRENO=0
for i in $(seq 1 26); do
  C=$(codigo POST /auth/pin '' "{\"usuario_id\":$DIEGO_ID,\"pin\":\"0$(printf '%03d' $i)\"}")
  if [ "$C" = "429" ]; then FRENO=$i; break; fi
done
check "el limitador corta la fuerza bruta" "True" "$(py "print(0 < $FRENO <= 26)")"
echo "         cortó en el intento $FRENO"
fi

echo
echo "=== 14. Cabeceras de seguridad ==="
CAB=$(curl -s -D - -o /dev/null $API/salud)
check "Helmet pone nosniff" "True" "$(echo "$CAB" | grep -qi 'x-content-type-options: nosniff' && echo True || echo False)"
check "no filtra X-Powered-By" "True" "$(echo "$CAB" | grep -qi 'x-powered-by' && echo False || echo True)"
check "CORS no acepta cualquier origen" "True" "$(curl -s -D - -o /dev/null -H 'Origin: http://malicioso.test' $API/salud | grep -qi 'access-control-allow-origin: http://malicioso.test' && echo False || echo True)"

echo
echo "=== 15. Fugas de información ==="
HASH=$(cuerpo GET /admin/usuarios "$TK_ENC" | grep -ci 'password_hash\|pin_hash' || true)
check "la API nunca devuelve hashes" 0 "$HASH"
LISTA=$(curl -s $API/auth/usuarios-pin | grep -ci 'hash' || true)
check "la lista de PIN no expone hashes" 0 "$LISTA"
ERR=$(cuerpo GET /cuentas/999999 "$TK_CAJA" | grep -ci 'sql\|mysql\|at Object\|stack' || true)
check "los errores no filtran SQL ni stack" 0 "$ERR"

echo
echo "=== 16. Basura en el ?query= (400, nunca 500) ==="
# Un 500 acá no es sólo prolijidad: el mensaje de MySQL salía al cliente.
for Q in "/admin/auditoria?limite=abc" "/admin/auditoria?limite=-5" \
         "/admin/auditoria?actor_id=abc" "/admin/auditoria?desde=xx&hasta=yy" \
         "/admin/auditoria?desde=2026-02-31" "/caja/movimientos?turno_id=abc" \
         "/caja/pagos?turno_id=abc" "/reportes/resumen?desde=xx" \
         "/reportes/por-producto?limite=abc" "/salon/reservas?desde=xx&hasta=yy" \
         "/reportes/resumen?desde=2026-10-01&desde=2026-10-02"; do
  check "$Q" 400 "$(codigo GET "$Q" "$TK_ENC")"
done
FUGA=$(cuerpo GET "/admin/auditoria?limite=abc" "$TK_ENC" | grep -ci 'NaN\|Undeclared\|Unknown column' || true)
check "el 400 no filtra el mensaje de MySQL" 0 "$FUGA"

echo
echo "=== 17. Dar de baja a alguien le corta la sesión abierta ==="
# El JWT dura 12 h y no se puede revocar: si esto no corta, al echado le queda
# media jornada de poder cobrar.
BAJA_ID=$(id_de 'Diego Sosa')
check "antes de la baja opera" 200 "$(codigo GET /salon "$TK_DIEGO")"
codigo PUT "/admin/usuarios/$BAJA_ID" "$TK_ENC" '{"nombre":"Diego Sosa","rol":"mozo","activo":false}' >/dev/null
check "después de la baja no opera" 401 "$(codigo GET /salon "$TK_DIEGO")"
check "tampoco puede pedir a cocina" 401 "$(codigo GET /borradores "$TK_DIEGO")"
codigo PUT "/admin/usuarios/$BAJA_ID" "$TK_ENC" '{"nombre":"Diego Sosa","rol":"mozo","activo":true}' >/dev/null
check "reactivado vuelve a operar" 200 "$(codigo GET /salon "$TK_DIEGO")"

echo
echo "=== 18. El día del reporte es el del local, no UTC ==="
# De 21 a 24 en Argentina, UTC ya está en mañana: el reporte del día daba cero.
HOY_LOCAL=$(date '+%Y-%m-%d')
RANGO=$(cuerpo GET /reportes/resumen "$TK_ENC" | jget "d['rango']['desde']")
check "el rango por omisión es hoy en hora local" "$HOY_LOCAL" "$RANGO"

echo
echo "=== 19. El borrador pasado a caja ya no se toca ==="
# Mientras es privado es del mozo. Pasado a caja esa línea ya es plata
# esperando: si otro la borra ahí, no queda registro en ninguna parte.
PROD=$(cuerpo GET /carta "$TK_DIEGO" | py "
import sys,json
d = json.load(sys.stdin)
cats = d if isinstance(d, list) else d.get('categorias', [])
for c in cats:
  for p in c.get('productos', []):
    if p.get('activo', 1) and not p.get('agotado'): print(p['id']); raise SystemExit")
BOR=$(cuerpo POST /borradores/mio "$TK_DIEGO" '{}' | jget "d['id']")
ITEM=$(cuerpo POST "/borradores/$BOR/items" "$TK_DIEGO" "{\"producto_id\":$PROD,\"cantidad\":1}" | jget "d['id']")
check "el dueño borra mientras es privado" 200 "$(codigo DELETE "/borradores/$BOR/items/$ITEM" "$TK_DIEGO")"
ITEM=$(cuerpo POST "/borradores/$BOR/items" "$TK_DIEGO" "{\"producto_id\":$PROD,\"cantidad\":1}" | jget "d['id']")
check "otro mozo no entra al privado" 403 "$(codigo DELETE "/borradores/$BOR/items/$ITEM" "$TK_CARLA")"
codigo POST "/borradores/$BOR/pasar" "$TK_DIEGO" >/dev/null
check "pasado: otro mozo no borra" 409 "$(codigo DELETE "/borradores/$BOR/items/$ITEM" "$TK_CARLA")"
check "pasado: el dueño tampoco borra" 409 "$(codigo DELETE "/borradores/$BOR/items/$ITEM" "$TK_DIEGO")"
check "pasado: nadie reescribe la nota" 409 "$(codigo PATCH "/borradores/$BOR" "$TK_CARLA" '{"nota":"cambiada"}')"

echo
echo "=== 20. Sockets: sin token no se escucha nada ==="
# La sala 'publico' existía para la carta QR, que ya no está. Emitía
# 'caja:turno' a cualquiera que se conectara sin presentar nada.
SOCKIO=client/node_modules/socket.io-client/build/esm/index.js
if [ -f "$SOCKIO" ]; then
  node --input-type=module -e "
import { io } from './$SOCKIO';
const probar = (auth) => new Promise((ok) => {
  const s = io('http://localhost:4000', { auth, transports: ['websocket'], reconnection: false });
  const fin = (t) => { s.close(); ok(t); };
  s.on('connect', () => fin('CONECTA'));
  s.on('connect_error', (e) => fin(e.message));
  setTimeout(() => fin('timeout'), 4000);
});
console.log(await probar({}));
console.log(await probar({ token: 'abc.def.ghi' }));
console.log(await probar({ token: process.argv[1] }));
process.exit(0);
" "$TK_ENC" > /tmp/sock.out 2>&1
  check "sin token: rechazado" "no_autenticado" "$(sed -n 1p /tmp/sock.out)"
  check "token basura: rechazado" "sesion_invalida" "$(sed -n 2p /tmp/sock.out)"
  check "token válido: conecta" "CONECTA" "$(sed -n 3p /tmp/sock.out)"
else
  echo "  (salteado: falta $SOCKIO — corré npm install en client/)"
fi

echo
echo "=== 21. Bajarle el rango le quita los permisos en el acto ==="
# El rol viaja firmado dentro del token: si `exigirRol` lo lee de ahí, al que
# degradás le quedan los permisos viejos hasta que el token venza (12 h).
CARLA_ID=$(id_de 'Carla Vega')
check "la mozo no entra a reportes" 403 "$(codigo GET /reportes/resumen "$TK_CARLA")"
codigo PUT "/admin/usuarios/$CARLA_ID" "$TK_ENC" \
  '{"nombre":"Carla Vega","email":"carla.vega@local.test","rol":"encargado","activo":true}' >/dev/null
check "ascendida: con el mismo token ya entra" 200 "$(codigo GET /reportes/resumen "$TK_CARLA")"
codigo PUT "/admin/usuarios/$CARLA_ID" "$TK_ENC" \
  '{"nombre":"Carla Vega","rol":"mozo","activo":true}' >/dev/null
check "degradada: con el mismo token ya no entra" 403 "$(codigo GET /reportes/resumen "$TK_CARLA")"
check "y tampoco toca empleados" 403 "$(codigo GET /admin/usuarios "$TK_CARLA")"

echo
echo "========================================"
echo "  $ok pasaron · $mal fallaron"
echo "========================================"
[ "$mal" -eq 0 ]
