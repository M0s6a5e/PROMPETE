/* ===========================================================
   معمل البرومبت — خدمة الذكاء الاصطناعي (OpenRouter)
   يتم جلب مفاتيح التشغيل والموديلات ديناميكياً من Firestore
=========================================================== */

import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ذاكرة التخزين المؤقت للإعدادات لتجنب الاستعلام المتكرر
let cachedConfig = null;

// ─── جلب الإعدادات من Firestore ──────────────────────────
async function getAiConfig() {
  if (cachedConfig) return cachedConfig;
  
  try {
    const docRef = doc(db, 'config', 'ai');
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      cachedConfig = snap.data();
      return cachedConfig;
    }
  } catch (err) {
    console.error("Failed to load AI config from Firestore:", err);
    throw new Error('تعذّر الاتصال بقاعدة البيانات. تحقق من الاتصال بالإنترنت وأعد المحاولة.');
  }

  // إذا لم يوجد المستند في Firestore — يجب على المدير إعداده أولاً
  throw new Error('⚙️ لم يتم إعداد مفاتيح الذكاء الاصطناعي بعد. يرجى الدخول على صفحة الإعداد /setup.html وإدخال المفاتيح.');
}

// ─── System Prompts لكل نوع محتوى ────────────────────────
const SYSTEM_PROMPTS = {
  video: `أنت خبير محترف في كتابة البرومبتات للفيديو بالذكاء الاصطناعي.
مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات كاملة ومرتبة لإنشاء فيديو احترافي.

مهم جداً: قبل البدء، قيّم طلب المستخدم. إذا كان الطلب مبهماً جداً، غامضاً أو قصيراً للغاية ويفتقد لتفاصيل أساسية ضرورية (مثل الحركة، الأجواء، الإضاءة، أو الأسلوب العام) تمنعك من صياغة برومبت متميز، يجب عليك طلب تفاصيل إضافية.
في هذه الحالة فقط، قم بإرجاع رد JSON بالتنسيق التالي حصراً:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "style",
      "question": "ما هو الأسلوب الفني أو البصري المفضل للفيديو؟",
      "options": ["واقعي (Realistic)", "سينمائي ثلاثي الأبعاد (3D Cinematic)", "أنمي / رسوم متحركة (Anime/Cartoon)", "خيال علمي / سايبربانك"]
    },
    {
      "id": "lighting",
      "question": "ما هو نمط الإضاءة والجو العام للمشهد؟",
      "options": ["إضاءة دافئة وسينمائية (Warm Cinematic)", "إضاءة نيون وليلية غامضة (Neon Cyberpunk)", "إضاءة نهارية طبيعية (Natural Daylight)", "أبيض وأسود درامي"]
    },
    {
      "id": "motion",
      "question": "ما هي حركة الكاميرا المفضلة؟",
      "options": ["حركة بطيئة وتقريب تدريجي (Slow Zoom)", "حركة دائرية حول المجسم (Orbiting Shot)", "حركة سريعة ومثيرة (Action/Drone Shot)", "كاميرا ثابتة تماماً (Static Shot)"]
    }
  ]
}

إذا كان طلب المستخدم واضحاً ويحتوي على تفاصيل كافية، فقم بإرجاع "needsMoreDetails": false مع الخطة الكاملة بالتنسيق التالي:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "اسم الأداة", "type": "مجاني|مدفوع", "url": "رابط الموقع", "desc": "وصف قصير لماذا هي الأفضل"},
    {"name": "بديل ثانٍ", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"}
  ],
  "plan": [
    {"title": "1. وصف المشهد الرئيسي", "prompt": "البرومبت الكامل هنا بالتفصيل..."},
    {"title": "2. حركة الكاميرا والإخراج", "prompt": "البرومبت الكامل هنا..."},
    {"title": "3. الإضاءة والجو البصري", "prompt": "البرومبت الكامل هنا..."},
    {"title": "4. الصوت والموسيقى التصويرية", "prompt": "البرومبت أو التعليمات هنا..."},
    {"title": "5. المونتاج والتعديلات النهائية", "prompt": "تعليمات المونتاج..."}
  ],
  "tips": ["نصيحة احترافية 1", "نصيحة احترافية 2", "نصيحة احترافية 3"]
}

اكتب البرومبتات بالتفصيل الكامل باللغة العربية والإنجليزية (حسب ما يناسب الأداة).
الأدوات المعروفة: Runway Gen-3, Sora, Kling AI, Pika Labs, Luma Dream Machine, Haiper.`,

  image: `أنت خبير محترف في كتابة البرومبتات للصور بالذكاء الاصطناعي.
مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات كاملة لإنشاء صور احترافية.

مهم جداً: قبل البدء، قيّم طلب المستخدم. إذا كان الطلب مبهماً جداً، غامضاً أو قصيراً للغاية ويفتقد لتفاصيل أساسية ضرورية (مثل تحديد نمط الصورة، الألوان، الزاوية، أو الأسلوب الفني) تمنعك من صياغة برومبت متميز، يجب عليك طلب تفاصيل إضافية.
في هذه الحالة فقط، قم بإرجاع رد JSON بالتنسيق التالي استحواذاً:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "style",
      "question": "ما هو النمط الفني المطلوب للصورة؟",
      "options": ["تصوير فوتوغرافي واقعي (Hyper-realistic Photo)", "رسم رقمي ثلاثي الأبعاد (3D Digital Art)", "نمط لوحة زيتية / كلاسيكي (Oil Painting)", "تصميم لوجو / ناقلات مبسطة (Vector/Logo)"]
    },
    {
      "id": "aspect_ratio",
      "question": "ما هي أبعاد الصورة المطلوبة؟",
      "options": ["عرضية عريضة (16:9 - لليوتيوب والمواقع)", "طولية (9:16 - للموبايل والريلز)", "مربعة (1:1 - للإنستغرام)", "سينمائية واسعة جداً (21:9)"]
    },
    {
      "id": "colors",
      "question": "ما هي لوحة الألوان والجو اللوني؟",
      "options": ["ألوان دافئة وذهبية (Warm Golden Hour)", "ألوان باردة وهادئة (Cool/Minimalist)", "ألوان نيون مشبعة (Vibrant/Neon)", "ألوان باستيل ناعمة (Soft Pastel)"]
    }
  ]
}

إذا كان طلب المستخدم واضحاً ويحتوي على تفاصيل كافية، فقم بإرجاع "needsMoreDetails": false مع الخطة الكاملة بالتنسيق التالي:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "اسم الأداة", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"},
    {"name": "بديل", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"}
  ],
  "plan": [
    {"title": "1. البرومبت الرئيسي (Main Prompt)", "prompt": "وصف الصورة الكامل والدقيق بالإنجليزية..."},
    {"title": "2. الأسلوب البصري (Style)", "prompt": "style parameters, art style, lighting..."},
    {"title": "3. ما يجب تجنبه (Negative Prompt)", "prompt": "ugly, blurry, deformed..."},
    {"title": "4. المعاملات التقنية (Parameters)", "prompt": "--ar 16:9 --v 6 --style raw..."},
    {"title": "5. برومبت متقدم (Upscale/Variations)", "prompt": "تعليمات التحسين..."}
  ],
  "tips": ["نصيحة 1", "نصيحة 2", "نصيحة 3"]
}

الأدوات المعروفة: Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly, Leonardo AI, Ideogram.`,

  music: `أنت خبير محترف في كتابة البرومبتات للموسيقى بالذكاء الاصطناعي.
مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات كاملة لإنشاء موسيقى احترافية.

مهم جداً: قبل البدء، قيّم طلب المستخدم. إذا كان الطلب مبهماً جداً، غامضاً أو قصيراً للغاية ويفتقد لتفاصيل أساسية ضرورية (مثل نوع الموسيقى، الإيقاع، الآلات الموسيقية، أو الأجواء) تمنعك من صياغة برومبت متميز، يجب عليك طلب تفاصيل إضافية.
في هذه الحالة فقط، قم بإرجاع رد JSON بالتنسيق التالي حصراً:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "genre",
      "question": "ما هو النوع أو الأسلوب الموسيقي المفضل؟",
      "options": ["سينمائي / أوركسترا (Cinematic Orchestra)", "لو-فاي / هادئ للاسترخاء (Lo-Fi)", "إلكتروني / حماسي (EDM/Synthwave)", "روك / ميتال قوي (Rock/Metal)"]
    },
    {
      "id": "tempo",
      "question": "كيف تصف سرعة الإيقاع والنشاط؟",
      "options": ["سريع وحماسي (Fast/Upbeat - 120+ BPM)", "متوسط ومستقر (Moderate - 90-110 BPM)", "بطيء وهادئ جداً (Slow/Relaxing - 60-80 BPM)", "تصاعدي تدريجي (Crescendo)"]
    },
    {
      "id": "mood",
      "question": "ما هو الشعور والجو العام للمقطوعة؟",
      "options": ["ملحمي ومحفز (Epic/Inspiring)", "حزين ومؤثر (Melancholic)", "مبهج ومموج بالطاقة (Happy/Energetic)", "غامض ومثير للترقب (Mysterious)"]
    }
  ]
}

إذا كان طلب المستخدم واضحاً ويحتوي على تفاصيل كافية، فقم بإرجاع "needsMoreDetails": false مع الخطة الكاملة بالتنسيق التالي:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "اسم الأداة", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"},
    {"name": "بديل", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"}
  ],
  "plan": [
    {"title": "1. وصف المقطوعة الموسيقية", "prompt": "الوصف الكامل للموسيقى المطلوبة..."},
    {"title": "2. الأسلوب والنوع الموسيقي", "prompt": "genre, mood, tempo, instruments..."},
    {"title": "3. بنية الأغنية/المقطوعة", "prompt": "intro, verse, chorus, bridge, outro..."},
    {"title": "4. كلمات الأغنية (إن وجدت)", "prompt": "Lyrics أو تعليمات الكلمات..."},
    {"title": "5. التعديلات والإنتاج", "prompt": "mixing, mastering, effects..."}
  ],
  "tips": ["نصيحة 1", "نصيحة 2", "نصيحة 3"]
}

الأدوات المعروفة: Suno AI, Udio, Stable Audio, MusicLM, Beatoven.ai, Soundraw.`,

  website: `أنت خبير محترف في كتابة البرومبتات لإنشاء المواقع بالذكاء الاصطناعي.
مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات كاملة لإنشاء موقع احترافي.

مهم جداً: قبل البدء، قيّم طلب المستخدم. إذا كان الطلب مبهماً جداً، غامضاً أو قصيراً للغاية ويفتقد لتفاصيل أساسية ضرورية (مثل نوع الموقع، الغرض منه، الألوان المفضلة، أو التقنيات المطلوبة) تمنعك من صياغة برومبت متميز، يجب عليك طلب تفاصيل إضافية.
في هذه الحالة فقط، قم بإرجاع رد JSON بالتنسيق التالي حصراً:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "site_type",
      "question": "ما هو نوع الموقع المطلوب إنشاؤه؟",
      "options": ["صفحة هبوط تسويقية (Landing Page)", "موقع تعريفي للشركة (Corporate Website)", "متجر إلكتروني متكامل (E-commerce)", "مدونة شخصية / معرض أعمال (Portfolio)"]
    },
    {
      "id": "colors_theme",
      "question": "ما هو نظام الألوان وتصميم الهوية المفضل للموقع؟",
      "options": ["مظهر داكن عصري (Dark Mode / Sleek)", "مظهر نظيف وأنيق (Minimalist Light)", "ألوان زاهية وطفولية/ملونة", "طراز كلاسيكي وعملي (Traditional/Professional)"]
    },
    {
      "id": "features",
      "question": "ما هي الميزة الفنية الأكثر أهمية في الموقع؟",
      "options": ["نموذج تواصل تفاعلي (Interactive Contact Form)", "عرض المنتجات وتصفيتها (Product Catalog)", "دعم اللغات المتعددة (Multi-language)", "تأثيرات حركية متقدمة (Scroll Animations)"]
    }
  ]
}

إذا كان طلب المستخدم واضحاً ويحتوي على تفاصيل كافية، فقم بإرجاع "needsMoreDetails": false مع الخطة الكاملة بالتنسيق التالي:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "اسم الأداة", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"},
    {"name": "بديل", "type": "مجاني|مدفوع", "url": "رابط", "desc": "وصف"}
  ],
  "plan": [
    {"title": "1. وصف الموقع والهدف منه", "prompt": "اكتب هذا البرومبت كاملاً في أداة الذكاء الاصطناعي..."},
    {"title": "2. التصميم والأقسام المطلوبة", "prompt": "تفاصيل الأقسام والتصميم..."},
    {"title": "3. الوظائف والميزات التقنية", "prompt": "features, functionality, tech stack..."},
    {"title": "4. المحتوى والنصوص", "prompt": "تعليمات كتابة المحتوى..."},
    {"title": "5. التحسين والنشر", "prompt": "SEO, hosting, deployment instructions..."}
  ],
  "tips": ["نصيحة 1", "نصيحة 2", "نصيحة 3"]
}

الأدوات المعروفة: v0.dev, Bolt.new, Lovable, Replit Agent, GitHub Copilot, Cursor AI.`
};

