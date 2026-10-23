# Maldita Conducta POS (demo frontend)

Caja registradora y gestión para un café speakeasy. Es solo el frontend: los datos viven en el navegador (localStorage) hasta que exista el backend.

## Correr

```bash
cd app
npm install
npm run dev      # http://localhost:5173 (también accesible desde tablet/celular en la misma red)
npm test         # pruebas de las reglas de negocio
npm run build
```

PINs de prueba (también salen en la pantalla de entrada): 1111 admin, 2222 líder, 3333 barra, 4444 cajero, 5555 y 6666 meseros.

Un recorrido corto: entra como cajero (4444) y abre la caja. Sal y entra como mesero (5555): toca una mesa en Salón, pide, envía, imprime la precuenta y cobra. Como barra (3333) pon un producto en conteo en Menú. Como admin (1111) revisa Permisos, Compras y Reportes.

## Estructura

```
app/src/
  types.ts     contrato de datos: las entidades que el backend debe exponer
  logic.ts     reglas puras (recetas y subrecetas, totales, división de pagos, cuadre de caja)
  store.ts     estado y acciones; hoy guarda en localStorage
  config.ts    nombre de la app, permisos por rol, íconos de categoría
  seed.ts      datos de prueba con 14 días de historial
  styles.css   paleta y estilo (tokens en :root)
  screens/     una pantalla por sección
docs/
  REQUISITOS.md      las notas organizadas, estado de cada punto y preguntas abiertas
  INTEGRACIONES.md   investigación: DIAN, impresoras, Power BI, datáfonos
  ejemplo-factura-proveedor.xml   para probar la carga de compras por XML
```

## Conectar el backend

Las pantallas solo llaman funciones de `store.ts` (`openAccount`, `addLine`, `sendOrder`, `pay`, `registerPurchase`, `closeCashSession`…). Para pasar a la API se reemplaza el cuerpo de cada una por su llamada HTTP y la carga inicial por un GET; las pantallas no cambian. `types.ts` sirve como esquema de las tablas y `logic.ts` se puede portar tal cual para validar en el servidor.

Cosas que el backend debe asumir y que el demo deja marcadas con `shortcut:` en el código:

- Los PIN están en texto plano; hay que guardar un hash.
- El CUFE y el envío por correo son simulados.
- La impresión usa el diálogo del navegador; la impresión directa va con ESC/POS por red.
- El costo en los reportes usa las recetas actuales. Para tener costo histórico, cada venta debe guardar su costo.

## Cambios rápidos

- Nombre de la app: `APP_NAME` en `config.ts` y el `<title>` de `index.html`.
- Colores: variables de `:root` en `styles.css`.
- Quién puede hacer qué: `PERMS` en `config.ts`.
- Categorías, métodos de pago, impuesto y prefijo de factura: pantalla Ajustes.

## Publicar

`.github/workflows/deploy.yml` compila, corre las pruebas y publica en GitHub Pages con cada push a `main` (también se puede lanzar a mano desde la pestaña Actions). Una sola vez, en el repositorio: Settings → Pages → Source: **GitHub Actions**. La URL queda como `https://<usuario>.github.io/<repo>/`.
