/* ===========================================================
   معمل البرومبت — خدمة الذكاء الاصطناعي (OpenRouter)
=========================================================== */

import { db } from './firebase-config.js';
import { MODEL_TEXT, MODEL_VISION } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ذاكرة التخزين المؤقت للإعدادات
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
    console.warn("Failed to load AI config from Firestore, using built-in models:", err);
  }
  // Fallback: استخدام الموديلات المدمجة مباشرة
  cachedConfig = {
    openRouterApiKey: null, // سيتم جلبه من Firestore فقط
    models: { free: MODEL_TEXT, pro: MODEL_TEXT, king: MODEL_TEXT },
    visionModel: MODEL_VISION,
    visionFallback: MODEL_VISION,
  };
  return cachedConfig;
}

// ─── جلب مفتاح API (مطلوب دائماً من Firestore) ──────────
async function getApiKey() {
  const config = await getAiConfig();
  if (config.openRouterApiKey) return config.openRouterApiKey;
  // محاولة أخيرة من Firestore مباشرة
  try {
    const snap = await getDoc(doc(db, 'config', 'ai'));
    if (snap.exists()) return snap.data().openRouterApiKey;
  } catch {}
  throw new Error('⚙️ لم يتم إعداد مفاتيح الذكاء الاصطناعي. يرجى الدخول على /setup.html وإدخال المفتاح.');
}