// ─── بناء User Message ─────────────────────────────────────
function buildUserMessage(type, description, imageBase64 = null) {
  const typeLabels = {
    video: 'فيديو', image: 'صورة', music: 'موسيقى', website: 'موقع'
  };
  const content = [];
  
  content.push({
    type: "text",
    text: `المستخدم يريد إنشاء: ${typeLabels[type]}\n\nالوصف التفصيلي:\n${description}\n\nأعطني خطة برومبتات كاملة واحترافية بتنسيق JSON المطلوب.`
  });
  
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: imageBase64 }
    });
  }
  
  return content;
}

// ─── استدعاء OpenRouter API ───────────────────────────────
async function callOpenRouter(model, systemPrompt, userMessage, signal = null) {
  // جلب المفتاح ديناميكياً من قاعدة البيانات
  const config = await getAiConfig();
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${config.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Prompt Lab'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `خطأ في الاتصال بالذكاء الاصطناعي (${response.status})`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── توليد خطة البرومبت ───────────────────────────────────
export async function generatePromptPlan({ type, description, imageBase64, planModel }) {
  const systemPrompt = SYSTEM_PROMPTS[type];
  if (!systemPrompt) throw new Error('نوع المحتوى غير معروف');
  
  const config = await getAiConfig();
  const model = config.models[planModel] || config.models.free;
  
  const userMsg = buildUserMessage(type, description, imageBase64);
  const rawContent = await callOpenRouter(model, systemPrompt, userMsg);
  
  // Parse JSON response
  let plan;
  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    plan = JSON.parse(cleaned);
  } catch {
    throw new Error('حدث خطأ في تحليل رد الذكاء الاصطناعي. حاول مرة أخرى.');
  }
  
  if (!plan.needsMoreDetails && (!plan.plan || !Array.isArray(plan.plan))) {
    throw new Error('الرد غير مكتمل من الذكاء الاصطناعي. حاول مرة أخرى.');
  }
  
  return plan;
}

// ─── تعديل جزء محدد من البرومبت ──────────────────────────
export async function fixSelectedText({ selectedText, fullBlockText, type, planModel }) {
  const config = await getAiConfig();
  const model = config.models[planModel] || config.models.free;
  
  const systemPrompt = `أنت مساعد متخصص في تحسين برومبتات الذكاء الاصطناعي.
  المستخدم اختار جزءاً من البرومبت ويريد تحسينه أو تعديله.
  أعطه نسخة محسّنة من الجزء المحدد فقط، دون أي شرح إضافي.
  الرد يجب أن يكون JSON: {"improved": "النص المحسّن هنا"}`;
  
  const userMsg = `البرومبت الكامل:
${fullBlockText}

الجزء المحدد للتعديل:
"${selectedText}"

حسّن هذا الجزء المحدد فقط.`;
  
  const rawContent = await callOpenRouter(model, systemPrompt, userMsg);
  
  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    return result.improved || rawContent;
  } catch {
    return rawContent.trim();
  }
}

