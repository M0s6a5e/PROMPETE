/* ===========================================================
   معمل البرومبت — app.js
   Firebase Auth + Firestore + Storage + OpenRouter AI
=========================================================== */

// ─── Firebase Imports (Modular SDK from CDN) ──────────────
import { onAuthStateChanged, signOut,
         createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         sendEmailVerification, sendPasswordResetEmail,
         GoogleAuthProvider, GithubAuthProvider,
         signInWithPopup, reload, updateProfile }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc,
         collection, addDoc, getDocs, deleteDoc,
         serverTimestamp, query, orderBy, limit,
         runTransaction }                               from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes }                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ─── Local Imports ─────────────────────────────────────────
import { db, auth, storage,
         PLAN_LIMITS, PACKAGES,
         PAYMENT_INFO, MODEL_DISPLAY,
         AVAILABLE_MODELS, MODEL_TEXT, MODEL_VISION }   from './firebase-config.js';
import { generatePromptPlan, fixSelectedText,
         verifyPaymentProof, fileToBase64 }             from './ai-service.js';

// ─── App State ─────────────────────────────────────────────
const state = {
  user:             null,
  userDoc:          null,
  package:          'free',
  projectsUsed:     0,
  storageUsedMB:    0,
  selectedType:     'video',
  checkoutPkg:      null,
  checkoutMethod:   null,
  currentPlan:      null,
  projects:         [],
  cachedImageBase64: null,  // تخزين الصورة للاستخدام عند إعادة التوليد
  customModel:      null,  // الموديل المختار من قبل المستخدم
};

const TYPE_LABELS = {
  video:'🎬 فيديو', image:'🖼️ صورة',
  music:'🎵 موسيقى', website:'💻 موقع'
};

/* ================================================================
   TOAST NOTIFICATIONS
================================================================ */
function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ================================================================
   VIEW ROUTING
================================================================ */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => {
    v.hidden = v.dataset.view !== name;
  });
  if (name === 'workspace') renderWorkspaceSide();
  if (name === 'account')   renderAccount();
  if (name === 'pricing')   renderPricingFull();
  // close mobile nav
  document.getElementById('navInner').classList.remove('is-open');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Nav buttons
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => {
    const type = el.dataset.type;
    if (type) state.selectedType = type;
    showView(el.dataset.nav);
  });
});

document.getElementById('openAccountBtn').addEventListener('click', () => showView('account'));

// Mobile burger
document.getElementById('burgerBtn').addEventListener('click', () => {
  document.getElementById('navInner').classList.toggle('is-open');
});

/* ================================================================
   MODALS
================================================================ */
function openModal(id)  { document.getElementById(id).hidden = false; }
async function closeModal(id) {
  if (id === 'authOverlay' && auth.currentUser && !auth.currentUser.emailVerified) {
    showToast('تم تسجيل الخروج لأن الحساب لم يتم تأكيده بعد.', 'warning');
    try { await signOut(auth); } catch (e) {}
  }
  document.getElementById(id).hidden = true;
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
});
document.getElementById('openAuthBtn').addEventListener('click', () => openModal('authOverlay'));

/* ================================================================
   PRICING CARDS
================================================================ */
function pricingCardHTML(key) {
  const p = PACKAGES[key];
  const priceText = p.price === 0
    ? 'مجانًا'
    : `$${p.price}<span>/شهريًا</span>`;
  const isCurrent = state.package === key;

  return `
    <div class="price-card ${p.featured ? 'is-featured' : ''}">
      ${p.featured ? '<span class="price-stamp">الأكثر طلبًا</span>' : ''}
      <p class="price-name">باقة ${p.name}</p>
      <p class="price-amount">${priceText}</p>
      <ul class="price-features">
        ${p.features.map(f => `<li>${f}</li>`).join('')}
      </ul>
      ${isCurrent
        ? `<div class="price-current-badge">✓ باقتك الحالية</div>`
        : `<button class="btn ${p.featured ? 'btn-primary' : 'btn-outline'} btn-block"
            data-choose-pkg="${key}">
            ${key === 'free' ? 'ابدأ مجانًا' : 'اشترك الآن'}
           </button>`
      }
    </div>`;
}

function renderPricingHome() {
  const el = document.getElementById('pricingCardsHome');
  if (!el) return;
  el.innerHTML = `<div class="pricing-grid">${Object.keys(PACKAGES).map(pricingCardHTML).join('')}</div>`;
  attachPricingListeners(el);
}

function renderPricingFull() {
  const el = document.getElementById('pricingCardsFull');
  if (!el) return;
  el.innerHTML = `<div class="pricing-grid">${Object.keys(PACKAGES).map(pricingCardHTML).join('')}</div>`;
  attachPricingListeners(el);
}

function attachPricingListeners(container) {
  container.querySelectorAll('[data-choose-pkg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.choosePkg;
      if (!state.user) { openModal('authOverlay'); return; }
      if (key === 'free') { showView('workspace'); return; }
      openCheckout(key);
    });
  });
}

renderPricingHome();

/* ================================================================
   WORKSPACE
================================================================ */
function renderWorkspaceSide() {
  document.querySelectorAll('.ws-type-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.type === state.selectedType);
  });

  const lbl = TYPE_LABELS[state.selectedType]?.split(' ')[1] || '';
  document.getElementById('wsTitle').textContent = `احكيلنا فكرتك عن الـ${lbl}`;

  const limits = PLAN_LIMITS[state.package];
  document.getElementById('wsProjectsUsed').textContent =
    `${state.projectsUsed} / ${limits.projects}`;
  document.getElementById('wsStorageVal').textContent =
    `${state.storageUsedMB} ميجا / ${limits.storageMB} ميجا`;
  document.getElementById('wsStorageFill').style.width =
    `${Math.min(100, (state.storageUsedMB / limits.storageMB) * 100)}%`;

  // Model name
  const modelEl = document.getElementById('wsModelName');
  if (modelEl) {
    const activeModelId = state.customModel || MODEL_TEXT;
    const selectedLabel = AVAILABLE_MODELS.find(m => m.id === activeModelId)?.label || activeModelId;
    modelEl.textContent = selectedLabel;
  }

  // File upload badge
  const badge = document.getElementById('wsFileProBadge');
  if (badge) badge.hidden = limits.fileUpload;

  // Quick projects
  renderQuickProjects();
}

