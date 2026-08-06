function renderContainer() {
  const container = document.getElementById('container');
  const isRealAgent = Boolean(state.session && state.session.role === 'agent');
  const hasMaterials = Boolean((state.materials || []).length);

  if (!hasMaterials) {
    container.innerHTML = /*html*/ `
      <section class='materials-section' id='materials'>
        <h2 class='section-title'>الخامات المتاحة</h2>
        <p class='section-sub'>اختر الخامة المناسبة لطلبك، السعر بالجنيه لكل متر مربع</p>
        <div class='materials-grid' id='materials-grid'></div>
      </section>
    `;
    container.classList.add('has-content');
    renderMaterials();
    return;
  }

  container.innerHTML = /*html*/ `
    <section class='materials-section top-item' id='materials'>
      <h2 class='section-title'>الخامات المتاحة</h2>
      <p class='section-sub'>اختر الخامة المناسبة لطلبك، السعر بالجنيه لكل متر مربع</p>
      <div class='materials-grid' id='materials-grid'></div>
    </section>
    <section class='order-section' id='order'>
      <h2 class='section-title'>اطلب طباعتك</h2>
      <p class='section-sub'>ارفع صورة واحدة أو ملف مضغوط يحتوي على عدة صور، وحدد المقاس والخامة لكل صورة</p>
      <div class='order-panel'>
        <div class='upload-row'>
          <label class='file-label' id='file-label'>
            <span id='file-label-text'>اضغط هنا لاختيار صورة أو أكثر، أو ملفات ZIP</span>
            <input type='file' id='file-input' accept='image/*,.zip,application/zip' multiple>
          </label>
        </div>
        <div class='rows-wrap' id='rows-wrap'>
          <p class='empty-note' id='empty-note'>لا توجد صور بعد، ارفع ملفًا لعرض تفاصيل الطلب هنا</p>
        </div>
        <div class='form-row'>
          <div class='after-row'>
            <label for='name-input'>الاسم</label>
            <input type='text' id='name-input' class='form-input' placeholder='أدخل اسمك'>
          </div>
          <div class='after-row'>
            <label for='phone-input'>رقم الهاتف</label>
            <input type='text' id='phone-input' class='form-input' placeholder='أدخل رقم الهاتف'>
          </div>
        </div>
        <div class='after-row'>
          <label for='notes-input'>الملاحظات</label>
          <input type='text' id='notes-input' class='notes-input' placeholder='أدخل ملاحظاتك هنا'>
        </div>
        <div class='order-total'>
          <button class='btn-primary share-btn' id='share-btn' type='button'>
            <i class='fa-solid fa-paper-plane'></i> إرسال الطلب
          </button>
          <span class='amount' id='order-total'>0 ج.م</span>
        </div>
      </div>
    </section>

    ${isRealAgent ? /*html*/ `
    <section class='order-section' id='orders-log'>
      <h2 class='section-title'>سجل الطلبات</h2>
      <p class='section-sub'>جميع الطلبات السابقة المرتبطة بحسابك</p>
      <div class='admin-table-wrap'>
        <table class='admin-table'>
          <thead>
            <tr>
              <th>رقم الطلب</th> <th>الإجمالي</th> <th>الحالة</th> <th>الملفات</th> <th>الملاحظات</th> <th>التاريخ</th>
            </tr>
          </thead>
          <tbody id='orders-log-table-body'>
            <tr><td colspan='6' class='empty-note'>جارٍ التحميل...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    ` : ''}
  `;
  container.classList.add('has-content');

  renderMaterials();
  wireOrderSection();

  if (isRealAgent) { loadOrdersLog(); }
}

function prefillContactFields() {
  const nameInput = document.getElementById('name-input');
  const phoneInput = document.getElementById('phone-input');
  if (nameInput) { nameInput.value = state.session.name || ''; nameInput.disabled = true; }
  if (phoneInput) { phoneInput.value = state.session.phone || ''; phoneInput.disabled = true; }
}

