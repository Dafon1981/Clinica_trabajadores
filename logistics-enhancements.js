/* Mejoras de acceso, inventario, recepción y respaldos para el portal de logística. */
window.registerLogisticsFixes(({ state, $, esc, fmt, fmtDate, toast, rpc, sessionToken, clearSession, navAdmin, navWorker, goPage, adminProducts, loadOrders, renderOrderList, panel, bindJumps }) => {
  const ICONS = { inicio: '⌂', solicitud: '+', 'mis-pedidos': '▤', pedidos: '▤', stock: '□', recepcion: '↧', kardex: '≡', usuarios: '◌', importar: '↑', configuracion: '⚙' };

  const shareFile = async (blob, filename, title) => {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title, files: [file] }); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const renderNav = function () {
    const nav = $('#main-nav'); const entries = state.session.es_administrador ? navAdmin : navWorker;
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

  const renderReception = async function () {
    const [products, receptions] = await Promise.all([adminProducts(), rpc('log_listar_recepciones_proveedor', { p_token: sessionToken() })]); state.receiptCart = state.receiptCart || [];
    $('#page-content').innerHTML = `<div class="receipt-layout"><section class="panel"><div class="panel-header"><div><h2>Recepción de proveedores</h2><p class="muted">Cada recepción genera ingresos trazables en stock y Kardex.</p></div></div><div class="form-grid"><label>Proveedor<input id="supplier-name" class="input" placeholder="Nombre o razón social"></label><label>RUC<input id="supplier-ruc" class="input" placeholder="Opcional"></label><label>Teléfono<input id="supplier-phone" class="input" placeholder="Opcional"></label><label>Comprobante / factura<input id="receipt-proof" class="input" placeholder="Factura, guía o nota"></label><label>Fecha<input id="receipt-date" class="input" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label class="full">Observación<textarea id="receipt-note" rows="2" placeholder="Condición, entrega parcial o detalle"></textarea></label></div><div class="toolbar"><input id="receipt-search" class="input" placeholder="Buscar producto para recibir"></div><div id="receipt-products" class="receipt-products"></div></section><section class="panel"><div class="panel-header"><div><h2>Productos recibidos</h2><p class="muted">Ingresa cantidad, lote y vencimiento cuando corresponda.</p></div></div><div id="receipt-cart"></div><button id="save-receipt" class="button primary full" type="button">Registrar recepción y actualizar stock</button></section><section class="panel"><div class="panel-header"><div><h2>Recepciones recientes</h2><p class="muted">Historial de ingresos por proveedor.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Recepción</th><th>Proveedor</th><th>Comprobante</th><th>Productos</th><th>Responsable</th></tr></thead><tbody>${receptions.map((receipt) => `<tr><td>${esc(receipt.fecha_recepcion)}</td><td>${esc(receipt.codigo_recepcion)}</td><td>${esc(receipt.proveedor)}</td><td>${esc(receipt.comprobante || '—')}</td><td>${(receipt.items || []).map((item) => `${esc(item.codigo)} · ${fmt(item.cantidad)}`).join('<br>')}</td><td>${esc(receipt.recibido_por || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Aún no hay recepciones registradas.</td></tr>'}</tbody></table></div></section></div>`;
    const renderProducts = (filter = '') => { const q = filter.trim().toLowerCase(); if (!q) { $('#receipt-products').innerHTML = '<div class="empty-state">Busca por código o descripción para agregar un producto a la recepción.</div>'; return; } const rows = products.filter((product) => `${product.codigo} ${product.descripcion}`.toLowerCase().includes(q)).slice(0, 30); $('#receipt-products').innerHTML = rows.map((product) => `<div class="receipt-item"><div><b>${esc(product.descripcion)}</b><small>${esc(product.codigo)} · Stock: ${fmt(product.stock_actual)} ${esc(product.unidad || '')}</small></div><input data-receipt-qty="${esc(product.codigo)}" type="number" min="0" step="0.001" placeholder="Cant."><input data-receipt-lot="${esc(product.codigo)}" placeholder="Lote"><input class="expiry" data-receipt-expiry="${esc(product.codigo)}" type="date"><button class="button ghost" data-receipt-add="${esc(product.codigo)}" type="button">Añadir</button></div>`).join('') || '<div class="empty-state">Sin coincidencias.</div>'; document.querySelectorAll('[data-receipt-add]').forEach((button) => button.onclick = () => { const code = button.dataset.receiptAdd; const product = products.find((item) => item.codigo === code); const quantity = Number(document.querySelector(`[data-receipt-qty="${code}"]`).value || 0); if (!product || quantity <= 0) return toast('Ingresa una cantidad válida.', true); const lot = document.querySelector(`[data-receipt-lot="${code}"]`).value; const expiry = document.querySelector(`[data-receipt-expiry="${code}"]`).value; state.receiptCart = state.receiptCart.filter((item) => item.codigo !== code); state.receiptCart.push({ ...product, cantidad: quantity, lote: lot, fecha_vencimiento: expiry || null }); renderCart(); toast('Producto añadido a la recepción.'); }); };
    const renderCart = () => { $('#receipt-cart').innerHTML = state.receiptCart.length ? state.receiptCart.map((item) => `<div class="receipt-cart-item"><div><b>${esc(item.descripcion)}</b><small>${esc(item.codigo)} · ${esc(item.unidad || '')}</small></div><input data-cart-qty="${esc(item.codigo)}" type="number" min="0.001" step="0.001" value="${item.cantidad}"><input data-cart-lot="${esc(item.codigo)}" value="${esc(item.lote || '')}" placeholder="Lote"><input class="expiry" data-cart-expiry="${esc(item.codigo)}" type="date" value="${esc(item.fecha_vencimiento || '')}"><button class="button danger" data-cart-remove="${esc(item.codigo)}" type="button">Quitar</button></div>`).join('') : '<div class="empty-state">Aún no agregaste productos para recibir.</div>'; document.querySelectorAll('[data-cart-remove]').forEach((button) => button.onclick = () => { state.receiptCart = state.receiptCart.filter((item) => item.codigo !== button.dataset.cartRemove); renderCart(); }); document.querySelectorAll('[data-cart-qty]').forEach((input) => input.onchange = () => { const item = state.receiptCart.find((row) => row.codigo === input.dataset.cartQty); if (item) item.cantidad = Number(input.value || 0); }); document.querySelectorAll('[data-cart-lot]').forEach((input) => input.onchange = () => { const item = state.receiptCart.find((row) => row.codigo === input.dataset.cartLot); if (item) item.lote = input.value; }); document.querySelectorAll('[data-cart-expiry]').forEach((input) => input.onchange = () => { const item = state.receiptCart.find((row) => row.codigo === input.dataset.cartExpiry); if (item) item.fecha_vencimiento = input.value || null; }); };
    $('#receipt-search').oninput = (event) => renderProducts(event.target.value); $('#save-receipt').onclick = async () => { if (!$('#supplier-name').value.trim()) return toast('Ingresa el proveedor.', true); if (!state.receiptCart.length) return toast('Agrega al menos un producto recibido.', true); try { const result = await rpc('log_registrar_recepcion_proveedor', { p_token: sessionToken(), p_proveedor_nombre: $('#supplier-name').value, p_proveedor_ruc: $('#supplier-ruc').value || null, p_proveedor_telefono: $('#supplier-phone').value || null, p_comprobante: $('#receipt-proof').value || null, p_fecha_recepcion: $('#receipt-date').value, p_observacion: $('#receipt-note').value || null, p_items: state.receiptCart.map((item) => ({ codigo: item.codigo, cantidad: item.cantidad, lote: item.lote || null, fecha_vencimiento: item.fecha_vencimiento || null })) }); state.receiptCart = []; toast(`Recepción ${result[0].codigo_recepcion} registrada. Stock y Kardex actualizados.`); goPage('recepcion'); } catch (error) { toast(error.message || 'No se pudo registrar la recepción.', true); } };
    renderProducts(); renderCart();
  };
  return { renderNav, renderHome, renderAdminOrders, renderStock, renderReception };
});
