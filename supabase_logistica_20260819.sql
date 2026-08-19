-- Migración de logística: catálogo de Excel, stock y Kardex operativo.
-- Ejecutar con Supabase MCP/SQL Editor antes de publicar los archivos estáticos.

-- Áreas que aparecen en el registro entregado por el usuario.
INSERT INTO public.log_areas (codigo, nombre, activo)
VALUES
  ('ALMACEN', 'Almacén', true),
  ('CUARTO_MAQUINA', 'Cuarto de máquina', true)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    activo = true;

-- Excel INVENTARIO es catálogo + fotografía actual del stock.
-- No crea movimientos INICIAL ni vuelve a sumar el stock inicial.
CREATE OR REPLACE FUNCTION public.log_importar_inventario(
  p_productos jsonb,
  p_archivo_nombre text DEFAULT NULL,
  p_realizado_por bigint DEFAULT NULL
)
RETURNS TABLE(productos_nuevos integer, productos_actualizados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_producto jsonb;
  v_nuevos integer := 0;
  v_actualizados integer := 0;
  v_id bigint;
  v_stock numeric(14,3);
  v_tiene_stock boolean;
begin
  if jsonb_typeof(p_productos) <> 'array' then
    raise exception 'El inventario debe ser una lista de productos';
  end if;

  for v_producto in select value from jsonb_array_elements(p_productos)
  loop
    if nullif(trim(v_producto->>'codigo'), '') is null then
      continue;
    end if;

    v_tiene_stock := v_producto ? 'stock'
      and nullif(trim(v_producto->>'stock'), '') is not null;
    v_stock := case
      when v_tiene_stock then (v_producto->>'stock')::numeric
      else 0
    end;

    select id into v_id
    from public.log_productos
    where codigo = trim(v_producto->>'codigo');

    if v_id is null then
      insert into public.log_productos(
        codigo, descripcion, unidad, clasificacion, almacen,
        precio_unitario, proveedor, stock_inicial, stock_actual
      )
      values (
        trim(v_producto->>'codigo'),
        coalesce(nullif(trim(v_producto->>'descripcion'), ''), trim(v_producto->>'codigo')),
        nullif(trim(v_producto->>'unidad'), ''),
        nullif(trim(v_producto->>'clasificacion'), ''),
        nullif(trim(v_producto->>'almacen'), ''),
        nullif(replace(replace(v_producto->>'precio_unitario', 'S/', ''), ',', '.')::numeric, null),
        nullif(trim(v_producto->>'proveedor'), ''),
        v_stock,
        v_stock
      );
      v_nuevos := v_nuevos + 1;
    else
      update public.log_productos
      set descripcion = coalesce(nullif(trim(v_producto->>'descripcion'), ''), descripcion),
          unidad = coalesce(nullif(trim(v_producto->>'unidad'), ''), unidad),
          clasificacion = coalesce(nullif(trim(v_producto->>'clasificacion'), ''), clasificacion),
          almacen = coalesce(nullif(trim(v_producto->>'almacen'), ''), almacen),
          stock_actual = case when v_tiene_stock then v_stock else stock_actual end,
          actualizado_en = now()
      where id = v_id;
      v_actualizados := v_actualizados + 1;
    end if;
  end loop;

  insert into public.log_importaciones(
    archivo_nombre, productos_nuevos, productos_actualizados, realizado_por
  )
  values (p_archivo_nombre, v_nuevos, v_actualizados, p_realizado_por);

  return query select v_nuevos, v_actualizados;
end;
$function$;

-- El Kardex operativo muestra solo movimientos reales. Las cargas iniciales
-- antiguas se conservan en la base de datos, pero no se muestran aquí.
CREATE OR REPLACE FUNCTION public.log_listar_movimientos(
  p_token uuid,
  p_codigo text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE(
  id bigint,
  fecha timestamp with time zone,
  codigo text,
  descripcion text,
  tipo text,
  cantidad numeric,
  impacto numeric,
  lote text,
  vencimiento date,
  area text,
  responsable text,
  motivo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_usuario public.log_usuarios;
begin
  v_usuario := public.log_sesion_actual(p_token);
  if not v_usuario.es_administrador then
    raise exception 'Solo administración puede ver el kardex';
  end if;

  return query
  select
    m.id,
    m.creado_en,
    p.codigo,
    p.descripcion,
    m.tipo,
    m.cantidad,
    m.impacto,
    m.lote,
    m.fecha_vencimiento,
    coalesce(a.nombre, ''),
    coalesce(cp.nombre_completo, ''),
    coalesce(m.motivo, '')
  from public.log_movimientos m
  join public.log_productos p on p.id = m.producto_id
  left join public.log_areas a on a.id = m.area_id
  left join public.clinic_personal cp on cp.id = m.responsable_id
  where m.tipo <> 'INICIAL'
    and (p_codigo is null or p.codigo = p_codigo)
    and (p_tipo is null or m.tipo = p_tipo)
    and (p_desde is null or m.creado_en::date >= p_desde)
    and (p_hasta is null or m.creado_en::date <= p_hasta)
  order by m.creado_en desc
  limit 1000;
end;
$function$;

-- Asignaciones de alta confianza solamente. Los demás usuarios siguen sin área.
WITH asignaciones(personal_id, area_codigo) AS (
  VALUES
    (22, 'CUARTO_LIMPIO'), -- Ana Nora Benavente
    (7, 'SALA'),           -- Analia Villegas
    (35, 'CUARTO_LIMPIO'), (25, 'CUARTO_LIMPIO'), -- Benigna Cruz duplicada
    (16, 'LIMPIEZA'),      -- David Cárdenas
    (26, 'CUARTO_LIMPIO'), -- Deysi Casaño
    (18, 'CUARTO_MAQUINA'),-- Elferes Collantes
    (19, 'CUARTO_MAQUINA'),-- Francisco Omar Cortez
    (11, 'SALA'),          -- Isabel Tejeda
    (10, 'SALA'),          -- Jesús Ander
    (9, 'SALA'),           -- Jonhatan Hidalgo
    (15, 'LIMPIEZA'),      -- Jorge Alarcón
    (20, 'CUARTO_MAQUINA'),-- José Sánchez
    (17, 'CUARTO_MAQUINA'),-- Juan López
    (21, 'CUARTO_LIMPIO'), (27, 'CUARTO_LIMPIO'), -- Judith Yataco duplicada
    (6, 'SALA'),           -- Leidymar Salazar
    (34, 'CUARTO_LIMPIO'), (36, 'CUARTO_LIMPIO'), -- Luz Angélica duplicada
    (38, 'CUARTO_LIMPIO'), -- Luz Magali Aguilar
    (4, 'ADMIN'),          -- Maricielo
    (14, 'SALA'), (29, 'SALA'), -- Merly Santiago duplicada
    (33, 'CUARTO_LIMPIO'), -- Mery Mendoza
    (12, 'SALA'),          -- Nataly Huamán
    (23, 'CUARTO_LIMPIO'), -- Norma Huallpa
    (24, 'CUARTO_LIMPIO'), -- Rosalía Lipa
    (13, 'SALA'),          -- Samantha Fernández
    (8, 'SALA'),           -- Segundino Velasco
    (2, 'ALMACEN')         -- Manuel Dafonseka; conserva su rol administrador
)
UPDATE public.log_usuarios AS u
SET area_id = a.id,
    actualizado_en = now()
FROM asignaciones AS x
JOIN public.log_areas AS a ON a.codigo = x.area_codigo AND a.activo
WHERE u.personal_id = x.personal_id;
