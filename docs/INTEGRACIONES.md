# Integraciones del POS (Colombia)

Investigación hecha el 2026-10-23 para el backend del POS de la cafetería. Cada sección cita sus fuentes. Lo marcado con **[sin verificar]** no lo pude confirmar contra una fuente oficial y hay que revisarlo antes de implementarlo.

---

## 1. Facturación electrónica DIAN

### Qué documento emitir

Hay dos documentos electrónicos válidos para una venta en mostrador:

| | Factura electrónica de venta (FEV) | Documento equivalente electrónico tiquete POS (DEE POS) |
|---|---|---|
| Norma | Res. 000042 de 2020, actualizada por la Res. 000165 de 2023 (Anexo 1.9) | Res. 000165 de 2023 (Anexo Técnico DEE 1.0), con cambios de las Res. 000008 y 000119 de 2024 |
| Cuándo | Siempre que el cliente la pida | Venta normal en caja |
| Código CUFE/CUDE | CUFE (SHA-384) | CUDE (SHA-384) |
| Datos del cliente | Obligatorios: tipo y número de documento (NIT con DV o CC), nombre o razón social, email, dirección, responsabilidades fiscales | Opcionales. Si el cliente da nombre y NIT, el DEE le sirve para costos, deducciones e IVA descontable |

Lo que cambió y conviene tener claro:

- El tiquete POS en papel dejó de ser documento equivalente válido. La DIAN lo dice en el Oficio 6259 de 2024 citando la Res. 000008 de 2024. Todo debe salir electrónico.
- El tope de 5 UVT ya no aplica al POS electrónico. Según el comunicado de la DIAN de 2024, el DEE POS no tiene límite de valor (el tope de la Res. 1092 de 2022 era para el POS en papel). Aun así, si el cliente pide factura, hay que expedir FEV. Como referencia, la UVT de 2026 es $52.374 (Res. 000238 de 2025).
- Para consumidor final sin identificación se usa el número genérico `222222222222` con nombre "Consumidor final" (art. 11 de la Res. 000042 de 2020). **[sin verificar]** No confirmé en el Anexo DEE 1.0 qué campos exactos exige para el adquirente genérico; lo validará el proveedor tecnológico.

### Detalles técnicos que el backend debe modelar

- **XML UBL 2.1 con extensiones DIAN.** Lleva el bloque `DianExtensions` con `InvoiceControl` (la resolución de numeración), `SoftwareProvider` y `SoftwareSecurityCode`. Según una implementación de referencia de Odoo, el DEE POS usa tipo de documento 20 y código de operación 48 **[sin verificar en el anexo oficial]**.
- **Numeración.** Cada caja o punto de venta tiene su propia resolución de numeración: prefijo, rango desde/hasta, vigencia y clave técnica. El backend tiene que asignar consecutivos de forma atómica y avisar cuando el rango se esté agotando o la vigencia esté por vencer.
- **QR.** Va en la representación gráfica (el ticket impreso o el PDF) y apunta a la URL de consulta de la DIAN con el CUFE o CUDE. El tiquete además lleva número, fecha, valor total, IVA y CUDE.
- **Entrega al cliente.** La factura solo se considera expedida cuando la DIAN o el proveedor la valida y se le entrega al adquirente (art. 616-1 ET). En la práctica eso significa enviar el XML (en un AttachedDocument) y el PDF al email del cliente. El proveedor tecnológico normalmente se encarga del envío.
- **Conservación.** Cinco años (art. 632 ET; Concepto DIAN 1260 de 2024). Las fuentes no coinciden en si el plazo corre desde la expedición o desde el 1 de enero del año siguiente; lo prudente es guardar el XML y el CUFE/CUDE de forma indefinida, que sale barato. La Ley 962 de 2005 lo amarra a la firmeza de la declaración.
- **Notas crédito.** Las anulaciones y devoluciones no borran el documento; se emite una nota crédito o una nota de ajuste al DEE que lo referencia. El modelo de datos tiene que permitirlo desde el inicio.

### Proveedores tecnológicos con API

