# Logística Clínica Virgen del Lourdes

Esta aplicación administra el inventario del almacén, las solicitudes de productos por área, los despachos, las devoluciones y el kardex de movimientos. Está diseñada para publicarse como sitio estático en **GitHub Pages** y conectarse al proyecto Supabase configurado en `config.js`.

## Publicación en GitHub Pages

Descomprima el archivo ZIP entregado y copie **todos los archivos que contiene** a la raíz de la rama `main` de su repositorio de GitHub. No debe subir una carpeta contenedora: `index.html` debe quedar al mismo nivel que `app.js`, `config.js` y `styles.css`.

En GitHub, abra **Settings → Pages** y seleccione publicación desde la rama `main` y la carpeta `/(root)`. Una vez publicado, GitHub mostrará la URL pública del portal. La guía oficial de configuración está disponible en la documentación de [GitHub Pages][1].

| Archivo | Función |
|---|---|
| `index.html` | Pantalla de acceso, pedidos, stock, kardex y administración. |
| `app.js` | Lógica de inicio de sesión, solicitudes, kardex, despacho, PDF y sincronización. |
| `styles.css` | Diseño adaptable para computadora y móvil. |
| `config.js` | Configuración pública de conexión con Supabase. |
| `README.md` | Esta guía de publicación y uso. |

## Acceso inicial

Cada trabajador ingresa seleccionando su nombre y usando la clave inicial **`123456`**. Después del primer acceso debe cambiar la clave desde la opción **Configuración**. Los productos disponibles dependen del área que tenga asignada el trabajador.

| Perfil | Acciones disponibles |
|---|---|
| Trabajador | Crear solicitudes y devoluciones de productos autorizados para su área. |
| Administración | Ver todos los productos, kardex, pedidos, ingresos, egresos, devoluciones, ajustes e impresión de formatos. |

> La clave inicial es temporal. La administración debe pedir a cada usuario que la cambie antes de utilizar el portal de forma regular.

## Flujo de inventario

El Kardex 2026 fue importado completo, sin aplicar filtros del Excel. El stock no se reemplaza mediante una nueva carga: se calcula a partir de movimientos trazables.

| Movimiento | Efecto | Ejemplo |
|---|---:|---|
| Ingreso | Aumenta stock | Compra, reposición o ingreso de lote. |
| Egreso | Disminuye stock | Entrega de pedido aprobado. |
| Devolución | Aumenta stock | Producto devuelto desde un área. |
| Ajuste | Corrige diferencia | Conteo físico con motivo y responsable. |

Los despachos crean un egreso solo cuando administración confirma la entrega. Las devoluciones crean el movimiento inverso, manteniendo el historial del pedido y del lote.

## Formatos e impresión

Desde administración puede seleccionar pedidos, generar un PDF consolidado y enviarlo a impresión. El formato conserva la lógica de los archivos de despacho: identificación del solicitante, área, productos, cantidades, espacios para firma y sello.

## Uso del APK administrativo

El APK administrativo permite consultar pedidos, stock y kardex desde el almacén, confirmar despachos y compartir el PDF generado. Conserva una copia local de consulta y una cola de operaciones cuando la conexión sea intermitente; al recuperar Internet, sincroniza las operaciones pendientes con Supabase.

## Seguridad y operación

No modifique `config.js` ni elimine códigos de productos desde GitHub. Los ajustes de stock deben hacerse desde Administración, con motivo. Los usuarios solo deben solicitar o devolver productos de su área; las autorizaciones se gestionan desde la base de datos.

## Soporte operativo

Antes de iniciar la operación real, compruebe que cada trabajador tenga su área asignada, cambie su clave inicial y realice un pedido de prueba con un producto de bajo riesgo. Verifique luego que el pedido aparezca en Administración, que el PDF conserve el formato y que el despacho reduzca el stock.

## Referencias

[1]: https://docs.github.com/pages/getting-started-with-github-pages/creating-a-github-pages-site "Creating a GitHub Pages site"