document.querySelectorAll('.ws-type-btn').forEach(b => {
  b.addEventListener('click', () => {
    state.selectedType = b.dataset.type;
    renderWorkspaceSide();
    document.getElementById('wsResult').hidden = true;
  });
});

// Quick projects list
function renderQuickProjects() {
  const box = document.getElementById('wsProjectsQuick');
  const list = document.getElementById('wsQuickProjectsList');
  if (!box || !list || !state.user || state.projects.length === 0) {
    if (box) box.hidden = true;
    return;
  }
  box.hidden = false;
  const recent = state.projects.slice(0, 5);
  list.innerHTML = recent.map(p => `
    <div class="ws-quick-item" data-pid="${p.id}">
      <span class="ws-quick-type">${TYPE_LABELS[p.type]?.split(' ')[0] || '📁'}</span>
      <span class="ws-quick-name">${escapeHTML(p.name || 'بدون اسم')}</span>
    </div>
  `).join('');
  list.querySelectorAll('.ws-quick-item').forEach(item => {
    item.addEventListener('click', () => openProjectModal(item.dataset.pid));
  });
}

/* ─── File Drop ─── */
function setupFileDrop(dropId, inputId, textId, onFile) {
  const drop  = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  if (!drop || !input) return;

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const f = input.files[0];
    document.getElementById(textId).textContent =
      f ? `✓ ${f.name}` : (drop.dataset.defaultText || 'اختر ملفاً');
    drop.classList.toggle('has-file', !!f);
    if (f && onFile) onFile(f);
  });
  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.style.background = '#fff'; });
  drop.addEventListener('dragleave', () => drop.style.background = '');
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.style.background = '';
    if (e.dataTransfer.files[0]) {
      const dt = e.dataTransfer;
      // Safari / Firefox workaround
      try { input.files = dt.files; } catch {}
      const f = dt.files[0];
      document.getElementById(textId).textContent = `✓ ${f.name}`;
      drop.classList.add('has-file');
      if (onFile) onFile(f);
    }
  });
}

setupFileDrop('fileDrop', 'wsFile', 'fileDropText');

/* ─── Workspace Form Submit ─── */
document.getElementById('wsForm').addEventListener('submit', async e => {
  e.preventDefault();

  const description = document.getElementById('wsDescription').value.trim();
  if (!description) { showToast('اكتب وصف فكرتك أولاً', 'error'); return; }

  const limits = PLAN_LIMITS[state.package];

  // Check project limit
  if (state.user && state.projectsUsed >= limits.projects) {
    showToast('وصلت لحد المشاريع. ارفع باقتك!', 'warning');
    showView('pricing');
    return;
  }

  // تنبيه إذا رفع المستخدم ملفاً وباقته لا تدعم ذلك
  const wsFile = document.getElementById('wsFile').files[0];
  if (wsFile && !limits.fileUpload) {
    showToast('رفع الملفات متاح في باقة برو فقط', 'warning');
  }

  await executePromptGeneration(description, false);
});


/* ─── Render Plan ─── */
function renderPlan(plan, description) {
  const result = document.getElementById('wsResult');

  // Tools section
  const toolsHTML = (plan.tools || []).map(t => `
    <div class="plan-tool-card">
      <strong>${escapeHTML(t.name)}</strong>
      <span class="${t.type === 'مجاني' ? 'tag-free' : 'tag-paid'}">${escapeHTML(t.type)}</span>
      ${t.url ? `<a href="${escapeHTML(t.url)}" target="_blank" rel="noopener">🔗 فتح الموقع</a>` : ''}
      <p class="plan-tool-desc">${escapeHTML(t.desc || '')}</p>
    </div>
  `).join('');

  // Plan blocks
  const blocksHTML = (plan.plan || []).map((b, i) => `
    <div class="plan-block">
      <div class="plan-block-head">
        <span>${escapeHTML(b.title)}</span>
        <div class="plan-block-actions">
          <button class="copy-btn" data-copy-target="block-${i}">نسخ</button>
        </div>
      </div>
      <div class="plan-block-body" id="block-${i}" contenteditable="true">${escapeHTML(b.prompt || '')}</div>
    </div>
  `).join('');

  // Tips
  const tipsHTML = (plan.tips || []).map(t => `<li>${escapeHTML(t)}</li>`).join('');

  result.innerHTML = `
    <div class="plan-tool-row">${toolsHTML}</div>
    ${blocksHTML}
    <div class="plan-tips">
      <h4>💡 نصائح احترافية</h4>
      <ul>${tipsHTML}</ul>
    </div>
    <div class="plan-save-row">
      <button class="btn btn-primary" id="savePlanBtn">💾 حفظ المشروع</button>
      <button class="btn btn-outline" id="copyAllBtn">📋 نسخ كل الأوامر</button>
    </div>
  `;

  // Copy buttons
  result.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.copyTarget);
      navigator.clipboard.writeText(el.innerText).then(() => {
        btn.textContent = '✓ اتنسخ';
        btn.classList.add('is-copied');
        setTimeout(() => { btn.textContent = 'نسخ'; btn.classList.remove('is-copied'); }, 1600);
      }).catch(() => showToast('فشل النسخ', 'error'));
    });
  });

  // Copy all
  document.getElementById('copyAllBtn')?.addEventListener('click', () => {
    const all = [...result.querySelectorAll('.plan-block-body')]
      .map((el, i) => `=== ${plan.plan[i]?.title || ''} ===\n${el.innerText}`)
      .join('\n\n');
    navigator.clipboard.writeText(all).then(() => {
      showToast('تم نسخ كل الأوامر! 📋', 'success');
    }).catch(() => showToast('فشل النسخ', 'error'));
  });

  // Save plan
  document.getElementById('savePlanBtn')?.addEventListener('click', () => saveProject(description, plan));
}

