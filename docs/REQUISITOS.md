# Maldita Conducta POS: requisitos organizados

Nombre provisional: Maldita Conducta. Es un café speakeasy de concepto industrial y alternativo. Este documento ordena las notas sueltas de `Crear un GBpos.txt`, dice qué hace hoy el demo y deja las preguntas que siguen abiertas.

Estado: ✅ en el demo · 🟡 simulado en el demo, falta integración real · ⏳ pendiente

## 1. Acceso y roles

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Ingreso de todos con código numérico | ✅ | Teclado de PIN de 4 dígitos en la pantalla de entrada ("¿Cuál es la contraseña?") |
| Acceso por QR | ⏳ | Queda para el backend: QR rotativo por empleado |
| Roles: admin/dueño, líder, barra, cajero, mesero | ✅ | La matriz de permisos vive en `app/src/config.ts` (`PERMS`) y se cambia ahí |
| Meseros solo digitan productos | ✅ | Toman pedidos y los envían; no ven Cobrar ni Caja |
| Anulaciones solo con acceso alto | ✅ | Si quien anula no tiene el permiso, se pide el PIN de un admin y un motivo |
| El admin da y quita permisos a los roles | ✅ | Sección Permisos: interruptores por rol, aplican al instante. El admin siempre los tiene todos |
| Registro de entrada y salida de trabajadores | ✅ | Botón "Marcar turno" en la entrada; horas y registro en Personal |

## 2. Salón y mesas

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Mapa interactivo con números de mesa | ✅ | Plano con colores: verde azulado libre, dorado ocupada, azul con pedido sin enviar |
| Todos los roles ven el plano | ✅ | |
| Agregar, quitar y mover mesas | ✅ | Admin: "Editar plano", arrastrar, renombrar, forma y puestos |
| Varias cuentas por mesa aunque haya una sin pagar | ✅ | "+ Nueva cuenta" siempre está disponible |
| La mesa queda libre al cerrar sus cuentas | ✅ | Al pagar, al anular todo o al abandonar una cuenta vacía |
| Seguimiento de cuándo se creó y se gestionó cada cuenta | ✅ | Hora de apertura, último envío, cierre, quién y duración. En la cuenta y en la sección Cuentas |

## 3. Pedidos

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Elegir producto y cantidad | ✅ | |
| Secciones: bebidas, comidas, promociones, postres… | ✅ | Categorías editables en Ajustes, con ícono |
| Comentario por producto | ✅ | |
| Comanda impresa automática al enviar, con quién pidió | 🟡 | Se arma un ticket por estación (cocina y barra) con nombre y rol. Hoy imprime con el navegador; la impresión directa va por el backend |
| Productos agotados bloqueados por barra y líderes | ✅ | Botón Disponible/Bloqueado en Menú |
| Productos en conteo (ej. solo 20 espressos) | ✅ | Barra pone el conteo en Menú. Se descuenta al enviar y no deja pedir más de lo que queda |

## 4. Cobro y facturación

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Precuenta para imprimir lo consumido | ✅ | Botón "Precuenta" en la cuenta (imprimir o guardar como PDF) |
| Cajero y mesero cierran y cobran cuentas | ✅ | "Cobrar y cerrar cuenta" en la cuenta, o "Cobrar" desde la sección Cuentas. Requiere caja abierta |
| Fraccionar la cuenta en dos cuentas | ✅ | "Separar cuenta" mueve productos a una cuenta nueva de la misma mesa |
| Botón de dividir el pago | ✅ | En 2, 3 o 4 partes, o pagos libres con método distinto cada uno |
| Medios de pago | ✅ | Efectivo, débito, crédito, Nequi, Daviplata y transferencia (editables) |
| Convenios | ✅ prueba | Descuento % elegido en la cuenta; aparece en la factura y en reportes |
| Facturación electrónica con NIT y correo | 🟡 | Tiquete POS o factura electrónica con datos del cliente; CUFE y correo simulados. Ver `INTEGRACIONES.md` |
| La factura se guarda como constancia | ✅ | Sección Facturación, con búsqueda, reimpresión y anulación (nota crédito simulada) |

## 5. Caja

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Abrir caja con valor de entrada en COP | ✅ | Sin caja abierta no se puede cobrar |
| Cierre diario conectado a impresora | 🟡 | Imprime el ticket de cierre con el navegador |
| Al cerrar debe aparecer siempre la base, si no, aviso importante | ✅ | Si el efectivo contado es menor que la base sale una alerta magenta que parpadea; también se avisa faltante o sobrante |
| Cierre de datáfonos | ⏳ | Marcado como pendiente en la pantalla de Caja |

## 6. Inventario, menú y recetas

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Inventario inicial | ✅ | Datos de prueba de un café |
| Facturas de compra que suman o crean productos automáticamente | ✅ | Sección Compras: arrastrar el XML de la factura electrónica del proveedor. Actualiza cantidad y costo promedio y crea los insumos nuevos |
| El consumo descuenta inventario | ✅ | Al enviar el pedido se descuenta según la receta, incluidas las subrecetas |
| Botones para subir o bajar cantidades | ✅ | Con paso configurable por insumo y registro en Movimientos |
| Platos y recetas como menú de venta | ✅ | Cada producto tiene receta con insumos o subrecetas; se ve costo y margen |
| Subrecetas | ✅ | Ejemplos: shot de espresso, leche texturizada, jarabe. Se pueden anidar |
| Solo el dueño o admin crea productos | ✅ | |

## 7. Reportes

| Requisito | Estado | Cómo quedó |
|---|---|---|
| Saber todo sobre las ventas | ✅ | Ventas, ticket promedio, por día, hora, categoría, método y mesero |
| Dónde hubo pérdidas y ganancias | ✅ | Ganancia bruta, margen por producto, anulaciones, mermas y descuadres de caja |
| Anulaciones en el reporte | ✅ | Con quién pidió, quién autorizó y el motivo |
| Power BI | 🟡 | "Exportar CSV (Power BI)" descarga una tabla por archivo. La conexión directa es tarea del backend |

## Decisiones que tomé (se pueden cambiar)

1. El inventario se descuenta al enviar el pedido y no al cobrar, porque ahí es cuando se prepara.
2. Una anulación no devuelve el insumo al inventario, porque el producto pudo haberse preparado. Si se quiere devolver, es un ajuste manual.
3. Los precios incluyen el impuesto (INC 8% por defecto, configurable).
4. Solo se cobra si no quedan productos sin enviar.
5. El cobro exige una caja abierta. El cierre exige que no haya cuentas abiertas con productos.
6. No incluí propina voluntaria. Es muy común en Colombia; si la quieren, es un campo más en el cobro.

## Preguntas abiertas

1. ¿El negocio es responsable de INC o de IVA? Esto lo define el contador y cambia la factura.
2. ¿Qué proveedor tecnológico de facturación electrónica van a usar? La investigación recomienda probar Factus o Alegra.
3. ¿Cuántas impresoras habrá (caja, cocina, barra) y de qué tipo (USB o red)?
4. "Turbo caja": no encontré documentación pública del software. Si tienen acceso a una instalación, conviene revisar qué pantallas les gustan.
5. ¿Los convenios llevan solo descuento o también crédito (cuenta por cobrar a una empresa)?
6. ¿Los meseros usarán su propio celular o tablets del negocio? Esto define si se necesita QR.
7. El video de referencia de las notas (`youtube.com/watch?v=-dC_L90IpM`) parece incompleto y no lo revisé. El short que enviaste (un speakeasy escondido dentro de un supermercado en París) inspiró la entrada con "contraseña".
