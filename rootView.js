const STATUS_OPTIONS = ['بانتظار التأكيد', 'قيد المراجعة', 'جارٍ التجهيز', 'جاهز للاستلام', 'تم التسليم والدفع', 'ملغي (العميل)', 'ملغي (المسؤول)'];
const STATUS_UNCONFIRMED = STATUS_OPTIONS[0];
const STATUS_DELIVERED   = STATUS_OPTIONS[4];
const STATUS_CANCELLED_C = STATUS_OPTIONS[5];
const STATUS_CANCELLED_A = STATUS_OPTIONS[6];

const ADMIN_SETTABLE_STATUSES = STATUS_OPTIONS.filter(s => s !== STATUS_CANCELLED_C && s !== STATUS_UNCONFIRMED);

function statusBadgeClass(status) {
  switch (status) {
    case STATUS_UNCONFIRMED:
      return 'unconfirmed';
    case STATUS_OPTIONS[1]:
      return 'pending';
    case STATUS_OPTIONS[2]:
      return 'processing';
    case STATUS_OPTIONS[3]:
      return 'available';
    case STATUS_DELIVERED:
      return 'completed';
    case STATUS_CANCELLED_C:
    case STATUS_CANCELLED_A:
      return 'unavailable';
    default:
      return 'available';
  }
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

async function renderRootView() {
  const container = document.getElementById('container');
  container.innerHTML = /*html*/ `
    <section class='admin-section'>
      <div class='admin-tabs' id='admin-tabs'>
        <button class='admin-tab active' data-tab='orders'>إدارة الطلبات</button>
        <button class='admin-tab' data-tab='materials'>إدارة الخامات</button>
        <button class='admin-tab' data-tab='agents'>إدارة المندوبين</button>
        <button class='admin-tab' data-tab='prices'>خطط الأسعار</button>
      </div>
      <div class='admin-panel-body' id='admin-panel-body'>
        <p class='empty-note'>جارٍ التحميل...</p>
      </div>
    </section>
  `;
  container.classList.add('has-content');

  const [agentsRes, ordersRes] = await Promise.all([
    authFetch('agents/list'), authFetch('orders/list'),
  ]);

  const agentsData = await agentsRes.json();
  const ordersData = await ordersRes.json();
  state.agents = agentsData.ok ? agentsData.agents : [];
  state.orders = ordersData.ok ? ordersData.orders : [];

  const panelBody = document.getElementById('admin-panel-body');
  const tabRenderers = {
    materials:    renderMaterialsPanel,
    agents: () => renderAgentsPanel(panelBody),
    prices: () => renderPricesPanel(panelBody),
    orders: () => renderOrdersPanel(panelBody),
  };

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabRenderers[tab.dataset.tab](panelBody);
    });
  });

  renderOrdersPanel(panelBody);
}

// ---------- Materials ---------- ----------

function renderMaterialsPanel(container) {
  container.innerHTML = /*html*/ `
    <div class='admin-header'>
      <h3 class='section-title'>إدارة الخامات</h3>
      <button class='btn-primary' id='add-material-btn' type='button'>
        <i class='fa-solid fa-plus'></i> إضافة خامة
      </button>
    </div>
    <div class='admin-material-grid' id='materials-table-body'></div>
  `;
  document.getElementById('add-material-btn').addEventListener('click', () => openMaterialForm());
  renderMaterialsTable();
}

