/* ===========================================================
   معمل البرومبت — إعدادات ومثيلات Firebase المشتركة
=========================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ─── Firebase Config ─────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCffrRr-wYBeiAf7GML6Xs3kQg-14mLFhQ",
  authDomain:        "prompat-76c51.firebaseapp.com",
  projectId:         "prompat-76c51",
  storageBucket:     "prompat-76c51.firebasestorage.app",
  messagingSenderId: "663109200073",
  appId:             "1:663109200073:web:9da9a15649a88028b68518",
  measurementId:     "G-HKL1XTBX6H"
};

// ─── تهيئة مثيلات Firebase ────────────────────────────────
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const auth        = getAuth(firebaseApp);
const storage     = getStorage(firebaseApp);

// ─── الموديلات المتاحة ─────────────────────────────────────
// موديل النصوص الرئيسي — يُعرض للمستخدم باسم "Claude Sonnet 4.6"
const MODEL_TEXT   = 'openai/gpt-oss-20b:free';
// نفس الموديل للرؤية
const MODEL_VISION = 'openai/gpt-oss-20b:free';

// ─── الموديلات المتاحة للاختيار ──────────────────────────
const AVAILABLE_MODELS = [
  { id: 'google/gemma-4-26b-a4b-it:free', label: 'Chat GPT 5' },
  { id: 'openai/gpt-oss-20b:free',        label: 'Claude Sonnet 4.6' },
];

// ─── حدود الباقات (جعلها مفتوحة ومجانية بالكامل) ───────────
const PLAN_LIMITS = {
  free: { storageMB: 999999,  projects: 999999, fileUpload: false, modelKey: 'free'  },
  pro:  { storageMB: 999999,  projects: 999999, fileUpload: false, modelKey: 'pro'   },
  king: { storageMB: 999999,  projects: 999999, fileUpload: false, modelKey: 'king'  },
};

// ─── بيانات الباقات (تم إلغاء الرسوم وجعلها مجانية) ──────────
const PACKAGES = {
  free: {
    name: 'المجانية بالكامل', price: 0, storage: 'غير محدود', featured: true,
    model: MODEL_TEXT,
    features: [
      'سعة تخزين غير محدودة',
      '🤖 الوصول لجميع الموديلات الذكية (Chat GPT 5 & Claude Sonnet 4.6)',
      'مشاريع غير محدودة',
      'توليد برومبتات احترافية لجميع أنواع المحتوى',
    ]
  }
};

// ─── بيانات التبرع ووسائل الدفع لدعم المشروع ───────────────
const PAYMENT_INFO = {
  instapay: { label: '💳 InstaPay',  detail: '01148179176' },
  vodafone: { label: '📱 محفظة كاش (اتصالات كاش)',  detail: '01148179176' },
  fawry:    { label: '🏪 فوري (Fawry)',  detail: '01148179176' },
  paypal:   { label: '🌐 PayPal',      detail: 'faregmostafe2@gmail.com' },
};

// ─── اسماء الموديلات للعرض ────────────────────────────────
const MODEL_DISPLAY = {
  free: 'Chat GPT 5',
  pro:  'Claude Sonnet 4.6',
  king: 'Claude Sonnet 4.6',
};

export {
  firebaseConfig, firebaseApp, db, auth, storage,
  PLAN_LIMITS, PACKAGES, PAYMENT_INFO, MODEL_DISPLAY,
  MODEL_TEXT, MODEL_VISION, AVAILABLE_MODELS
};