// ─── System Prompts محسّنة لكل نوع محتوى ─────────────────
function buildSystemPrompt(type, planTier = 'free') {
  const depthNote = planTier === 'king'
    ? 'المستخدم يملك باقة الملك: اجعل البرومبتات شاملة ومطوّلة بأقصى تفاصيل ممكنة مع أمثلة ومتغيرات بديلة.'
    : planTier === 'pro'
    ? 'المستخدم يملك باقة برو: اجعل البرومبتات مفصّلة واحترافية مع تفاصيل تقنية كافية.'
    : 'المستخدم يملك الباقة المجانية: اجعل البرومبتات واضحة وعملية وقابلة للتطبيق فوراً.';

  const prompts = {
    video: `أنت خبير محترف في كتابة البرومبتات للفيديو بالذكاء الاصطناعي على مستوى عالمي.
${depthNote}

مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات كاملة ومرتبة خطوة بخطوة لإنشاء فيديو احترافي.

تقييم الطلب أولاً:
إذا كان الطلب مبهماً جداً أو يفتقد لتفاصيل أساسية (الحركة، الأجواء، الإضاءة، الأسلوب)، أرجع:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "style",
      "question": "ما هو الأسلوب الفني والبصري للفيديو؟",
      "options": ["واقعي سينمائي (Realistic Cinematic)", "ثلاثي الأبعاد احترافي (3D CGI)", "أنمي / رسوم متحركة", "خيال علمي / سايبربانك", "وثائقي طبيعي"]
    },
    {
      "id": "mood",
      "question": "ما هو الجو العاطفي والإضاءة المطلوبة؟",
      "options": ["دافئ وسينمائي (Golden Hour)", "غامض وليلي (Dark Moody)", "نهاري مشرق (Bright & Vibrant)", "أبيض وأسود درامي", "نيون إلكتروني ملون"]
    },
    {
      "id": "motion",
      "question": "ما نوع حركة الكاميرا المفضلة؟",
      "options": ["تقريب بطيء (Slow Zoom In)", "دوران حول المجسم (Orbit Shot)", "حركة طائرة مسيّرة (Drone Fly)", "كاميرا يد (Handheld)", "ثابتة تماماً (Static)"]
    }
  ]
}

إذا كان الطلب واضحاً، أرجع خطة شاملة بهذا التنسيق الدقيق:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "اسم الأداة", "type": "مجاني|مدفوع", "url": "https://...", "desc": "سبب اختيارها وما تتميز به"},
    {"name": "بديل ثانٍ", "type": "مجاني|مدفوع", "url": "https://...", "desc": "متى تستخدمه"}
  ],
  "plan": [
    {"title": "🎬 1. وصف المشهد الرئيسي (Main Scene)", "prompt": "برومبت كامل ومفصّل بالعربية والإنجليزية يشمل: الموضوع، البيئة، الزاوية، التفاصيل البصرية..."},
    {"title": "🎥 2. حركة الكاميرا والإخراج (Camera & Direction)", "prompt": "نوع الحركة، سرعتها، زاوية التصوير، أسلوب الإخراج..."},
    {"title": "💡 3. الإضاءة والجو البصري (Lighting & Atmosphere)", "prompt": "نوع الإضاءة، درجات الألوان، العمق البصري، تأثيرات الجو..."},
    {"title": "🎵 4. الصوت والموسيقى التصويرية (Sound & Music)", "prompt": "وصف الموسيقى المطلوبة، المؤثرات الصوتية، الإيقاع..."},
    {"title": "✂️ 5. المونتاج والتعديلات النهائية (Editing & Post)", "prompt": "تعليمات تفصيلية للمونتاج، الفلاتر، التصحيح اللوني، الإيقاع التحريري..."}
  ],
  "tips": [
    "نصيحة احترافية محددة 1",
    "نصيحة احترافية محددة 2",
    "نصيحة احترافية محددة 3"
  ]
}

الأدوات المعروفة: Runway Gen-3 Alpha, Kling AI, Pika 2.0, Luma Dream Machine, Hailuo AI, Sora (OpenAI).
اكتب البرومبتات بتفصيل حقيقي — لا تكتفِ بالعناوين العامة.`,

    image: `أنت خبير عالمي في كتابة البرومبتات للصور بالذكاء الاصطناعي.
${depthNote}

مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات كاملة لإنشاء صور احترافية.

تقييم الطلب أولاً:
إذا كان الطلب مبهماً أو يفتقد لتفاصيل (النمط الفني، الألوان، الأبعاد)، أرجع:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "style",
      "question": "ما هو النمط الفني للصورة؟",
      "options": ["تصوير فوتوغرافي فائق الواقعية (Hyper-realistic)", "رسم رقمي ثلاثي الأبعاد (3D Digital Art)", "لوحة زيتية / كلاسيكية (Oil Painting)", "ناقلات / لوجو مبسط (Vector/Logo)", "أنمي / كرتون (Anime/Cartoon)"]
    },
    {
      "id": "ratio",
      "question": "ما هي أبعاد ونسبة الصورة؟",
      "options": ["عريضة 16:9 (يوتيوب / مواقع)", "طولية 9:16 (ريلز / ستوريز)", "مربعة 1:1 (إنستغرام)", "سينمائية 21:9 (فيلمية)", "مخصصة"]
    },
    {
      "id": "palette",
      "question": "ما هي لوحة الألوان والمزاج البصري؟",
      "options": ["ذهبي دافئ (Golden Hour Warm)", "بارد هادئ (Cool Minimalist)", "نيون مشبع (Vibrant Neon)", "باستيل ناعم (Soft Pastel)", "أحادي اللون (Monochrome)"]
    }
  ]
}

إذا كان الطلب واضحاً، أرجع:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "الأداة", "type": "مجاني|مدفوع", "url": "https://...", "desc": "لماذا هي الأفضل لهذا الطلب"},
    {"name": "بديل", "type": "مجاني|مدفوع", "url": "https://...", "desc": "حالات استخدامه"}
  ],
  "plan": [
    {"title": "🖼️ 1. البرومبت الرئيسي (Main Prompt)", "prompt": "وصف كامل ودقيق بالإنجليزية: الموضوع، التفاصيل، الزاوية، الإضاءة، الأسلوب الفني..."},
    {"title": "🎨 2. الأسلوب والجودة (Style & Quality)", "prompt": "keywords للنمط الفني: hyperrealistic, 8K resolution, studio lighting, bokeh, sharp focus..."},
    {"title": "🚫 3. البرومبت السلبي (Negative Prompt)", "prompt": "ugly, blurry, deformed, extra limbs, watermark, low quality, distorted..."},
    {"title": "⚙️ 4. المعاملات التقنية (Parameters)", "prompt": "--ar 16:9 --v 6.1 --style raw --q 2 --s 750 أو ما يناسب الأداة..."},
    {"title": "🔧 5. التحسينات والتنويعات (Variations)", "prompt": "طريقة توليد تنويعات، upscaling، تعديل أجزاء معينة (inpainting)..."}
  ],
  "tips": [
    "نصيحة مهمة 1 مع تفاصيل عملية",
    "نصيحة مهمة 2 مع تفاصيل عملية",
    "نصيحة مهمة 3 مع تفاصيل عملية"
  ]
}

الأدوات المعروفة: Midjourney v6, DALL-E 3, Stable Diffusion 3, Adobe Firefly 3, Leonardo AI, Ideogram 2, Flux.`,

    music: `أنت خبير عالمي في كتابة البرومبتات لتوليد الموسيقى بالذكاء الاصطناعي.
${depthNote}

مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات متكاملة لإنشاء مقطوعة موسيقية احترافية.

تقييم الطلب أولاً:
إذا كان الطلب مبهماً أو يفتقد لتفاصيل (النوع، الإيقاع، الأدوات)، أرجع:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "genre",
      "question": "ما هو النوع الموسيقي الأساسي؟",
      "options": ["سينمائي / أوركسترا (Epic Cinematic)", "إلكتروني تقني (EDM / Synthwave)", "لو-فاي هادئ (Lo-Fi Chill)", "روك / ميتال (Rock/Metal)", "عربي شرقي (Arabian Oriental)", "جاز / بلوز (Jazz/Blues)"]
    },
    {
      "id": "tempo",
      "question": "ما هي سرعة الإيقاع؟",
      "options": ["سريع جداً وحماسي (Fast 140+ BPM)", "متوسط ومتوازن (Moderate 90-120 BPM)", "بطيء وهادئ (Slow 60-80 BPM)", "تصاعدي من بطيء لسريع (Crescendo)"]
    },
    {
      "id": "mood",
      "question": "ما هو المزاج العاطفي للمقطوعة؟",
      "options": ["ملحمي محفّز (Epic & Inspiring)", "حزين ومعبّر (Melancholic & Emotional)", "مبهج وطاقوي (Happy & Energetic)", "غامض وداكن (Dark & Mysterious)", "رومانسي حالم (Romantic & Dreamy)"]
    }
  ]
}

إذا كان الطلب واضحاً، أرجع:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "الأداة", "type": "مجاني|مدفوع", "url": "https://...", "desc": "ميزتها لهذا النوع الموسيقي"},
    {"name": "بديل", "type": "مجاني|مدفوع", "url": "https://...", "desc": "متى يُفضَّل"}
  ],
  "plan": [
    {"title": "🎵 1. وصف المقطوعة الكاملة", "prompt": "وصف شامل: النوع، الجو، المدة، الغرض، الاستخدام المقصود..."},
    {"title": "🎹 2. الأسلوب والآلات الموسيقية", "prompt": "genre tags: cinematic, orchestral / instruments: violin, piano / mood: epic, emotional / tempo: 120 BPM..."},
    {"title": "📐 3. بنية المقطوعة (Structure)", "prompt": "Intro (0:00-0:20): هادئ / Verse (0:20-0:50): متصاعد / Chorus (0:50-1:20): ذروة / Bridge / Outro..."},
    {"title": "📝 4. كلمات الأغنية أو الإرشادات الصوتية", "prompt": "كلمات مقترحة مع إرشادات الأداء / أو: instrumental only with vocal hints..."},
    {"title": "🎚️ 5. الإنتاج والمكساج (Production)", "prompt": "mixing style, mastering loudness, reverb depth, stereo width, EQ notes..."}
  ],
  "tips": [
    "نصيحة إنتاج محددة 1",
    "نصيحة إنتاج محددة 2",
    "نصيحة إنتاج محددة 3"
  ]
}

الأدوات: Suno AI v4, Udio, Stable Audio 2.0, MusicGen, Beatoven.ai, Soundraw, Mubert.`,

    website: `أنت خبير عالمي في كتابة البرومبتات لإنشاء المواقع بأدوات الذكاء الاصطناعي.
${depthNote}

مهمتك: تحليل طلب المستخدم وإنشاء خطة برومبتات شاملة لإنشاء موقع احترافي.

تقييم الطلب أولاً:
إذا كان الطلب مبهماً أو يفتقد لتفاصيل (نوع الموقع، الغرض، التصميم)، أرجع:
{
  "needsMoreDetails": true,
  "questions": [
    {
      "id": "site_type",
      "question": "ما هو نوع الموقع المطلوب؟",
      "options": ["صفحة هبوط تسويقية (Landing Page)", "موقع شركة تعريفي (Corporate)", "متجر إلكتروني (E-commerce)", "معرض أعمال / بورتفوليو (Portfolio)", "تطبيق ويب متكامل (Web App)", "مدونة / موقع محتوى"]
    },
    {
      "id": "design_style",
      "question": "ما هو أسلوب التصميم المفضل؟",
      "options": ["داكن عصري (Dark Mode Premium)", "أبيض نظيف (Clean Minimalist)", "جريء وملون (Bold & Colorful)", "تقليدي احترافي (Traditional Corporate)", "إبداعي تجريبي (Creative Experimental)"]
    },
    {
      "id": "tech_stack",
      "question": "ما هي التقنيات أو الأدوات المفضلة؟",
      "options": ["Bolt.new / Lovable (سريع بلا كود)", "v0.dev (React احترافي)", "Replit Agent (تطبيق كامل)", "WordPress / Webflow", "HTML/CSS/JS بسيط"]
    }
  ]
}

إذا كان الطلب واضحاً، أرجع:
{
  "needsMoreDetails": false,
  "tools": [
    {"name": "الأداة", "type": "مجاني|مدفوع", "url": "https://...", "desc": "لماذا هي الأنسب لهذا المشروع"},
    {"name": "بديل", "type": "مجاني|مدفوع", "url": "https://...", "desc": "متى يُفضَّل"}
  ],
  "plan": [
    {"title": "🏗️ 1. وصف الموقع والهدف (Site Overview)", "prompt": "اكتب هذا في أداة الذكاء الاصطناعي: نوع الموقع، الجمهور المستهدف، الهدف الرئيسي، الشعور العام..."},
    {"title": "🎨 2. التصميم والأقسام (Design & Sections)", "prompt": "تفاصيل كل قسم: Header (محتواه)، Hero section، Features، Testimonials، Pricing، Footer / الألوان والخطوط..."},
    {"title": "⚙️ 3. الوظائف والمميزات التقنية", "prompt": "قائمة الميزات المطلوبة: نموذج تواصل، قاعدة بيانات، دفع إلكتروني، تسجيل دخول، API integrations..."},
    {"title": "📝 4. المحتوى والنصوص (Content)", "prompt": "تعليمات كتابة المحتوى: عناوين، أوصاف، دعوات للفعل (CTAs)، نصوص تسويقية..."},
    {"title": "🚀 5. SEO والنشر (Launch & SEO)", "prompt": "meta tags، title, description، performance optimization، hosting platform، deployment steps..."}
  ],
  "tips": [
    "نصيحة تقنية محددة 1 مع تفاصيل",
    "نصيحة تقنية محددة 2 مع تفاصيل",
    "نصيحة تقنية محددة 3 مع تفاصيل"
  ]
}

الأدوات: v0.dev, Bolt.new, Lovable, Replit Agent, GitHub Copilot, Cursor AI, Builder.io.`
  };

  return prompts[type] || prompts.video;
}