function renderMaterialsTable() {
  const body = document.getElementById('materials-table-body');
  if (!body) return;

  if (!state.materials.length) {
    body.innerHTML = /*html*/ `<div class='empty-note'>لا توجد خامات مضافة</div>`;
    return;
  }

  body.innerHTML = state.materials.map(m => /*html*/ `
    <div class='admin-material-card' data-name='${m.name}'>
      <div class='admin-material-card-main'>
        <span class='admin-material-card-name'>${m.name}</span>
        <span class='admin-material-card-price'>${m.price || 0} ج.م</span>
      </div>
      <div class='admin-material-card-actions'>
        <span class='status-badge ${m.available !== false ? 'available' : 'unavailable'} btn-badge' role='button' tabindex='0' title='تغيير حالة التوفر'>${m.available !== false ? 'متاحة' : 'غير متاحة'}</span>
        <div class='admin-material-card-icons'>
          <button class='icon-action-btn edit-material-btn' title='تعديل'><i class='fa-solid fa-pen'></i></button>
          <button class='icon-action-btn danger delete-material-btn' title='حذف'><i class='fa-solid fa-trash'></i></button>
        </div>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('.btn-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const name = badge.closest('.admin-material-card').dataset.name;
      toggleMaterialAvailability(name);
    });
  });

  body.querySelectorAll('.edit-material-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.closest('.admin-material-card').dataset.name;
      openMaterialForm(state.materials.find(m => m.name === name));
    });
  });

  body.querySelectorAll('.delete-material-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.closest('.admin-material-card').dataset.name;
      deleteMaterial(name);
    });
  });
}

async function toggleMaterialAvailability(name) {
  const material = state.materials.find(m => m.name === name);
  if (!material) return;

  const currentlyAvailable = material.available !== false;
  const nextAvailable = !currentlyAvailable;
  const confirmMsg = `هل تود تغيير حالة الخامة '${name}' لتصبح ${currentlyAvailable ? 'غير متاحة' : 'متاحة'}؟`;

  if (!await askConfirm(confirmMsg)) return;

  const res = await authFetch('materials/edit', {
    method: 'POST',
    body: JSON.stringify({ name, available: !currentlyAvailable }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    notify('تعذر تحديث حالة التوفر');
    return;
  }

  material.available = data.available;
  renderMaterialsTable();
}

function openMaterialForm(material) {
  const isEdit = Boolean(material);

  openAdminForm({
    title: isEdit ? 'تعديل الخامة' : 'إضافة خامة',
    submitLabel: isEdit ? 'حفظ' : 'إضافة',
    fields: [
      { key: 'name', label: 'الاسم', value: material?.name || '', disabled: isEdit },
      { key: 'price', label: 'السعر (ج.م/م²)', type: 'number', value: material?.price ?? '' },
      { key: 'image', label: 'رابط الصورة (اختياري)', value: material?.image || '' },
    ],
    onSubmit: async (values, showMessage) => {
      const name = isEdit ? material.name : values.name;
      if (!name) {
        showMessage('اسم الخامة مطلوب');
        return;
      }
      if (!values.price) {
        showMessage('سعر الخامة مطلوب');
        return;
      }
      const action = isEdit ? 'materials/edit' : 'materials/add';
      const res = await authFetch(action, {
        method: 'POST',
        body: JSON.stringify({
          name,
          desc: material?.desc || '',
          image: values.image,
          price: Number(values.price) || 0,
          available: material ? material.available !== false : true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showMessage(data.error === 'material_exists' ? 'خامة بهذا الاسم موجودة بالفعل' : 'حدث خطأ، حاول مرة أخرى');
        return;
      }

      const record = { name: data.name, desc: data.desc, image: data.image, price: data.price, available: data.available };
      const idx = state.materials.findIndex(m => m.name === record.name);
      if (idx !== -1) state.materials[idx] = record;
      else state.materials.push(record);

      closeAdminForm();
      renderMaterialsTable();
    },
  });
}

async function deleteMaterial(name) {
  if (!await askConfirm(`حذف الخامة '${name}'؟`)) return;
  const res = await authFetch('materials/delete', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    notify('تعذر حذف الخامة');
    return;
  }
  state.materials = state.materials.filter(m => m.name !== name);
  renderMaterialsTable();
}

// ---------- People (Admins/Agents) ---------- ----------

function renderAgentsPanel(container) {
  container.innerHTML = /*html*/ `
    <div class='admin-header'>
      <h3 class='section-title'>إدارة المندوبين</h3>
      <button class='btn-primary' id='add-agents-btn' type='button'>
        <i class='fa-solid fa-user-plus'></i> إضافة مندوب
      </button>
    </div>
    <div class='admin-material-grid' id='agents-table-body'></div>
  `;

  document.getElementById('add-agents-btn').addEventListener('click', () => openPersonForm());
  renderAgentsTable();
}

function renderAgentsTable() {
  const body = document.getElementById('agents-table-body');
  if (!body) return;

  const people = state.agents || [];
  if (!people.length) {
    body.innerHTML = /*html*/ `<div class='empty-note'>لا توجد بيانات</div>`;
    return;
  }

  body.innerHTML = people.map(p => `
    <div class='admin-material-card' data-id='${p.id}'>
      <div class='admin-material-card-main'>
        <span class='admin-material-card-name'>${p.name || ''}</span>
        <span class='admin-material-card-price'>${p.phone || ''}</span>
      </div>
      <button class='icon-action-btn danger delete-person-btn' title='حذف'><i class='fa-solid fa-trash'></i></button>
    </div>
  `).join('');

  body.querySelectorAll('.delete-person-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePerson(btn.closest('.admin-material-card').dataset.id));
  });
}

function openPersonForm() {
  const fields = [
    { key: 'name', label: 'الاسم' },
    { key: 'phone', label: 'رقم الهاتف' },
    { key: 'password', label: 'كلمة المرور', type: 'password' },
  ];

  openAdminForm({
    title: 'إضافة مندوب',
    submitLabel: 'إضافة',
    fields,
    onSubmit: async (values, showMessage) => {
      if (!values.name || !values.password || !values.phone) {
        showMessage('الاسم ورقم الهاتف وكلمة المرور مطلوبة');
        return;
      }

      const payload = { name: values.name, password: values.password, phone: values.phone };

      const res = await authFetch('agents/add', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const messages = {
          password_in_use: 'كلمة المرور مستخدمة بالفعل',
          phone_in_use: 'رقم الهاتف مستخدم بالفعل',
        };
        showMessage(messages[data.error] || 'حدث خطأ، حاول مرة أخرى');
        return;
      }

      const record = {
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        lastSeen: data.lastSeen,
        phone: data.phone,
        pricingMap: data.pricingMap,
      };
      state.agents.push(record);

      closeAdminForm();
      renderAgentsTable();
    },
  });
}

async function deletePerson(id) {
  if (!await askConfirm('تأكيد الحذف؟')) return;
  const res = await authFetch('agents/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    notify('تعذر الحذف');
    return;
  }

  const removed = state.agents.find(p => p.id === id);
  state.agents = state.agents.filter(p => p.id !== id);
  renderAgentsTable();

  if (removed && removed.phone && Array.isArray(state.orders)) {
    state.orders = state.orders.filter(o => o.phone !== removed.phone);
    if (document.getElementById('orders-table-body')) renderOrdersTable();
  }

  if (removed && pricesSelectedAgentId === removed.id) {
    pricesSelectedAgentId = null;
  }
}

// ---------- Prices ---------- ----------

let pricesSelectedAgentId = null;

function renderPricesPanel(container) {
  const agents = state.agents || [];
  if (!pricesSelectedAgentId || !agents.some(a => a.id === pricesSelectedAgentId)) {
    pricesSelectedAgentId = agents.length ? agents[0].id : null;
  }
  const selectedAgent = agents.find(a => a.id === pricesSelectedAgentId) || null;

  container.innerHTML = /*html*/ `
    <div class='admin-header'>
      <h3 class='section-title'>خطط الأسعار</h3>
      <div class='header-controls'>
        <div class='menu-select wide-select' id='prices-agent-select'>
          <button type='button' class='menu-select-toggle'${agents.length ? '' : ' disabled'}>
            <span class='menu-select-label'>${selectedAgent ? selectedAgent.name : 'لا يوجد مندوبين'}</span>
            <i class='fa-solid fa-chevron-down'></i>
          </button>
          <ul class='menu-select-menu' role='listbox'>
            ${agents.map((a, i) => `<li class='menu-option${a.id === pricesSelectedAgentId ? ' selected' : ''}' data-value='${a.id}' role='option'>${a.name}</li>`).join('')}
          </ul>
        </div>
        <button class='btn-primary' id='update-prices-btn' type='button' disabled>
          <i class='fa-solid fa-floppy-disk'></i> تحديث
        </button>
      </div>
    </div>
    <div class='admin-table-wrap'>
      <table class='admin-table table-eq'>
        <thead>
          <tr>
            <th>الخامة</th>
            <th>السعر الأصلي</th>
            <th>السعر في الخطة</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody id='prices-table-body'></tbody>
      </table>
    </div>
  `;

  renderPricesTable();

  const agentSelect = document.getElementById('prices-agent-select');
  const agentToggle = agentSelect ? agentSelect.querySelector('.menu-select-toggle') : null;
  if (agentToggle) {
    agentToggle.addEventListener('click', async e => {
      if (agentSelect.classList.contains('open')) return;
      if (pricesHasUnsavedChanges()) {
        e.stopImmediatePropagation();
        if (!await askConfirm('هناك أسعار تم تعديلها ولم يتم تحديثها بعد، هل تريد إلغاء التعديلات والمتابعة؟')) return;
        document.querySelectorAll('#prices-table-body tr[data-material]').forEach(row => {
          row.dataset.held = row.dataset.current;
        });
        renderPricesTable();
        closeAllMaterialSelects();
        setTimeout(() => agentSelect.classList.add('open'), 0);
      }
    }, true);
  }

  wireAdminSelect('prices-agent-select', value => {
    pricesSelectedAgentId = value;
    renderPricesPanel(container);
  });
  wireUpdatePricesBtn();
}

function renderPricesTable() {
  const body = document.getElementById('prices-table-body');
  if (!body) return;

  const agent = (state.agents || []).find(a => a.id === pricesSelectedAgentId);

  if (!agent || !state.materials.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='4' class='empty-note'>${agent ? 'لا توجد خامات مضافة' : 'لا يوجد مندوبين'}</td></tr>`;
    return;
  }

  const priceFor = m => (agent.pricingMap && agent.pricingMap[m.name] !== undefined) ? agent.pricingMap[m.name] : m.price;

  body.innerHTML = state.materials.map(m => `
    <tr data-material='${m.name}' data-current='${priceFor(m)}' data-held='${priceFor(m)}'>
      <td>${m.name}</td>
      <td>${m.price || 0} ج.م</td>
      <td><span class='status-badge material-price btn-badge plan-price-badge' role='button' tabindex='0' title='تعديل السعر'>${planPriceBadgeContent(priceFor(m), priceFor(m))}</span></td>
      <td><span class='status-badge available row-status-badge'>محدث</span></td>
    </tr>
  `).join('');

  body.querySelectorAll('.plan-price-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      openPlanPriceModal(badge.closest('tr'));
    });
  });

  updatePricesBtnState();
}

