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
import { generatePromptPlan, fixSelectedText }             from './ai-service.js';


// ─── Translation & Localization ────────────────────────────
const translations = {
  ar: {
    page_title: "معمل البرومبت — من فكرتك إلى برومبت جاهز",
    nav_home: "الرئيسية",
    nav_workspace: "أنشئ برومبت",
    nav_support: "دعم وتبرع",
    login: "تسجيل الدخول",
    hero_eyebrow: "استوديو البرومبتات الاحترافية",
    hero_display: "اكتب فكرتك<br>مرة واحدة",
    hero_sub: "اختَر إيه اللي عايز تنشئه — فيديو، صورة، موسيقى، أو موقع — واحكي فكرتك بأسلوبك، ومعمل البرومبت هيرجعلك خطة كاملة وأوامر جاهزة تلصقها في أي أداة ذكاء اصطناعي.",
    hero_start: "ابدأ دلوقتي",
    hero_support_btn: "دعم المشروع",
    free_label: "مجاني",
    terminal_placeholder: "إعلان قهوة صباحي، إضاءة دافئة، حركة كاميرا بطيئة من الأسفل للأعلى…",
    type_video: "فيديو",
    type_music: "موسيقى",
    type_image: "صورة",
    type_website: "موقع",
    marquee_text: "فيديو ✦ صورة ✦ موسيقى ✦ موقع ✦ فيديو ✦ صورة ✦ موسيقى ✦ موقع ✦ فيديو ✦ صورة ✦ موسيقى ✦ موقع ✦",
    picker_title: "إيه اللي عايز تنشئه؟",
    picker_sub: "اختَر نوع المحتوى، وهنجهزلك أداة الذكاء الاصطناعي المناسبة وخطة أوامر كاملة.",
    desc_video: "إعلانات، مشاهد سينمائية، كليبات قصيرة",
    desc_image: "شعارات، بوسترات، صور منتجات",
    desc_music: "مقطوعات، جينجل، خلفيات صوتية",
    desc_website: "لاندنج بيدج، تطبيق ويب، متجر",
    how_title: "إزاي بيشتغل؟",
    how_step1_title: "اختر واحكي",
    how_step1_desc: "حدد نوع المحتوى واكتب فكرتك بكلامك بوضوح وتفصيل.",
    how_step2_title: "الذكاء الاصطناعي يجهزلك خطة",
    how_step2_desc: "هيقترحلك الأداة المناسبة ويكتبلك أوامر مرتبة خطوة بخطوة مع أمثلة وقوالب جاهزة.",
    how_step3_title: "انسخ والصق",
    how_step3_desc: "خذ الأوامر زي ما هي — أو حدد أي جزء وعدّله — والصقها في أي منصة ذكاء اصطناعي.",
    support_project_title: "دعم المشروع بالتبرع",
    support_project_sub: "معمل البرومبت أصبح مجانياً ومفتوحاً بالكامل لخدمة الجميع! إذا أعجبك المشروع، يمكنك دعمنا بأي مبلغ لمساعدتنا في تغطية تكاليف الخوادم والتشغيل.",
    content_type: "نوع المحتوى",
    type_video_btn: "🎬 فيديو",
    type_image_btn: "🖼️ صورة",
    type_music_btn: "🎵 موسيقى",
    type_website_btn: "💻 موقع",
    account_status: "حالة الحساب",
    free_unlimited: "✨ مجاني بالكامل",
    saved_projects: "المشاريع المحفوظة",
    recent_projects: "مشاريعي الأخيرة",
    describe_idea: "احكيلنا فكرتك",
    idea_description: "وصف الفكرة بالتفصيل",
    project_name: "اسم المشروع (اختياري)",
    choose_model: "اختر موديل الذكاء الاصطناعي",
    generate_plan_btn: "🤖 جهّزلي الخطة",
    active_model: "الموديل المفعّل:",
    donate_link: "تبرع لدعم المشروع",
    clarification_title: "🤔 تفاصيل إضافية مطلوبة (خيارات منسدلة)",
    clarification_desc: "الذكاء الاصطناعي يود سؤالك عن بعض النقاط لتعديل الخطة:",
    submit_inline_answers: "🚀 إرسال الأجوبة وإعادة التوليد",
    loading_text: "الذكاء الاصطناعي بيجهز خطة البرومبت…",
    loading_sub: "بيحلل فكرتك ويختار أفضل الأدوات",
    followup_title: "🔄 استكمال وتعديل البرومبت (Follow up)",
    followup_desc: "هل تريد استكمال البرومبت بمشهد آخر أو طلب تعديل محدد؟ اكتب طلبك الإضافي وسنكمل على برومبتك السابق:",
    followup_submit_btn: "🤖 استكمل البرومبت",
    copy_donation_btn: "نسخ تفاصيل التبرع",
    wallet_label: "اتصالات كاش / فودافون كاش",
    fawry_label: "فوري (Fawry)",
    invite_code_title: "لديك كود دعوة؟",
    invite_code_sub: "أدخل كودك للحصول على ميزات حصرية مستقبلية",
    redeem_code_btn: "🔓 تفعيل الكود",
    invite_code_note: "أكواد الدعوة تمنح حسابك شارة (عضو مميز) لتفعيل المميزات المستقبلية فور نزولها.",
    invite_success_title: "تم تفعيل كودك بنجاح!",
    invite_success_desc: "تم ترقية حسابك إلى باقة الميزات المستقبلية",
    start_using_now: "ابدأ الاستخدام الآن",
    not_logged_in: "مش مسجّل دخول لسه",
    not_logged_in_sub: "سجّل دخولك عشان تحفظ مشاريعك على السحابة وتتابع مشاريعك.",
    login_or_create: "تسجيل الدخول / إنشاء حساب",
    logout: "🚪 تسجيل الخروج",
    current_package: "الباقة الحالية",
    storage: "سعة التخزين",
    unlimited: "غير محدودة",
    projects_count: "عدد المشاريع",
    my_projects: "مشاريعي",
    no_projects: "لسه معملتش أي مشروع. ابدأ من \"أنشئ برومبت\".",
    view_project: "عرض المشروع",
    fix_selection_btn: "✏️ اطلب تعديل هذا الجزء",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgot_password: "نسيت كلمة المرور؟",
    username: "اسم المستخدم",
    confirm_password: "تأكيد كلمة المرور",
    verification_note: "هيتبعتلك رمز تأكيد على بريدك.",
    signup: "حساب جديد",
    or: "أو",
    continue_google: "المتابعة عبر Google",
    continue_github: "المتابعة عبر GitHub",
    email_verify_title: "تأكيد البريد الإلكتروني",
    email_sent_to: "أرسلنا رسالة تأكيد إلى",
    click_verification_link: "افتح الرسالة واضغط على رابط التأكيد.",
    resend_email: "إعادة إرسال الرسالة",
    already_verified_login: "تأكدت؟ دخول",
    forgot_password_desc: "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.",
    send_reset_link: "إرسال رابط الاستعادة",
    go_back: "← رجوع",
  },
  en: {
    page_title: "Prompt Lab — From Idea to Ready-to-Use Prompt",
    nav_home: "Home",
    nav_workspace: "Create Prompt",
    nav_support: "Support & Donate",
    login: "Login",
    hero_eyebrow: "Professional Prompt Studio",
    hero_display: "Write Your Idea<br>Once",
    hero_sub: "Choose what you want to create — video, image, music, or website — describe it in your own words, and Prompt Lab will generate a complete plan and ready-to-use prompts.",
    hero_start: "Start Now",
    hero_support_btn: "Support Project",
    free_label: "Free",
    terminal_placeholder: "Morning coffee commercial, warm lighting, slow camera motion upwards...",
    type_video: "Video",
    type_music: "Music",
    type_image: "Image",
    type_website: "Website",
    marquee_text: "Video ✦ Image ✦ Music ✦ Website ✦ Video ✦ Image ✦ Music ✦ Website ✦ Video ✦ Image ✦ Music ✦ Website ✦",
    picker_title: "What do you want to create?",
    picker_sub: "Choose the content type, and we will prepare the right AI tools and commands.",
    desc_video: "Ads, cinematic scenes, short clips",
    desc_image: "Logos, posters, product photos",
    desc_music: "Tracks, jingles, background audio",
    desc_website: "Landing pages, web apps, e-commerce",
    how_title: "How it works?",
    how_step1_title: "Choose & Describe",
    how_step1_desc: "Select the content type and describe your idea in your own words.",
    how_step2_title: "AI Generates a Plan",
    how_step2_desc: "AI suggests the right tools and drafts step-by-step prompts with copyable templates.",
    how_step3_title: "Copy & Paste",
    how_step3_desc: "Copy the prompts or edit specific parts, then paste them directly into any AI platform.",
    support_project_title: "Support the Project with Donations",
    support_project_sub: "Prompt Lab is now completely free and open for everyone! If you like the project, you can support us with any donation amount to help cover hosting and server costs.",
    content_type: "Content Type",
    type_video_btn: "🎬 Video",
    type_image_btn: "🖼️ Image",
    type_music_btn: "🎵 Music",
    type_website_btn: "💻 Website",
    account_status: "Account Status",
    free_unlimited: "✨ Fully Free",
    saved_projects: "Saved Projects",
    recent_projects: "Recent Projects",
    describe_idea: "Describe Your Idea",
    idea_description: "Detailed Idea Description",
    project_name: "Project Name (Optional)",
    choose_model: "Select AI Model",
    generate_plan_btn: "🤖 Prepare the Plan",
    active_model: "Active Model:",
    donate_link: "Donate to support",
    clarification_title: "🤔 Additional Details Needed (Dropdown Options)",
    clarification_desc: "AI wants to clarify some details to optimize the generation:",
    submit_inline_answers: "🚀 Submit Answers & Re-generate",
    loading_text: "AI is preparing your prompt plan...",
    loading_sub: "Analyzing your description and selecting the best tools",
    followup_title: "🔄 Follow-up & Refine Prompt",
    followup_desc: "Would you like to extend this prompt with another scene or ask for edits? Write it below:",
    followup_submit_btn: "🤖 Extend Prompt",
    copy_donation_btn: "Copy Donation Details",
    wallet_label: "Etisalat Cash / Vodafone Cash",
    fawry_label: "Fawry Pay",
    invite_code_title: "Have an Invite Code?",
    invite_code_sub: "Enter your code to unlock exclusive future features",
    redeem_code_btn: "🔓 Activate Code",
    invite_code_note: "Invite codes grant your account a (Premium Member) badge for early access to future features.",
    invite_success_title: "Code activated successfully!",
    invite_success_desc: "Your account is now upgraded to receive future updates first",
    start_using_now: "Start Using Now",
    not_logged_in: "Not Logged In Yet",
    not_logged_in_sub: "Sign in to save your projects to the cloud and sync your drafts.",
    login_or_create: "Login / Sign Up",
    logout: "🚪 Logout",
    current_package: "Current Plan",
    storage: "Storage",
    unlimited: "Unlimited",
    projects_count: "Projects Count",
    my_projects: "My Projects",
    no_projects: "No projects yet. Start by going to 'Create Prompt'.",
    view_project: "View Project",
    fix_selection_btn: "✏️ Request edit for this part",
    email: "Email Address",
    password: "Password",
    forgot_password: "Forgot Password?",
    username: "Username",
    confirm_password: "Confirm Password",
    verification_note: "A verification code will be sent to your email.",
    signup: "New Account",
    or: "OR",
    continue_google: "Continue with Google",
    continue_github: "Continue with GitHub",
    email_verify_title: "Email Verification Required",
    email_sent_to: "We sent a verification email to",
    click_verification_link: "Open the email and click the verification link.",
    resend_email: "Resend Verification Email",
    already_verified_login: "Verified? Login",
    forgot_password_desc: "Enter your email address and we will send you a password reset link.",
    send_reset_link: "Send Reset Link",
    go_back: "← Back",
  }
};

