-- Conciliación de A0097 PAPEL TOALLA GOFRADO.
-- La primera importación dejó stock_actual en 200 por sumar dos veces el stock inicial de 100.
-- Se corrige a 100 y se registra la salida real de 1 paquete: saldo final 99.
UPDATE public.log_productos
SET stock_actual = stock_inicial,
    actualizado_en = now()
WHERE codigo = 'A0097'
  AND stock_actual = 200;

INSERT INTO public.log_movimientos(
  producto_id, tipo, cantidad, impacto, motivo, area_id, responsable_id, referencia_cliente
)
SELECT
  p.id,
  'EGRESO',
  1,
  -1,
  'Salida de 1 paquete reportada en el Kardex de Excel; conciliación inicial',
  (SELECT id FROM public.log_areas WHERE codigo = 'ALMACEN' AND activo LIMIT 1),
  2,
  gen_random_uuid()
FROM public.log_productos AS p
WHERE p.codigo = 'A0097'
LIMIT 1;
