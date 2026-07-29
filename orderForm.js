const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
let rowSeq = 0, followUpOrder = null;

function wireOrderSection() {
  wireUploadForm();
  wireShareButton();
}

function wireUploadForm() {
  const fileInput = document.getElementById('file-input');
  const labelText = document.getElementById('file-label-text');

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    labelText.textContent = files.length === 1
      ? `جارٍ المعالجة: ${files[0].name}...`
      : `جارٍ معالجة ${files.length} ملفات...`;

    try {
      await handleFiles(files);
      labelText.textContent = files.length === 1
        ? `تمت إضافة: ${files[0].name}`
        : `تمت إضافة ${files.length} ملفات`;
    } catch (e) {
      console.error(e);
      notify('حدث خطأ أثناء معالجة الملفات');
      labelText.textContent = 'اضغط هنا لاختيار صورة أو أكثر، أو ملفات ZIP';
    }
    fileInput.value = '';
  });
}

function wireShareButton() {
  document.getElementById('share-btn').addEventListener('click', submitOrder);
}

async function handleFiles(files) {
  for (const file of files) {
    await handleFile(file);
  }
  renderRows();
}

async function handleFile(file) {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';

  if (isZip) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(f => !f.dir && IMAGE_EXT.test(f.name));
    if (!entries.length) {
      notify(`لم يتم العثور على صور داخل الملف المضغوط: ${file.name}`);
      return;
    }
    for (const entry of entries) {
      const blob = await entry.async('blob');
      const url = URL.createObjectURL(blob);
      addRow(entry.name.split('/').pop(), url);
    }
  } else if (file.type.startsWith('image/') || IMAGE_EXT.test(file.name)) {
    const url = URL.createObjectURL(file);
    addRow(file.name, url);
  } else {
    notify(`الملف '${file.name}' يجب أن يكون صورة أو ملف ZIP يحتوي على صور`);
  }
}

function addRow(name, url) {
  const defaultMaterial = (state.materials || []).find(m => m.available !== false);
  const newRow = { id: ++rowSeq, name, url, width: 25, height: 25, materialName: defaultMaterial ? defaultMaterial.name : '', qty: 1 };
  state.rows.push(newRow);

  const img = new Image();
  img.onload = () => {
    newRow.width = Math.round(img.naturalWidth / 10);
    newRow.height = Math.round(img.naturalHeight / 10);
    renderRows();
  };
  img.src = url;
}

function removeRow(id) {
  state.rows = state.rows.filter(r => r.id !== id);
  renderRows();
}

function findMaterial(name) {
  return (state.materials || []).find(m => m.name === name);
}

function calcRowPrice(row) {
  const material = findMaterial(row.materialName);
  const pricePerM2 = material ? effectivePrice(material) : 0;
  const areaM2 = (parseFloat(row.width) || 0) / 100 * ((parseFloat(row.height) || 0) / 100);
  const qty = parseFloat(row.qty) || 0;
  return areaM2 * pricePerM2 * qty;
}

function updateTotal() {
  const total = state.rows.reduce((sum, r) => sum + calcRowPrice(r), 0);
  document.getElementById('order-total').textContent = `${total.toFixed(2)} ج.م`;
}

function buildStack(row) {
  const w = Math.max(parseFloat(row.width) || 1, 1);
  const h = Math.max(parseFloat(row.height) || 1, 1);
  const cellW = 90, cellH = 96;
  const boxMax = 66;
  const scale = boxMax / Math.max(w, h);
  const dispW = Math.max(w * scale, 14);
  const dispH = Math.max(h * scale, 14);

  const qty = Math.max(parseInt(row.qty, 10) || 1, 1);
  const layers = Math.min(qty, 3);
  const offset = 6;

  const centerTop = (cellH - dispH) / 2;
  const centerRight = (cellW - dispW) / 2;
  const spread = (layers - 1) * offset;

  let html = '';
  for (let i = layers - 1; i >= 0; i--) {
    const isTop = i === 0;
    const top = centerTop - spread / 2 + i * offset;
    const right = centerRight - spread / 2 + (layers - 1 - i) * offset;

    html += `<div class='stack-canvas' style='
        width:${dispW}px; height:${dispH}px;
        top:${top}px;
        right:${right}px;
        overflow:hidden;
      '>
        <img src='${row.url}' alt='preview' style='width:100%; height:100%; object-fit:fill; display:block;'>
        </div>
        ${isTop ? `<span class='stack-count'>×${qty}</span>` : ''}
      `;
  }
  return html;
}

