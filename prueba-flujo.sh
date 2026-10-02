#!/usr/bin/env bash
# Ciclo de vida completo de una mesa, de punta a punta, contra la API real.
set -e
API=http://localhost:4000/api

req() { # req METODO RUTA TOKEN [JSON]
  if [ -n "${4:-}" ]; then
    curl -s -X "$1" "$API$2" --oauth2-bearer "$3" -H 'Content-Type: application/json' -d "$4"
  else
    curl -s -X "$1" "$API$2" --oauth2-bearer "$3" -H 'Content-Type: application/json'
  fi
}
py() { python3 -c "$1"; }
ok() { echo "  OK  $1"; }

echo "0. Personal de prueba"
# La instalación arranca con un solo usuario (el encargado). El resto del
# plantel lo crea acá el propio encargado, por la misma API que usa la
# pantalla de Empleados: así la prueba no depende de lo que traiga la siembra.
LOGIN_ENC=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"encargado@local.test","password":"encargado1234"}')
TK_ENC=$(echo "$LOGIN_ENC" | py "
import sys,json
try: print(json.load(sys.stdin).get('token',''))
except Exception: pass")
if [ -z "$TK_ENC" ]; then
  # El caso 13 de ataque.sh quema la ventana del limitador (20 intentos cada
  # 10 min). Sin esto, el script moría con un KeyError de Python y parecía que
  # el sistema estaba roto.
  echo "  ABORTA  no se pudo iniciar sesión como encargado."
  echo "          Respuesta: $(echo "$LOGIN_ENC" | head -c 120)"
  echo "          Si dice 'demasiados intentos', el limitador todavía cuenta:"
  echo "          son 10 minutos desde la última corrida de ataque.sh."
  exit 2
fi
crear_si_falta() { # crear_si_falta JSON NOMBRE
  if ! curl -s $API/admin/usuarios --oauth2-bearer "$TK_ENC" | grep -q "\"$2\""; then
    req POST /admin/usuarios "$TK_ENC" "$1" > /dev/null
  fi
}
crear_si_falta '{"nombre":"Lucía Ramos","email":"caja@local.test","rol":"caja","password":"caja1234","pin":"2222"}' 'Lucía Ramos'
crear_si_falta '{"nombre":"Diego Sosa","rol":"mozo","pin":"3333"}' 'Diego Sosa'
crear_si_falta '{"nombre":"Carla Vega","rol":"mozo","pin":"4444"}' 'Carla Vega'
crear_si_falta '{"nombre":"Cocina","rol":"cocina","pin":"6666"}' 'Cocina'
ok "plantel listo"

echo "1. Logins"
TK_CAJA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"caja@local.test","password":"caja1234"}' | py "import sys,json;print(json.load(sys.stdin)['token'])")
ok "caja por email"

USUARIOS=$(curl -s $API/auth/usuarios-pin)
buscar_id() { echo "$USUARIOS" | py "import sys,json;print([u['id'] for u in json.load(sys.stdin) if u['nombre']=='$1'][0])"; }
MOZO_ID=$(buscar_id 'Diego Sosa')
COCINA_ID=$(buscar_id 'Cocina')

TK_MOZO=$(curl -s -X POST $API/auth/pin -H 'Content-Type: application/json' \
  -d "{\"usuario_id\":$MOZO_ID,\"pin\":\"3333\"}" | py "import sys,json;print(json.load(sys.stdin)['token'])")
ok "mozo Diego por PIN"
TK_COC=$(curl -s -X POST $API/auth/pin -H 'Content-Type: application/json' \
  -d "{\"usuario_id\":$COCINA_ID,\"pin\":\"6666\"}" | py "import sys,json;print(json.load(sys.stdin)['token'])")
ok "cocina por PIN"

echo "2. El mozo NO puede cobrar ni cargar ítems (control de roles)"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/caja/turno/abrir --oauth2-bearer "$TK_MOZO" \
  -H 'Content-Type: application/json' -d '{"fondo_inicial":1}')
