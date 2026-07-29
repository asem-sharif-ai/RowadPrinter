let adminStatusFilter = 'all';
let adminAgentFilter = 'all';
let adminDateFilter = 'all';
let adminSearchQuery = '';

async function renderAdminView() {
  document.getElementById('container').innerHTML = /*html*/ `
    <section class='admin-section'>
      <div class='admin-header'>
        <h3 class='section-title'>طلبات العملاء</h3>
        <div class='header-controls'>
          <div class='admin-search-wrap'>
            <input type='text' id='admin-search' class='form-input' placeholder='ابحث برقم الطلب'>
          </div>
          <div class='menu-select' id='admin-date-filter-select'>
            <button type='button' class='menu-select-toggle wide-select'>
              <span class='menu-select-label'>كل الأوقات</span>
              <i class='fa-solid fa-chevron-down'></i>
            </button>
            <ul class='menu-select-menu' role='listbox'>
                <li class='menu-option selected' data-value='all' role='option'>كل الأوقات</li>
                <li class='menu-option' data-value='today' role='option'>اليوم</li>
                <li class='menu-option' data-value='older_day' role='option'>الأقدم من يوم</li>
                <li class='menu-option' data-value='this_week' role='option'>هذا الأسبوع</li>
                <li class='menu-option' data-value='older_week' role='option'>الأقدم من أسبوع</li>
                <li class='menu-option' data-value='this_month' role='option'>هذا الشهر</li>
                <li class='menu-option' data-value='older_month' role='option'>الأقدم من شهر</li>
                <li class='menu-option' data-value='this_year' role='option'>هذا العام</li>
                <li class='menu-option' data-value='older_year' role='option'>الأقدم من عام</li>
            </ul>
          </div>
          <div class='menu-select' id='admin-status-filter-select'>
            <button type='button' class='menu-select-toggle wide-select'>
              <span class='menu-select-label'>كل الحالات</span>
              <i class='fa-solid fa-chevron-down'></i>
            </button>
            <ul class='menu-select-menu' role='listbox'>
              <li class='menu-option selected' data-value='all' role='option'>كل الحالات</li>
              ${STATUS_OPTIONS.map(s => `<li class='menu-option' data-value='${s}' role='option'>${s}</li>`).join('')}
            </ul>
          </div>
          <div class='menu-select' id='admin-agent-filter-select'>
            <button type='button' class='menu-select-toggle wide-select'>
              <span class='menu-select-label'>كل العملاء</span>
              <i class='fa-solid fa-chevron-down'></i>
            </button>
            <ul class='menu-select-menu' role='listbox'>
              <li class='menu-option selected' data-value='all' role='option'>كل العملاء</li>
              <li class='menu-option' data-value='agent_only' role='option'>المندوبين فقط</li>
              <li class='menu-option' data-value='non_agent' role='option'>غير المندوبين</li>
            </ul>
          </div>
        </div>
      </div>
      <div class='admin-table-wrap'>
        <table class='admin-table'>
          <thead>
            <tr>
              <th>رقم الطلب</th> <th>الاسم</th> <th>الهاتف</th> <th>الإجمالي</th> <th>الحالة</th> <th>الملفات</th> <th>التاريخ</th>
            </tr>
          </thead>
          <tbody id='admin-orders-table-body'>
            <tr><td colspan='7' class='empty-note'>جارٍ التحميل...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  adminStatusFilter = 'all';
  adminAgentFilter = 'all';
  adminDateFilter = 'all';
  adminSearchQuery = '';

  const [agentsRes, ordersRes] = await Promise.all([ authFetch('agents/list'), authFetch('orders/list') ]);

  const agentsData = await agentsRes.json();
  const ordersData = await ordersRes.json();
  state.agents = agentsData.ok ? agentsData.agents : [];
  state.orders = ordersData.ok ? ordersData.orders : [];

  populateAdminAgentFilter();
  wireAdminFilters();
  renderAdminOrdersTable();
}

function populateAdminAgentFilter() {
  const menu = document.querySelector('#admin-agent-filter-select .menu-select-menu');
  if (!menu) return;

  const agentMap = new Map();
  state.agents.forEach(a => {
    if (a.phone) agentMap.set(a.phone, a.name || a.phone);
  });
  state.orders.forEach(o => {
    if (o.agentId && o.phone && !agentMap.has(o.phone)) {
      agentMap.set(o.phone, o.name || o.phone);
    }
  });

  const agentOptions = Array.from(agentMap.entries())
    .map(([phone, name]) => `<li class='menu-option' data-value='${phone}' role='option'>${name}</li>`)
    .join('');

  menu.innerHTML = /*html*/ `
    <li class='menu-option selected' data-value='all' role='option'>كل العملاء</li>
    <li class='menu-option' data-value='agent_only' role='option'>المندوبين فقط</li>
    <li class='menu-option' data-value='non_agent' role='option'>غير المندوبين</li>
    ${agentOptions}
  `;
}

function wireAdminFilters() {
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      adminSearchQuery = searchInput.value.trim().toLowerCase();
      renderAdminOrdersTable();
    });
  }

  wireAdminSelect('admin-date-filter-select', value => {
    adminDateFilter = value;
    renderAdminOrdersTable();
  });
  wireAdminSelect('admin-status-filter-select', value => {
    adminStatusFilter = value;
    renderAdminOrdersTable();
  });
  wireAdminSelect('admin-agent-filter-select', value => {
    adminAgentFilter = value;
    renderAdminOrdersTable();
  });
}

function wireAdminSelect(id, onChange) {
  const select = document.getElementById(id);
  if (!select) return;

  const toggle = select.querySelector('.menu-select-toggle');
  const label = select.querySelector('.menu-select-label');

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = select.classList.contains('open');
    closeAllMaterialSelects();
    select.classList.toggle('open', !isOpen);
  });

  select.querySelector('.menu-select-menu').addEventListener('click', e => {
    const opt = e.target.closest('.menu-option');
    if (!opt) return;
    e.stopPropagation();
    select.querySelectorAll('.menu-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    label.textContent = opt.textContent;
    select.classList.remove('open');
    onChange(opt.dataset.value);
  });
}

function matchesAdminDateFilter(order) {
  if (adminDateFilter === 'all') return true;

  if (adminDateFilter === 'cancelled') return order.status === STATUS_CANCELLED_C || order.status === STATUS_CANCELLED_A;
  if (adminDateFilter === 'non_cancelled') return order.status !== STATUS_CANCELLED_C && order.status !== STATUS_CANCELLED_A;
  if (adminDateFilter === 'agent_only') return !!order.agentId;
  if (adminDateFilter === 'non_agent') return !order.agentId;

  const created = new Date(order.createdAt);
  if (isNaN(created)) return false;
  const now = new Date();

  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = d => {
    const s = startOfDay(d);
    const day = s.getDay();
    s.setDate(s.getDate() - day);
    return s;
  };
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfYear = d => new Date(d.getFullYear(), 0, 1);

  switch (adminDateFilter) {
    case 'today':
      return created >= startOfDay(now);
    case 'older_day':
      return created < startOfDay(now);
    case 'this_week':
      return created >= startOfWeek(now);
    case 'older_week':
      return created < startOfWeek(now);
    case 'this_month':
      return created >= startOfMonth(now);
    case 'older_month':
      return created < startOfMonth(now);
    case 'this_year':
      return created >= startOfYear(now);
    case 'older_year':
      return created < startOfYear(now);
    default:
      return true;
  }
}

function matchesAdminFilters(order) {
  if (adminSearchQuery && !String(order.id || '').toLowerCase().includes(adminSearchQuery)) return false;
  if (!matchesAdminDateFilter(order)) return false;
  if (adminStatusFilter !== 'all' && order.status !== adminStatusFilter) return false;
  if (adminAgentFilter === 'agent_only' && !order.agentId) return false;
  if (adminAgentFilter === 'non_agent' && order.agentId) return false;
  if (adminAgentFilter !== 'all' && adminAgentFilter !== 'agent_only' && adminAgentFilter !== 'non_agent' && order.phone !== adminAgentFilter) return false;
  return true;
}

function renderAdminOrdersTable() {
  const body = document.getElementById('admin-orders-table-body');
  if (!body) return;

  const orders = state.orders.filter(matchesAdminFilters);

  if (!orders.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='7' class='empty-note'>لا توجد طلبات مطابقة</td></tr>`;
    return;
  }

  body.innerHTML = orders.map(o => `
    <tr data-id='${o.id}'>
      <td>${o.id}</td>
      <td>${o.name || ''}</td>
      <td>${o.phone || ''}</td>
      <td>${(o.total || 0).toFixed(2)} ج.م</td>
      <td><span class='status-badge ${statusBadgeClass(o.status)} btn-badge order-status-badge' role='button' tabindex='0' title='تعديل الحالة'>${o.status || ''}</span></td>
      <td>${o.driveFolderUrl ? `<a href='${o.driveFolderUrl}' target='_blank' rel='noopener'>عرض الملفات</a>` : '-'}</td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('.order-status-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      openOrderStatusModal(badge.closest('tr').dataset.id);
    });
  });
}

function openOrderStatusModal(id) {
  const order = state.orders.find(o => o.id === id);
  if (!order) return;

  const canEdit = !String(order.status || '').includes('ملغي');

  openAdminForm({
    title: `طلب رقم ${order.id}`,
    submitLabel: 'حفظ',
    fields: [
      { key: 'status', label: 'الحالة', value: order.status },
    ],
    onSubmit: async (values, showMessage) => {
      const status = values.status;
      if (!ADMIN_SETTABLE_STATUSES.includes(status)) {
        showMessage('اختر حالة صحيحة');
        return;
      }
      if (status === order.status) {
        closeAdminForm();
        return;
      }

      const res = await authFetch('orders/edit-status', { method: 'POST', body: JSON.stringify({ id: order.id, status }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showMessage('حدث خطأ، حاول مرة أخرى');
        return;
      }

      order.status = data.status || status;
      closeAdminForm();
      renderAdminOrdersTable();
    }
  });

  replaceStatusFieldWithSelect(order, canEdit);
}

function replaceStatusFieldWithSelect(order, canEdit) {
  const oldInput = document.getElementById('field-status');
  if (!oldInput) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = /*html*/ `
    <div class='menu-select' id='status-field-select'>
      <button type='button' class='menu-select-toggle wide-select'${canEdit ? '' : ' disabled'}>
        <span class='menu-select-label'>${order.status}</span>
        <i class='fa-solid fa-chevron-down'></i>
      </button>
      <ul class='menu-select-menu' role='listbox'>
        ${ADMIN_SETTABLE_STATUSES.map(s => `<li class='menu-option${s === order.status ? ' selected' : ''}' data-value='${s}' role='option'>${s}</li>`).join('')}
      </ul>
    </div>
    <input type='hidden' id='field-status' value='${order.status}'>
  `;

  const fragment = document.createDocumentFragment();
  while (wrap.firstChild) fragment.appendChild(wrap.firstChild);
  oldInput.replaceWith(fragment);

  if (canEdit) {
    wireAdminSelect('status-field-select', value => {
      const hidden = document.getElementById('field-status');
      if (hidden) hidden.value = value;
    });
  }

  const submitBtn = document.getElementById('admin-form-submit');
  if (submitBtn) submitBtn.style.display = canEdit ? '' : 'none';
}