function planPriceBadgeContent(current, held) {
  if (held === current) return `${held} ج.م`;
  return `<del>${current}</del> ${held} ج.م`;
}

function openPlanPriceModal(row) {
  const material = row.dataset.material;
  const held = Number(row.dataset.held) || 0;

  openAdminForm({
    title: `تعديل سعر ${material}`,
    submitLabel: 'موافق',
    fields: [
      { key: 'price', label: 'السعر في الخطة (ج.م)', type: 'number', value: held },
    ],
    onSubmit: async (values, showMessage) => {
      const price = Number(values.price);
      if (isNaN(price) || price < 0) {
        showMessage('أدخل سعرًا صحيحًا');
        return;
      }

      row.dataset.held = price;
      const badge = row.querySelector('.plan-price-badge');
      if (badge) badge.innerHTML = planPriceBadgeContent(Number(row.dataset.current) || 0, price);
      updateRowStatusBadge(row);
      updatePricesBtnState();
      closeAdminForm();
    },
  });
}

function updateRowStatusBadge(row) {
  const badge = row.querySelector('.row-status-badge');
  if (!badge) return;

  const isUpdated = (Number(row.dataset.held) || 0) === (Number(row.dataset.current) || 0);
  badge.textContent = isUpdated ? 'محدث' : 'غير محدث';
  badge.classList.toggle('available', isUpdated);
  badge.classList.toggle('unavailable', !isUpdated);
}

