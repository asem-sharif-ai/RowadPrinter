const state = {
  config: null,
  endpoint: 'https://rowad-printer.asem-sharif-august.workers.dev',
  session: null,
  materials: [],
  agents: [],
  orders: [],
  pricingMap: null, // override
  rows: [] // { id, file, url, name, width, height, materialName, qty }
};

const CUSTOM = true;
initApplication();

// ---------- ---------- App Launch ---------- ---------- ----------

async function initApplication() {
  await loadMaterials();
  renderNav();
  renderBody();
}

async function loadMaterials() {
  try {
    const res = await fetch(`${state.endpoint}/?action=materials/list`);
    const data = await res.json();
    state.materials = data.ok ? data.materials : [];
  } catch (e) {
    console.error(e);
    state.materials = [];
  }
}

// ---------- ---------- Session Memory ---------- ---------- ----------

const SESSION_KEY = 'rowad-printer-session';

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  if (typeof resetOrderForm === 'function') resetOrderForm();
  renderBody();
}
function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (typeof resetOrderForm === 'function') resetOrderForm();
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.expiresAt || Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ---------- ---------- Authentication ---------- ---------- ----------

function authFetch(action, options = {}) {
  const session = state.session;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return fetch(`${state.endpoint}/?action=${action}`, { ...options, headers });
}

// ---------- ---------- Utils ---------- ---------- ----------

