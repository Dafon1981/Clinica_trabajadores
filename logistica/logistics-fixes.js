/* Correcciones de operación: áreas múltiples, pedidos independientes y Kardex administrable. */
window.registerLogisticsFixes(({ state, $, esc, fmt, fmtDate, toast, rpc, sessionToken, clearSession, renderLoginResults, navAdmin, navWorker, goPage, adminProducts, loadOrders, renderOrderList, panel, bindJumps }) => {
  const ICONS = { inicio: '⌂', solicitud: '+', 'mis-pedidos': '▤', pedidos: '▤', stock: '□', kardex: '≡', usuarios: '◌', importar: '↑', configuracion: '⚙' };

  function resetToUserSelection() {
    clearSession();
    state.cartPedido = [];
    state.cartDevolucion = [];
    state.requestNotes = { PEDIDO: '', DEVOLUCION: '' };
    state.person = null;
    state.page = 'inicio';
    $('#workspace').classList.add('hidden');
    $('#login-view').classList.remove('hidden');
    $('#login-search').value = '';
    $('#login-password').value = '';
    $('#login-submit').disabled = true;
    $('#selected-person').classList.add('empty');
    $('#selected-person').textContent = 'Primero selecciona tu nombre.';
    renderLoginResults();
    $('#login-search').focus();
  }

  const renderNav = function () {
    const nav = $('#main-nav');
    const entries = state.session.es_administrador ? navAdmin : navWorker;
    nav.className = `nav-list ${state.session.es_administrador ? 'admin-nav' : 'worker-nav'}`;
    nav.innerHTML = entries.map(([key, label]) => `<button data-page="${key}" class="${state.page === key ? 'active' : ''}"><span class="nav-icon" aria-hidden="true">${ICONS[key] || '•'}</span><span>${label}</span></button>`).join('');
    nav.querySelectorAll('[data-page]').forEach((btn) => btn.addEventListener('click', () => goPage(btn.dataset.page)));
  };

  const renderHome = async function () {
    const switchButton = '<button class="button ghost switch-user" data-switch-user type="button">Cambiar usuario</button>';
    if (state.session.es_administrador) {
      const [products, orders] = await Promise.all([adminProducts(), loadOrders()]);
      const pending = orders.filter((o) => o.estado === 'PENDIENTE').length;
      const negative = products.filter((p) => Number(p.stock_actual) < 0).length;
      $('#page-content').innerHTML = `<div class="grid cards"><article class="metric"><p>Productos activos</p><b>${products.length}</b></article><article class="metric"><p>Pedidos pendientes</p><b>${pending}</b></article><article class="metric"><p>Stock crítico</p><b>${negative}</b></article><article class="metric"><p>Sincronización</p><b>${navigator.onLine ? 'En línea' : 'Pendiente'}</b></article></div><div class="split"><section class="panel"><div class="panel-header"><h2>Pedidos recientes</h2><button class="button ghost no-print" data-jump="pedidos">Ver todos</button></div>${renderOrderList(orders.slice(0, 5), false)}</section><section class="panel"><h2>Acciones rápidas</h2><p class="muted">Consulta el stock completo, imprime pedidos o registra despachos desde esta misma vista.</p><div class="grid"><button class="button primary" data-jump="pedidos">Atender pedidos</button><button class="button outline" data-jump="stock">Ver stock</button><button class="button ghost" data-jump="importar">Actualizar desde Excel</button>${switchButton}</div></section></div>`;
    } else {
      const orders = await loadOrders();
      $('#page-content').innerHTML = `<div class="stepper"><span class="step current">1. Identidad</span><span class="step">2. Solicitud</span><span class="step">3. Entrega</span></div><div class="split"><section class="panel"><h2>Bienvenido, ${esc(state.session.nombre_completo.split(' ')[0])}</h2><p class="muted">Puedes solicitar solo los productos permitidos para <b>${esc(state.session.area_nombre || 'tu área')}</b>. Logística recibirá tu pedido y confirmará la entrega.</p><div class="home-actions"><button class="button primary" data-jump="solicitud">Crear solicitud</button>${switchButton}</div></section><section class="panel"><h2>Estado de tus pedidos</h2>${renderOrderList(orders.slice(0, 4), false)}</section></div>`;
    }
    bindJumps();
    document.querySelectorAll('[data-switch-user]').forEach((btn) => { btn.onclick = resetToUserSelection; });
  };

  const renderRequest = async function () {
    state.cartPedido = Array.isArray(state.cartPedido) ? state.cartPedido : [];
    state.cartDevolucion = Array.isArray(state.cartDevolucion) ? state.cartDevolucion : [];
    state.requestNotes = state.requestNotes || { PEDIDO: '', DEVOLUCION: '' };
    const [products, areas] = await Promise.all([
      adminProducts(),
      rpc('log_listar_areas_usuario', { p_token: sessionToken() })
    ]);
    const areaList = areas || [];
    state.requestArea = state.requestArea || areaList[0]?.codigo || '';
    if (!areaList.some((area) => area.codigo === state.requestArea)) state.requestArea = areaList[0]?.codigo || '';

    $('#page-content').innerHTML = `<div class="split request-layout"><section class="panel"><div class="request-type request-tabs"><button data-type="PEDIDO"><span>Pedido</span><b id="pedido-count">0</b></button><button data-type="DEVOLUCION"><span>Devolución</span><b id="devolucion-count">0</b></button></div>${areaList.length > 1 ? `<label class="field-label" for="request-area">Área para esta solicitud</label><select id="request-area" class="input">${areaList.map((area) => `<option value="${esc(area.codigo)}" ${state.requestArea === area.codigo ? 'selected' : ''}>${esc(area.nombre)}</option>`).join('')}</select><p class="small muted">Selecciona el área para la que se solicitan o devuelven los productos.</p>` : `<p class="area-chip">Área: <b>${esc(areaList[0]?.nombre || state.session.area_nombre || 'Por asignar')}</b></p>`}<div class="toolbar"><input id="product-search" class="input" placeholder="Buscar por código o producto" /></div><div id="product-list" class="product-list"></div></section><section class="panel"><div class="panel-header"><div><h2 id="cart-title">Mi pedido</h2><p class="muted">Pedido y devolución conservan sus cantidades de forma independiente.</p></div></div><div id="cart-list" class="cart-list"></div><label class="field-label" for="request-observation">Observación</label><textarea id="request-observation" rows="3" placeholder="Motivo, turno o detalle adicional"></textarea><button id="send-request" class="button primary full">Enviar pedido a logística</button></section></div>`;

    const getCart = () => state.requestType === 'DEVOLUCION' ? state.cartDevolucion : state.cartPedido;
    const setCart = (cart) => { if (state.requestType === 'DEVOLUCION') state.cartDevolucion = cart; else state.cartPedido = cart; };
    const updateTabs = () => {
      $('#pedido-count').textContent = state.cartPedido.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
      $('#devolucion-count').textContent = state.cartDevolucion.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
      document.querySelectorAll('[data-type]').forEach((button) => button.classList.toggle('active', button.dataset.type === state.requestType));
      $('#cart-title').textContent = state.requestType === 'PEDIDO' ? 'Mi pedido' : 'Mi devolución';
      $('#send-request').textContent = state.requestType === 'PEDIDO' ? 'Enviar pedido a logística' : 'Enviar devolución a logística';
    };
    const renderCart = () => {
      const cart = getCart();
      $('#cart-list').innerHTML = cart.length ? cart.map((item) => `<div class="cart-item"><div><b>${esc(item.descripcion)}</b><small>${esc(item.codigo)} · ${fmt(item.cantidad)} ${esc(item.unidad || '')}</small></div><button class="button danger" data-remove="${esc(item.codigo)}">Quitar</button></div>`).join('') : '<div class="empty-state">Aún no agregaste productos.</div>';
      document.querySelectorAll('[data-remove]').forEach((button) => {
        button.onclick = () => { setCart(getCart().filter((item) => item.codigo !== button.dataset.remove)); renderProducts($('#product-search').value); renderCart(); updateTabs(); };
      });
    };
    const change = (code, value) => {
      const product = products.find((item) => item.codigo === code);
      const quantity = Math.max(0, Number(value) || 0);
      const next = getCart().filter((item) => item.codigo !== code);
      if (quantity > 0 && product) next.push({ ...product, cantidad: quantity });
      setCart(next);
      renderProducts($('#product-search').value);
      renderCart();
      updateTabs();
    };
    const bindCart = () => {
      document.querySelectorAll('[data-inc]').forEach((button) => { button.onclick = () => { const code = button.dataset.inc; change(code, (getCart().find((item) => item.codigo === code)?.cantidad || 0) + 1); }; });
      document.querySelectorAll('[data-dec]').forEach((button) => { button.onclick = () => { const code = button.dataset.dec; change(code, (getCart().find((item) => item.codigo === code)?.cantidad || 0) - 1); }; });
      document.querySelectorAll('[data-qty]').forEach((input) => { input.onchange = () => change(input.dataset.qty, input.value); });
    };
    const renderProducts = (filter = '') => {
      const query = filter.toLowerCase();
      const rows = products.filter((product) => `${product.codigo} ${product.descripcion}`.toLowerCase().includes(query));
      $('#product-list').innerHTML = rows.map((product) => `<article class="product-row"><div><b>${esc(product.descripcion)}</b><small>${esc(product.codigo)} · ${esc(product.unidad || '')}</small><span class="stock">Stock: ${fmt(product.stock_actual)}</span></div><div class="mini-qty"><button data-dec="${esc(product.codigo)}" type="button">−</button><input type="number" min="0" value="${getCart().find((item) => item.codigo === product.codigo)?.cantidad || 0}" data-qty="${esc(product.codigo)}"><button data-inc="${esc(product.codigo)}" type="button">+</button></div></article>`).join('') || '<div class="empty-state">No hay productos autorizados con esa búsqueda.</div>';
      bindCart();
    };

    document.querySelectorAll('[data-type]').forEach((button) => {
      button.onclick = () => {
        state.requestNotes[state.requestType] = $('#request-observation').value;
        state.requestType = button.dataset.type;
        $('#request-observation').value = state.requestNotes[state.requestType] || '';
        renderProducts($('#product-search').value);
        renderCart();
        updateTabs();
      };
    });
    $('#request-area')?.addEventListener('change', (event) => { state.requestArea = event.target.value; });
    $('#product-search').oninput = (event) => renderProducts(event.target.value);
    $('#request-observation').value = state.requestNotes[state.requestType] || '';
    $('#send-request').onclick = async () => {
      const cart = getCart();
      if (!cart.length) return toast('Agrega al menos un producto.', true);
      try {
        const response = await rpc('log_crear_pedido', { p_token: sessionToken(), p_tipo: state.requestType, p_items: cart.map((item) => ({ codigo: item.codigo, cantidad: item.cantidad })), p_observacion: $('#request-observation').value, p_area_codigo: state.requestArea || null });
        toast(`Solicitud ${response[0].codigo_pedido} enviada a logística.`);
        setCart([]);
        state.requestNotes[state.requestType] = '';
        goPage('mis-pedidos');
      } catch (error) { toast(error.message || 'No se pudo enviar.', true); }
    };
    renderProducts();
    renderCart();
    updateTabs();
  };

  const renderKardex = async function () {
    const rows = await rpc('log_listar_movimientos', { p_token: sessionToken(), p_codigo: null, p_tipo: null, p_desde: null, p_hasta: null });
    $('#page-content').innerHTML = panel(`<div class="panel-header kardex-header"><div><h2>Registros 2026</h2><p class="muted">Selecciona uno o varios movimientos solo si necesitas revertir su efecto de stock.</p></div><div class="kardex-actions"><button id="copy-kardex" class="button ghost">Copiar</button><button id="delete-kardex" class="button danger" disabled>Eliminar seleccionados</button></div></div><div class="table-wrap"><table class="table"><thead><tr><th><input id="select-all-movements" type="checkbox" title="Seleccionar todos"></th><th>Fecha</th><th>Código</th><th>Descripción</th><th>Tipo</th><th>Cantidad</th><th>Impacto</th><th>Lote</th><th>Área</th><th>Responsable</th></tr></thead><tbody>${rows.map((row) => `<tr><td><input class="movement-select" type="checkbox" value="${row.id}" aria-label="Seleccionar movimiento ${row.id}"></td><td>${fmtDate(row.fecha)}</td><td>${esc(row.codigo)}</td><td>${esc(row.descripcion)}</td><td><span class="badge ${row.tipo === 'EGRESO' ? 'pending' : 'done'}">${esc(row.tipo)}</span></td><td>${fmt(row.cantidad)}</td><td class="${Number(row.impacto) < 0 ? 'stock-negative' : ''}">${fmt(row.impacto)}</td><td>${esc(row.lote || '—')}</td><td>${esc(row.area || '—')}</td><td>${esc(row.responsable || '—')}</td></tr>`).join('') || '<tr><td colspan="10" class="empty-state">No hay movimientos.</td></tr>'}</tbody></table></div>`);
    const selected = () => Array.from(document.querySelectorAll('.movement-select:checked')).map((input) => Number(input.value));
    const refreshSelection = () => { $('#delete-kardex').disabled = !selected().length; };
    $('#select-all-movements')?.addEventListener('change', (event) => { document.querySelectorAll('.movement-select').forEach((input) => { input.checked = event.target.checked; }); refreshSelection(); });
    document.querySelectorAll('.movement-select').forEach((input) => input.addEventListener('change', refreshSelection));
    $('#copy-kardex').onclick = () => navigator.clipboard.writeText(rows.map((row) => [row.fecha, row.codigo, row.descripcion, row.tipo, row.cantidad, row.impacto, row.lote, row.area].join('\t')).join('\n')).then(() => toast('Kardex copiado.'));
    $('#delete-kardex').onclick = async () => {
      const ids = selected();
      if (!ids.length) return;
      if (!window.confirm(`Se eliminarán ${ids.length} movimiento(s) y se revertirá su impacto en el stock. Esta acción quedará auditada. ¿Continuar?`)) return;
      try {
        const removed = await rpc('log_eliminar_movimientos', { p_token: sessionToken(), p_movimientos_ids: ids, p_motivo: 'Eliminado desde panel administrativo' });
        toast(`${removed} movimiento(s) eliminado(s) y stock revertido.`);
        renderKardex();
      } catch (error) { toast(error.message || 'No se pudieron eliminar los movimientos.', true); }
    };
  };

  const renderUsers = async function () {
    const users = await rpc('log_listar_usuarios_admin', { p_token: sessionToken() });
    const areas = ['SALA', 'CEBADO', 'LIMPIEZA', 'MANTENIMIENTO', 'CUARTO_LIMPIO', 'ADMIN', 'LOGISTICA'];
    $('#page-content').innerHTML = panel(`<div class="panel-header"><div><h2>Áreas y acceso de trabajadores</h2><p class="muted">Un trabajador puede pertenecer a varias áreas. Logística puede solicitar todo el catálogo.</p></div></div><div class="table-wrap"><table class="table users-table"><thead><tr><th>Trabajador</th><th>Cargo</th><th>Áreas autorizadas</th><th>Administración</th><th></th></tr></thead><tbody>${users.map((user) => {
      const selected = new Set(user.areas_codigos || (user.area_codigo ? [user.area_codigo] : []));
      return `<tr><td><b>${esc(user.nombre_completo)}</b></td><td>${esc(user.rol || '')}</td><td><div class="area-checkboxes">${areas.map((area) => `<label><input type="checkbox" data-area-user="${user.personal_id}" value="${area}" ${selected.has(area) ? 'checked' : ''}><span>${area.replace('_', ' ')}</span></label>`).join('')}</div></td><td><input type="checkbox" data-admin-user="${user.personal_id}" ${user.es_administrador ? 'checked' : ''}></td><td><button class="button ghost" data-save-user="${user.personal_id}">Guardar</button></td></tr>`;
    }).join('')}</tbody></table></div>`);
    document.querySelectorAll('[data-save-user]').forEach((button) => {
      button.onclick = async () => {
        const id = Number(button.dataset.saveUser);
        const selectedAreas = Array.from(document.querySelectorAll(`[data-area-user="${id}"]:checked`)).map((input) => input.value);
        const admin = document.querySelector(`[data-admin-user="${id}"]`).checked;
        if (!selectedAreas.length) return toast('Selecciona al menos un área.', true);
        try {
          await rpc('log_asignar_areas_usuario', { p_token: sessionToken(), p_personal_id: id, p_areas_codigos: selectedAreas, p_es_administrador: admin });
          toast('Áreas y acceso actualizados.');
        } catch (error) { toast(error.message || 'No se pudo guardar.', true); }
      };
    });
  };
  return { renderNav, renderHome, renderRequest, renderKardex, renderUsers };
});