function pricesHasUnsavedChanges() {
  return Array.from(document.querySelectorAll('#prices-table-body tr[data-material]')).some(row => {
    return (Number(row.dataset.held) || 0) !== (Number(row.dataset.current) || 0);
  });
}

function updatePricesBtnState() {
  const btn = document.getElementById('update-prices-btn');
  if (!btn) return;
  btn.disabled = !pricesHasUnsavedChanges();
}

function wireUpdatePricesBtn() {
  const btn = document.getElementById('update-prices-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const agent = (state.agents || []).find(a => a.id === pricesSelectedAgentId);
    if (!agent) return;

    const pricingMap = {};
    document.querySelectorAll('#prices-table-body tr[data-material]').forEach(row => {
      pricingMap[row.dataset.material] = Number(row.dataset.held) || 0;
    });

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = /*html*/ `<i class='fa-solid fa-spinner fa-spin'></i> جارٍ التحديث...`;

    try {
      const res = await authFetch('agents/edit-pricing', {
        method: 'POST',
        body: JSON.stringify({ id: agent.id, pricingMap }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify('تعذر تحديث خطة الأسعار');
        return;
      }

      agent.pricingMap = pricingMap;
      document.querySelectorAll('#prices-table-body tr[data-material]').forEach(row => {
        row.dataset.current = pricingMap[row.dataset.material] ?? row.dataset.current;
      });
      renderPricesTable();
      notify('تم تحديث خطة الأسعار');
    } catch (e) {
      console.error(e);
      notify('تعذر الاتصال بالخادم');
    } finally {
      btn.innerHTML = originalHtml;
      updatePricesBtnState();
    }
  });
}

// ---------- Orders ---------- ----------

let adminStatusFilter = 'all';
let adminAgentFilter = 'all';
let adminDateFilter = 'all';
let adminSearchQuery = '';

async function loadOrders() {
  try {
    const res = await authFetch('orders/list');
    const data = await res.json();
    state.orders = data.ok ? data.orders : [];
  } catch (e) {
    console.error(e);
  }
  renderOrdersTable();
}

function renderOrdersPanel(container) {
  adminStatusFilter = 'all';
  adminAgentFilter = 'all';
  adminDateFilter = 'all';
  adminSearchQuery = '';

  container.innerHTML = /*html*/ `
    <div class='admin-header'>
      <h3 class='section-title'>طلبات المندوبين</h3>
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
              <li class='menu-option' data-value='today' role='option'>هذا اليوم</li>
              <li class='menu-option' data-value='this_week' role='option'>هذا الأسبوع</li>
              <li class='menu-option' data-value='this_month' role='option'>هذا الشهر</li>
              <li class='menu-option' data-value='this_year' role='option'>هذا العام</li>
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
        <tbody id='orders-table-body'></tbody>
      </table>
    </div>
  `;

  populateAdminAgentFilter();
  wireAdminFilters();
  renderOrdersTable();
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
    ${agentOptions}
  `;
}

function wireAdminFilters() {
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      adminSearchQuery = searchInput.value.trim().toLowerCase();
      renderOrdersTable();
    });
  }

  wireAdminSelect('admin-date-filter-select', value => {
    adminDateFilter = value;
    renderOrdersTable();
  });
  wireAdminSelect('admin-status-filter-select', value => {
    adminStatusFilter = value;
    renderOrdersTable();
  });
  wireAdminSelect('admin-agent-filter-select', value => {
    adminAgentFilter = value;
    renderOrdersTable();
  });
}

function matchesAdminDateFilter(order) {
  if (adminDateFilter === 'all') return true;

  const created = new Date(order.createdAt);
  if (isNaN(created)) return false;
  const now = new Date();

  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeekLocal = d => {
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
      return created >= startOfWeekLocal(now);
    case 'older_week':
      return created < startOfWeekLocal(now);
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
  if (adminAgentFilter !== 'all' && order.phone !== adminAgentFilter) return false;
  return true;
}

function renderOrdersTable() {
  const body = document.getElementById('orders-table-body');
  if (!body) return;

  const orders = (state.orders || []).filter(matchesAdminFilters);

  if (!orders.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='7' class='empty-note'>لا توجد طلبات مطابقة</td></tr>`;
    return;
  }

  const isActionable = status => status !== STATUS_CANCELLED_C && status !== STATUS_CANCELLED_A && status !== STATUS_DELIVERED;

  body.innerHTML = orders.map(o => {
    const actionable = isActionable(o.status);
    return `
    <tr data-id='${o.id}'>
      <td>${o.id}</td>
      <td>${o.name || ''}</td>
      <td>${o.phone || ''}</td>
      <td>${(o.total || 0).toFixed(2)} ج.م</td>
      <td><span class='status-badge ${statusBadgeClass(o.status)}${actionable ? ' btn-badge order-status-badge' : ' badge-disabled'}'${actionable ? ` role='button' tabindex='0' title='${o.status === STATUS_UNCONFIRMED ? 'إلغاء الطلب' : 'تعديل الحالة'}'` : ''}>${o.status || ''}</span></td>
      <td>${o.driveFolderUrl ? `<a href='${o.driveFolderUrl}' target='_blank' rel='noopener'>عرض الملفات</a>` : '-'}</td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `;
  }).join('');

  body.querySelectorAll('.order-status-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      openOrderStatusModal(badge.closest('tr').dataset.id);
    });
  });
}

