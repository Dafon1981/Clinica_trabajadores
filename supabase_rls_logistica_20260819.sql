-- RLS para logística.
-- Las tablas quedan protegidas contra lecturas/escrituras directas desde anon/authenticated.
-- La aplicación usa funciones SECURITY DEFINER propiedad de postgres, que continúan
-- realizando las operaciones autorizadas después de activar RLS.
-- No se usa FORCE ROW LEVEL SECURITY para no bloquear esas RPC.

ALTER TABLE public.log_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_producto_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_importaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_sesiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_areas_solo_rpc" ON public.log_areas;
CREATE POLICY "log_areas_solo_rpc" ON public.log_areas
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_productos_solo_rpc" ON public.log_productos;
CREATE POLICY "log_productos_solo_rpc" ON public.log_productos
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_usuarios_solo_rpc" ON public.log_usuarios;
CREATE POLICY "log_usuarios_solo_rpc" ON public.log_usuarios
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_producto_area_solo_rpc" ON public.log_producto_area;
CREATE POLICY "log_producto_area_solo_rpc" ON public.log_producto_area
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_importaciones_solo_rpc" ON public.log_importaciones;
CREATE POLICY "log_importaciones_solo_rpc" ON public.log_importaciones
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_pedidos_solo_rpc" ON public.log_pedidos;
CREATE POLICY "log_pedidos_solo_rpc" ON public.log_pedidos
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_pedido_items_solo_rpc" ON public.log_pedido_items;
CREATE POLICY "log_pedido_items_solo_rpc" ON public.log_pedido_items
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_movimientos_solo_rpc" ON public.log_movimientos;
CREATE POLICY "log_movimientos_solo_rpc" ON public.log_movimientos
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "log_sesiones_solo_rpc" ON public.log_sesiones;
CREATE POLICY "log_sesiones_solo_rpc" ON public.log_sesiones
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