[ "$CODIGO" = "403" ] && ok "abrir caja como mozo -> 403" || { echo "  FALLO: dio $CODIGO"; exit 1; }

echo "3. Caja abre turno con fondo de \$20.000"
req POST /caja/turno/abrir "$TK_CAJA" '{"fondo_inicial":20000}' > /dev/null
ok "turno abierto"

echo "4. El mozo marca la Mesa 7 ocupada con 4 comensales"
MESA7=$(req GET /salon "$TK_MOZO" | py "import sys,json;print([m['id'] for m in json.load(sys.stdin)['mesas'] if m['nombre']=='Mesa 7'][0])")
CUENTA=$(req POST /cuentas "$TK_MOZO" "{\"tipo\":\"salon\",\"mesa_id\":$MESA7,\"comensales\":4}" \
  | py "import sys,json;print(json.load(sys.stdin)['id'])")
ok "cuenta $CUENTA abierta en Mesa 7"

echo "5. Arma el borrador en el celular y lo pasa a caja"
BORR=$(req POST /borradores/mio "$TK_MOZO" "{\"mesa_id\":$MESA7,\"cuenta_id\":$CUENTA}" \
  | py "import sys,json;print(json.load(sys.stdin)['id'])")
CARTA=$(req GET /carta "$TK_MOZO")
GRUPOS=$(req GET /carta/grupos "$TK_MOZO")
prod() { echo "$CARTA" | py "import sys,json;d=json.load(sys.stdin);print([p['id'] for c in d['categorias'] for p in c['productos'] if p['nombre']=='$1'][0])"; }
var() { echo "$CARTA" | py "import sys,json;d=json.load(sys.stdin);print([p['variantes'][$2]['id'] for c in d['categorias'] for p in c['productos'] if p['nombre']=='$1'][0])"; }
opcion() { echo "$GRUPOS" | py "import sys,json;print([o['id'] for g in json.load(sys.stdin) if g['nombre']=='$1' for o in g['opciones'] if o['nombre']=='$2'][0])"; }

NAPO=$(prod 'Milanesa napolitana'); NAPO_V=$(var 'Milanesa napolitana' 0)
PURE=$(opcion 'Guarnición a elección' 'Puré de papas')
BIFE=$(prod 'Bife de chorizo'); PUNTO=$(opcion 'Punto de carne' 'A punto')
PAPAS=$(opcion 'Guarnición a elección' 'Papas fritas')

req POST "/borradores/$BORR/items" "$TK_MOZO" \
  "{\"producto_id\":$NAPO,\"variante_id\":$NAPO_V,\"cantidad\":2,\"nota\":\"una sin sal\",\"opcion_ids\":[$PURE]}" > /dev/null
req POST "/borradores/$BORR/items" "$TK_MOZO" \
  "{\"producto_id\":$BIFE,\"cantidad\":1,\"opcion_ids\":[$PUNTO,$PAPAS]}" > /dev/null
req PATCH "/borradores/$BORR" "$TK_MOZO" '{"nota":"pagan con tarjeta","pago_previsto":"tarjeta"}' > /dev/null
req POST "/borradores/$BORR/pasar" "$TK_MOZO" > /dev/null
ok "borrador $BORR pasado a caja (2 milanesas + 1 bife)"