function renderMaterials() {
  const grid = document.getElementById('materials-grid');
  const materials = state.materials || [];
  if (!materials.length) {
    grid.innerHTML = /*html*/ `<p class='empty-note'>لا توجد خامات مضافة حاليًا</p>`;
    return;
  }

  grid.innerHTML = materials.map(m => /*html*/ `
    <div class='material-card${m.available === false ? ' material-unavailable' : ''}'>
      <img src='${m.image || ''}' alt='${m.name || ''}' loading='lazy' onerror='this.style.opacity=0'>
      <div class='material-body'>
        <div class='material-name'>${m.name || ''}</div>
        ${m.available === false
          ? /*html*/ `<span class='status-badge unavailable'>غير متاحة</span>`
          : /*html*/ `<span class='material-price'>${m.price || 0} ج.م / م²</span>`}
      </div>
    </div>
  `).join('');
}

/* ---------- orders log (agent) ---------- */

async function loadOrdersLog() {
  const body = document.getElementById('orders-log-table-body');
  if (!body) return;

  try {
    const res = await authFetch('orders/mine');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      body.innerHTML = /*html*/ `<tr><td colspan='6' class='empty-note'>تعذر تحميل سجل الطلبات</td></tr>`;
      return;
    }
    state.ordersLog = data.orders || [];
    renderOrdersLogTable(state.ordersLog);
  } catch (e) {
    console.error(e);
    body.innerHTML = /*html*/ `<tr><td colspan='6' class='empty-note'>تعذر الاتصال بالخادم</td></tr>`;
  }
}

function prependOrderToLog(order) {
  const body = document.getElementById('orders-log-table-body');
  if (!body) return;

  if (!Array.isArray(state.ordersLog)) state.ordersLog = [];
  state.ordersLog.unshift(order);
  renderOrdersLogTable(state.ordersLog);
}