function notify(message) {
  let overlay = document.getElementById('friendly-alert-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'friendly-alert-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = /*html*/ `
      <div class='modal-card'>
        <button class='modal-close' type='button' aria-label='إغلاق'>
          <i class='fa-solid fa-xmark'></i>
        </button>
        <p class='modal-sub' id='friendly-alert-message'></p>
        <button class='btn-primary' id='friendly-alert-ok-btn' type='button'>حسنًا</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.classList.remove('active');
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#friendly-alert-ok-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });
  }

  overlay.querySelector('#friendly-alert-message').textContent = message;
  overlay.classList.add('active');
}

function askConfirm(message) {
  let overlay = document.getElementById('friendly-confirm-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'friendly-confirm-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = /*html*/ `
      <div class='modal-card'>
        <button class='modal-close' type='button' aria-label='إغلاق'>
          <i class='fa-solid fa-xmark'></i>
        </button>
        <p class='modal-sub' id='friendly-confirm-message'></p>
        <div style='display:flex; gap:10px;'>
          <button class='btn-primary' id='friendly-confirm-ok-btn' type='button' style='flex:1;'>تأكيد</button>
          <button class='btn-danger' id='friendly-confirm-cancel-btn' type='button' style='flex:1;'>إلغاء</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  return new Promise(resolve => {
    const messageEl = overlay.querySelector('#friendly-confirm-message');
    const okBtn = overlay.querySelector('#friendly-confirm-ok-btn');
    const cancelBtn = overlay.querySelector('#friendly-confirm-cancel-btn');
    const closeBtn = overlay.querySelector('.modal-close');

    messageEl.textContent = message;

    const cleanup = (result) => {
      overlay.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = (e) => {
      if (e.target === overlay) cleanup(false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);

    overlay.classList.add('active');
  });
}


function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function effectivePrice(material) {
  const override = state.pricingMap;
  if (override && override[material.name] !== undefined) {
    return parseFloat(override[material.name]) || 0;
  }
  return parseFloat(material.price) || 0;
}

// ---------- ---------- Modal ---------- ---------- ----------

function closeAdminForm() {
  document.getElementById('admin-form-overlay').classList.remove('active');
}

function openAdminForm({ title, fields, submitLabel, onSubmit }) {
  const overlay = document.getElementById('admin-form-overlay');
  const fieldsWrap = document.getElementById('admin-form-fields');
  const titleEl = document.getElementById('admin-form-title');
  const messageEl = document.getElementById('admin-form-message');
  let submitBtn = document.getElementById('admin-form-submit');

  const staleCancelBtn = document.getElementById('agent-confirm-cancel-btn');
  if (staleCancelBtn) staleCancelBtn.remove();

  titleEl.textContent = title;
  submitBtn.textContent = submitLabel;
  messageEl.textContent = '';
  messageEl.classList.remove('visible');

  fieldsWrap.innerHTML = fields.map(f => {
    if (f.type === 'checkbox') {
      return `
        <label class='admin-form-checkbox'>
          <input type='checkbox' id='field-${f.key}' ${f.value ? 'checked' : ''}>
          <span>${f.label}</span>
        </label>`;
    }
    return `
      <div class='after-row'>
        <label for='field-${f.key}'>${f.label}</label>
        <input type='${f.type || 'text'}' id='field-${f.key}' class='form-input'
               value='${f.value !== undefined && f.value !== null ? f.value : ''}' ${f.disabled ? 'disabled' : ''}>
      </div>`;
  }).join('');

  const freshSubmit = submitBtn.cloneNode(true);
  submitBtn.replaceWith(freshSubmit);
  submitBtn = freshSubmit;
  submitBtn.style.display = '';
  submitBtn.classList.remove('btn-danger');

  submitBtn.addEventListener('click', async () => {
    const values = {};
    fields.forEach(f => {
      const el = document.getElementById(`field-${f.key}`);
      values[f.key] = f.type === 'checkbox' ? el.checked : el.value.trim();
    });

    submitBtn.disabled = true;
    try {
      await onSubmit(values, msg => {
        messageEl.textContent = msg;
        messageEl.classList.toggle('visible', Boolean(msg));
      });
    } finally {
      submitBtn.disabled = false;
    }
  });

  overlay.classList.add('active');
}

function setModalMessage(text) {
  const el = document.getElementById('verify-modal-message');
  el.textContent = text || '';
  el.classList.toggle('visible', Boolean(text));
}

async function submitVerifyCode(code) {
  if (!code) return;

  const submitBtn = document.getElementById('verify-code-submit');
  submitBtn.disabled = true;
  setModalMessage('');

  try {
    const res = await fetch(`${state.endpoint}/?action=verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setModalMessage('كود غير صحيح');
      return;
    }

    saveSession({
      token: data.token,
      role: data.role,
      name: data.name,
      phone: data.phone || '',
      pricingMap: data.pricingMap || null,
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    });

    document.getElementById('verify-modal-overlay').classList.remove('active');
    document.getElementById('verify-code-input').value = '';
    renderBody();
  } catch (e) {
    console.error(e);
    setModalMessage('تعذر الاتصال بالخادم');
  } finally {
    submitBtn.disabled = false;
  }
}

// ---------- ---------- NAV & Body ---------- ---------- ----------

function renderNav() {
  const toggleBtn = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!toggleBtn || !links) return;

  const closeMenu = () => {
    links.classList.remove('open');
    toggleBtn.setAttribute('aria-expanded', 'false');
  };

  toggleBtn.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
  });

  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('click', e => {
    if (!links.classList.contains('open')) return;
    if (links.contains(e.target) || toggleBtn.contains(e.target)) return;
    closeMenu();
  });

  const ctaBtn = document.getElementById('cta-define');
  const overlay = document.getElementById('verify-modal-overlay');
  const closeBtn = document.getElementById('verify-modal-close');
  const submitBtn = document.getElementById('verify-code-submit');
  const input = document.getElementById('verify-code-input');

  const openModal = e => {
    e.preventDefault();
    setModalMessage('');
    overlay.classList.add('active');
    input.focus();
  };

  const closeModal = () => {
    overlay.classList.remove('active');
    input.value = '';
    setModalMessage('');
  };

  ctaBtn.addEventListener('click', e => {
    e.preventDefault();
    if (state.session) clearSession();
    else openModal(e);
    }
  );

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); })
  submitBtn.addEventListener('click', () => { submitVerifyCode(input.value.trim()); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submitVerifyCode(input.value.trim()); });

  document.getElementById('admin-form-close').addEventListener('click', closeAdminForm);
  document.getElementById('admin-form-overlay').addEventListener('click', e => {
    if (e.target.id === 'admin-form-overlay') closeAdminForm();
  });
}

function renderBody() {
  state.session = loadSession();

  const heroEl = document.querySelector('.hero');

  const linksEl = document.getElementById('nav-links');
  const toggleBtn = document.getElementById('nav-toggle');
  const ctaBtn = document.getElementById('cta-define');
  const showSectionNav = Boolean(state.session) && state.session.role === 'agent';

  linksEl.style.display = showSectionNav ? '' : 'none';
  toggleBtn.style.display = showSectionNav ? '' : 'none';

  const ordersLogLink = document.querySelector(`a[href='#orders-log']`);
  if (ordersLogLink) {
    const isRealAgent = Boolean(state.session && state.session.role === 'agent');
    ordersLogLink.style.display = isRealAgent ? '' : 'none';
  }

  ctaBtn.innerHTML = state.session ? `<i class='fa-solid fa-right-from-bracket'></i><span>خروج</span>` : `<i class='fa-solid fa-circle-user'></i><span>كود التعريف</span>`;

  const navName = document.getElementById('nav-name');
  if (!state.session) {
    state.pricingMap = null;
    heroEl.style.display = '';
    navName.textContent = 'مطبعة الرواد';
    const containerEl = document.getElementById('container');
    containerEl.innerHTML = '';
    containerEl.classList.remove('has-content');
    return;
  }

  const role = { root: 'المدير', agent: 'مندوب' }[state.session.role.toLowerCase()];
  navName.textContent = `${state.session.name} (${role})`;

  if (state.session.role === 'root') {
    state.pricingMap = null;
    heroEl.style.display = 'none';
    renderRootView();
  } else {
    state.pricingMap = state.session.pricingMap || null;
    heroEl.style.display = '';
    renderContainer();
    prefillContactFields();
  }

  document.getElementById('footer-year').textContent = new Date().getFullYear();
}