/* ─── Save Project to Firestore ─── */
async function saveProject(description, plan) {
  if (!state.user) {
    showToast('سجّل دخولك لحفظ المشروع', 'warning');
    openModal('authOverlay');
    return;
  }

  const projectName = document.getElementById('wsProjectName')?.value?.trim()
    || description.slice(0, 40) + '…';
  const limits = PLAN_LIMITS[state.package];

  if (state.projectsUsed >= limits.projects) {
    showToast('وصلت لحد المشاريع في باقتك', 'warning');
    return;
  }

  const saveBtn = document.getElementById('savePlanBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ جاري الحفظ…'; }

  try {
    const projectRef = collection(db, 'users', state.user.uid, 'projects');
    await addDoc(projectRef, {
      name:      projectName,
      type:      state.selectedType,
      desc:      description,
      plan:      plan,
      createdAt: serverTimestamp(),
    });

    // Update project count
    const newCount = state.projectsUsed + 1;
    await updateDoc(doc(db, 'users', state.user.uid), { projectsCount: newCount });
    state.projectsUsed = newCount;
    renderWorkspaceSide();
    await loadProjects();

    showToast('✅ تم حفظ المشروع بنجاح!', 'success');
  } catch (err) {
    showToast('فشل الحفظ: ' + err.message, 'error');
    console.error(err);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 حفظ المشروع'; }
  }
}

/* ─── Select-to-Fix Popover ─── */
const fixPopover = document.getElementById('fixPopover');
let   fixingBlockId = null;

document.addEventListener('mouseup', e => {
  const sel  = window.getSelection();
  const text = sel.toString().trim();
  const block = e.target.closest?.('.plan-block-body');
  if (text && block) {
    const range = sel.getRangeAt(0).getBoundingClientRect();
    fixPopover.style.top  = `${window.scrollY + range.top - 52}px`;
    fixPopover.style.left = `${window.scrollX + range.left}px`;
    fixPopover.hidden = false;
    fixingBlockId = block.id;
  } else if (!e.target.closest('#fixPopover')) {
    fixPopover.hidden = true;
  }
});

document.getElementById('fixPopoverBtn').addEventListener('click', async () => {
  const selectedText = window.getSelection().toString().trim();
  if (!selectedText || !fixingBlockId) return;

  const block = document.getElementById(fixingBlockId);
  const fullText = block?.innerText || '';
  fixPopover.hidden = true;
  block?.classList.add('is-fixing');

  try {
    const improved = await fixSelectedText({
      selectedText,
      fullBlockText: fullText,
      type:          state.selectedType,
      planModel:     state.package,
      customModel:   state.customModel,
    });
    // Replace selected text in the block
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(improved));
    }
    showToast('✅ تم تحسين النص', 'success');
  } catch (err) {
    showToast(err.message || 'فشل التعديل', 'error');
  } finally {
    block?.classList.remove('is-fixing');
  }
});

/* ================================================================
   FIREBASE AUTH
================================================================ */
onAuthStateChanged(auth, async user => {
  if (user) {
    if (!user.emailVerified) {
      state.user = null;
      state.userDoc = null;
      state.package = 'free';
      state.projectsUsed  = 0;
      state.storageUsedMB = 0;
      state.projects = [];
      updateNavForLoggedOut();
      
      const emailDisp = document.getElementById('verifyEmailDisplay');
      if (emailDisp) emailDisp.textContent = user.email;
      showAuthScreen('authVerifyScreen');
      openModal('authOverlay');
    } else {
      state.user = user;
      await loadUserDoc(user);
      updateNavForLoggedIn(user);
    }
  } else {
    state.user    = null;
    state.userDoc = null;
    state.package = 'free';
    state.projectsUsed  = 0;
    state.storageUsedMB = 0;
    state.projects = [];
    updateNavForLoggedOut();
  }
  renderPricingHome();
  renderWorkspaceSide();
  populateModelSelect();
});

async function loadUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  let snap;
  try { snap = await getDoc(ref); } catch (e) { console.warn(e); }

  if (snap?.exists()) {
    const d = snap.data();
    state.package       = d.package       || 'free';
    state.projectsUsed  = d.projectsCount || 0;
    state.storageUsedMB = d.storageMB     || 0;
    state.userDoc = d;

    // Keep display name in sync in firestore if updated
    if (user.displayName && d.username !== user.displayName) {
      try { await updateDoc(ref, { username: user.displayName }); } catch(e){}
    }
  } else {
    // Create new user document
    const newDoc = {
      uid:          user.uid,
      email:        user.email,
      username:     user.displayName || user.email?.split('@')[0] || 'مستخدم جديد',
      package:      'free',
      projectsCount:0,
      storageMB:    0,
      createdAt:    serverTimestamp(),
    };
    try { await setDoc(ref, newDoc); } catch (e) { console.warn(e); }
    state.package = 'free';
    state.userDoc = newDoc;
  }
  await loadProjects();
}

