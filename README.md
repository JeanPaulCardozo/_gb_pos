# Maldita Conducta POS (demo frontend)

Caja registradora y gestión para Maldita Conducta, un café speakeasy de concepto industrial. El nombre es provisional. Este repositorio es solo el frontend: mientras no exista el backend, los datos viven en el navegador (localStorage), así que cada dispositivo ve los suyos.

Hecho con React 18, Vite y TypeScript. Los íconos son de [Lucide](https://lucide.dev/icons/).

## Correr

```bash
cd app
npm install
npm run dev      # http://localhost:5173 (también accesible desde tablet/celular en la misma red)
npm test         # pruebas de las reglas de negocio
npm run build
```

Las pruebas usan el soporte nativo de TypeScript de Node, así que necesitan Node 23.6 o superior.

## Usuarios de prueba

| PIN | Usuario | Rol |
|---|---|---|
| 1111 | Dueño | Admin / dueño |
| 2222 | Valentina | Líder |
| 3333 | Andrés | Barra |
| 4444 | Camila | Cajero |
| 5555 | Mateo | Mesero |
| 6666 | Sofía | Mesero |

Los PIN también aparecen en la pantalla de entrada, en "PINs del demo". Para cambiar de rol, toca Salir y entra con otro PIN.

Un recorrido corto:

1. Como cajero (4444), abre la caja con la base.
2. Como mesero (5555), toca una mesa en el Salón, pide, envía el pedido, imprime la precuenta y cobra.
3. Como barra (3333), pon un producto en conteo en Menú y recetas.
4. Como admin (1111), revisa Permisos, Compras y Reportes.

## Secciones

| Sección | Para qué sirve |
|---|---|
| Salón | Plano de mesas. Al tocar una mesa se abre su cuenta. El admin agrega, quita y mueve mesas |
| Cuentas | Cuentas abiertas y cerradas, con hora de apertura, último envío, cierre, quién las gestionó y cuánto duraron |
| Caja | Apertura con base, ventas por método de pago y cierre con alerta si falta la base |
| Menú y recetas | Productos, recetas y subrecetas, costo y margen. Barra bloquea productos agotados o los pone en conteo |
| Inventario | Insumos, ajustes manuales y movimientos |
| Compras | Subir la factura del proveedor (XML) para sumar o crear insumos en el inventario |
| Facturación | Tiquetes POS y facturas electrónicas emitidas, reimpresión y anulación |
| Reportes | Ventas, ganancias, pérdidas (anulaciones, mermas, descuadres) y export CSV para Power BI |
| Personal | Empleados, PIN y registro de entradas y salidas |
| Permisos | El admin da y quita permisos a cada rol |
| Convenios | Descuentos por acuerdo (de prueba) |
| Ajustes | Datos de la empresa, impuesto, numeración, categorías, métodos de pago y respaldo. Solo el admin, sin excepción |

Dentro de una cuenta se agregan productos con cantidad y comentario. Desde ahí se envía la comanda a cocina y barra, se imprime la precuenta, se separa la cuenta o se divide el pago, y se cobra y cierra. Cuando se cierran sus cuentas, la mesa queda libre.

## Estructura

```
app/src/
  types.ts     contrato de datos: las entidades que el backend debe exponer
  logic.ts     reglas puras (recetas y subrecetas, totales, división de pagos, cuadre de caja)
  store.ts     estado y acciones; hoy guarda en localStorage. También la regla de permisos (can)
  config.ts    nombre de la app, permisos por defecto, permisos solo de admin, íconos de categoría
  seed.ts      datos de prueba con 14 días de historial
  styles.css   paleta y estilo (tokens en :root)
  ui.tsx       piezas compartidas: ventana modal, teclado de PIN, tickets, barras
  screens/     una pantalla por sección
docs/
  REQUISITOS.md      las notas originales organizadas, estado de cada punto y preguntas abiertas
  INTEGRACIONES.md   investigación: DIAN, impresoras, Power BI, datáfonos
  ejemplo-factura-proveedor.xml   para probar la sección Compras
```

## Conectar el backend

Las pantallas solo llaman funciones de `store.ts`, como `openAccount`, `addLine`, `sendOrder`, `pay`, `registerPurchase` o `closeCashSession`. Para pasar a la API se reemplaza el cuerpo de cada una por su llamada HTTP y la carga inicial por un GET, sin tocar las pantallas. `types.ts` sirve como esquema de las tablas, y `logic.ts` se puede portar tal cual para validar en el servidor.

Los permisos se revisan en el navegador solo para mostrar u ocultar opciones. El backend tiene que volver a validarlos en cada petición, sobre todo las anulaciones y Ajustes.

El demo deja marcadas con `shortcut:` en el código las cosas que el backend debe resolver:

- Los PIN están en texto plano. Hay que guardar un hash.
- Las anulaciones de factura son locales. En producción se emite la nota crédito electrónica ante la DIAN.
- El CUFE y el envío por correo son simulados.
- La impresión usa el diálogo del navegador. La impresión directa va con ESC/POS por red.
- El acceso es solo por PIN. Falta el QR.
- El costo en los reportes usa las recetas actuales. Para tener costo histórico, cada venta debe guardar su costo.

## Cambios rápidos

- Nombre de la app: `APP_NAME` en `config.ts` y el `<title>` de `index.html`.
- Colores: variables de `:root` en `styles.css`.
- Permisos de cada rol: sección Permisos dentro de la app. Los valores de fábrica están en `DEFAULT_PERMS` (`config.ts`), y lo que ningún rol puede recibir, en `ADMIN_ONLY`.
- Íconos de categoría: `CATEGORY_ICON` en `config.ts`, con nombres de Lucide.
- Categorías, métodos de pago, impuesto y prefijo de factura: sección Ajustes.

## Publicar

`.github/workflows/deploy.yml` corre las pruebas, compila y publica en GitHub Pages con cada push a `main`. También se puede lanzar a mano desde la pestaña Actions. Si una prueba falla, no publica.

Una sola vez, en el repositorio: Settings → Pages → Source: **GitHub Actions**. La URL queda como `https://<usuario>.github.io/<repo>/`.