| Proveedor | API | Auth | DEE POS por API | Notas |
|---|---|---|---|---|
| **Factus** (Halltec) | REST, docs públicas: https://developers.factus.com.co/ | OAuth2 (token + refresh) | **[sin verificar]** La página de docs lista facturas, notas, documento soporte, nómina y rangos de numeración, pero no menciona el DEE POS | Colecciones de Postman y Bruno. Pensada para developers |
| **Alegra** | REST: https://developer.alegra.com/ | HTTP Basic con email y token (según Apideck) | **[sin verificar]** Tiene `POST /invoices` y endpoint de timbrado. Alegra POS convierte el documento POS en factura, pero no encontré el endpoint público del DEE | Muy usada por pymes; también trae contabilidad |
| **Siigo** | REST: https://siigoapi.docs.apiary.io/ | Token desde `https://api.siigo.com/auth` (usuario API + access key) | **[sin verificar]** | La API está orientada a contabilidad y a crear facturas; necesitas una cuenta Siigo Nube |
| **Dataico** | Anuncia API, POS y ERP (https://www.dataico.com) | **[sin verificar]** | **[sin verificar]** | No encontré la documentación pública |
| The Factory HKA | SOAP/REST bajo contrato | Credenciales por contrato | Sí, según su oferta comercial **[sin verificar]** | Proveedor autorizado desde 2017. Más enterprise; la documentación se entrega al firmar |

**Recomendación.** No generes el XML ni firmes tú mismo. Ser tu propio "software propio" ante la DIAN implica certificado digital, proceso de habilitación y pruebas del set de la DIAN, y el mantenimiento de cada anexo nuevo. Usa un proveedor tecnológico con API REST y deja que el backend le mande un JSON con la venta. Antes de firmar, pide por escrito que el proveedor soporte el **DEE POS por API** (no solo la FEV), notas crédito al DEE y la conversión de POS a FEV. Por documentación pública, Factus es el más amigable para un developer; Alegra es una buena alternativa si el negocio ya lleva su contabilidad ahí. Diseña una interfaz `InvoiceProvider` con dos métodos (`emitPos`, `emitInvoice`) y una cola con reintentos, porque la DIAN y los proveedores fallan, y la venta no puede quedarse bloqueada en la caja (hay modo contingencia).

Fuentes:
- https://cancilleria.gov.co/normograma/compilacion/docs/resolucion_dian_0165_2023.htm
- https://normograma.invima.gov.co/normograma/docs/pdf/resolucion_dian_0165_2023.pdf
- https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_6259_2024.htm
- https://ambitojuridico.com/sites/default/files/2024-01/COMUNICADO-Losgrandescontribuyentes-2024.pdf
- https://sovos.com/co/iva/documento-equivalente-electronico-pos/
- https://cancilleria.gov.co/sites/default/files/Normograma/docs/resolucion_dian_0042_2020.htm
- https://legalytributarioenlinea.co.pwc.com/Repositorio%20PwC/PDF/Doctrina/DIAN/Conceptos/2022/CON-000043-22.PDF
- https://incp.org.co/agendatributariaincp/noticias/2025/12/dian-fijo-en-52-374-en-valor-de-la-uvt-para-el-ano-gravable-2026/
- https://accounter.co/normatividad/la-dian-para-exigir-la-entrega-de-copias-de-las-facturas-electronicas-o-documentos-equivalentes-concepto-dian-1260-de-2024
- https://actualicese.com/tiempo-de-conservacion-de-facturas-y-documentos-equivalentes/
- https://www.cijuf.org.co/node/23160
- https://apps.odoo.com/apps/modules/19.0/l10n_co_dian_pos_dee
- https://developers.factus.com.co/
- https://developer.alegra.com/
- https://developers.apideck.com/apis/accounting/alegra
- https://siigoapi.docs.apiary.io/
- https://actualicese.com/dataico-cumplimiento-a-la-dian-y-revolucion-de-la-gestion-empresarial/
- https://www.contapyme.com/acuerdos/facturacion-electronica/tfhka.pdf

---

## 2. Impresoras térmicas (comandas y cierre de caja)

Las impresoras de 80 mm (Epson TM-T20, Xprinter, 3nStar, etc.) hablan **ESC/POS**: bytes crudos para texto, negrita, corte de papel, apertura del cajón monedero y QR nativo. Se puede llegar a ellas de cuatro formas:

| Opción | Cómo funciona | A favor | En contra |
|---|---|---|---|
| `window.print()` con CSS de 80 mm | `@page { size: 80mm auto; margin: 0 }` y el driver de Windows | Cero código extra | Muestra el diálogo de impresión (salvo Chrome en modo `--kiosk-printing`), no corta el papel ni abre el cajón de forma fiable y solo maneja una impresora por defecto |
| WebUSB / Web Serial | El navegador manda ESC/POS directo | No hay que instalar nada | Solo funciona en Chrome y Edge. En Windows el driver del fabricante suele "capturar" el USB y WebUSB no lo ve. Hay que pedir permiso por dispositivo |
| QZ Tray | Agente local (Java) que recibe trabajos por WebSocket desde la web | Imprime crudo y en silencio, maneja varias impresoras (cocina y caja), USB, serial y red | Hay que instalarlo en cada PC. Para no mostrar el aviso de confianza, necesita un certificado firmado (plan de pago) |
| Impresora de red, puerto 9100 | El backend (o un agente en el local) abre un socket TCP a `IP:9100` y escribe los bytes ESC/POS | No depende del navegador ni del PC. Las comandas de cocina salen aunque la caja esté apagada | Las impresoras deben tener Ethernet o Wi-Fi e IP fija. Si el backend está en la nube, no ve la LAN del café, así que hace falta un agente local |

**Recomendación.** Compra impresoras con **Ethernet**, ponles IP fija y manda ESC/POS por TCP 9100. Si el backend corre en la nube, monta un agente pequeño dentro del café (un Node o Python en un mini PC o Raspberry) que se conecte al backend por WebSocket o haga polling a una cola `print_jobs`, y que escriba al socket de cada impresora. Con eso las comandas se rutean por estación (barra, cocina) y el cierre de caja sale en la de caja, sin diálogos. Usa una librería existente para armar los bytes (por ejemplo `node-thermal-printer` o `escpos` en Node, o `python-escpos`) y guarda cada trabajo con su estado para poder reimprimir. Deja `window.print()` con CSS de 80 mm solo como plan B. Cuidado con la codificación: usa la página de códigos de la impresora (CP850/CP858 o ISO-8859-1) para que salgan bien las tildes y la ñ; QZ advierte que UTF-8 corrompe los QR.

Fuentes:
- https://github.com/qzind/tray/wiki/What-is-Raw-Printing
- https://qz.io/docs/raw-legacy
- https://docs.frappe.io/framework/user/en/printing/raw-and-network-printing
- https://yomotherboard.com/question/whats-the-best-way-to-print-esc-pos-receipts-from-a-web-saas-2/
- **[sin verificar en fuente]** Lo de WebUSB/Web Serial solo en navegadores Chromium y el conflicto con drivers de Windows viene de mi conocimiento previo, no de una búsqueda de esta sesión. Ver https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API

---

## 3. Power BI

| Opción | Esfuerzo | Frescura | Nota |
|---|---|---|---|
| Exportar CSV o Excel | Mínimo | Manual | Sirve para empezar, pero se rompe cuando alguien cambia el archivo |
| Conexión directa a Postgres/MySQL | Bajo | Refresh programado (8 al día en Pro) | Si la BD no es accesible desde Azure, necesita el **on-premises data gateway** en una máquina que sí la vea |
| API REST + Power Query (conector Web) | Medio | Refresh programado | Útil si no quieres exponer la BD. La paginación y la autenticación quedan a tu cargo, y Power Query es incómodo para eso |
| Push / streaming datasets | n/a | Tiempo real | **No usar.** Microsoft dejó de permitir crear modelos push y streaming nuevos desde el 31 de octubre de 2024 y retira los existentes en octubre de 2027. El reemplazo es Real-Time Intelligence de Fabric |

**Recomendación.** Crea un esquema `bi` en la misma base (o en una réplica de solo lectura) con **vistas** en estrella, y un usuario de BD de solo lectura que solo vea ese esquema. Power BI se conecta en modo Import con refresh programado, usando gateway si la BD es privada. Para un café, el tiempo real no hace falta: con refrescar cada hora alcanza.

Modelo sugerido (granos explícitos):

- `fact_venta`: una fila por documento (ticket o factura). Columnas: `venta_id`, `fecha_key`, `hora`, `empleado_key`, `mesa_key`, `caja_key`, `cierre_id`, subtotal, descuento, impuesto (INC o IVA), propina, total, tipo de documento (DEE o FEV), CUFE/CUDE y estado.
- `fact_venta_linea`: una fila por ítem. `venta_id`, `producto_key`, cantidad, precio unitario, descuento, impuesto, total y costo (si existe receta o costo estándar).
- `fact_pago`: una fila por pago, porque una venta se puede pagar en partes. `venta_id`, `metodo_pago_key`, monto, autorización del datáfono, franquicia.
- `fact_anulacion`: anulaciones y devoluciones, con `venta_id` original, `linea_id` (si aplica), motivo, empleado que anula, empleado que autoriza, monto y nota crédito asociada.
- `fact_cierre_caja`: una fila por cierre. Caja, empleado, apertura y cierre (timestamps), base inicial, esperado por método de pago, contado, diferencia, y el total del datáfono frente al del sistema.
- Dimensiones: `dim_fecha` (con festivos de Colombia), `dim_producto` (categoría, subcategoría, estación de preparación), `dim_empleado`, `dim_mesa` (zona), `dim_metodo_pago` (efectivo, tarjeta débito o crédito, Nequi, Daviplata, Bre-B, transferencia), `dim_caja`.

Ojo con un detalle: en restaurantes el impuesto suele ser el **impuesto al consumo (INC) del 8%**, no IVA, según el régimen del negocio. Guarda el tipo y la tarifa de impuesto por línea y no los calcules en BI. **[sin verificar en esta sesión]** Que el café sea responsable de INC o de IVA lo define el contador.

Fuentes:
- https://powerbi.microsoft.com/blog/announcing-the-retirement-of-real-time-streaming-in-power-bi
- https://community.fabric.microsoft.com/t5/Developer/Creation-of-streaming-dataset-is-deprecated-We-recommend/td-p/4270482
- https://community.fabric.microsoft.com/t5/Desktop/Scheduled-Refresh-for-PostgreSQL-Render/m-p/4817296
- https://medium.com/niftit-sharepoint-blog/installing-power-bi-data-gateway-for-refresh-of-postgresql-database-6a58e14e59e3
- https://dev.to/josepho_okwemba_a02e2378a/power-bi-meets-postgresql-a-practical-guide-to-local-and-cloud-database-connections-79i

---

## 4. Datáfonos (Redeban, Credibanco, Bold)

Sí se pueden integrar, pero ninguno publica una API abierta para developers. Cada integración se negocia con el adquirente:

- **Redeban.** La integración "caja" usa su aplicación de Windows *Cajas* (`Cajas.exe`). El POS escribe un archivo de solicitud (`SOLICITUD.TXT`) y lee la respuesta (`RESPUESTA.TXT`) según el manual técnico que entrega Redeban. Un módulo de Odoo lo resuelve con un agente local en `127.0.0.1:8765` que recibe compras y anulaciones y devuelve autorización, franquicia, recibo y RRN.
- **Credibanco.** Ofrece "integración con caja registradora" y datáfonos Android con tienda de apps. La conciliación se hace en su portal HubConnect. No encontré documentación técnica pública.
- **Bold.** Integra su propio Bold POS con sus datáfonos. No encontré una API pública para que un POS de terceros mande el cobro al datáfono **[sin verificar]**; hay que preguntarle a su equipo comercial.

**Recomendación.** Arranca **sin integración** (modo "no integrado"): el cajero digita el monto en el datáfono y luego, en el POS, registra el pago con método, franquicia, últimos 4 dígitos y número de aprobación. Así se cuadra igual y no dependes de nadie. Si luego hace falta integrar, el patrón sería el mismo agente local de las impresoras con un adaptador por adquirente.

Cierre de datáfono (conciliación):
1. Al cerrar la caja, el cajero hace el cierre en el datáfono (la opción "cierre" o "totales"), que imprime el total por franquicia y el número de transacciones.
2. El POS muestra lo registrado como tarjeta en el turno, agrupado por franquicia y datáfono.
3. El cajero digita los totales del voucher de cierre; el sistema calcula la diferencia y exige un motivo si no da cero.
4. Al día siguiente (o en T+1 o T+2, según el adquirente), se cruza contra el reporte de abonos del portal del adquirente (HubConnect en Credibanco, el portal de Redeban, la app de Bold) usando el número de aprobación y el monto, y se descuenta la comisión y la retención para ver el neto.

Guarda el número de aprobación en `fact_pago`; es la llave del cruce.

Fuentes:
- https://apps.odoo.com/apps/modules/16.0/pos_redeban_co
- https://blog.alegra.com/colombia/que-es-un-datafono/
- https://forbes.co/2025/05/15/negocios/credibanco-la-esta-dando-toda-por-la-digitalizacion-de-los-pagos-del-pais/
- https://dplnews.com/colombia-credibanco-mejora-la-experiencia-de-los-comercios-con-el-sistema-de-pagos-inmediatos-bre-b/
- https://www.larepublica.co/credibanco
- https://www.bold.co/legal/bold-pos

---

## 5. TurboCaja

**[sin verificar]** No encontré ningún producto llamado "TurboCaja" en las búsquedas ("TurboCaja", "Turbo Caja", con y sin "Colombia"), y el dominio `turbocaja.com` no resuelve. Puede ser un software local que no tiene presencia web o que se llama distinto. Si alguien del café lo usa, lo mejor es pedir capturas o el nombre del fabricante.

Lo que sí vale la pena copiar, según lo que ofrecen los POS de restaurante en Colombia (Siigo POS, Alegra POS, Vendty, PirPos, Poster):

- Mapa de mesas con estado (libre, ocupada, cuenta pedida) y traslado o unión de mesas.
- Comanda por estación: la bebida va a barra y la comida a cocina, con reimpresión y nota por ítem ("sin azúcar", "leche deslactosada").
- Dividir la cuenta por ítem o por partes iguales, y pago mixto (efectivo más tarjeta).
- Propina sugerida (voluntaria, 10%), que el cliente puede quitar y que se reporta aparte.
- Apertura de caja con base, retiros y gastos menores durante el turno, y cierre ciego (el cajero cuenta sin ver el esperado).
- Anulaciones que exigen PIN de supervisor y motivo.
- Convertir un tiquete POS en factura electrónica cuando el cliente la pide después.
- Inventario por receta (descontar café en grano y leche por bebida vendida), aunque es opcional para una primera versión.

Fuentes:
- https://www.siigo.com/blog/software-para-restaurantes/
- https://www.comparasoftware.com/sistema-pos-gastrobar
- https://apps.apple.com/us/app/id1084859936

---

## 6. Registro de ingreso de empleados (PIN o QR)

Para el backend: una tabla `marcacion` (empleado, tipo entrada/salida, timestamp del servidor, dispositivo, método PIN o QR). Usa siempre la hora del servidor, no la del navegador. Para que nadie marque por otro, usa un QR que rote (por ejemplo, un token firmado de 30 segundos que se muestra en la tablet de la caja y que el empleado escanea con su celular), o un PIN más una foto. No guardes el PIN en claro.

Nota legal breve:
- Desde el **15 de julio de 2026** la jornada máxima es de **42 horas semanales** (Ley 2101 de 2021, último escalón de la reducción). El salario no baja y el divisor de la hora ordinaria pasa a 210 horas al mes.
- Lo que pase de la jornada es hora extra (recargo de 25% diurna y 75% nocturna). El recargo dominical y festivo subió al 90% desde julio de 2026, según la Ley 2466 de 2025 **[sin verificar en el texto oficial]**.
- No encontré una norma que obligue a un sistema de marcación, pero en una inspección del Ministerio de Trabajo el registro de turnos es la forma práctica de probar que se pagaron las extras. Calcula por turno las horas ordinarias, extras, nocturnas y dominicales, y deja que nómina las liquide. **[sin verificar]** No confirmé en esta sesión la hora exacta en que empieza el recargo nocturno tras la Ley 2466; déjala configurable.
- El registro de ingresos es un dato personal (Ley 1581 de 2012). Informa a los empleados para qué se usa y no recolectes biometría sin autorización expresa.

Fuentes:
- https://actualicese.com/reduccion-de-la-jornada-laboral-2026-reglas-y-aplicacion/
- https://www.publimetro.co/noticias/2026/06/23/jornada-laboral-de-42-horas-en-colombia-lo-que-cambiara-desde-el-15-de-julio-para-trabajadores-y-pymes/
- https://www.siigo.com/blog/derecho-laboral/reduccion-de-jornada-laboral-colombia/
- https://blog.alegra.com/colombia/cambios-jornada-laboral-colombia/
- https://softland.com/co/nueva-jornada-laboral-2026/

---

## Pendientes antes de implementar

1. Confirmar con el contador si el café factura con INC o IVA y en qué calendario de DEE POS quedó.
2. Pedirle a 2 o 3 proveedores tecnológicos una demo del **DEE POS por API**, con sandbox.
3. Revisar el Anexo Técnico DEE 1.0 y sus actualizaciones en el micrositio de la DIAN; lo que está aquí sale de fuentes secundarias y de una implementación de referencia.
4. Comprar impresoras con Ethernet.
5. Preguntar al adquirente del datáfono si ofrece integración con caja y a qué costo.