async function loadProjects() {
  if (!state.user) return;
  try {
    const q = query(
      collection(db, 'users', state.user.uid, 'projects'),
      orderBy('createdAt', 'desc'),
      limit(60)
    );
    const snap = await getDocs(q);
    state.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('loadProjects:', e);
    state.projects = [];
  }
}

function updateNavForLoggedIn(user) {
  const authBtn    = document.getElementById('openAuthBtn');
  const accountBtn = document.getElementById('openAccountBtn');
  authBtn.hidden    = true;
  accountBtn.hidden = false;

  const displayName = user.displayName || user.email?.split('@')[0] || 'مستخدم';
  const initial = displayName.trim().charAt(0).toUpperCase();

  const initialEl = document.getElementById('navUserInitial');
  const nameEl = document.getElementById('navUserDisplayName');

  if (initialEl) initialEl.textContent = initial;
  if (nameEl) nameEl.textContent = displayName;
}

function updateNavForLoggedOut() {
  const authBtn    = document.getElementById('openAuthBtn');
  const accountBtn = document.getElementById('openAccountBtn');
  authBtn.hidden    = false;
  accountBtn.hidden = true;
}

/* ─── Auth Tabs ─── */
document.querySelectorAll('.tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('is-active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.querySelector(`[data-panel="${tab.dataset.tab}"]`)?.classList.add('is-active');
  });
});

/* ─── Auth Screens ─── */
function showAuthScreen(name) {
  ['authMainScreen','authVerifyScreen','authResetScreen'].forEach(id => {
    document.getElementById(id).hidden = id !== name;
  });
}

// Reset on open
document.getElementById('openAuthBtn').addEventListener('click', () => {
  showAuthScreen('authMainScreen');
  clearAuthErrors();
});

function clearAuthErrors() {
  ['loginError','signupError','resetError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; el.textContent = ''; }
  });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.hidden = false; }
}

function firebaseErrorAr(code) {
  const map = {
    'auth/invalid-email':           'البريد الإلكتروني غير صحيح',
    'auth/user-not-found':          'لا يوجد حساب بهذا البريد',
    'auth/wrong-password':          'كلمة المرور غير صحيحة',
    'auth/email-already-in-use':    'هذا البريد مستخدم بالفعل',
    'auth/weak-password':           'كلمة المرور ضعيفة (6 أحرف على الأقل)',
    'auth/popup-closed-by-user':    'تم إلغاء تسجيل الدخول',
    'auth/network-request-failed':  'مشكلة في الاتصال بالإنترنت',
    'auth/too-many-requests':       'تجاوزت عدد المحاولات. حاول بعد قليل',
    'auth/invalid-credential':      'البريد أو كلمة المرور غير صحيحة',
  };
  return map[code] || 'حدث خطأ. حاول مجدداً.';
}

/* ─── Login ─── */
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearAuthErrors();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginSubmitBtn');
  btn.disabled   = true;
  btn.textContent = '⏳ جاري الدخول…';
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      showAuthError('loginError', 'يرجى تأكيد بريدك الإلكتروني أولاً.');
      const emailDisp = document.getElementById('verifyEmailDisplay');
      if (emailDisp) emailDisp.textContent = cred.user.email;
      showAuthScreen('authVerifyScreen');
      await signOut(auth);
      return;
    }
    closeModal('authOverlay');
    showToast('أهلاً بك! 👋', 'success');
    showView('workspace');
  } catch (err) {
    showAuthError('loginError', firebaseErrorAr(err.code));
  } finally {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
});

/* ─── Signup ─── */
document.getElementById('signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearAuthErrors();
  const username = document.getElementById('signupUsername').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;
  const btn      = document.getElementById('signupSubmitBtn');

  if (!username) {
    showAuthError('signupError', 'من فضلك أدخل اسم المستخدم');
    return;
  }
  if (password !== confirm) {
    showAuthError('signupError', 'كلمتا المرور غير متطابقتان');
    return;
  }
  if (password.length < 6) {
    showAuthError('signupError', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ جاري الإنشاء…';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Store display name in Auth
    await updateProfile(cred.user, { displayName: username });
    
    // Send email verification with dynamic action code redirect to verify-email.html
    const cleanPath = window.location.pathname.replace('index.html', '').replace(/\/$/, '');
    const redirectUrl = window.location.origin + cleanPath + '/verify-email.html';
    await sendEmailVerification(cred.user, {
      url: redirectUrl,
      handleCodeInApp: true
    });
    document.getElementById('verifyEmailDisplay').textContent = email;
    showAuthScreen('authVerifyScreen');
    showToast('تم إنشاء الحساب! تحقق من بريدك 📧', 'success');
  } catch (err) {
    showAuthError('signupError', firebaseErrorAr(err.code));
  } finally {
    btn.disabled = false;
    btn.textContent = 'إنشاء الحساب';
  }
});

/* ─── Resend Verify ─── */
document.getElementById('resendVerifyBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return;
  try {
    const cleanPath = window.location.pathname.replace('index.html', '').replace(/\/$/, '');
    const redirectUrl = window.location.origin + cleanPath + '/verify-email.html';
    await sendEmailVerification(auth.currentUser, {
      url: redirectUrl,
      handleCodeInApp: true
    });
    showToast('تم إعادة إرسال رسالة التأكيد 📧', 'success');
  } catch { showToast('انتظر قليلاً قبل إعادة الإرسال', 'warning'); }
});