// ─── التحقق من صور الدفع ─────────────────────────────────
export async function verifyPaymentProof({ smsImageBase64, appImageBase64, expectedAmount, packageName }) {
  const config = await getAiConfig();
  const systemPrompt = `أنت نظام تحقق من إثباتات الدفع.
  مهمتك: فحص صورتي الدفع والتأكد من صحتهما.
  أعطِ ردك بتنسيق JSON: 
  {
    "verified": true/false,
    "reason": "سبب القرار",
    "smsValid": true/false,
    "appValid": true/false,
    "amountMatch": true/false,
    "dateMatch": true/false,
    "suspicionFlags": ["أي علامات مشبوهة"]
  }`;

  const userMsg = [
    {
      type: "text",
      text: `تحقق من هذه الصورتين:
1. صورة رسالة SMS تأكيد الدفع
2. صورة تطبيق الدفع

المبلغ المتوقع: $${expectedAmount} (أو ما يعادله بالجنيه)
الباقة: ${packageName}

تأكد من:
- صحة الصور وعدم تزويرها
- تطابق المبلغ (تقريباً بسعر الصرف)
- أن التاريخ حديث (خلال آخر 48 ساعة)
- تطابق بيانات المرسل/المستلم`
    },
    {
      type: "image_url",
      image_url: { url: smsImageBase64, detail: "high" }
    },
    {
      type: "image_url",
      image_url: { url: appImageBase64, detail: "high" }
    }
  ];

  let rawContent;
  try {
    rawContent = await callOpenRouter(config.visionModel, systemPrompt, userMsg);
  } catch (err) {
    console.warn("Primary vision model failed, using fallback:", err);
    rawContent = await callOpenRouter(config.visionFallback, systemPrompt, userMsg);
  }
  
  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { verified: false, reason: 'فشل في تحليل صور الدفع. تواصل مع الدعم.' };
  }
}

// ─── تحويل الملف إلى Base64 ──────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