let currentLang = 'ar';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const toggleBtn = document.getElementById('langToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = lang === 'ar' ? 'English' : 'العربية';
  }

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[lang] && translations[lang][key]) {
      el.innerHTML = translations[lang][key];
    }
  });

  const descEl = document.getElementById('wsDescription');
  if (descEl) {
    descEl.placeholder = lang === 'ar' 
      ? "مثال: عايز فيديو إعلاني قصير لكافيه صغير، جو صباحي دافئ، بدون كلام، مدته 15 ثانية…"
      : "Example: I want a short video ad for a small cafe, warm morning atmosphere, no voiceover, 15 seconds long...";
  }

  const projEl = document.getElementById('wsProjectName');
  if (projEl) {
    projEl.placeholder = lang === 'ar' ? "مثال: إعلان كافيه الصباح" : "Example: Morning Cafe Ad";
  }

  const followEl = document.getElementById('followupDescription');
  if (followEl) {
    followEl.placeholder = lang === 'ar'
      ? "مثال: أضف مشهداً ثانياً يظهر فيه المقهى وهو يمتلئ بالزبائن، واجعل الألوان أكثر دفئاً..."
      : "Example: Add a second scene showing the cafe filling up with customers, and make the colors warmer...";
  }

  const inviteEl = document.getElementById('inviteCodeInput');
  if (inviteEl) {
    inviteEl.placeholder = lang === 'ar' ? "PRMP-XXXXXX" : "PRMP-XXXXXX";
  }
  
  renderPricingHome();
}