/* ─── Already Verified ─── */
document.getElementById('alreadyVerifiedBtn').addEventListener('click', async () => {
  if (!auth.currentUser) { showAuthScreen('authMainScreen'); return; }
  try {
    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      closeModal('authOverlay');
      showToast('تم تأكيد بريدك! 🎉', 'success');
      showView('workspace');
    } else {
      showToast('لم يتم التأكيد بعد. افتح الرسالة في بريدك.', 'warning');
    }
  } catch { showToast('حدث خطأ', 'error'); }
});

/* ─── Forgot Password ─── */
document.getElementById('forgotPassBtn').addEventListener('click', () => {
  showAuthScreen('authResetScreen');
});
document.getElementById('backToLoginBtn').addEventListener('click', () => {
  showAuthScreen('authMainScreen');
  clearAuthErrors();
});
document.getElementById('resetForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearAuthErrors();
  const email = document.getElementById('resetEmail').value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('تم إرسال رابط استعادة كلمة المرور 📧', 'success');
    showAuthScreen('authMainScreen');
  } catch (err) {
    document.getElementById('resetError').textContent = firebaseErrorAr(err.code);
    document.getElementById('resetError').hidden = false;
  }
});

/* ─── Google Login ─── */
document.getElementById('googleBtn').addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    if (!cred.user.emailVerified) {
      showToast('بريدك الإلكتروني التابع لحساب Google غير مؤكد.', 'warning');
      await signOut(auth);
      return;
    }
    closeModal('authOverlay');
    showToast('أهلاً! تم الدخول بـ Google ✅', 'success');
    showView('workspace');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast(firebaseErrorAr(err.code), 'error');
    }
  }
});

/* ─── GitHub Login ─── */
document.getElementById('githubBtn').addEventListener('click', async () => {
  const provider = new GithubAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    if (!cred.user.emailVerified) {
      showToast('بريدك الإلكتروني التابع لحساب GitHub غير مؤكد.', 'warning');
      await signOut(auth);
      return;
    }
    closeModal('authOverlay');
    showToast('أهلاً! تم الدخول بـ GitHub ✅', 'success');
    showView('workspace');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast(firebaseErrorAr(err.code), 'error');
    }
  }
});

/* ─── Logout ─── */
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await signOut(auth);
  showToast('تم تسجيل الخروج', 'info');
  showView('home');
});

/* ================================================================
   ACCOUNT VIEW
================================================================ */
async function renderAccount() {
  const loggedOut = document.getElementById('accountLoggedOut');
  const loggedIn  = document.getElementById('accountLoggedIn');

  if (!state.user) {
    loggedOut.hidden = false;
    loggedIn.hidden  = true;
    return;
  }

  loggedOut.hidden = true;
  loggedIn.hidden  = false;

  // UID display
  const uidEl = document.getElementById('accUidDisplay');
  if (uidEl) uidEl.textContent = `ID: ${state.user.uid}`;

  // Premium Profile Info
  const displayName = state.user.displayName || state.user.email?.split('@')[0] || 'مستخدم';
  const displayEmail = state.user.email || '';
  const initial = displayName.trim().charAt(0).toUpperCase();

  const nameEl = document.getElementById('accDisplayName');
  const emailEl = document.getElementById('accEmailDisplay');
  const avatarEl = document.getElementById('profileAvatar');

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = displayEmail;
  if (avatarEl) avatarEl.textContent = initial;

  // Package
  document.getElementById('accPackageName').textContent =
    PACKAGES[state.package]?.name || 'مجانية';

  // Storage
  const limits = PLAN_LIMITS[state.package];
  document.getElementById('accStorageFill').style.width =
    `${Math.min(100, (state.storageUsedMB / limits.storageMB) * 100)}%`;
  document.getElementById('accStorageVal').textContent =
    `${state.storageUsedMB} ميجا / ${limits.storageMB} ميجا`;

  // Projects count
  document.getElementById('accProjectsVal').textContent =
    `${state.projectsUsed} / ${limits.projects}`;

  // Projects list
  await loadProjects();
  renderProjectsList();
}