function renderRows() {
  const wrap = document.getElementById('rows-wrap');

  if (!state.rows.length) {
    wrap.innerHTML = /*html*/ `<p class='empty-note' id='empty-note'>لا توجد صور بعد، ارفع ملفًا لعرض تفاصيل الطلب هنا</p>`;
    updateTotal();
    return;
  }

  const materials = (state.materials || []).filter(m => m.available !== false);
  const materialMenuMarkup = materials.map(m => `
    <li class='menu-option' data-name='${m.name}' role='option'>${m.name}</li>
  `).join('');

  wrap.innerHTML = state.rows.map(row => /*html*/ `
    <div class='order-row' data-id='${row.id}'>
      <div class='stack-cell'>${buildStack(row)}</div>
      <div>
        <label>اسم الملف</label>
        <div class='fname' title='${row.name}'>${row.name}</div>
      </div>
      <div>
        <label>العرض (سم)</label>
        <input type='number' step='1' min='25' max='1000' class='input-width' value='${row.width}'
               oninput="this.value = this.value.replace(/\\D/g, ''); if(+this.value > +this.max) this.value = this.max;"
               onblur='this.value = Math.max(this.min, this.value || this.min)'>
      </div>
      <div>
        <label>الارتفاع (سم)</label>
        <input type='number' step='1' min='25' max='1000' class='input-height' value='${row.height}'
               oninput="this.value = this.value.replace(/\\D/g, ''); if(+this.value > +this.max) this.value = this.max;"
               onblur='this.value = Math.max(this.min, this.value || this.min)'>
      </div>
      <div>
        <label>العدد (قطعة)</label>
        <input type='number' step='1' min='1' max='100' class='input-qty' value='${row.qty}'
               oninput="this.value = this.value.replace(/\\D/g, ''); if(+this.value > +this.max) this.value = this.max;"
               onblur='this.value = Math.max(this.min, this.value || this.min)'>
      </div>
      <div>
        <label>الخامة</label>
        <div class='menu-select'>
          <button type='button' class='menu-select-toggle'>
            <span class='menu-select-label'>${row.materialName || ''}</span>
            <i class='fa-solid fa-chevron-down'></i>
          </button>
          <ul class='menu-select-menu' role='listbox'>${materialMenuMarkup}</ul>
        </div>
      </div>
      <div>
        <label>السعر (جنيه)</label>
        <div class='price'>${calcRowPrice(row).toFixed(2)}</div>
      </div>
      <button class='remove-btn' title='حذف'><i class='fa-solid fa-trash'></i></button>
    </div>
  `).join('');

  wrap.querySelectorAll('.order-row').forEach(rowEl => {
    const id = parseInt(rowEl.dataset.id, 10);
    const row = state.rows.find(r => r.id === id);

    const materialSelect = rowEl.querySelector('.menu-select');
    wireMaterialSelect(materialSelect, rowEl, row);

    rowEl.querySelector('.input-width').addEventListener('input', e => { row.width = e.target.value; updateRowPrice(rowEl, row); });
    rowEl.querySelector('.input-height').addEventListener('input', e => { row.height = e.target.value; updateRowPrice(rowEl, row); });
    rowEl.querySelector('.input-qty').addEventListener('input', e => { row.qty = e.target.value; updateRowPrice(rowEl, row); });
    rowEl.querySelector('.remove-btn').addEventListener('click', () => removeRow(id));
  });

  updateTotal();
}

/* ---------- custom material dropdown ---------- */

function closeAllMaterialSelects(except) {
  document.querySelectorAll('.menu-select.open').forEach(el => {
    if (el !== except) el.classList.remove('open');
  });
}

document.addEventListener('click', () => closeAllMaterialSelects());

