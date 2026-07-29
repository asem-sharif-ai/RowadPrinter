const STATUS_OPTIONS = ['قيد المراجعة', 'جارٍ التجهيز', 'جاهز للاستلام', 'تم التسليم والدفع', 'ملغي (العميل)', 'ملغي (المسؤول)'];
const STATUS_DELIVERED   = STATUS_OPTIONS[3];
const STATUS_CANCELLED_C = STATUS_OPTIONS[4];
const STATUS_CANCELLED_A = STATUS_OPTIONS[5];

const ADMIN_SETTABLE_STATUSES = STATUS_OPTIONS.filter(s => s !== STATUS_CANCELLED_C);

function statusBadgeClass(status) {
  switch (status) {
    case STATUS_OPTIONS[0]:
      return 'pending';
    case STATUS_OPTIONS[1]:
      return 'processing';
    case STATUS_OPTIONS[2]:
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

async function renderRootView() {
  document.getElementById('container').innerHTML = /*html*/ `
    <section class='admin-section'>
      <div class='admin-tabs' id='admin-tabs'>
        <button class='admin-tab active' data-tab='materials'>إدارة الخامات</button>
        <button class='admin-tab' data-tab='admins'>إدارة المسؤولين</button>
        <button class='admin-tab' data-tab='agents'>إدارة المندوبين</button>
        <button class='admin-tab' data-tab='prices'>خطط الأسعار</button>
        <button class='admin-tab' data-tab='orders'>طلبات العملاء</button>
      </div>
      <div class='admin-panel-body' id='admin-panel-body'>
        <p class='empty-note'>جارٍ التحميل...</p>
      </div>
    </section>
  `;

  const [adminsRes, agentsRes, ordersRes] = await Promise.all([
    authFetch('admins/list'), authFetch('agents/list'), authFetch('orders/list'),
  ]);

  const adminsData = await adminsRes.json();
  const agentsData = await agentsRes.json();
  const ordersData = await ordersRes.json();
  state.admins = adminsData.ok ? adminsData.admins : [];
  state.agents = agentsData.ok ? agentsData.agents : [];
  state.orders = ordersData.ok ? ordersData.orders : [];

  const panelBody = document.getElementById('admin-panel-body');
  const tabRenderers = {
    materials:    renderMaterialsPanel,
    admins: () => renderPeoplePanel(panelBody, { title: 'إدارة المسؤولين', addLabel: 'إضافة مسؤول', kind: 'admins' }),
    agents: () => renderPeoplePanel(panelBody, { title: 'إدارة المندوبين', addLabel: 'إضافة مندوب', kind: 'agents' }),
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

  renderMaterialsPanel(panelBody);
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
    <div class='admin-table-wrap'>
      <table class='admin-table table-eq material-table'>
        <thead><tr><th>الصورة</th><th>الاسم</th><th>الوصف</th><th>السعر</th><th></th></tr></thead>
        <tbody id='materials-table-body'></tbody>
      </table>
    </div>
  `;
  document.getElementById('add-material-btn').addEventListener('click', () => openMaterialForm());
  renderMaterialsTable();
}

function renderMaterialsTable() {
  const body = document.getElementById('materials-table-body');
  if (!body) return;

  if (!state.materials.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='5' class='empty-note'>لا توجد خامات مضافة</td></tr>`;
    return;
  }

  body.innerHTML = state.materials.map(m => /*html*/ `
    <tr data-name='${m.name}'>
      <td><img class='material-thumb' src='${m.image || ''}' alt='' onerror="this.classList.add('material-thumb-empty')"></td>
      <td>${m.name}</td>
      <td>${m.desc || ''}</td>
      <td>${m.price || 0} ج.م</td>
      <td class='admin-row-actions'>
        <span class='status-badge ${m.available !== false ? 'available' : 'unavailable'} btn-badge' role='button' tabindex='0' title='تغيير حالة التوفر'>${m.available !== false ? 'متاحة' : 'غير متاحة'}</span>
        <button class='icon-action-btn edit-material-btn' title='تعديل'><i class='fa-solid fa-pen'></i></button>
        <button class='icon-action-btn danger delete-material-btn' title='حذف'><i class='fa-solid fa-trash'></i></button>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.btn-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const name = badge.closest('tr').dataset.name;
      toggleMaterialAvailability(name);
    });
  });

  body.querySelectorAll('.edit-material-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.closest('tr').dataset.name;
      openMaterialForm(state.materials.find(m => m.name === name));
    });
  });

  body.querySelectorAll('.delete-material-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.closest('tr').dataset.name;
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

  const FIELD_OPTIONS = [
    ...(isEdit ? [] : [{ key: 'name', label: 'الاسم' }]),
    { key: 'desc', label: 'الوصف' },
    { key: 'image', label: 'رابط الصورة' },
    { key: 'price', label: 'السعر (ج.م/م²)' },
  ];

  const draft = {
    name: material?.name || '',
    desc: material?.desc || '',
    image: material?.image || '',
    price: material?.price ?? '',
    available: material ? material.available !== false : true,
  };

  openAdminForm({
    title: isEdit ? 'تعديل الخامة' : 'إضافة خامة',
    submitLabel: isEdit ? 'حفظ' : 'إضافة',
    fields: [
      { key: 'field', label: 'البيانات', value: FIELD_OPTIONS[0].key },
      { key: 'value', label: FIELD_OPTIONS[0].label, value: draft[FIELD_OPTIONS[0].key] },
    ],
    onSubmit: async (values, showMessage) => {
      if (!draft.name) {
        showMessage('اسم الخامة مطلوب');
        return;
      }
      if (!draft.price) {
        showMessage('سعر الخامة مطلوب');
        return;
      }
      const action = isEdit ? 'materials/edit' : 'materials/add';
      const res = await authFetch(action, {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          desc: draft.desc,
          image: draft.image,
          price: Number(draft.price) || 0,
          available: draft.available,
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

  wireMaterialFieldPicker(FIELD_OPTIONS, draft, isEdit);
}

function wireMaterialFieldPicker(FIELD_OPTIONS, draft, isEdit) {
  const oldFieldInput = document.getElementById('field-field');
  if (!oldFieldInput) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = /*html*/ `
    <div class='menu-select' id='material-field-select'>
      <button type='button' class='menu-select-toggle wide-select'>
        <span class='menu-select-label'>${FIELD_OPTIONS[0].label}</span>
        <i class='fa-solid fa-chevron-down'></i>
      </button>
      <ul class='menu-select-menu' role='listbox'>
        ${FIELD_OPTIONS.map((f, i) => `<li class='menu-option${i === 0 ? ' selected' : ''}' data-value='${f.key}' role='option'>${f.label}</li>`).join('')}
      </ul>
    </div>
    <input type='hidden' id='field-field' value='${FIELD_OPTIONS[0].key}'>
  `;
  const fragment = document.createDocumentFragment();
  while (wrap.firstChild) fragment.appendChild(wrap.firstChild);
  oldFieldInput.replaceWith(fragment);
  const valueInput = document.getElementById('field-value');
  const label = valueInput?.parentElement?.querySelector('label');
  const sync = key => {
    const opt = FIELD_OPTIONS.find(f => f.key === key);
    if (label && opt) label.textContent = opt.label;
    if (valueInput) {
      valueInput.type = key === 'price' ? 'number' : 'text';
      valueInput.value = draft[key] ?? '';
      valueInput.disabled = isEdit && key === 'name';
    }
    document.querySelector('#material-field-select .menu-select-label').textContent = opt.label;
  };
  if (valueInput) {
    valueInput.addEventListener('input', (e) => {
      draft[document.getElementById('field-field').value] = e.target.value;
    });
  }
  wireAdminSelect('material-field-select', key => {
    document.getElementById('field-field').value = key;
    sync(key);
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

function renderPeoplePanel(container, { title, addLabel, kind }) {
  const isAgents = kind === 'agents';
  container.innerHTML = /*html*/ `
    <div class='admin-header'>
      <h3 class='section-title'>${title}</h3>
      <button class='btn-primary' id='add-${kind}-btn' type='button'>
        <i class='fa-solid fa-user-plus'></i> ${addLabel}
      </button>
    </div>
    <div class='admin-table-wrap'>
      <table class='admin-table table-eq'>
        <thead>
          <tr>
            <th>الاسم</th>
            ${isAgents ? '<th>الهاتف</th>' : ''}
            <th>تاريخ الإنشاء</th>
            <th>آخر ظهور</th>
            <th></th>
          </tr>
        </thead>
        <tbody id='${kind}-table-body'></tbody>
      </table>
    </div>
  `;

  document.getElementById(`add-${kind}-btn`).addEventListener('click', () => openPersonForm(kind, addLabel));
  renderPeopleTable(kind);
}

function renderPeopleTable(kind) {
  const isAgents = kind === 'agents';
  const body = document.getElementById(`${kind}-table-body`);
  if (!body) return;

  const people = state[kind] || [];
  if (!people.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='${isAgents ? 5 : 4}' class='empty-note'>لا توجد بيانات</td></tr>`;
    return;
  }

  body.innerHTML = people.map(p => `
    <tr data-id='${p.id}'>
      <td>${p.name || ''}</td>
      ${isAgents ? `<td>${p.phone || ''}</td>` : ''}
      <td>${formatDate(p.createdAt)}</td>
      <td>${p.lastSeen ? formatDate(p.lastSeen) : '—'}</td>
      <td class='admin-row-actions'>
        <button class='icon-action-btn danger delete-person-btn' title='حذف'><i class='fa-solid fa-trash'></i></button>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.delete-person-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePerson(kind, btn.closest('tr').dataset.id));
  });
}

function openPersonForm(kind, addLabel) {
  const isAgents = kind === 'agents';
  const fields = [{ key: 'name', label: 'الاسم' }];
  if (isAgents) {
    fields.push({ key: 'phone', label: 'رقم الهاتف' });
  }
  fields.push({ key: 'password', label: 'كلمة المرور', type: 'password' });

  openAdminForm({
    title: addLabel,
    submitLabel: 'إضافة',
    fields,
    onSubmit: async (values, showMessage) => {
      if (!values.name || !values.password || (isAgents && !values.phone)) {
        showMessage(isAgents ? 'الاسم ورقم الهاتف وكلمة المرور مطلوبة' : 'الاسم وكلمة المرور مطلوبان');
        return;
      }

      const payload = { name: values.name, password: values.password };
      if (isAgents) {
        payload.phone = values.phone;
      }

      const res = await authFetch(`${kind}/add`, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const messages = {
          password_in_use: 'كلمة المرور مستخدمة بالفعل',
          phone_in_use: 'رقم الهاتف مستخدم بالفعل',
        };
        showMessage(messages[data.error] || 'حدث خطأ، حاول مرة أخرى');
        return;
      }

      const record = { id: data.id, name: data.name, createdAt: data.createdAt, lastSeen: data.lastSeen };
      if (isAgents) {
        record.phone = data.phone;
        record.pricingMap = data.pricingMap;
      }
      state[kind].push(record);

      closeAdminForm();
      renderPeopleTable(kind);
    },
  });
}

async function deletePerson(kind, id) {
  if (!await askConfirm('تأكيد الحذف؟')) return;
  const res = await authFetch(`${kind}/delete`, {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    notify('تعذر الحذف');
    return;
  }

  const removed = state[kind].find(p => p.id === id);
  state[kind] = state[kind].filter(p => p.id !== id);
  renderPeopleTable(kind);

  // The server cascades: deleting an agent also deletes all their orders
  // (matched by phone). Mirror that locally so the orders table doesn't
  // keep showing orders that no longer exist.
  if (kind === 'agents' && removed && removed.phone && Array.isArray(state.orders)) {
    state.orders = state.orders.filter(o => o.phone !== removed.phone);
    if (document.getElementById('orders-table-body')) renderOrdersTable();
  }

  if (kind === 'agents' && removed && pricesSelectedAgentId === removed.id) {
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

// Shows just the price, or the original struck through followed by the
// pending price, whenever the held (unsaved) value differs from the saved one.
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

const DELETE_FILTER_LABELS = {
  all:           'كل الطلبات',
  today:         'طلبات اليوم',
  this_week:     'طلبات هذا الأسبوع',
  this_month:    'طلبات هذا الشهر',
  this_year:     'طلبات هذا العام',
  older_day:     'الطلبات الأقدم من يوم',
  older_week:    'الطلبات الأقدم من أسبوع',
  older_month:   'الطلبات الأقدم من شهر',
  older_year:    'الطلبات الأقدم من عام',
  cancelled:     'الطلبات الملغاة',
  non_cancelled: 'الطلبات غير الملغاة',
  agent_only:    'طلبات المندوبين',
  non_agent:     'طلبات غير المندوبين (الزوار)',
};

const ORDERS_TABLE_FILTERS = {
  all: () => true,
  today: o => {
    const [d, r] = [ orderCreatedDate(o), new Date() ];
    return d ? (d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth() && d.getDate() === r.getDate()) : false;
  },
  this_week: o => {
    const d = orderCreatedDate(o);
    if (!d) return false;
    return d >= startOfWeek(new Date());
  },
  this_month: o => {
    const d = orderCreatedDate(o);
    if (!d) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  },
  this_year: o => {
    const d = orderCreatedDate(o);
    if (!d) return false;
    return d.getFullYear() === new Date().getFullYear();
  },
  older_day: o => orderAgeMs(o) > 1 * 24 * 60 * 60 * 1000,
  older_week: o => orderAgeMs(o) > 7 * 24 * 60 * 60 * 1000,
  older_month: o => orderAgeMs(o) > 30 * 24 * 60 * 60 * 1000,
  older_year: o => orderAgeMs(o) > 365 * 24 * 60 * 60 * 1000,
  cancelled: o => (o.status || '').includes('ملغي'),
  non_cancelled: o => !(o.status || '').includes('ملغي'),
  agent_only: o => Boolean(o.agentId),
  non_agent: o => !o.agentId,
};

let ordersTableFilter = 'all';

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
  ordersTableFilter = 'all';
  container.innerHTML = /*html*/ `
    <div class='admin-header'>
      <h3 class='section-title'>طلبات العملاء</h3>
      <div class='header-controls'>
        <div class='menu-select wide-select' id='delete-orders-filter-select'>
          <button type='button' class='menu-select-toggle'>
            <span class='menu-select-label'>كل الطلبات</span>
            <i class='fa-solid fa-chevron-down'></i>
          </button>
          <ul class='menu-select-menu' role='listbox'>
            <li class='menu-option selected' data-value='all' role='option'>كل الطلبات</li>
            <li class='menu-option' data-value='today' role='option'>اليوم</li>
            <li class='menu-option' data-value='older_day' role='option'>الأقدم من يوم</li>
            <li class='menu-option' data-value='this_week' role='option'>هذا الأسبوع</li>
            <li class='menu-option' data-value='older_week' role='option'>الأقدم من أسبوع</li>
            <li class='menu-option' data-value='this_month' role='option'>هذا الشهر</li>
            <li class='menu-option' data-value='older_month' role='option'>الأقدم من شهر</li>
            <li class='menu-option' data-value='this_year' role='option'>هذا العام</li>
            <li class='menu-option' data-value='older_year' role='option'>الأقدم من عام</li>
            <li class='menu-option' data-value='cancelled' role='option'>الملغاة</li>
            <li class='menu-option' data-value='non_cancelled' role='option'>غير الملغاة</li>
            <li class='menu-option' data-value='agent_only' role='option'>طلبات المندوبين</li>
            <li class='menu-option' data-value='non_agent' role='option'>طلبات غير المندوبين</li>
          </ul>
        </div>
        <button class='btn-danger' id='delete-orders-btn' type='button'>
          <i class='fa-solid fa-trash'></i> حذف
        </button>
      </div>
    </div>
    <div class='admin-table-wrap'>
      <table class='admin-table'>
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>الاسم</th>
            <th>الهاتف</th>
            <th>الإجمالي</th>
            <th>الحالة</th>
            <th>الملفات</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody id='orders-table-body'></tbody>
      </table>
    </div>
  `;
  renderOrdersTable();
  wireDeleteOrders();
}

function orderAgeMs(order) {
  const created = Date.parse(order.createdAt || '');
  if (Number.isNaN(created)) return 0;
  return Date.now() - created;
}

function orderCreatedDate(order) {
  const created = Date.parse(order.createdAt || '');
  return Number.isNaN(created) ? null : new Date(created);
}

function isSameDay(d, ref) {
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function startOfWeek(d) {
  const day = d.getDay();
  const diff = (day + 1) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - diff);
  return start;
}

function wireDeleteOrders() {
  const btn = document.getElementById('delete-orders-btn');
  const select = document.getElementById('delete-orders-filter-select');
  if (!btn || !select) return;

  const toggle = select.querySelector('.menu-select-toggle');
  const label = select.querySelector('.menu-select-label');
  const options = select.querySelectorAll('.menu-option');

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = select.classList.contains('open');
    closeAllMaterialSelects();
    select.classList.toggle('open', !isOpen);
  });

  options.forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      ordersTableFilter = opt.dataset.value;
      label.textContent = opt.textContent;
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      select.classList.remove('open');
      renderOrdersTable();
    });
  });

  btn.addEventListener('click', async () => {
    const filterLabel = DELETE_FILTER_LABELS[ordersTableFilter] || ordersTableFilter;

    if (!await askConfirm(`سيتم حذف ${filterLabel} نهائيًا مع كل المجلدات الخاصة بها، هل أنت متأكد؟`)) return;

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = /*html*/ `<i class='fa-solid fa-spinner fa-spin'></i> جارٍ الحذف...`;

    try {
      const res = await authFetch('orders/delete-all', {
        method: 'POST',
        body: JSON.stringify({ filter: ordersTableFilter }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify('تعذر حذف الطلبات');
        return;
      }
      notify(`تم حذف ${data.deletedCount} طلب/طلبات`);
      await loadOrders();
    } catch (e) {
      console.error(e);
      notify('تعذر الاتصال بالخادم');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });
}

function renderOrdersTable() {
  const body = document.getElementById('orders-table-body');
  if (!body) return;

  const matchesFilter = ORDERS_TABLE_FILTERS[ordersTableFilter] || ORDERS_TABLE_FILTERS.all;
  const orders = state.orders.filter(matchesFilter);

  if (!orders.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='7' class='empty-note'>لا توجد طلبات مطابقة</td></tr>`;
    updateDeleteOrdersBtnState();
    return;
  }

  body.innerHTML = orders.map(o => /*html*/ `
    <tr data-id='${o.id}'>
      <td>${o.id}</td>
      <td>${o.name || ''}</td>
      <td>${o.phone || ''}</td>
      <td>${(o.total || 0).toFixed(2)} ج.م</td>
      <td><span class='status-badge ${statusBadgeClass(o.status)}'>${o.status || ''}</span></td>
      <td>${o.driveFolderUrl ? `<a href='${o.driveFolderUrl}' target='_blank' rel='noopener'>عرض الملفات</a>` : '-'}</td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `).join('');

  updateDeleteOrdersBtnState();
}

function updateDeleteOrdersBtnState() {
  const btn = document.getElementById('delete-orders-btn');
  if (!btn) return;
  const matchesFilter = ORDERS_TABLE_FILTERS[ordersTableFilter] || ORDERS_TABLE_FILTERS.all;
  btn.disabled = !(state.orders || []).some(matchesFilter);
}