function initLanguage() {
  const saved = localStorage.getItem('lang');
  if (saved) {
    setLanguage(saved);
  } else {
    const browserLang = navigator.language || navigator.userLanguage;
    const defaultLang = browserLang.startsWith('en') ? 'en' : 'ar';
    setLanguage(defaultLang);
  }
}

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

document.getElementById('openAccountBtn')?.addEventListener('click', () => showView('account'));

// Language toggle
document.getElementById('langToggleBtn')?.addEventListener('click', () => {
  setLanguage(currentLang === 'ar' ? 'en' : 'ar');
});

// Mobile burger
document.getElementById('burgerBtn')?.addEventListener('click', () => {
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
document.getElementById('openAuthBtn')?.addEventListener('click', () => openModal('authOverlay'));

/* ================================================================
   PRICING CARDS
================================================================ */
function pricingCardHTML(key) {
  return '';
}

function renderPricingHome() {
  const el = document.getElementById('pricingCardsHome');
  if (!el) return;
  const copyText = currentLang === 'ar' ? 'نسخ التفاصيل' : 'Copy Details';
  const cashLabel = currentLang === 'ar' ? 'محفظة كاش (اتصالات كاش)' : 'Cash Wallet (Etisalat/Vodafone)';
  const fawryLabel = currentLang === 'ar' ? 'فوري (Fawry)' : 'Fawry Pay';

  el.innerHTML = `
    <div class="donation-grid-home">
      <div class="price-card" style="text-align: center;">
        <span class="type-icon" style="font-size:32px;">💳</span>
        <h3 style="font-family:var(--font-ui); margin: 10px 0 5px;">InstaPay</h3>
        <p style="font-weight: bold; font-size:18px; color:var(--ink); margin: 5px 0 15px;">01148179176</p>
        <button class="btn btn-primary btn-block copy-donation-btn" data-copy="01148179176">${copyText}</button>
      </div>
      <div class="price-card" style="text-align: center;">
        <span class="type-icon" style="font-size:32px;">📱</span>
        <h3 style="font-family:var(--font-ui); margin: 10px 0 5px;">${cashLabel}</h3>
        <p style="font-weight: bold; font-size:18px; color:var(--ink); margin: 5px 0 15px;">01148179176</p>
        <button class="btn btn-primary btn-block copy-donation-btn" data-copy="01148179176">${copyText}</button>
      </div>
      <div class="price-card" style="text-align: center;">
        <span class="type-icon" style="font-size:32px;">🏪</span>
        <h3 style="font-family:var(--font-ui); margin: 10px 0 5px;">${fawryLabel}</h3>
        <p style="font-weight: bold; font-size:18px; color:var(--ink); margin: 5px 0 15px;">01148179176</p>
        <button class="btn btn-primary btn-block copy-donation-btn" data-copy="01148179176">${copyText}</button>
      </div>
      <div class="price-card" style="text-align: center;">
        <span class="type-icon" style="font-size:32px;">🌐</span>
        <h3 style="font-family:var(--font-ui); margin: 10px 0 5px;">PayPal</h3>
        <p style="font-weight: bold; font-size:16px; color:var(--ink); margin: 5px 0 15px;">faregmostafe2@gmail.com</p>
        <button class="btn btn-primary btn-block copy-donation-btn" data-copy="faregmostafe2@gmail.com">${copyText}</button>
      </div>
    </div>
  `;
}

function renderPricingFull() {
  // Statically rendered in index.html
}

function attachPricingListeners(container) {
  // Obsolete
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
  const titleEl = document.getElementById('wsTitle');
  if (titleEl) {
    titleEl.textContent = currentLang === 'ar' ? `احكيلنا فكرتك عن الـ${lbl}` : `Tell us your idea about ${lbl}`;
  }

  const wsProjectsUsedEl = document.getElementById('wsProjectsUsed');
  if (wsProjectsUsedEl) {
    wsProjectsUsedEl.textContent = `${state.projectsUsed}`;
  }

  const premiumBadge = document.getElementById('premiumBadge');
  if (premiumBadge) {
    premiumBadge.hidden = state.package === 'free';
  }

  // Model name
  const modelEl = document.getElementById('wsModelName');
  if (modelEl) {
    const activeModelId = state.customModel || MODEL_TEXT;
    const selectedLabel = AVAILABLE_MODELS.find(m => m.id === activeModelId)?.label || activeModelId;
    modelEl.textContent = selectedLabel;
  }

  // Quick projects
  renderQuickProjects();
}

document.querySelectorAll('.ws-type-btn').forEach(b => {
  b.addEventListener('click', () => {
    state.selectedType = b.dataset.type;
    renderWorkspaceSide();
    document.getElementById('wsResult').hidden = true;
    document.getElementById('wsFollowupBox').style.display = 'none';
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

// File drop omitted because file upload is deleted

/* ─── Workspace Form Submit ─── */
document.getElementById('wsForm')?.addEventListener('submit', async e => {
  e.preventDefault();

  const description = document.getElementById('wsDescription').value.trim();
  if (!description) { showToast(currentLang === 'ar' ? 'اكتب وصف فكرتك أولاً' : 'Write your idea description first', 'error'); return; }

  const limits = PLAN_LIMITS[state.package];

  // Check project limit
  if (state.user && state.projectsUsed >= limits.projects) {
    showToast(currentLang === 'ar' ? 'وصلت لحد المشاريع.' : 'Project limit reached.', 'warning');
    return;
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

document.getElementById('fixPopoverBtn')?.addEventListener('click', async () => {
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
document.getElementById('openAuthBtn')?.addEventListener('click', () => {
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
document.getElementById('loginForm')?.addEventListener('submit', async e => {
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
document.getElementById('signupForm')?.addEventListener('submit', async e => {
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
document.getElementById('resendVerifyBtn')?.addEventListener('click', async () => {
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
document.getElementById('alreadyVerifiedBtn')?.addEventListener('click', async () => {
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
document.getElementById('forgotPassBtn')?.addEventListener('click', () => {
  showAuthScreen('authResetScreen');
});
document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
  showAuthScreen('authMainScreen');
  clearAuthErrors();
});
document.getElementById('resetForm')?.addEventListener('submit', async e => {
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
document.getElementById('googleBtn')?.addEventListener('click', async () => {
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
document.getElementById('githubBtn')?.addEventListener('click', async () => {
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
    state.package !== 'free' 
      ? (currentLang === 'ar' ? 'مجانية بالكامل (عضو مميز ✨)' : 'Fully Free (Premium Member ✨)')
      : (currentLang === 'ar' ? 'مجانية بالكامل ✨' : 'Fully Free ✨');

  // Projects count
  document.getElementById('accProjectsVal').textContent = `${state.projectsUsed}`;

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
   CHECKOUT / PAYMENT — removed (site is now free with donations)
================================================================ */
/* eslint-disable no-unused-vars */
function openCheckout() { /* no-op — pricing is now free+donations */ }
/* eslint-enable no-unused-vars */



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
  const followupBox = document.getElementById('wsFollowupBox');
  const inlineBox   = document.getElementById('clarificationInlineBox');
  
  result.hidden   = true;
  loading.hidden  = false;
  submitBtn.disabled = true;
  document.getElementById('wsSubmitLabel').textContent = currentLang === 'ar' ? '⏳ جاري التحليل…' : '⏳ Analyzing...';

  const streamBody = document.getElementById('streamingLiveBody');
  const streamTerminal = document.getElementById('streamingLiveTerminal');
  if (streamTerminal) streamTerminal.hidden = false;
  if (streamBody) streamBody.textContent = "";

  try {
    const plan = await generatePromptPlan({
      type:        state.selectedType,
      description: descriptionText,
      imageBase64: null,
      planModel:   state.package,
      customModel: state.customModel,
    }, (chunk, fullText) => {
      if (streamBody) {
        streamBody.textContent = fullText;
        streamBody.scrollTop = streamBody.scrollHeight;
      }
    });

    if (streamTerminal) streamTerminal.hidden = true;

    if (plan.needsMoreDetails) {
      if (!isClarification) {
        originalPromptDescription = descriptionText;
      }
      renderClarificationQuestionsInline(plan.questions);
      if (inlineBox) inlineBox.style.display = 'block';
      if (followupBox) followupBox.style.display = 'none';
      showToast(currentLang === 'ar' ? 'الرجاء توضيح بعض التفاصيل لمساعدتنا 🤖' : 'Please clarify some details to help us 🤖', 'info');
    } else {
      if (inlineBox) inlineBox.style.display = 'none';
      state.currentPlan = { type: state.selectedType, description: originalPromptDescription || descriptionText, plan };
      renderPlan(plan, originalPromptDescription || descriptionText);
      result.hidden = false;
      if (followupBox) followupBox.style.display = 'block';
      showToast(currentLang === 'ar' ? 'تمت الخطة بنجاح! 🎉' : 'Plan generated successfully! 🎉', 'success');
      originalPromptDescription = "";
    }
  } catch (err) {
    if (streamTerminal) streamTerminal.hidden = true;
    showToast(err.message || (currentLang === 'ar' ? 'حدث خطأ. حاول مجدداً.' : 'An error occurred. Try again.'), 'error');
    console.error(err);
  } finally {
    loading.hidden  = true;
    submitBtn.disabled = false;
    document.getElementById('wsSubmitLabel').textContent = currentLang === 'ar' ? '🤖 جهّزلي الخطة' : '🤖 Prepare Plan';
  }
}

function renderClarificationQuestionsInline(questions) {
  const container = document.getElementById('clarificationInlineContainer');
  if (!container) return;
  container.innerHTML = '';

  questions.forEach((q, idx) => {
    const qBox = document.createElement('div');
    qBox.style.marginBottom = '12px';
    qBox.className = 'clarification-question-box';
    qBox.dataset.id = q.id || `q-${idx}`;
    qBox.dataset.question = q.question;

    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = q.question;
    label.style.marginTop = '0';
    qBox.appendChild(label);

    const select = document.createElement('select');
    select.className = 'field-select';
    
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = currentLang === 'ar' ? '-- اختر خياراً --' : '-- Select Option --';
    select.appendChild(defOpt);

    q.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    });
    
    qBox.appendChild(select);

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'clarification-custom-input';
    customInput.placeholder = currentLang === 'ar' ? 'أو اكتب إجابة مخصصة هنا...' : 'Or write custom answer here...';
    customInput.style.marginTop = '8px';
    qBox.appendChild(customInput);

    container.appendChild(qBox);
  });
}

// Obsolete screen questions submit is handled on the inline button instead

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
  showToast(currentLang === 'ar' ? `تم تغيير الموديل النشط إلى: ${selectedLabel}` : `Active model changed to: ${selectedLabel}`, 'info');
});

// ─── Submit Inline Clarification Answers ───────────────────
document.getElementById('submitClarificationInlineBtn')?.addEventListener('click', async () => {
  const container = document.getElementById('clarificationInlineContainer');
  if (!container) return;
  const questionBoxes = container.querySelectorAll('.clarification-question-box');
  
  const additionalDetails = [];
  
  questionBoxes.forEach(box => {
    const questionText = box.dataset.question;
    const selectEl = box.querySelector('select');
    const customVal = box.querySelector('.clarification-custom-input').value.trim();
    
    let answer = "";
    if (customVal) {
      answer = customVal;
    } else if (selectEl && selectEl.value) {
      answer = selectEl.value;
    }
    
    if (answer) {
      additionalDetails.push(`- ${questionText}: ${answer}`);
    }
  });

  if (additionalDetails.length === 0) {
    showToast(currentLang === 'ar' ? 'الرجاء اختيار إجابة أو كتابة توضيح واحد على الأقل' : 'Please select or type at least one answer', 'warning');
    return;
  }

  const combinedDescription = `${originalPromptDescription}\n\n[معلومات إضافية للتوضيح]:\n${additionalDetails.join('\n')}`;
  
  document.getElementById('clarificationInlineBox').style.display = 'none';
  await executePromptGeneration(combinedDescription, true);
});

// ─── Follow Up Submission ─────────────────────────────────
document.getElementById('followupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const followupDesc = document.getElementById('followupDescription').value.trim();
  if (!followupDesc) return;

  const previousPlanText = JSON.stringify(state.currentPlan?.plan || {});
  const combinedPromptText = `لقد قمت بتوليد الخطة التالية سابقاً:\n${previousPlanText}\n\nوالآن يريد المستخدم استكمالها أو تعديلها بالطلب التالي:\n"${followupDesc}"\n\nأرجع خطة جديدة كاملة ومعدلة ومستكملة للبرومبت بالتنسيق المطلوب JSON.`;

  document.getElementById('followupDescription').value = "";
  document.getElementById('wsFollowupBox').style.display = 'none';

  await executePromptGeneration(combinedPromptText, false);
});

// ─── Donation Copy Listeners ──────────────────────────────
document.addEventListener('click', e => {
  if (e.target.classList.contains('copy-donation-btn')) {
    const copyText = e.target.dataset.copy;
    if (copyText) {
      navigator.clipboard.writeText(copyText).then(() => {
        showToast(currentLang === 'ar' ? 'تم نسخ تفاصيل التبرع! شكراً لدعمك ❤️' : 'Donation details copied! Thank you for your support ❤️', 'success');
      }).catch(() => showToast('فشل النسخ', 'error'));
    }
  }
});

// ─── Initialize Lang & App ───────────────────────────────
initLanguage();
populateModelSelect();
showView('home');