function renderOrdersLogTable(orders) {
  const body = document.getElementById('orders-log-table-body');
  if (!body) return;

  if (!orders.length) {
    body.innerHTML = /*html*/ `<tr><td colspan='6' class='empty-note'>لا توجد طلبات سابقة</td></tr>`;
    return;
  }

  const isEditable = status => status === STATUS_UNCONFIRMED || status === STATUS_OPTIONS[1];

  body.innerHTML = orders.map(o => /*html*/ `
    <tr data-id='${o.id}'>
      <td>${o.id}</td>
      <td>${(o.total || 0).toFixed(2)} ج.م</td>
      <td>
        <span class='status-badge ${statusBadgeClass(o.status)}${isEditable(o.status) ? ' btn-badge order-status-badge' : ' badge-disabled'}'${isEditable(o.status) ? ` role='button' tabindex='0' title='${o.status === STATUS_UNCONFIRMED ? 'تأكيد أو إلغاء الطلب' : 'إلغاء الطلب'}'` : ''}>${o.status || ''}</span>
      </td>
      <td>${o.driveFolderUrl ? /*html*/ `<a href='${o.driveFolderUrl}' target='_blank' rel='noopener'>عرض الملفات</a>` : '-'}</td>
      <td><span class='btn-badge order-notes-link' role='button' tabindex='0'>تعديل الملاحظات</span></td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('.order-status-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const id = badge.closest('tr').dataset.id;
      const order = (state.ordersLog || []).find(o => o.id === id);
      if (order && order.status === STATUS_UNCONFIRMED) {
        openAgentConfirmMenu(id);
      } else {
        openAgentCancelMenu(id);
      }
    });
  });

  body.querySelectorAll('.order-notes-link').forEach(link => {
    link.addEventListener('click', e => {
      e.stopPropagation();
      openAgentNotesModal(link.closest('tr').dataset.id);
    });
  });
}

function openAgentConfirmMenu(id) {
  const order = (state.ordersLog || []).find(o => o.id === id);
  if (!order) return;

  openAdminForm({
    title: `طلب رقم ${order.id}`,
    submitLabel: 'تأكيد الطلب',
    fields: [],
    onSubmit: async (values, showMessage) => {
      const res = await authFetch('orders/confirm', { method: 'POST', body: JSON.stringify({ id: order.id }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === 'edit_locked') {
          if (data.status) order.status = data.status;
          showMessage('لم يعد بإمكانك تأكيد هذا الطلب');
          closeAdminForm();
          renderOrdersLogTable(state.ordersLog);
        } else {
          showMessage('حدث خطأ، حاول مرة أخرى');
        }
        return;
      }

      order.status = data.status || order.status;
      closeAdminForm();
      renderOrdersLogTable(state.ordersLog);
    }
  });

  const fieldsWrap = document.getElementById('admin-form-fields');
  if (fieldsWrap) {
    fieldsWrap.innerHTML = /*html*/ `
      <p class='modal-sub'>سيتم تأكيد الطلب أو إلغاؤه بشكل نهائي، ولا يمكن التراجع عن أي من الإجراءين.</p>
    `;
  }

  const submitBtn = document.getElementById('admin-form-submit');
  if (submitBtn && submitBtn.parentNode) {
    const stale = document.getElementById('agent-confirm-cancel-btn');
    if (stale) stale.remove();

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'agent-confirm-cancel-btn';
    cancelBtn.className = 'btn-danger';
    cancelBtn.textContent = 'إلغاء الطلب';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.style.width = '100%';
    submitBtn.insertAdjacentElement('afterend', cancelBtn);

    const messageEl = document.getElementById('admin-form-message');

    cancelBtn.addEventListener('click', async () => {
      cancelBtn.disabled = true;
      submitBtn.disabled = true;
      try {
        const res = await authFetch('orders/cancel', { method: 'POST', body: JSON.stringify({ id: order.id }) });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (data.error === 'edit_locked') {
            if (data.status) order.status = data.status;
            if (messageEl) {
              messageEl.textContent = 'لم يعد بإمكانك إلغاء هذا الطلب';
              messageEl.classList.add('visible');
            }
            closeAdminForm();
            renderOrdersLogTable(state.ordersLog);
          } else if (messageEl) {
            messageEl.textContent = 'حدث خطأ، حاول مرة أخرى';
            messageEl.classList.add('visible');
          }
          return;
        }

        order.status = data.status || order.status;
        closeAdminForm();
        renderOrdersLogTable(state.ordersLog);
      } catch (e) {
        console.error(e);
        if (messageEl) {
          messageEl.textContent = 'تعذر الاتصال بالخادم';
          messageEl.classList.add('visible');
        }
      } finally {
        cancelBtn.disabled = false;
        submitBtn.disabled = false;
      }
    });
  }
}

function openAgentCancelMenu(id) {
  const order = (state.ordersLog || []).find(o => o.id === id);
  if (!order) return;

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
          renderOrdersLogTable(state.ordersLog);
        } else {
          showMessage('حدث خطأ، حاول مرة أخرى');
        }
        return;
      }

      order.status = data.status || order.status;
      closeAdminForm();
      renderOrdersLogTable(state.ordersLog);
    }
  });

  const submitBtn = document.getElementById('admin-form-submit');
  if (submitBtn) submitBtn.classList.add('btn-danger');
}

function openAgentNotesModal(id) {
  const order = (state.ordersLog || []).find(o => o.id === id);
  if (!order) return;

  const canEdit = order.status === STATUS_UNCONFIRMED || order.status === STATUS_OPTIONS[1];

  openAdminForm({
    title: `ملاحظات الطلب رقم ${order.id}`,
    submitLabel: 'حفظ',
    fields: [
      { key: 'notes', label: 'الملاحظات', value: order.notes || '', disabled: !canEdit },
    ],
    onSubmit: async (values, showMessage) => {
      if (!canEdit) {
        closeAdminForm();
        return;
      }

      const res = await authFetch('orders/edit-note', { method: 'POST', body: JSON.stringify({ id: order.id, notes: values.notes }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === 'edit_locked') {
          showMessage('لم يعد بإمكانك تعديل ملاحظات هذا الطلب');
          closeAdminForm();
        } else {
          showMessage('حدث خطأ، حاول مرة أخرى');
        }
        return;
      }

      order.notes = data.notes;
      closeAdminForm();
    }
  });

  const submitBtn = document.getElementById('admin-form-submit');
  if (submitBtn) submitBtn.style.display = canEdit ? '' : 'none';
}