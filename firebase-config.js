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

// ─── حدود الباقات ─────────────────────────────────────────
const PLAN_LIMITS = {
  free: { storageMB: 624,  projects: 10, fileUpload: false, modelKey: 'free'  },
  pro:  { storageMB: 1024, projects: 30, fileUpload: true,  modelKey: 'pro'   },
  king: { storageMB: 5120, projects: 60, fileUpload: true,  modelKey: 'king'  },
};

// ─── بيانات الباقات ────────────────────────────────────────
const PACKAGES = {
  free: {
    name: 'مجانية', price: 0, storage: '624 ميجا', featured: false,
    features: [
      'سعة تخزين 624 ميجا',
      'وصول لموديل Gemma 4 مجاني',
      'حتى 10 مشاريع',
      'توليد برومبتات احترافية',
    ]
  },
  pro: {
    name: 'برو', price: 2, storage: '1 جيجا', featured: true,
    features: [
      'سعة تخزين 1 جيجا',
      'وصول لـ GPT-OSS 120B الأقوى',
      'حتى 30 مشروع',
      'رفع صور وملفات للشات',
      'أولوية في المعالجة',
    ]
  },
  king: {
    name: 'الملك 👑', price: 5, storage: '5 جيجا', featured: false,
    features: [
      'كل مميزات باقة برو',
      'سعة تخزين 5 جيجا',
      'حتى 60 مشروع',
      'دعم فني مخصص',
    ]
  },
};

// ─── بيانات وسائل الدفع ───────────────────────────────────
const PAYMENT_INFO = {
  vodafone: { label: 'محفظة اتصالات',  detail: '01148179176' },
  paypal:   { label: 'PayPal',          detail: 'faregmostafe2@gmail.com' },
  instapay: { label: 'InstaPay',        detail: '01148179176' },
};

// ─── اسماء الموديلات للعرض ────────────────────────────────
const MODEL_DISPLAY = {
  free: 'Gemma 4 26B (مجاني)',
  pro:  'GPT-OSS 120B',
  king: 'GPT-OSS 120B',
};

export {
  firebaseConfig, firebaseApp, db, auth, storage,
  PLAN_LIMITS, PACKAGES, PAYMENT_INFO, MODEL_DISPLAY
};