echo "6. Caja lo ve en su bandeja de pendientes"
req GET /borradores/pendientes "$TK_CAJA" | py "
import sys,json
for b in json.load(sys.stdin):
  print(f\"      {b['mesa']} · mozo {b['mozo']} · {b['pago_previsto']} · {b['nota']}\")
  for i in b['items']: print(f\"        {i['cantidad']}x {i['producto']} {i['variante'] or ''} {i['nota'] or ''}\")"
req POST "/borradores/$BORR/convertir" "$TK_CAJA" '{"enviar":true}' > /dev/null
ok "caja lo convirtió y mandó la comanda"

echo "7. Pantalla de cocina"
KDS=$(req GET /comandas/pendientes "$TK_COC")
COMANDA=$(echo "$KDS" | py "import sys,json;print(json.load(sys.stdin)[0]['id'])")
echo "$KDS" | py "
import sys,json
for c in json.load(sys.stdin):
  print(f\"      [{c['mesa_label']}] nivel={c['nivel']} {c['minutos']} min urgente={bool(c['urgente'])}\")
  for i in c['items']: print(f\"        {i['cantidad']}x {i['nombre']} {'/'.join(i['mods'])} {i['nota'] or ''}\")"
req POST "/comandas/$COMANDA/terminada" "$TK_COC" > /dev/null
ok "cocina marcó TERMINADA (su único botón)"

echo "8. El aviso le llega al mozo y lo apaga"
req GET /comandas/listas "$TK_MOZO" | py "
import sys,json
for c in json.load(sys.stdin): print(f\"      aviso: {c['mesa_label']} lista\")"
req POST "/comandas/$COMANDA/retirado" "$TK_MOZO" > /dev/null
ok "plato retirado"

echo "9. Devolución con reposición (el bife salió crudo)"
ITEM_BIFE=$(req GET "/cuentas/$CUENTA" "$TK_CAJA" | py "
import sys,json
print([i['id'] for i in json.load(sys.stdin)['items'] if 'Bife' in i['nombre_snapshot'] and i['estado']=='activo'][0])")
req POST "/cuentas/$CUENTA/items/$ITEM_BIFE/devolver" "$TK_CAJA" \
  '{"motivo":"error_cocina","detalle":"salió crudo","reponer":true,"pin":"1111"}' > /dev/null
ok "devuelto con PIN del encargado y repuesto sin cargo"

echo "10. Segunda ronda: postres cargados por caja"
FLAN=$(prod 'Flan casero con dulce')
req POST "/cuentas/$CUENTA/items" "$TK_CAJA" "{\"items\":[{\"producto_id\":$FLAN,\"cantidad\":2}],\"enviar\":true}" > /dev/null
ok "2 flanes enviados"

echo "11. Descuento sin PIN debe fallar (tope en cero)"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/cuentas/$CUENTA/descuento" \
  --oauth2-bearer "$TK_CAJA" -H 'Content-Type: application/json' -d '{"monto":2000,"motivo":"prueba"}')
[ "$CODIGO" = "403" ] && ok "descuento sin PIN -> 403" || { echo "  FALLO: dio $CODIGO"; exit 1; }
req POST "/cuentas/$CUENTA/descuento" "$TK_CAJA" '{"monto":2000,"motivo":"cliente habitual","pin":"1111"}' > /dev/null
ok "descuento con PIN aplicado"

echo "12. El mozo toca 'piden la cuenta'"
req POST "/cuentas/$CUENTA/pedir-cuenta" "$TK_MOZO" > /dev/null
ok "mesa en por_cobrar"

echo "13. Estado de la cuenta"
req GET "/cuentas/$CUENTA" "$TK_CAJA" | py "
import sys,json
d=json.load(sys.stdin)
print(f\"      {d['mesa']} | {d['comensales']} comensales | mozo {d['mozo']}\")
for i in d['items']:
  marca = '' if i['estado']=='activo' else f\" <-- {i['estado']}: {i['motivo']}\"
  print(f\"        {i['cantidad']}x {i['nombre_snapshot']:<40} {i['total_linea']:>10}{marca}\")
print(f\"      subtotal {d['subtotal']} + cubierto {d['cubierto_total']} - descuento {d['descuento']} = TOTAL {d['total']}\")"

echo "14. Dividir en 4 partes iguales"
req GET "/caja/cuentas/$CUENTA/dividir?partes=4" "$TK_CAJA" | py "
import sys,json
d=json.load(sys.stdin);print(f\"      saldo {d['saldo']} -> {d['montos']}\")"

echo "15. Cobro mixto (efectivo + crédito) con propina y factura B"
TOTAL=$(req GET "/cuentas/$CUENTA" "$TK_CAJA" | py "import sys,json;print(json.load(sys.stdin)['total'])")
MITAD=$(py "print(round(float('$TOTAL')/2,2))")
RESTO=$(py "print(round(float('$TOTAL')-float('$MITAD'),2))")
RECIBIDO=$(py "print(float('$MITAD')+5000)")
req POST "/caja/cuentas/$CUENTA/cobrar" "$TK_CAJA" "{
  \"pagos\":[{\"medio\":\"efectivo\",\"monto\":$MITAD,\"recibido\":$RECIBIDO},
             {\"medio\":\"credito\",\"monto\":$RESTO,\"referencia\":\"lote 0042\"}],
  \"propina\":2000,\"idempotency_key\":\"prueba-flujo-0001\",
  \"comprobante\":{\"tipo\":\"factura_b\",\"doc_tipo\":\"CF\"}}" | py "
import sys,json
d=json.load(sys.stdin)
c=d['comprobante']
print(f\"      cerrada={d['cerrada']} saldo={d['saldo']}\")
print(f\"      {c['tipo']} PV{c['punto_venta']} N°{c['numero']} | neto {c['neto']} + IVA {c['iva']} = {c['total']}\")
for a in c['por_alicuota']: print(f\"        IVA {a['alicuota']}%: base {a['base']} iva {a['iva']}\")"

echo "16. Idempotencia: repito el mismo cobro"
req POST "/caja/cuentas/$CUENTA/cobrar" "$TK_CAJA" \
  '{"pagos":[{"medio":"efectivo","monto":100}],"propina":0,"idempotency_key":"prueba-flujo-0001"}' \
  | py "import sys,json;print('      repetido =',json.load(sys.stdin)['repetido'])"

echo "17. La Mesa 7 volvió a libre sola"
req GET /salon "$TK_CAJA" | py "
import sys,json
m=[m for m in json.load(sys.stdin)['mesas'] if m['nombre']=='Mesa 7'][0]
print(f\"      Mesa 7: {m['estado']}\")"

echo "18. Unir mesas y fusionar cuentas"
M1=$(req GET /salon "$TK_CAJA" | py "import sys,json;print([m['id'] for m in json.load(sys.stdin)['mesas'] if m['nombre']=='Mesa 1'][0])")
M2=$(req GET /salon "$TK_CAJA" | py "import sys,json;print([m['id'] for m in json.load(sys.stdin)['mesas'] if m['nombre']=='Mesa 2'][0])")
C1=$(req POST /cuentas "$TK_MOZO" "{\"tipo\":\"salon\",\"mesa_id\":$M1,\"comensales\":2}" | py "import sys,json;print(json.load(sys.stdin)['id'])")
C2=$(req POST /cuentas "$TK_MOZO" "{\"tipo\":\"salon\",\"mesa_id\":$M2,\"comensales\":3}" | py "import sys,json;print(json.load(sys.stdin)['id'])")
req POST "/cuentas/$C1/items" "$TK_CAJA" "{\"items\":[{\"producto_id\":$FLAN,\"cantidad\":1}]}" > /dev/null
req POST "/cuentas/$C2/items" "$TK_CAJA" "{\"items\":[{\"producto_id\":$FLAN,\"cantidad\":3}]}" > /dev/null
req POST "/salon/mesas/$M1/unir" "$TK_MOZO" "{\"mesa_ids\":[$M2]}" | py "
import sys,json;d=json.load(sys.stdin);print(f\"      unidas: satelites={d['satelites']} avisos={d['avisos']}\")"
req POST "/cuentas/$C2/fusionar" "$TK_CAJA" "{\"destino_id\":$C1}" | py "
import sys,json;d=json.load(sys.stdin);print(f\"      fusionada -> cuenta {d['id']} total {d['total']} comensales {d['comensales']}\")"
req POST "/cuentas/$C1/perdida" "$TK_CAJA" '{"motivo":"se fueron sin pagar","pin":"1111"}' | py "
import sys,json;d=json.load(sys.stdin);print(f\"      cuenta marcada {d['estado']} por {d['importe']}\")"
req GET /salon "$TK_CAJA" | py "
import sys,json
d=json.load(sys.stdin)
for n in ('Mesa 1','Mesa 2'):
  m=[m for m in d['mesas'] if m['nombre']==n][0]
  print(f\"      {n}: {m['estado']} (satelites {m['satelites']})\")"

echo "19. Arqueo del turno"
req GET /caja/turno/arqueo "$TK_CAJA" | py "
import sys,json
d=json.load(sys.stdin)
print(f\"      fondo {d['fondo_inicial']} | ventas {d['ventas_totales']} | propinas {d['propinas_totales']}\")
print(f\"      efectivo esperado {d['efectivo_esperado']} | cuentas abiertas {len(d['cuentas_abiertas'])}\")
for p in d['por_medio']: print(f\"        {p['medio']}: ventas {p['ventas']} neto {p['neto']} ({p['operaciones']} op)\")"

echo "20. Cierre de turno con diferencia"
ESPERADO=$(req GET /caja/turno/arqueo "$TK_CAJA" | py "import sys,json;print(json.load(sys.stdin)['efectivo_esperado'])")
DECLARADO=$(py "print(round(float('$ESPERADO')-500,2))")
req POST /caja/turno/cerrar "$TK_CAJA" "{\"total_declarado\":$DECLARADO,\"nota\":\"faltaron 500\"}" | py "
import sys,json;d=json.load(sys.stdin)
print(f\"      esperado {d['efectivo_esperado']} declarado {d['total_declarado']} diferencia {d['diferencia']}\")"

echo "21. Reportes"
# El reporte sin fechas tiene que ver lo que se cobró recién. Si devuelve cero,
# el "hoy" del servidor no es el del local — pasaba de 21 a 24 por usar UTC.
req GET /reportes/resumen "$TK_CAJA" | py "
import sys,json;d=json.load(sys.stdin)
print(f\"      tickets {d['tickets']} | venta {d['venta']} | promedio {d['ticket_promedio']} | por comensal {d['por_comensal']}\")
assert d['tickets'] > 0, f'el reporte del dia no ve las ventas de hoy (rango {d[\"rango\"]})'"
req GET /reportes/tiempos "$TK_CAJA" | py "
import sys,json;d=json.load(sys.stdin)
print(f\"      mesa {d['mesa_minutos']}min | cocina {d['cocina_minutos']}min | cobro {d['cobro_minutos']}min | retiro {d['retiro_minutos']}min\")"
req GET /reportes/perdidas "$TK_CAJA" | py "
import sys,json;d=json.load(sys.stdin)
print(f\"      devuelto {d['total_devuelto']} | anulado {d['total_anulado']} | no cobrado {d['total_no_cobrado']}\")"
req GET /reportes/por-producto "$TK_CAJA" | py "
import sys,json
for p in json.load(sys.stdin)[:3]: print(f\"      {p['unidades']}x {p['producto']} = {p['venta']}\")"

echo "22. Auditoría de lo que le importa al dueño"
req GET '/admin/auditoria?accion=sensibles' "$TK_CAJA" | py "
import sys,json
for a in json.load(sys.stdin)[:8]:
  print(f\"      {a['accion']:<22} {a['actor_nombre'] or '-':<16} {a['motivo'] or ''}\")"

echo "23. La carta ya no se sirve sin login"
# El local usa carta en papel: no hay superficie pública. Que siga dando 404
# importa, porque una API abierta que nadie mira es la que nadie parchea.
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' $API/publico/carta)
[ "$CODIGO" = "404" ] && ok "/publico/carta -> 404" || { echo "  FALLO: dio $CODIGO"; exit 1; }
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' $API/carta)
[ "$CODIGO" = "401" ] && ok "/carta sin token -> 401" || { echo "  FALLO: dio $CODIGO"; exit 1; }

echo
echo "===== FLUJO COMPLETO OK ====="
