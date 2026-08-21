/* Mejoras de acceso, inventario, recepción y respaldos para el portal de logística. */
window.registerLogisticsFixes(({ state, $, esc, fmt, fmtDate, toast, rpc, sessionToken, clearSession, navAdmin, navWorker, goPage, adminProducts, loadOrders, renderOrderList, panel, bindJumps }) => {
  const ICONS = { inicio: '⌂', solicitud: '+', 'mis-pedidos': '▤', pedidos: '▤', stock: '□', inventario: '▣', recepcion: '↧', kardex: '≡', usuarios: '◌', importar: '↑', configuracion: '⚙' };

  const shareFile = async (blob, filename, title) => {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title, files: [file] }); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const isMachineTechnician = () => !state.session.es_administrador && (
    String(state.session.area_codigo || '').split(',').includes('MANTENIMIENTO') ||
    /mantenimiento|t[eé]cnic[oa].*m[aá]quina/i.test(String(state.session.rol || ''))
  );

  const renderNav = function () {
    const entries = state.session.es_administrador ? navAdmin : (isMachineTechnician() ? [...navWorker.slice(0, 3), ['temperaturas', 'Temperaturas'], ...navWorker.slice(3)] : navWorker);
    const nav = $('#main-nav');
    nav.className = `nav-list ${state.session.es_administrador ? 'admin-nav' : 'worker-nav'}`;
    nav.innerHTML = entries.map(([key, label]) => `<button data-page="${key}" class="${state.page === key ? 'active' : ''}" type="button"><span class="nav-icon" aria-hidden="true">${ICONS[key] || '•'}</span><span>${label}</span></button>`).join('');
    nav.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => goPage(button.dataset.page)));
  };

  const renderHome = async function () {
    const switchButton = '<button class="button ghost switch-user" data-switch-user type="button">Cambiar usuario</button>';
    if (!state.session.es_administrador) {
      const orders = await loadOrders();
      $('#page-content').innerHTML = `<div class="stepper"><span class="step current">1. Identidad</span><span class="step">2. Solicitud</span><span class="step">3. Entrega</span></div><div class="split"><section class="panel"><h2>Bienvenido, ${esc(state.session.nombre_completo.split(' ')[0])}</h2><p class="muted">Puedes solicitar productos autorizados por cualquiera de tus áreas: <b>${esc(state.session.area_nombre || 'Área por asignar')}</b>.</p><div class="home-actions"><button class="button primary" data-jump="solicitud">Crear solicitud</button>${switchButton}</div></section><section class="panel"><h2>Estado de tus pedidos</h2>${renderOrderList(orders.slice(0, 4), false)}</section></div>`;
      bindJumps(); bindSwitch(); return;
    }
    const [products, orders, critical] = await Promise.all([adminProducts(), loadOrders(), rpc('log_listar_stock_critico', { p_token: sessionToken() })]);
    const pending = orders.filter((order) => order.estado === 'PENDIENTE').length;
    $('#page-content').innerHTML = `<div class="grid cards"><article class="metric"><p>Productos activos</p><b>${products.length}</b></article><article class="metric"><p>Pedidos pendientes</p><b>${pending}</b></article><article class="metric clickable critical-card" data-open-critical><p>Stock crítico</p><b>${critical.length}</b><small>Ver reposición</small></article><article class="metric"><p>Sincronización</p><b>${navigator.onLine ? 'En línea' : 'Pendiente'}</b></article></div><div class="split"><section class="panel"><div class="panel-header"><h2>Pedidos recientes</h2><button class="button ghost no-print" data-jump="pedidos">Ver todos</button></div>${renderOrderList(orders.slice(0, 5), false)}</section><section class="panel"><h2>Acciones rápidas</h2><p class="muted">Recibe productos de proveedores, respalda el inventario o atiende pedidos desde esta vista.</p><div class="grid"><button class="button primary" data-jump="pedidos">Atender pedidos</button><button class="button outline" data-jump="recepcion">Recibir proveedor</button><button class="button ghost" data-jump="stock">Respaldar stock</button>${switchButton}</div></section></div>`;
    bindJumps(); document.querySelector('[data-open-critical]')?.addEventListener('click', () => { state.stockCriticalMode = true; goPage('stock'); }); bindSwitch();
  };

  function bindSwitch() {
    document.querySelectorAll('[data-switch-user]').forEach((button) => button.onclick = () => {
      clearSession(); state.person = null; state.page = 'inicio'; $('#workspace').classList.add('hidden'); $('#login-view').classList.remove('hidden'); $('#login-search').value = ''; $('#login-password').value = ''; $('#login-submit').disabled = true; $('#selected-person').classList.add('empty'); $('#selected-person').textContent = 'Primero selecciona tu nombre.'; $('#login-results').innerHTML = ''; $('#login-results').classList.add('hidden'); $('#login-search').focus();
    });
  }

  const renderTemperatures = async function () {
    if (!isMachineTechnician() && !state.session.es_administrador) throw new Error('Esta consulta está disponible para el técnico de máquinas.');
    const today = new Date().toISOString().slice(0, 10);
    $('#page-content').innerHTML = panel(`<div class="panel-header"><div><h2>Temperatura y humedad del día</h2><p class="muted">Consulta las tomas registradas para Almacén 1, Almacén 2 y Refrigeradora.</p></div><label class="field-label">Fecha<input id="technical-temperature-date" class="input" type="date" value="${today}"></label></div><div id="technical-temperature-summary" class="grid cards"></div><div class="table-wrap"><table class="table"><thead><tr><th>Hora</th><th>Zona</th><th>Temperatura</th><th>Humedad</th><th>Observación</th><th>Responsable</th></tr></thead><tbody id="technical-temperature-rows"></tbody></table></div>`);
    const zoneName = (zone) => ({ ALMACEN_1: 'Almacén 1', ALMACEN_2: 'Almacén 2', REFRIGERADORA: 'Refrigeradora' })[zone] || zone;
    const load = async () => {
      const date = $('#technical-temperature-date').value || today;
      const rows = await rpc('log_listar_controles_ambientales_tecnico', { p_token: sessionToken(), p_fecha: date });
      const byZone = ['ALMACEN_1', 'ALMACEN_2', 'REFRIGERADORA'].map((zone) => rows.find((row) => row.zona === zone));
      $('#technical-temperature-summary').innerHTML = byZone.map((row, index) => `<article class="metric"><p>${['Almacén 1', 'Almacén 2', 'Refrigeradora'][index]}</p><b>${row ? `${fmt(row.temperatura_c)} °C` : 'Sin toma'}</b><small>${row ? `${fmt(row.humedad_pct)} % hum.` : 'Pendiente'}</small></article>`).join('');
      $('#technical-temperature-rows').innerHTML = rows.map((row) => `<tr><td>${fmtDate(row.registrado_en)}</td><td>${esc(zoneName(row.zona))}</td><td>${fmt(row.temperatura_c)} °C</td><td>${fmt(row.humedad_pct)} %</td><td>${esc(row.observacion || '—')}</td><td>${esc(row.responsable || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No hay tomas registradas para esta fecha.</td></tr>';
    };
    $('#technical-temperature-date').onchange = () => { void load(); };
    await load();
  };

  const renderAdminOrders = async function () {
    const orders = await loadOrders();
    const actionable = orders.filter((order) => ['PENDIENTE', 'PARCIAL'].includes(order.estado));
    state.deliveryDrafts = state.deliveryDrafts || {};
    const card = (order) => {
      const draft = state.deliveryDrafts[order.id] || {};
      const lines = (order.items || []).map((item) => {
        const pending = Math.max(0, Number(item.cantidad_solicitada) - Number(item.cantidad_entregada));
        const selected = draft[item.item_id]?.selected === true;
        const amount = draft[item.item_id]?.cantidad ?? String(pending);
        return `<div class="delivery-check-row ${selected ? 'selected' : ''}"><label class="delivery-check"><input type="checkbox" data-delivery-check="${order.id}:${item.item_id}" ${selected ? 'checked' : ''} ${pending <= 0 ? 'disabled' : ''}><span>Entregado ahora</span></label><div class="delivery-item-detail"><b>${esc(item.codigo)}</b> · ${esc(item.descripcion)}<small>Solicita: ${fmt(item.cantidad_solicitada)} ${esc(item.unidad || '')} · Entregado: ${fmt(item.cantidad_entregada)} · Pendiente: ${fmt(pending)}</small></div><input class="delivery-quantity" data-delivery-qty="${order.id}:${item.item_id}" type="number" min="0" max="${pending}" step="0.001" value="${esc(amount)}" ${selected && pending > 0 ? '' : 'disabled'}></div>`;
      }).join('');
      return `<article class="order-card delivery-order-card"><header><div><h3>${esc(order.codigo_pedido)} <span class="badge ${order.estado === 'PENDIENTE' ? 'pending' : 'return'}">${esc(order.estado)}</span></h3><p>${esc(order.tipo)} · ${esc(order.solicitante)} · ${esc(order.area)} · ${fmtDate(order.creado_en)}</p></div></header><p class="muted">Marca solo los productos entregados ahora. El pedido queda parcial hasta completar todos sus ítems.</p><div class="delivery-check-list">${lines || '<div class="empty-state">No hay productos pendientes.</div>'}</div>${order.observacion ? `<p>Obs.: ${esc(order.observacion)}</p>` : ''}<button class="button primary final-delivery" data-final-delivery="${order.id}" disabled type="button">Finalizar entrega seleccionada</button></article>`;
    };
    $('#page-content').innerHTML = `<section class="panel"><div class="panel-header"><div><h2>Pedidos y despacho</h2><p class="muted">Marca cada producto entregado y luego usa el botón final. Solo los ítems marcados actualizan Stock y Kardex.</p></div></div><div id="delivery-orders">${actionable.map(card).join('') || '<div class="empty-state">No hay pedidos pendientes ni parciales.</div>'}</div></section>`;

    const linesFor = (order) => {
      const draft = state.deliveryDrafts[order.id] || {};
      return (order.items || []).filter((item) => draft[item.item_id]?.selected).map((item) => ({ item_id: item.item_id, cantidad: Math.max(0, Number(String(draft[item.item_id]?.cantidad ?? 0).replace(',', '.')) || 0) })).filter((line) => line.cantidad > 0);
    };
    const refreshFinalButton = (order) => { const button = document.querySelector(`[data-final-delivery="${order.id}"]`); if (button) button.disabled = !linesFor(order).length; };
    document.querySelectorAll('[data-delivery-check]').forEach((input) => input.addEventListener('change', () => {
      const [orderId, itemId] = input.dataset.deliveryCheck.split(':').map(Number); const order = actionable.find((row) => row.id === orderId); if (!order) return;
      const item = (order.items || []).find((row) => row.item_id === itemId); if (!item) return;
      state.deliveryDrafts[orderId] = state.deliveryDrafts[orderId] || {}; const previous = state.deliveryDrafts[orderId][itemId] || {};
      const pending = Math.max(0, Number(item.cantidad_solicitada) - Number(item.cantidad_entregada));
      state.deliveryDrafts[orderId][itemId] = { ...previous, selected: input.checked, cantidad: previous.cantidad ?? String(pending) };
      const quantity = document.querySelector(`[data-delivery-qty="${orderId}:${itemId}"]`); if (quantity) quantity.disabled = !input.checked; input.closest('.delivery-check-row')?.classList.toggle('selected', input.checked); refreshFinalButton(order);
    }));
    document.querySelectorAll('[data-delivery-qty]').forEach((input) => input.addEventListener('change', () => {
      const [orderId, itemId] = input.dataset.deliveryQty.split(':').map(Number); const order = actionable.find((row) => row.id === orderId); if (!order) return;
      state.deliveryDrafts[orderId] = state.deliveryDrafts[orderId] || {}; state.deliveryDrafts[orderId][itemId] = { ...(state.deliveryDrafts[orderId][itemId] || {}), cantidad: input.value }; refreshFinalButton(order);
    }));
    document.querySelectorAll('[data-final-delivery]').forEach((button) => button.onclick = async () => {
      const order = actionable.find((row) => row.id === Number(button.dataset.finalDelivery)); const lines = order ? linesFor(order) : [];
      if (!order || !lines.length) return toast('Marca al menos un producto y una cantidad válida.', true);
      if (!window.confirm(`¿Finalizar la entrega de ${lines.length} producto(s)? Solo estos ítems afectarán el stock y el Kardex.`)) return;
      button.disabled = true;
      try { await rpc('log_confirmar_entrega', { p_token: sessionToken(), p_pedido_id: order.id, p_items: lines }); delete state.deliveryDrafts[order.id]; toast('Entrega registrada. El pedido quedó cerrado o parcial según los productos restantes.'); goPage('pedidos'); } catch (error) { button.disabled = false; toast(error.message || 'No se pudo finalizar la entrega.', true); }
    });
  };

  async function downloadStockExcel(rows) {
    if (!rows.length) return toast('No hay productos para exportar.', true);
    const data = rows.map((p) => ({ Código: p.codigo, Descripción: p.descripcion, Unidad: p.unidad || '', Clasificación: p.clasificacion || '', Almacén: p.almacen || '', Proveedor: p.proveedor || '', Stock: Number(p.stock_actual || 0), 'Stock mínimo': Number(p.stock_minimo || p.umbral_critico || 0) }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), 'Stock');
    const content = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
    await shareFile(new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Respaldo_stock_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Respaldo de stock');
    toast('Respaldo Excel preparado para descargar o compartir.');
  }
  async function downloadStockPdf(rows, title = 'RESPALDO DE STOCK') {
    if (!rows.length) return toast('No hay productos para exportar.', true);
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    doc.setFontSize(14); doc.text(title, 14, 15); doc.setFontSize(8); doc.text(`Centro de Diálisis Virgen del Lourdes · ${new Date().toLocaleString('es-PE')}`, 14, 21);
    doc.autoTable({ startY: 26, head: [['Código', 'Descripción', 'UM', 'Clasificación', 'Almacén', 'Proveedor', 'Stock', 'Mínimo']], body: rows.map((p) => [p.codigo, p.descripcion, p.unidad || '', p.clasificacion || '', p.almacen || '', p.proveedor || '', fmt(p.stock_actual), fmt(p.stock_minimo ?? p.umbral_critico ?? 0)]), styles: { fontSize: 7 }, headStyles: { fillColor: [17, 132, 117] } });
    await shareFile(doc.output('blob'), `${title.toLowerCase().replaceAll(' ', '_')}_${new Date().toISOString().slice(0, 10)}.pdf`, title); toast('PDF de stock preparado.');
  }

  const renderStock = async function () {
    const [products, critical] = await Promise.all([adminProducts(), rpc('log_listar_stock_critico', { p_token: sessionToken() })]);
    const criticalIds = new Set(critical.map((item) => item.id)); let current = state.stockCriticalMode ? critical : products; state.stockCriticalMode = false;
    $('#page-content').innerHTML = panel(`<div class="panel-header"><div><h2 id="stock-heading">${current === critical ? 'Stock crítico y reposición' : 'Stock general · sin filtros del Excel'}</h2><p class="muted">Selecciona productos para retirarlos de forma segura o descarga un respaldo de inventario.</p></div></div><div class="stock-tools no-print"><input id="stock-search" class="input" placeholder="Buscar código o descripción"><div class="stock-actions"><button id="stock-all" class="button ghost" type="button">Todo el stock</button><button id="stock-critical" class="button outline" type="button">Críticos (${critical.length})</button><button id="stock-excel" class="button ghost" type="button">Excel</button><button id="stock-pdf" class="button ghost" type="button">PDF</button><button id="stock-delete" class="button danger" type="button" disabled>Retirar seleccionados</button></div></div><div class="table-wrap"><table class="table"><thead><tr><th><input id="stock-select-all" type="checkbox" title="Seleccionar todos"></th><th>Código</th><th>Descripción</th><th>Unidad</th><th>Clasificación</th><th>Stock</th><th>Mínimo</th></tr></thead><tbody id="stock-body"></tbody></table></div>`);
    const selected = () => Array.from(document.querySelectorAll('.stock-product-select:checked')).map((input) => Number(input.value));
    const refreshSelection = () => { $('#stock-delete').disabled = !selected().length; };
    const draw = (filter = '') => { const q = filter.toLowerCase(); const visible = current.filter((product) => `${product.codigo} ${product.descripcion}`.toLowerCase().includes(q)); $('#stock-body').innerHTML = visible.map((product) => `<tr class="${criticalIds.has(product.id) ? 'critical-row' : ''}"><td><input class="stock-product-select" type="checkbox" value="${product.id}"></td><td>${esc(product.codigo)}</td><td>${esc(product.descripcion)}</td><td>${esc(product.unidad || '')}</td><td>${esc(product.clasificacion || '')}</td><td class="${Number(product.stock_actual) <= 0 ? 'stock-negative' : criticalIds.has(product.id) ? 'stock-low' : ''}">${fmt(product.stock_actual)}</td><td>${fmt(product.stock_minimo ?? product.umbral_critico ?? 0)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">Sin coincidencias.</td></tr>'; document.querySelectorAll('.stock-product-select').forEach((input) => input.addEventListener('change', refreshSelection)); $('#stock-select-all').checked = false; };
    $('#stock-search').oninput = (event) => draw(event.target.value);
    $('#stock-all').onclick = () => { current = products; $('#stock-heading').textContent = 'Stock general · sin filtros del Excel'; $('#stock-search').value = ''; draw(); };
    $('#stock-critical').onclick = () => { current = critical; $('#stock-heading').textContent = 'Stock crítico y reposición'; $('#stock-search').value = ''; draw(); };
    $('#stock-excel').onclick = () => { void downloadStockExcel(current); };
    $('#stock-pdf').onclick = () => downloadStockPdf(current, current === critical ? 'LISTA DE REPOSICIÓN - STOCK CRÍTICO' : 'RESPALDO DE STOCK');
    $('#stock-select-all').onchange = (event) => { document.querySelectorAll('.stock-product-select').forEach((input) => { input.checked = event.target.checked; }); refreshSelection(); };
    $('#stock-delete').onclick = async () => { const ids = selected(); if (!ids.length) return; const reason = window.prompt(`Se retirarán ${ids.length} producto(s) del catálogo activo. Su Kardex y pedidos se conservarán. Motivo:`, 'Retirado desde Stock'); if (reason === null) return; if (!window.confirm('¿Confirmas retirar los productos seleccionados? Esta acción queda auditada.')) return; try { const total = await rpc('log_desactivar_productos', { p_token: sessionToken(), p_productos_ids: ids, p_motivo: reason }); toast(`${total} producto(s) retirado(s) del catálogo activo.`); renderStock(); } catch (error) { toast(error.message || 'No se pudieron retirar los productos.', true); } };
    draw();
  };

  const renderInventory = async function () {
    if (!state.session.es_administrador) throw new Error('Solo Administración puede cerrar un inventario general.');
    const products = await adminProducts();
    state.adminInventoryDraft = state.adminInventoryDraft || { counts: {}, observation: '' };
    const draft = state.adminInventoryDraft;
    $('#page-content').innerHTML = panel(`<div class="panel-header"><div><h2>Inventario general</h2><p class="muted">Busca por código, registra el conteo físico y cierra el inventario. Solo los productos con conteo escrito se ajustan en Stock y Kardex.</p></div><div class="stock-actions no-print"><button id="inventory-pdf" class="button ghost" type="button">PDF de inventario</button><button id="inventory-close" class="button primary" type="button">Cerrar inventario y actualizar stock</button></div></div><div class="grid cards inventory-summary" id="inventory-summary"></div><div class="toolbar no-print"><input id="inventory-search" class="input" placeholder="Buscar código o descripción"><label class="field-label inventory-observation">Observación<textarea id="inventory-observation" rows="2" placeholder="Ej. Inventario general de almacén, turno mañana"></textarea></label></div><div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th><th>Stock sistema</th><th>Conteo físico</th><th>Diferencia</th></tr></thead><tbody id="inventory-body"></tbody></table></div>`);

    const enteredLines = () => Object.entries(draft.counts).filter(([, value]) => String(value).trim() !== '').map(([codigo, value]) => ({ codigo, stock_contado: Number(String(value).replace(',', '.')) })).filter((item) => Number.isFinite(item.stock_contado));
    const reportLines = () => {
      const lines = enteredLines();
      if (lines.length) return lines.map((line) => { const product = products.find((row) => row.codigo === line.codigo); return product ? { ...product, stock_sistema: Number(product.stock_actual), stock_contado: line.stock_contado, diferencia: line.stock_contado - Number(product.stock_actual) } : null; }).filter(Boolean);
      return state.lastAdminInventory?.items || [];
    };
    const updateSummary = () => {
      const lines = enteredLines();
      const adjusted = lines.filter((line) => Number(products.find((row) => row.codigo === line.codigo)?.stock_actual) !== line.stock_contado).length;
      $('#inventory-summary').innerHTML = `<article class="metric"><p>Productos activos</p><b>${products.length}</b></article><article class="metric"><p>Contados</p><b>${lines.length}</b></article><article class="metric"><p>Con diferencia</p><b>${adjusted}</b></article><article class="metric"><p>Estado</p><b>${state.lastAdminInventory?.codigo_inventario || 'En conteo'}</b></article>`;
    };
    const draw = (filter = '') => {
      const term = filter.trim().toLowerCase();
      const visible = products.filter((product) => !term || `${product.codigo} ${product.descripcion}`.toLowerCase().includes(term));
      $('#inventory-body').innerHTML = visible.map((product) => {
        const raw = draft.counts[product.codigo] ?? '';
        const counted = raw === '' ? null : Number(String(raw).replace(',', '.'));
        const difference = counted === null || !Number.isFinite(counted) ? null : counted - Number(product.stock_actual);
        return `<tr class="${difference === null ? '' : difference === 0 ? '' : difference < 0 ? 'critical-row' : 'inventory-positive'}"><td><b>${esc(product.codigo)}</b></td><td>${esc(product.descripcion)}</td><td>${esc(product.unidad || '')}</td><td>${fmt(product.stock_actual)}</td><td><input class="inventory-count input" data-inventory-count="${esc(product.codigo)}" type="number" min="0" step="0.001" inputmode="decimal" value="${esc(raw)}" placeholder="—"></td><td>${difference === null ? '—' : `<b>${difference > 0 ? '+' : ''}${fmt(difference)}</b>`}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty-state">Sin coincidencias.</td></tr>';
      document.querySelectorAll('[data-inventory-count]').forEach((input) => input.addEventListener('change', () => { draft.counts[input.dataset.inventoryCount] = input.value; updateSummary(); draw($('#inventory-search').value); }));
    };
    const exportPdf = async () => {
      const rows = reportLines();
      if (!rows.length) return toast('Ingresa al menos un conteo físico antes de generar el PDF.', true);
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const report = state.lastAdminInventory; const date = new Date().toLocaleString('es-PE');
      doc.setFontSize(14); doc.text('INVENTARIO GENERAL ADMINISTRATIVO', 14, 15); doc.setFontSize(8);
      doc.text(`Centro de Diálisis Virgen del Lourdes · ${date}`, 14, 21);
      doc.text(`Referencia: ${report?.codigo_inventario || 'PREVISUALIZACIÓN DE CONTEO'} · Productos: ${rows.length}`, 14, 26);
      doc.autoTable({ startY: 31, head: [['Código', 'Descripción', 'UM', 'Stock sistema', 'Conteo físico', 'Diferencia']], body: rows.map((row) => [row.codigo, row.descripcion, row.unidad || '', fmt(row.stock_sistema), fmt(row.stock_contado), `${Number(row.diferencia) > 0 ? '+' : ''}${fmt(row.diferencia)}`]), styles: { fontSize: 7 }, headStyles: { fillColor: [17, 132, 117] } });
      const finalY = doc.lastAutoTable.finalY + 15; doc.setFontSize(8); doc.text(`Observación: ${report?.observacion || $('#inventory-observation').value || '—'}`, 14, finalY); doc.text('RESPONSABLE DE INVENTARIO', 28, finalY + 26); doc.text('REVISIÓN DE ADMINISTRACIÓN', 138, finalY + 26); doc.line(14, finalY + 21, 95, finalY + 21); doc.line(120, finalY + 21, 205, finalY + 21);
      await shareFile(doc.output('blob'), `Inventario_general_${new Date().toISOString().slice(0, 10)}.pdf`, 'Inventario general'); toast('PDF de inventario preparado para descargar o compartir.');
    };
    $('#inventory-search').oninput = (event) => draw(event.target.value);
    $('#inventory-observation').value = draft.observation || '';
    $('#inventory-observation').oninput = (event) => { draft.observation = event.target.value; };
    $('#inventory-pdf').onclick = () => { void exportPdf(); };
    $('#inventory-close').onclick = async () => {
      const lines = enteredLines();
      if (!lines.length) return toast('Registra el conteo físico de al menos un producto.', true);
      if (lines.some((line) => line.stock_contado < 0)) return toast('Cada conteo debe ser cero o mayor.', true);
      const changes = lines.filter((line) => Number(products.find((row) => row.codigo === line.codigo)?.stock_actual) !== line.stock_contado).length;
      if (!window.confirm(`Se cerrará el inventario con ${lines.length} producto(s) contados y ${changes} ajuste(s) de Kardex. ¿Confirmas?`)) return;
      const button = $('#inventory-close'); button.disabled = true;
      try {
        const reference = `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const result = await rpc('log_registrar_inventario_general', { p_token: sessionToken(), p_referencia_cliente: reference, p_items: lines, p_observacion: draft.observation || null, p_iniciado_en: new Date().toISOString() });
        const saved = result[0]; state.lastAdminInventory = { ...saved, observacion: draft.observation || '', items: reportLines() }; state.adminInventoryDraft = { counts: {}, observation: '' };
        toast(`Inventario ${saved.codigo_inventario} cerrado: ${saved.productos_contados} contados y ${saved.productos_ajustados} ajustes.`); await renderInventory();
      } catch (error) { button.disabled = false; toast(error.message || 'No se pudo cerrar el inventario.', true); }
    };
    updateSummary(); draw();
  };

  const renderReception = async function () {
    const [products, receptions] = await Promise.all([adminProducts(), rpc('log_listar_recepciones_proveedor', { p_token: sessionToken() })]); state.receiptCart = state.receiptCart || [];
    $('#page-content').innerHTML = `<div class="receipt-layout"><section class="panel"><div class="panel-header"><div><h2>Recepción de proveedores</h2><p class="muted">Cada recepción genera ingresos trazables en stock y Kardex.</p></div></div><div class="form-grid"><label>Proveedor<input id="supplier-name" class="input" placeholder="Nombre o razón social"></label><label>RUC<input id="supplier-ruc" class="input" placeholder="Opcional"></label><label>Teléfono<input id="supplier-phone" class="input" placeholder="Opcional"></label><label>Comprobante / factura<input id="receipt-proof" class="input" placeholder="Factura, guía o nota"></label><label>Fecha<input id="receipt-date" class="input" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label class="full">Observación<textarea id="receipt-note" rows="2" placeholder="Condición, entrega parcial o detalle"></textarea></label></div><div class="toolbar"><input id="receipt-search" class="input" placeholder="Buscar producto para recibir"></div><div id="receipt-products" class="receipt-products"></div></section><section class="panel"><div class="panel-header"><div><h2>Productos recibidos</h2><p class="muted">Ingresa cantidad, lote y vencimiento cuando corresponda.</p></div></div><div id="receipt-cart"></div><button id="save-receipt" class="button primary full" type="button">Registrar recepción y actualizar stock</button></section><section class="panel"><div class="panel-header"><div><h2>Recepciones recientes</h2><p class="muted">Historial de ingresos por proveedor.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Recepción</th><th>Proveedor</th><th>Comprobante</th><th>Productos</th><th>Responsable</th></tr></thead><tbody>${receptions.map((receipt) => `<tr><td>${esc(receipt.fecha_recepcion)}</td><td>${esc(receipt.codigo_recepcion)}</td><td>${esc(receipt.proveedor)}</td><td>${esc(receipt.comprobante || '—')}</td><td>${(receipt.items || []).map((item) => `${esc(item.codigo)} · ${fmt(item.cantidad)}`).join('<br>')}</td><td>${esc(receipt.recibido_por || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Aún no hay recepciones registradas.</td></tr>'}</tbody></table></div></section></div>`;
    const renderProducts = (filter = '') => { const q = filter.trim().toLowerCase(); if (!q) { $('#receipt-products').innerHTML = '<div class="empty-state">Busca por código o descripción para agregar un producto a la recepción.</div>'; return; } const rows = products.filter((product) => `${product.codigo} ${product.descripcion}`.toLowerCase().includes(q)).slice(0, 30); $('#receipt-products').innerHTML = rows.map((product) => `<div class="receipt-item"><div><b>${esc(product.descripcion)}</b><small>${esc(product.codigo)} · Stock: ${fmt(product.stock_actual)} ${esc(product.unidad || '')}</small></div><input data-receipt-qty="${esc(product.codigo)}" type="number" min="0" step="0.001" placeholder="Cant."><input data-receipt-lot="${esc(product.codigo)}" placeholder="Lote"><input class="expiry" data-receipt-expiry="${esc(product.codigo)}" type="date"><button class="button ghost" data-receipt-add="${esc(product.codigo)}" type="button">Añadir</button></div>`).join('') || '<div class="empty-state">Sin coincidencias.</div>'; document.querySelectorAll('[data-receipt-add]').forEach((button) => button.onclick = () => { const code = button.dataset.receiptAdd; const product = products.find((item) => item.codigo === code); const quantity = Number(document.querySelector(`[data-receipt-qty="${code}"]`).value || 0); if (!product || quantity <= 0) return toast('Ingresa una cantidad válida.', true); const lot = document.querySelector(`[data-receipt-lot="${code}"]`).value; const expiry = document.querySelector(`[data-receipt-expiry="${code}"]`).value; state.receiptCart = state.receiptCart.filter((item) => item.codigo !== code); state.receiptCart.push({ ...product, cantidad: quantity, lote: lot, fecha_vencimiento: expiry || null }); renderCart(); toast('Producto añadido a la recepción.'); }); };
    const renderCart = () => { $('#receipt-cart').innerHTML = state.receiptCart.length ? state.receiptCart.map((item) => `<div class="receipt-cart-item"><div><b>${esc(item.descripcion)}</b><small>${esc(item.codigo)} · ${esc(item.unidad || '')}</small></div><input data-cart-qty="${esc(item.codigo)}" type="number" min="0.001" step="0.001" value="${item.cantidad}"><input data-cart-lot="${esc(item.codigo)}" value="${esc(item.lote || '')}" placeholder="Lote"><input class="expiry" data-cart-expiry="${esc(item.codigo)}" type="date" value="${esc(item.fecha_vencimiento || '')}"><button class="button danger" data-cart-remove="${esc(item.codigo)}" type="button">Quitar</button></div>`).join('') : '<div class="empty-state">Aún no agregaste productos para recibir.</div>'; document.querySelectorAll('[data-cart-remove]').forEach((button) => button.onclick = () => { state.receiptCart = state.receiptCart.filter((item) => item.codigo !== button.dataset.cartRemove); renderCart(); }); document.querySelectorAll('[data-cart-qty]').forEach((input) => input.onchange = () => { const item = state.receiptCart.find((row) => row.codigo === input.dataset.cartQty); if (item) item.cantidad = Number(input.value || 0); }); document.querySelectorAll('[data-cart-lot]').forEach((input) => input.onchange = () => { const item = state.receiptCart.find((row) => row.codigo === input.dataset.cartLot); if (item) item.lote = input.value; }); document.querySelectorAll('[data-cart-expiry]').forEach((input) => input.onchange = () => { const item = state.receiptCart.find((row) => row.codigo === input.dataset.cartExpiry); if (item) item.fecha_vencimiento = input.value || null; }); };
    $('#receipt-search').oninput = (event) => renderProducts(event.target.value); $('#save-receipt').onclick = async () => { if (!$('#supplier-name').value.trim()) return toast('Ingresa el proveedor.', true); if (!state.receiptCart.length) return toast('Agrega al menos un producto recibido.', true); try { const result = await rpc('log_registrar_recepcion_proveedor', { p_token: sessionToken(), p_proveedor_nombre: $('#supplier-name').value, p_proveedor_ruc: $('#supplier-ruc').value || null, p_proveedor_telefono: $('#supplier-phone').value || null, p_comprobante: $('#receipt-proof').value || null, p_fecha_recepcion: $('#receipt-date').value, p_observacion: $('#receipt-note').value || null, p_items: state.receiptCart.map((item) => ({ codigo: item.codigo, cantidad: item.cantidad, lote: item.lote || null, fecha_vencimiento: item.fecha_vencimiento || null })) }); state.receiptCart = []; toast(`Recepción ${result[0].codigo_recepcion} registrada. Stock y Kardex actualizados.`); goPage('recepcion'); } catch (error) { toast(error.message || 'No se pudo registrar la recepción.', true); } };
    renderProducts(); renderCart();
  };
  return { renderNav, renderHome, renderAdminOrders, renderStock, renderInventory, renderReception, renderTemperatures };
});