// ─── بناء رسالة المستخدم ─────────────────────────────────
function buildUserMessage(type, description, imageBase64 = null) {
  const typeLabels = {
    video: 'فيديو', image: 'صورة', music: 'موسيقى', website: 'موقع'
  };
  const content = [];

  content.push({
    type: "text",
    text: `المستخدم يريد إنشاء: ${typeLabels[type] || type}

الوصف التفصيلي للمشروع:
${description}

المطلوب: خطة برومبتات كاملة ومفصّلة واحترافية بتنسيق JSON المحدد في التعليمات.
- اجعل كل برومبت في الخطة طويلاً ومفصّلاً وقابلاً للنسخ مباشرة إلى الأداة
- لا تكتفِ بالوصف العام — اكتب البرومبت الفعلي الجاهز للاستخدام`
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
async function callOpenRouter(model, systemPrompt, userMessage, signal = null, maxTokens = 3000) {
  const apiKey = await getApiKey();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Prompt Lab - Prompeter'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      temperature: 0.75,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errMsg = err.error?.message || `خطأ في الاتصال (${response.status})`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('الذكاء الاصطناعي لم يرجع رداً. حاول مرة أخرى.');
  return content;
}

// ─── تحديد max_tokens بحسب الباقة ────────────────────────
function getMaxTokens(planTier) {
  if (planTier === 'king') return 6000;
  if (planTier === 'pro')  return 4500;
  return 3000;
}

// ─── توليد خطة البرومبت ───────────────────────────────────
export async function generatePromptPlan({ type, description, imageBase64, planModel, customModel }) {
  const systemPrompt = buildSystemPrompt(type, planModel);

  // الموديل: يستخدم الموديل المخصص إذا اختار المستخدم، وإلا الموديل الافتراضي
  const model = customModel || MODEL_TEXT;
  const maxTokens = getMaxTokens(planModel);

  const userMsg = buildUserMessage(type, description, imageBase64);
  const rawContent = await callOpenRouter(model, systemPrompt, userMsg, null, maxTokens);

  let plan;
  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    plan = JSON.parse(cleaned);
  } catch {
    // محاولة استخراج JSON من الرد
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (match) {
      try { plan = JSON.parse(match[0]); } catch {}
    }
    if (!plan) throw new Error('حدث خطأ في تحليل رد الذكاء الاصطناعي. حاول مرة أخرى.');
  }

  if (!plan.needsMoreDetails && (!plan.plan || !Array.isArray(plan.plan))) {
    throw new Error('الرد غير مكتمل من الذكاء الاصطناعي. حاول مرة أخرى.');
  }

  return plan;
}

// ─── تعديل جزء محدد من البرومبت ──────────────────────────
export async function fixSelectedText({ selectedText, fullBlockText, type, planModel, customModel }) {
  const model = customModel || MODEL_TEXT;

  const systemPrompt = `أنت مساعد متخصص في تحسين برومبتات الذكاء الاصطناعي.
المستخدم اختار جزءاً من البرومبت ويريد تحسينه أو تعديله.
أعطه نسخة محسّنة من الجزء المحدد فقط — أكثر تفصيلاً، وضوحاً، واحترافية.
لا تضف شروحاً خارجية.
الرد يجب أن يكون JSON: {"improved": "النص المحسّن هنا"}`;

  const userMsg = `سياق البرومبت الكامل:
${fullBlockText}

الجزء المحدد للتحسين:
"${selectedText}"

حسّن هذا الجزء المحدد فقط — اجعله أكثر تفصيلاً واحترافية مع الحفاظ على المعنى الأصلي.`;

  const rawContent = await callOpenRouter(model, systemPrompt, userMsg, null, 1000);

  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    return result.improved || rawContent;
  } catch {
    return rawContent.trim();
  }
}

// ─── التحقق من صور الدفع (يستخدم موديل الرؤية) ──────────
export async function verifyPaymentProof({ smsImageBase64, appImageBase64, expectedAmount, packageName }) {
  const systemPrompt = `أنت نظام تحقق من إثباتات الدفع. مهمتك فحص صورتي الدفع والتأكد من صحتهما.
أعطِ ردك بتنسيق JSON:
{
  "verified": true/false,
  "reason": "سبب القرار بالتفصيل",
  "smsValid": true/false,
  "appValid": true/false,
  "amountMatch": true/false,
  "dateMatch": true/false,
  "suspicionFlags": ["أي علامات مشبوهة إن وجدت"]
}`;

  const userMsg = [
    {
      type: "text",
      text: `تحقق من هاتين الصورتين:
1. صورة رسالة SMS تأكيد الدفع
2. صورة تطبيق الدفع / المحفظة

المبلغ المتوقع: $${expectedAmount} (أو ما يعادله بالجنيه المصري)
الباقة المشتراة: ${packageName}

يرجى التأكد من:
- أن الصور حقيقية وغير مزوّرة
- تطابق المبلغ (يُقبل تقريباً بسعر الصرف)
- أن التاريخ حديث (خلال آخر 72 ساعة)
- بيانات المرسل/المستلم متطابقة`
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
    // محاولة أولى: موديل الرؤية
    rawContent = await callOpenRouter(MODEL_VISION, systemPrompt, userMsg, null, 1000);
  } catch (err) {
    console.warn("Vision model failed, trying text model:", err);
    try {
      // محاولة ثانية: موديل النص (بدون صور)
      const textOnlyMsg = `تحقق من دفع باقة "${packageName}" بمبلغ $${expectedAmount}. المستخدم يدّعي أنه دفع. بناءً على القواعد العامة، قيّم: هل يبدو الطلب صحيحاً؟`;
      rawContent = await callOpenRouter(MODEL_TEXT, systemPrompt, textOnlyMsg, null, 500);
    } catch (err2) {
      console.error("All models failed:", err2);
      // Fallback: موافقة يدوية مؤجّلة
      return {
        verified: false,
        reason: 'تعذّر التحقق التلقائي. سيتم مراجعة طلبك يدوياً خلال 24 ساعة. تواصل مع الدعم.',
        smsValid: false,
        appValid: false,
        amountMatch: false,
        dateMatch: false,
        suspicionFlags: ['auto-verify-failed']
      };
    }
  }

  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    // إذا فشل التحليل، اعتبره إيجابياً مشكوكاً فيه
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

// ─── توليد محتوى الصورة الإسلامية (للصفحة الجديدة) ──────
export async function generateIslamicContent({ contentType, theme, customModel }) {
  const model = customModel || MODEL_TEXT;

  const typeMap = {
    quran:   'آية قرآنية كريمة',
    hadith:  'حديث نبوي شريف',
    quote:   'مقولة مشهورة وحكمة خالدة',
  };

  const systemPrompt = `أنت متخصص في اختيار ${typeMap[contentType] || 'نص ملهم'} مناسبة.
أعطِ ردك بتنسيق JSON:
{
  "text": "النص الكامل",
  "source": "المصدر (مثلاً: سورة البقرة - آية 286 / أو: رواه البخاري / أو: أرسطو)",
  "bgDescription": "وصف بسيط باللغة العربية لخلفية SVG مناسبة (مثلاً: سماء زرقاء مع نجوم ذهبية وهلال)"
}`;

  const userMsg = `اختر ${typeMap[contentType] || 'نصاً ملهماً'} ${theme ? `تتعلق بـ: ${theme}` : 'مناسبة ومؤثرة'}.
يجب أن يكون النص قصيراً وعميقاً ومناسباً للصور والبطاقات التحفيزية.`;

  const rawContent = await callOpenRouter(model, systemPrompt, userMsg, null, 800);

  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { text: rawContent.trim(), source: '', bgDescription: 'خلفية هادئة بألوان ذهبية' };
  }
}
