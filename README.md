# 🌟 Azal Labs — Autonomous AI Agent (MVP)

منصة وتطبيق **Azal Labs** لوكيل الذكاء الاصطناعي المستقل (AI Agent) بنفس هوية وسلاسة تصميم **ChatGPT** مع نظام تنفيذ المهام التفاعلي المتعدد الخطوات مثل **Manus AI**، مبني وفق معايير **Google Material Design 3** وتكامل قاعدة بيانات ومصادقة **Supabase**.

---

## 🚀 المميزات الرئيسية في النسخة الأولية (MVP)

1. **الصفحة الرئيسية (Chat Page)**:
   - واجهة محادثة عائمة ونظيفة بهوية ChatGPT وتنسيقات Google Material 3.
   - **تجربة Manus Agent التفاعلية**: استعراض خطوات التفكير المستقلة (Planning -> Web Search -> Code Sandbox -> Synthesis) في مربعات قابلة للطي والتحقق من سجلات التشغيل.
   - محدد أوضاع الـ Agent (وضع Manus المستقل، تفعيل بحث الويب، وإرفاق الملفات).
   - دعم كامل لـ Markdown، وعرض الأكواد البرمجية مع زر النسخ السريع.
   - شريط جانبي قابل للطي لإدارة وتصفح المحادثات السابقة ومسح الجلسات.

2. **المصادقة وحسابات المستخدمين (Auth Page)**:
   - تسجيل الدخول وإنشاء الحساب بالبريد وكلمة المرور فقط.
   - **الدخول عبر OAuth مباشرة من Supabase** (زي TickTick): أزرار Google / GitHub / Microsoft / Apple.
   - ربط مباشر مع Supabase Auth.
   - **بدون اشتراط تأكيد البريد الإلكتروني حالياً** لسرعة التجربة.
   - إمكانية الدخول الفوري كزائر تجريبي (Guest Mode) بنقرة واحدة.

3. **ربط مشروع Supabase الخاص بالمستخدم (Supabase Connector)**:
   - أي مستخدم يربط مشروع Supabase **بتاعه** من صفحة الإعدادات (تبويب خوادم الربط).
   - بيانات الربط (URL + المفاتيح) تُحفظ محلياً في المتصفح فقط ولا تُرسل لأي خادم خارجي.
   - الوكيل الذكي يحصل تلقائياً على خادم `Supabase MCP` مع 7 أدوات:
     `supabase_list_tables` (استكشاف الجداول)، `supabase_describe_table` (وصف الأعمدة)،
     `supabase_query_table` (قراءة/فلترة الصفوف عبر PostgREST)، `supabase_insert_row`،
     `supabase_update_row`، `supabase_delete_row`، و`supabase_run_sql` (تنفيذ أي استعلام SQL حر عبر Management API).
   - يكفي إعطاء مفتاح `anon` للقراءة؛ وللكتابة يُفضّل مفتاح `service_role`؛ وتشغيل SQL الحر يتطلب Supabase Personal Access Token.

4. **لوحة التحكم (Dashboard - غير محمية مؤقتاً)**:
   - **الصفحة 1: Overview (نظرة عامة)**:
     - إحصائيات حية للـ Agent (استدعاءات المهام، سرعة الاستجابة، الأدوات المفعلة).
     - سجل العمليات الحية (Live Activity Logs) يوضح خطوات البحث والأكواد.
   - **الصفحة 2: System Prompt (التحكم في الـ Agent)**:
     - تحكم وتعديل كامل في نص الـ System Prompt الفعّال للوكيل.
     - قوالب جاهزة: (Azal Manus Autonomous, ChatGPT Conversational, Code Architect, Deep Research).
     - معلمات السلوك: درجة الحرارة (Temperature)، وأقصى خطوات تفكير (Max Steps).
     - تفعيل/تعطيل الأدوات المتاحة (Web Search, Code Interpreter, Browser, Terminal).
     - حفظ مباشر في Supabase مع كاش محلي تلقائي (LocalStorage Fallback).
     - **Live Playground**: بيئة تجربة واختبار سريعة لمعاينة سلوك الوكيل بالـ System Prompt الجديد فوراً.

---

## 🛠️ التشغيل السريع (Local Development)

```bash
# تثبيت الحزم
npm install

# تشغيل خادم التطوير
npm run dev

# بناء النسخة الإنتاجية
npm run build
```

---

## 🗄️ تكامل Supabase

تم تكوين المشروع مع بيانات Supabase الخاصة بالمشروع:
- **Project URL**: `https://rhcffiwpfvcbhlkheuis.supabase.co`
- **Publishable Key**: `sb_publishable_zbjDAxNRTdNTlUn7zQgm0g__QvqdP_z`

لتهيئة الجداول في قاعدة بيانات Supabase (اختياري، التطبيق يعمل بكفاءة مع التخزين المحلي الاحتياطي):
- قم بنسخ وتشغيل محتوى الملف [`supabase_schema.sql`](./supabase_schema.sql) في الـ SQL Editor داخل لوحة تحكم Supabase.