function wireMaterialSelect(materialSelect, rowEl, row) {
  const toggle = materialSelect.querySelector('.menu-select-toggle');
  const label = materialSelect.querySelector('.menu-select-label');
  const options = materialSelect.querySelectorAll('.menu-option');

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = materialSelect.classList.contains('open');
    closeAllMaterialSelects();
    materialSelect.classList.toggle('open', !isOpen);
  });

  options.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.name === row.materialName);

    opt.addEventListener('click', e => {
      e.stopPropagation();
      const name = opt.dataset.name;
      row.materialName = name;
      label.textContent = name;
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      materialSelect.classList.remove('open');
      updateRowPrice(rowEl, row);
    });
  });
}

function updateRowPrice(rowEl, row) {
  rowEl.querySelector('.price').textContent = `${calcRowPrice(row).toFixed(2)}`;
  rowEl.querySelector('.stack-cell').innerHTML = buildStack(row);
  updateTotal();
}

async function submitOrder() {
  if (!state.rows.length) {
    notify('لا توجد عناصر في الطلب لإرسالها');
    return;
  }

  const nameInput = document.getElementById('name-input');
  const phoneInput = document.getElementById('phone-input');
  const notesInput = document.getElementById('notes-input');

  const name = (nameInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();
  const notes = (notesInput?.value || '').trim();

  if (!name || !phone) {
    notify('الرجاء إدخال الاسم ورقم الهاتف قبل إرسال الطلب');
    return;
  }

  const shareBtn = document.getElementById('share-btn');
  const originalHtml = shareBtn.innerHTML;
  shareBtn.disabled = true;
  shareBtn.innerHTML = /*html*/ `<i class='fa-solid fa-spinner fa-spin'></i> جارٍ إرسال الطلب...`;

  try {
    const rowsMeta = state.rows.map(row => ({
      name: row.name,
      width: row.width,
      height: row.height,
      materialName: row.materialName,
      qty: row.qty,
    }));

    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('notes', notes);
    formData.append('rowsMeta', JSON.stringify(rowsMeta));

    await Promise.all(state.rows.map(async (row, i) => {
      const res = await fetch(row.url);
      const blob = await res.blob();
      formData.append(`file_${i}`, blob, row.name);
    }));

    const headers = {};
    if (state.session && state.session.token) {
      headers['Authorization'] = `Bearer ${state.session.token}`;
    }

    const res = await fetch(`${state.endpoint}/?action=orders/submit`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (data.error === 'phone_registered_as_agent') {
        notify('رقم الهاتف هذا مسجل كمندوب، إذا كان هذا رقمك يرجى تسجيل الدخول أولاً');
      } else {
        notify(`حدث خطأ أثناء إرسال الطلب\n${data.error || ''}\n${data.debug || ''}`);
      }
      return;
    }

    notify(`تم إرسال طلبك بنجاح \nرقم الطلب: ${data.orderId}\nيرجى حفظ رقم الطلب لمتابعة حالته لاحقًا من قسم 'متابعة الطلب'`);

    const followupInput = document.getElementById('followup-input');
    if (followupInput) followupInput.value = data.orderId;

    if (typeof prependOrderToLog === 'function') {
      prependOrderToLog({
        id: data.orderId,
        itemsCount: state.rows.length,
        total: data.total,
        status: 'قيد المراجعة',
        notes,
        driveFolderUrl: data.folderUrl,
        createdAt: new Date().toISOString(),
      });
    }

  } catch (e) {
    console.error(e);
    notify(`تعذر الاتصال بالخادم لإرسال الطلب\n${e.message || e}`);
  } finally {
    shareBtn.disabled = false;
    shareBtn.innerHTML = originalHtml;
  }
}

function wireFollowUpSection() {
  const btn = document.getElementById('followup-search-btn');
  btn.addEventListener('click', () => {
    const id = document.getElementById('followup-input').value.trim();
    performFollowUpSearch(id);
  });

  document.getElementById('followup-save-note-btn').addEventListener('click', saveFollowUpNote);
  document.getElementById('followup-cancel-btn').addEventListener('click', cancelFollowUpOrder);

  document.getElementById('followup-notes-input').addEventListener('input', () => {
    updateSaveNoteBtnState();
  });
}

function updateSaveNoteBtnState() {
  const notesInput = document.getElementById('followup-notes-input');
  const saveBtn = document.getElementById('followup-save-note-btn');
  if (!notesInput || !saveBtn || !followUpOrder) return;

  const changed = notesInput.value.trim() !== (followUpOrder.notes || '').trim();
  saveBtn.disabled = !changed;
}

async function performFollowUpSearch(orderCode) {
  const resultEl = document.getElementById('followup-result');
  const detailsEl = document.getElementById('followup-details');
  if (!resultEl || !detailsEl) return;

  detailsEl.style.display = 'none';
  followUpOrder = null;

  if (!orderCode) {
    resultEl.textContent = 'الرجاء إدخال رقم الطلب';
    return;
  }

  resultEl.textContent = 'جارٍ البحث...';

  const ok = await refreshFollowUpOrder(orderCode);
  if (!ok) resultEl.textContent = 'لم يتم العثور على طلب بهذا الرقم';
}

async function refreshFollowUpOrder(orderCode) {
  const id = orderCode || (followUpOrder && followUpOrder.id);
  if (!id) return false;

  try {
    const res = await fetch(`${state.endpoint}/?action=orders/status&id=${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      followUpOrder = null;
      document.getElementById('followup-details').style.display = 'none';
      return false;
    }

    followUpOrder = { id: data.id, notes: data.notes || '', status: data.status, canEdit: Boolean(data.canEdit) };
    renderFollowUpDetails();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function renderFollowUpDetails() {
  const detailsEl = document.getElementById('followup-details');
  const resultEl = document.getElementById('followup-result');
  const notesInput = document.getElementById('followup-notes-input');
  const saveBtn = document.getElementById('followup-save-note-btn');
  const cancelBtn = document.getElementById('followup-cancel-btn');
  if (!followUpOrder) return;

  if (resultEl) {
    resultEl.innerHTML = /*html*/ `<span class='status-badge ${statusBadgeClass(followUpOrder.status)}'>${followUpOrder.status || ''}</span>`;
  }

  notesInput.value = followUpOrder.notes;
  notesInput.disabled = !followUpOrder.canEdit;
  saveBtn.style.display = followUpOrder.canEdit ? '' : 'none';
  saveBtn.disabled = true;
  cancelBtn.style.display = followUpOrder.canEdit ? '' : 'none';

  detailsEl.style.display = '';
}

async function saveFollowUpNote() {
  if (!followUpOrder || !followUpOrder.canEdit) return;

  const notesInput = document.getElementById('followup-notes-input');
  const saveBtn = document.getElementById('followup-save-note-btn');
  const notes = notesInput.value.trim();

  saveBtn.disabled = true;
  try {
    const res = await fetch(`${state.endpoint}/?action=orders/edit-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: followUpOrder.id, notes }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (data.error === 'edit_locked') {
        notify('لم يعد بإمكانك تعديل هذا الطلب، حالته تغيّرت. جارٍ تحديث البيانات...');
        await refreshFollowUpOrder();
      } else {
        notify('تعذر حفظ الملاحظات');
      }
      return;
    }
    followUpOrder.notes = data.notes;
    notesInput.value = followUpOrder.notes;
    notify('تم تحديث الملاحظات بنجاح');
  } catch (e) {
    console.error(e);
    notify('تعذر الاتصال بالخادم');
  } finally {
    updateSaveNoteBtnState();
  }
}

async function cancelFollowUpOrder() {
  if (!followUpOrder || !followUpOrder.canEdit) return;
  if (!await askConfirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;

  const cancelBtn = document.getElementById('followup-cancel-btn');
  cancelBtn.disabled = true;
  try {
    const res = await fetch(`${state.endpoint}/?action=orders/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: followUpOrder.id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (data.error === 'edit_locked') {
        notify('لم يعد بإمكانك إلغاء هذا الطلب، حالته تغيّرت. جارٍ تحديث البيانات...');
        await refreshFollowUpOrder();
      } else {
        notify('تعذر إلغاء الطلب');
      }
      return;
    }
    followUpOrder.status = data.status;
    followUpOrder.canEdit = false;
    renderFollowUpDetails();
  } catch (e) {
    console.error(e);
    notify('تعذر الاتصال بالخادم');
  } finally {
    cancelBtn.disabled = false;
  }
}