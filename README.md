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

La carga desde Excel lee únicamente la pestaña **INVENTARIO**. Esa pestaña mantiene el catálogo mínimo —código, descripción, unidad y stock actual— y no importa `REGISTRO 2026`, `TABLA`, `CONSUMO CEBADO` ni `PRECIOS COSTOS`. En productos existentes, el stock de la pestaña INVENTARIO sincroniza el saldo actual; no se crean movimientos `INICIAL` nuevos.

El Kardex operativo muestra únicamente movimientos reales hechos en la aplicación. Las cargas iniciales antiguas se conservan como referencia técnica, pero quedan excluidas de la consulta operativa.

| Movimiento | Efecto | Ejemplo |
|---|---:|---|
| Ingreso | Aumenta stock | Compra, reposición o ingreso de lote. |
| Egreso | Disminuye stock | Salida de 1 paquete de papel toalla. |
| Devolución | Aumenta stock | Producto devuelto desde un área. |
| Ajuste positivo | Aumenta stock | Conteo físico superior al saldo. |
| Ajuste negativo | Disminuye stock | Conteo físico inferior al saldo. |

Para corregir una diferencia se debe registrar el movimiento desde **Actualizar inventario**, indicando código, tipo, cantidad y motivo. Cada columna del Kardex tiene un botón de copiado individual y existe también la opción **Copiar todo** para pegar directamente en Excel.

La conciliación inicial de A0097 `PAPEL TOALLA GOFRADO` dejó `stock_actual = 99`: se partió del stock inicial de 100 y se registró el egreso real de 1 paquete.

## Formatos e impresión

Desde administración puede seleccionar pedidos, generar un PDF consolidado y enviarlo a impresión. El formato conserva la lógica de los archivos de despacho: identificación del solicitante, área, productos, cantidades, espacios para firma y sello.

## Versión móvil

Este repositorio contiene una aplicación web estática para GitHub Pages; no contiene un proyecto Android, Expo ni código fuente de APK. Por ello, estos cambios no requieren generar un APK nuevo. La aplicación sigue siendo responsive y puede instalarse en el teléfono desde el navegador mediante **Añadir a pantalla de inicio**. Si posteriormente se solicita un APK independiente, será necesario crear un proyecto móvil envolvente y definir su política de publicación.

## Seguridad y operación

No modifique `config.js` ni elimine códigos de productos desde GitHub. Los ajustes de stock deben hacerse desde Administración, con motivo. Los usuarios solo deben solicitar o devolver productos de su área; las autorizaciones se gestionan desde la base de datos.

Las tablas de logística tienen RLS habilitado y políticas `*_solo_rpc` para `anon` y `authenticated`. El acceso directo a las tablas no devuelve filas; la aplicación trabaja mediante funciones RPC `SECURITY DEFINER`. No se activó `FORCE ROW LEVEL SECURITY`, porque bloquearía las funciones actuales propiedad de `postgres`. La política SQL aplicada se conserva en `supabase_rls_logistica_20260819.sql`. Se recomienda revisar periódicamente los permisos `EXECUTE` de las RPC y crear políticas más granulares si en el futuro se habilita acceso directo desde el cliente.

## Soporte operativo

Antes de iniciar la operación real, compruebe que cada trabajador tenga su área asignada, cambie su clave inicial y realice un pedido de prueba con un producto de bajo riesgo. Verifique luego que el pedido aparezca en Administración, que el PDF conserve el formato y que el despacho reduzca el stock.

## Referencias

[1]: https://docs.github.com/pages/getting-started-with-github-pages/creating-a-github-pages-site "Creating a GitHub Pages site"