function openOrderStatusModal(id) {
  const order = (state.orders || []).find(o => o.id === id);
  if (!order) return;

  if (order.status === STATUS_UNCONFIRMED) {
    openAdminCancelOnlyModal(order);
    return;
  }

  const canEdit = order.status !== STATUS_CANCELLED_C && order.status !== STATUS_CANCELLED_A && order.status !== STATUS_DELIVERED;

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
        if (data.error === 'edit_locked') {
          if (data.status) order.status = data.status;
          showMessage('لم يعد بإمكانك تعديل حالة هذا الطلب');
          closeAdminForm();
          renderOrdersTable();
        } else {
          showMessage('حدث خطأ، حاول مرة أخرى');
        }
        return;
      }

      order.status = data.status || status;
      closeAdminForm();
      renderOrdersTable();
    }
  });

  replaceStatusFieldWithSelect(order, canEdit);
}

function openAdminCancelOnlyModal(order) {
  openAdminForm({
    title: `طلب رقم ${order.id}`,
    submitLabel: 'إلغاء الطلب',
    fields: [],
    onSubmit: async (values, showMessage) => {
      if (!await askConfirm('سيتم إلغاء الطلب نهائيًا ولا يمكن التراجع عن ذلك، هل أنت متأكد؟')) return;

      const res = await authFetch('orders/cancel', { method: 'POST', body: JSON.stringify({ id: order.id }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === 'edit_locked') {
          if (data.status) order.status = data.status;
          showMessage('لم يعد بإمكانك إلغاء هذا الطلب');
          closeAdminForm();
          renderOrdersTable();
        } else {
          showMessage('حدث خطأ، حاول مرة أخرى');
        }
        return;
      }

      order.status = data.status || order.status;
      closeAdminForm();
      renderOrdersTable();
    }
  });

  const fieldsWrap = document.getElementById('admin-form-fields');
  if (fieldsWrap) {
    fieldsWrap.innerHTML = /*html*/ `
      <p class='modal-sub'>هذا الطلب بانتظار تأكيد العميل، ولا يمكنك سوى إلغاؤه.</p>
    `;
  }

  const submitBtn = document.getElementById('admin-form-submit');
  if (submitBtn) submitBtn.classList.add('btn-danger');
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