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
    renderMaterials();
    return;
  }

  container.innerHTML = /*html*/ `
    <section class='materials-section' id='materials'>
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
    <section class='order-section' id='follow-up'>
      <h2 class='section-title'>متابعة الطلب</h2>
      <p class='section-sub'>أدخل رقم الطلب لعرض حالته أو تعديل ملاحظاتك</p>
      <div class='order-panel'>
        <div class='followup-row'>
          <div class='after-row'>
            <div class='followup-header-wrap'>
                <label for='followup-input'>رقم الطلب</label>
                <p class='followup-result' id='followup-result'></p>
            </div>
            <input type='text' id='followup-input' class='form-input' placeholder='أدخل رقم الطلب'>
          </div>
          <button class='btn-primary followup-btn' id='followup-search-btn' type='button'>
            <i class='fa-solid fa-magnifying-glass'></i> بحث
          </button>
        </div>
        <div class='followup-details' id='followup-details' style='display: none;'>
          <div class='after-row notes-row'>
            <label for='followup-notes-input'>الملاحظات</label>
            <div class='followup-header-wrap'>
                <input type='text' class='form-input' id='followup-notes-input' placeholder='لا توجد ملاحظات'>
                <button class='btn-success followup-btn' id='followup-save-note-btn' type='button'><i class='fa-solid fa-floppy-disk'></i>تحديث</button>
                <button class='btn-danger followup-btn' id='followup-cancel-btn' type='button'><i class='fa-solid fa-ban'></i>إلغاء الطلب</button>
            </div>
          </div>
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
              <th>رقم الطلب</th> <th>عدد القطع</th> <th>الإجمالي</th> <th>الحالة</th> <th>الملفات</th> <th>التاريخ</th>
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

  renderMaterials();
  wireOrderSection();
  wireFollowUpSection();

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

  const hasCustomPricing = Boolean(state.session && state.session.pricingMap);

  grid.innerHTML = materials.map(m => /*html*/ `
    <div class='material-card${m.available === false ? ' material-unavailable' : ''}'>
      <img src='${m.image || ''}' alt='${m.name || ''}' loading='lazy' onerror='this.style.opacity=0'>
      <div class='material-body'>
        <div class='material-name'>${m.name || ''}</div>
        <div class='material-desc'>${m.desc || ''}</div>
        ${m.available === false
          ? /*html*/ `<span class='status-badge unavailable'>غير متاحة</span>`
          : hasCustomPricing
            ? /*html*/ `<span class='material-price'><del>${m.price || 0}</del> ${effectivePrice(m)} ج.م / م²</span>`
            : /*html*/ `<span class='material-price'>${effectivePrice(m)} ج.م / م²</span>`}
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

  body.innerHTML = orders.map(o => /*html*/ `
    <tr>
      <td>${o.id}</td>
      <td>${o.itemsCount || 0}</td>
      <td>${(o.total || 0).toFixed(2)} ج.م</td>
      <td><span class='status-badge ${statusBadgeClass(o.status)}'>${o.status || ''}</span></td>
      <td>${o.driveFolderUrl ? /*html*/ `<a href='${o.driveFolderUrl}' target='_blank' rel='noopener'>عرض الملفات</a>` : '-'}</td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `).join('');
}