function renderProjectsList() {
  const empty = document.getElementById('projectsEmpty');
  const list  = document.getElementById('projectsList');

  if (!state.projects.length) {
    empty.hidden = false;
    list.innerHTML = '';
    return;
  }
  empty.hidden = true;

  list.innerHTML = state.projects.map(p => {
    const date = p.createdAt?.toDate?.()?.toLocaleDateString('ar-EG') || '';
    const typeIcon = TYPE_LABELS[p.type]?.split(' ')[0] || '📁';
    return `
      <div class="project-card" data-pid="${p.id}">
        <span class="project-card-type">${typeIcon}</span>
        <p class="project-card-name">${escapeHTML(p.name || 'بدون اسم')}</p>
        <p class="project-card-date">${date}</p>
        <div class="project-card-actions">
          <button class="btn btn-outline btn-sm" data-open-pid="${p.id}">عرض</button>
          <button class="btn btn-danger btn-sm" data-del-pid="${p.id}">حذف</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-open-pid]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openProjectModal(btn.dataset.openPid);
    });
  });
  list.querySelectorAll('[data-del-pid]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteProject(btn.dataset.delPid);
    });
  });
}

async function deleteProject(pid) {
  if (!confirm('هل تريد حذف هذا المشروع نهائياً؟')) return;
  try {
    await deleteDoc(doc(db, 'users', state.user.uid, 'projects', pid));
    const newCount = Math.max(0, state.projectsUsed - 1);
    await updateDoc(doc(db, 'users', state.user.uid), { projectsCount: newCount });
    state.projectsUsed = newCount;
    await loadProjects();
    renderProjectsList();
    renderWorkspaceSide();
    showToast('تم حذف المشروع', 'info');
  } catch (err) {
    showToast('فشل الحذف: ' + err.message, 'error');
  }
}

function openProjectModal(pid) {
  const project = state.projects.find(p => p.id === pid);
  if (!project) return;

  document.getElementById('projectModalTitle').textContent =
    project.name || 'عرض المشروع';

  const plan = project.plan;
  let html = '';
  if (plan?.tools?.length) {
    html += `<p><strong>الأدوات المقترحة:</strong> ${plan.tools.map(t => t.name).join(' ، ')}</p>`;
  }
  if (plan?.plan?.length) {
    html += `<div class="project-modal-plan">
      ${plan.plan.map(b => `
        <div class="project-modal-block">
          <div class="project-modal-block-head">
            <span>${escapeHTML(b.title)}</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.project-modal-block').querySelector('.project-modal-block-body').innerText).then(()=>{ this.textContent='✓'; setTimeout(()=>this.textContent='نسخ',1500); })">نسخ</button>
          </div>
          <div class="project-modal-block-body">${escapeHTML(b.prompt || '')}</div>
        </div>
      `).join('')}
    </div>`;
  }
  document.getElementById('projectModalContent').innerHTML = html || '<p>لا توجد بيانات</p>';
  openModal('projectOverlay');
}

document.getElementById('accountLoginBtn')?.addEventListener('click', () => openModal('authOverlay'));

/* ================================================================
   CHECKOUT / PAYMENT
================================================================ */
function openCheckout(pkgKey) {
  state.checkoutPkg    = pkgKey;
  state.checkoutMethod = null;

  document.getElementById('checkoutPkgName').textContent  = `باقة ${PACKAGES[pkgKey].name}`;
  document.getElementById('checkoutPkgPrice').textContent = `$${PACKAGES[pkgKey].price}`;

  // Reset steps
  ['checkoutMethodStep','checkoutUploadStep','checkoutVerifyingStep',
   'checkoutDoneStep','checkoutFailedStep'].forEach(id => {
    document.getElementById(id).hidden = id !== 'checkoutMethodStep';
  });

  // Clear proofs
  ['proofFile1','proofFile2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['proofDrop1Text','proofDrop2Text'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = i === 0 ? 'اضغط لرفع صورة رسالة الـ SMS' : 'اضغط لرفع صورة التطبيق';
  });
  ['proofPreview1','proofPreview2'].forEach(id => {
    document.getElementById(id).hidden = true;
  });
  ['fileDrop1','fileDrop2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('has-file');
  });

  openModal('checkoutOverlay');
}

/* ─── Choose payment method ─── */
document.querySelectorAll('.pay-method').forEach(btn => {
  btn.addEventListener('click', () => {
    const method = btn.dataset.method;
    state.checkoutMethod = method;
    const info = PAYMENT_INFO[method];

    // Show payment info box
    const box = document.getElementById('payInfoBox');
    box.innerHTML = `
      <strong>${info.label}</strong>
      <span>${info.detail}</span>
      <p style="margin:6px 0 0;font-size:13px;color:var(--ink-soft)">
        حوّل مبلغ <b>$${PACKAGES[state.checkoutPkg]?.price}</b> لهذا الحساب ثم ارفع صور التأكيد أدناه.
      </p>`;

    document.getElementById('checkoutMethodStep').hidden = true;
    document.getElementById('checkoutUploadStep').hidden = false;
  });
});

/* ─── Proof file drops ─── */
setupProofDrop('proofDrop1', 'proofFile1', 'proofDrop1Text', 'proofPreview1', 'proofImg1');
setupProofDrop('proofDrop2', 'proofFile2', 'proofDrop2Text', 'proofPreview2', 'proofImg2');

function setupProofDrop(dropId, inputId, textId, previewId, imgId) {
  const drop    = document.getElementById(dropId);
  const input   = document.getElementById(inputId);
  const textEl  = document.getElementById(textId);
  const preview = document.getElementById(previewId);
  const img     = document.getElementById(imgId);
  if (!drop || !input) return;

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (!f) return;
    textEl.textContent = `✓ ${f.name}`;
    drop.classList.add('has-file');
    const url = URL.createObjectURL(f);
    img.src = url;
    preview.hidden = false;
  });

  // Remove button
  preview?.querySelector('.proof-remove')?.addEventListener('click', () => {
    input.value = '';
    textEl.textContent = dropId === 'proofDrop1' ? 'اضغط لرفع صورة رسالة الـ SMS' : 'اضغط لرفع صورة التطبيق';
    drop.classList.remove('has-file');
    preview.hidden = true;
    img.src = '';
  });
}

/* ─── Submit proof & verify ─── */
document.getElementById('submitProofBtn').addEventListener('click', async () => {
  const f1 = document.getElementById('proofFile1').files[0];
  const f2 = document.getElementById('proofFile2').files[0];

  if (!f1 || !f2) {
    showToast('من فضلك ارفع الصورتين', 'error');
    return;
  }

  document.getElementById('checkoutUploadStep').hidden    = true;
  document.getElementById('checkoutVerifyingStep').hidden = false;

  try {
    const [img1b64, img2b64] = await Promise.all([fileToBase64(f1), fileToBase64(f2)]);
    const pkg = PACKAGES[state.checkoutPkg];

    const result = await verifyPaymentProof({
      smsImageBase64: img1b64,
      appImageBase64: img2b64,
      expectedAmount: pkg.price,
      packageName:    pkg.name,
    });

    document.getElementById('checkoutVerifyingStep').hidden = true;

    if (result.verified) {
      // Activate package in Firestore
      if (state.user) {
        await updateDoc(doc(db, 'users', state.user.uid), {
          package: state.checkoutPkg,
          packageActivatedAt: serverTimestamp(),
        });

        // Upload proof images to Storage
        try {
          const timestamp = Date.now();
          const r1 = ref(storage, `payments/${state.user.uid}/${timestamp}_sms.jpg`);
          const r2 = ref(storage, `payments/${state.user.uid}/${timestamp}_app.jpg`);
          await Promise.all([uploadBytes(r1, f1), uploadBytes(r2, f2)]);
        } catch (e) { console.warn('Proof upload:', e); }

        state.package = state.checkoutPkg;
        const newLimits = PLAN_LIMITS[state.checkoutPkg];
        state.projectsUsed  = Math.min(state.projectsUsed, newLimits.projects);
        renderWorkspaceSide();
        renderPricingHome();
      }
      document.getElementById('checkoutDoneStep').hidden = false;
      showToast('🎉 تم تفعيل باقتك بنجاح!', 'success');
    } else {
      document.getElementById('checkoutFailReason').textContent =
        result.reason || 'الصور غير مطابقة أو المبلغ غير صحيح.';
      document.getElementById('checkoutFailedStep').hidden = false;
    }
  } catch (err) {
    document.getElementById('checkoutVerifyingStep').hidden = true;
    document.getElementById('checkoutFailReason').textContent =
      'حدث خطأ أثناء التحقق: ' + err.message;
    document.getElementById('checkoutFailedStep').hidden = false;
    console.error(err);
  }
});

/* ─── Retry proof ─── */
document.getElementById('retryProofBtn')?.addEventListener('click', () => {
  document.getElementById('checkoutFailedStep').hidden  = true;
  document.getElementById('checkoutUploadStep').hidden  = false;
});

/* ================================================================
   UTILS
================================================================ */
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ================================================================
   INVITE CODE REDEMPTION
================================================================ */

// Auto-uppercase input
const inviteInput = document.getElementById('inviteCodeInput');
if (inviteInput) {
  inviteInput.addEventListener('input', () => {
    const pos = inviteInput.selectionStart;
    inviteInput.value = inviteInput.value.toUpperCase();
    inviteInput.setSelectionRange(pos, pos);
  });
}

document.getElementById('redeemCodeBtn')?.addEventListener('click', redeemInviteCode);
inviteInput?.addEventListener('keydown', e => { if (e.key === 'Enter') redeemInviteCode(); });

async function redeemInviteCode() {
  const code    = document.getElementById('inviteCodeInput')?.value?.trim().toUpperCase();
  const errEl   = document.getElementById('inviteCodeError');
  const btn     = document.getElementById('redeemCodeBtn');
  const label   = document.getElementById('redeemBtnLabel');
  const form    = document.getElementById('inviteCodeForm');
  const success = document.getElementById('inviteSuccess');
  const successMsg = document.getElementById('inviteSuccessMsg');

  // Clear previous error
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

  if (!code || code.length < 6) {
    showInviteError('أدخل الكود كاملاً من فضلك'); return;
  }

  if (!state.user) {
    showInviteError('يجب تسجيل الدخول أولاً لتفعيل الكود');
    setTimeout(() => openModal('authOverlay'), 1200);
    return;
  }

  // Check if user already on a paid plan
  if (state.package !== 'free') {
    showInviteError('أنت مشترك في باقة مدفوعة بالفعل'); return;
  }

  btn.disabled = true;
  label.textContent = '⏳ جاري التحقق…';

  try {
    const codeRef = doc(db, 'inviteCodes', code);
    let   newPackage = null;

    // Atomic transaction: read → verify → mark used → update user
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(codeRef);

      if (!snap.exists()) {
        throw new Error('INVALID'); // كود غير موجود
      }

      const data = snap.data();

      if (data.used) {
        throw new Error('USED'); // كود مستخدم
      }

      newPackage = data.package;

      // Mark code as used
      transaction.update(codeRef, {
        used:   true,
        usedBy: state.user.uid,
        usedAt: serverTimestamp(),
      });

      // Update user package
      transaction.update(doc(db, 'users', state.user.uid), {
        package:             newPackage,
        packageActivatedAt:  serverTimestamp(),
        packageActivatedVia: 'invite_code',
        inviteCode:          code,
      });
    });

    // Update local state
    state.package = newPackage;
    renderWorkspaceSide();
    renderPricingHome();

    // Show success
    form.hidden    = true;
    success.hidden = false;
    const pkgName = PACKAGES[newPackage]?.name || newPackage;
    if (successMsg) successMsg.textContent = `تم ترقية حسابك إلى باقة ${pkgName} 🎉`;
    showToast(`🎉 تم تفعيل كود الدعوة! باقة ${pkgName} فعّالة الآن`, 'success', 5000);

  } catch (err) {
    const msg = err.message === 'INVALID'
      ? 'الكود غير صحيح أو غير موجود'
      : err.message === 'USED'
      ? 'هذا الكود مستخدم بالفعل من شخص آخر'
      : 'حدث خطأ أثناء التحقق. حاول مجدداً.';
    showInviteError(msg);
    console.error('Invite code error:', err);
  } finally {
    btn.disabled = false;
    label.textContent = '🔓 تفعيل الكود';
  }
}

function showInviteError(msg) {
  const errEl = document.getElementById('inviteCodeError');
  if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
  showToast(msg, 'error');
}

/* ================================================================
   INIT
================================================================ */
// Check for verified=true parameter in URL
const initUrlParams = new URLSearchParams(window.location.search);
if (initUrlParams.get('verified') === 'true') {
  // Clear parameter from URL bar to keep it clean
  const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  
  // Show premium success toast
  setTimeout(() => {
    showToast('🎉 تم تفعيل بريدك بنجاح! حسابك نشط الآن.', 'success', 5000);
  }, 1000);
}

/* ================================================================
   CLARIFICATION FLOW (TENTATIVE QUESTIONS)
================================================================ */
let originalPromptDescription = "";

async function executePromptGeneration(descriptionText, isClarification = false) {
  const submitBtn = document.getElementById('wsSubmitBtn');
  const loading   = document.getElementById('wsLoading');
  const result    = document.getElementById('wsResult');
  
  result.hidden   = true;
  loading.hidden  = false;
  submitBtn.disabled = true;
  document.getElementById('wsSubmitLabel').textContent = '⏳ جاري التحليل…';

  let imageBase64 = null;
  if (!isClarification) {
    // أول توليد: نقرأ الملف ونحفظه في الحالة
    const wsFile = document.getElementById('wsFile').files[0];
    const limits = PLAN_LIMITS[state.package];
    if (wsFile && limits.fileUpload) {
      try { imageBase64 = await fileToBase64(wsFile); }
      catch { console.error('Failed to read file'); }
    }
    state.cachedImageBase64 = imageBase64;
  } else {
    // إعادة توليد بعد الأسئلة: نستخدم الصورة المحفوظة
    imageBase64 = state.cachedImageBase64;
  }

  try {
    const plan = await generatePromptPlan({
      type:        state.selectedType,
      description: descriptionText,
      imageBase64,
      planModel:   state.package,
      customModel: state.customModel,
    });

    if (plan.needsMoreDetails) {
      if (!isClarification) {
        originalPromptDescription = descriptionText;
      }
      renderClarificationQuestions(plan.questions);
      openModal('clarificationOverlay');
      showToast('الرجاء توضيح بعض التفاصيل لمساعدتنا 🤖', 'info');
    } else {
      if (isClarification) {
        closeModal('clarificationOverlay');
      }
      state.currentPlan = { type: state.selectedType, description: originalPromptDescription || descriptionText, plan };
      renderPlan(plan, originalPromptDescription || descriptionText);
      result.hidden = false;
      showToast('تمت الخطة بنجاح! 🎉', 'success');
      originalPromptDescription = "";
    }
  } catch (err) {
    showToast(err.message || 'حدث خطأ. حاول مجدداً.', 'error');
    console.error(err);
  } finally {
    loading.hidden  = true;
    submitBtn.disabled = false;
    document.getElementById('wsSubmitLabel').textContent = '🤖 جهّزلي الخطة';
  }
}

function renderClarificationQuestions(questions) {
  const container = document.getElementById('clarificationQuestionsContainer');
  container.innerHTML = '';

  questions.forEach((q, idx) => {
    const qBox = document.createElement('div');
    qBox.className = 'clarification-question-box';
    qBox.dataset.id = q.id || `q-${idx}`;
    qBox.dataset.question = q.question;

    const qText = document.createElement('p');
    qText.className = 'clarification-question-text';
    qText.textContent = q.question;
    qBox.appendChild(qText);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'clarification-options';

    q.options.forEach(opt => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'clarification-option-btn';
      optBtn.textContent = opt;
      optBtn.addEventListener('click', () => {
        const alreadyActive = optBtn.classList.contains('active');
        optionsContainer.querySelectorAll('.clarification-option-btn').forEach(btn => btn.classList.remove('active'));
        if (!alreadyActive) {
          optBtn.classList.add('active');
        }
      });
      optionsContainer.appendChild(optBtn);
    });

    qBox.appendChild(optionsContainer);

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'clarification-custom-input';
    customInput.placeholder = 'أو اكتب إجابة مخصصة هنا...';
    qBox.appendChild(customInput);

    container.appendChild(qBox);
  });
}

document.getElementById('submitClarificationBtn').addEventListener('click', async () => {
  const container = document.getElementById('clarificationQuestionsContainer');
  const questionBoxes = container.querySelectorAll('.clarification-question-box');
  
  const additionalDetails = [];
  
  questionBoxes.forEach(box => {
    const qId = box.dataset.id;
    const questionText = box.dataset.question;
    const activeOptBtn = box.querySelector('.clarification-option-btn.active');
    const customVal = box.querySelector('.clarification-custom-input').value.trim();
    
    let answer = "";
    if (customVal) {
      answer = customVal;
    } else if (activeOptBtn) {
      answer = activeOptBtn.textContent;
    }
    
    if (answer) {
      additionalDetails.push(`- ${questionText}: ${answer}`);
    }
  });

  if (additionalDetails.length === 0) {
    showToast('الرجاء اختيار إجابة أو كتابة توضيح واحد على الأقل', 'warning');
    return;
  }

  const combinedDescription = `${originalPromptDescription}\n\n[معلومات إضافية للتوضيح]:\n${additionalDetails.join('\n')}`;
  
  closeModal('clarificationOverlay');
  await executePromptGeneration(combinedDescription, true);
});

// ─── Model Select Population ──────────────────────────────
function populateModelSelect() {
  const select = document.getElementById('wsModelSelect');
  if (!select) return;
  
  select.innerHTML = AVAILABLE_MODELS.map(m => `
    <option value="${m.id}" ${state.customModel === m.id ? 'selected' : ''}>${m.label}</option>
  `).join('');
  
  if (!state.customModel && AVAILABLE_MODELS.length > 0) {
    state.customModel = AVAILABLE_MODELS[0].id;
  }
}

document.getElementById('wsModelSelect')?.addEventListener('change', (e) => {
  state.customModel = e.target.value;
  const selectedLabel = AVAILABLE_MODELS.find(m => m.id === state.customModel)?.label || state.customModel;
  const modelEl = document.getElementById('wsModelName');
  if (modelEl) modelEl.textContent = selectedLabel;
  showToast(`تم تغيير الموديل النشط إلى: ${selectedLabel}`, 'info');
});

populateModelSelect();
showView('home');
