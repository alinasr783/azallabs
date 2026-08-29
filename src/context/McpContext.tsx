import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { discoverMcpToolsFromUrl } from '../lib/mcpClient'
import { clearTickTickToken } from '../lib/ticktick'
import { clearSupabaseConnection } from '../lib/supabaseConnector'
import { clearVercelToken } from '../lib/vercelConnector'

export interface McpToolDefinition {
  name: string
  description: string
  parameters?: Record<string, any>
  inputSchema?: Record<string, any>
}

export interface McpServer {
  id: string
  name: string
  url: string
  service: string
  status: 'disconnected' | 'connecting' | 'connected'
  isEnabled: boolean
  connectedAt?: string
  authToken?: string
  tools: McpToolDefinition[]
}

interface McpContextType {
  servers: McpServer[]
  connectServer: (serverData: {
    name: string
    url: string
    service?: string
    authToken?: string
    tools?: (string | McpToolDefinition)[]
    isEnabled?: boolean
  }) => Promise<void>
  disconnectServer: (id: string) => Promise<void>
  toggleServerEnabled: (id: string, enabled?: boolean) => Promise<void>
  addToolToServer: (serverId: string, tool: McpToolDefinition) => Promise<void>
  removeToolFromServer: (serverId: string, toolName: string) => Promise<void>
  discoverServerTools: (serverId: string) => Promise<{ success: boolean; count: number; tools: McpToolDefinition[] }>
  getServerByUrl: (url: string) => McpServer | undefined
  getServerByName: (name: string) => McpServer | undefined
}

const McpContext = createContext<McpContextType | undefined>(undefined)

const STORAGE_MCP_KEY = 'azal_connected_mcps'

export const TICKTICK_MCP_TOOLS: McpToolDefinition[] = [
  // 1. Task Queries (استعلامات المهام)
  { name: 'search_task', description: 'البحث عن المهام بالكلمات المفتاحية واسترجاع المعرفات والعناوين والروابط' },
  { name: 'get_task_by_id', description: 'استرجاع المحتوى والتفاصيل الكاملة لمهمة محددة عبر معرّفها (Task ID)' },
  { name: 'list_undone_tasks_by_time_query', description: 'عرض المهام غير المنجزة ضمن نطاق زمني محدد (today, last24hour, last7day, tomorrow, next24hour, next7day)' },
  { name: 'list_undone_tasks_by_date', description: 'عرض المهام غير المنجزة ضمن نطاق تاريخ محدد (حتى 14 يوماً)' },
  { name: 'list_completed_tasks_by_date', description: 'عرض المهام المنجزة داخل قائمة محددة ضمن نطاق تاريخ' },
  { name: 'filter_tasks', description: 'تصفية المهام وفق شروط متعددة مثل التاريخ، القائمة، الأولوية، الوسم، والحالة' },

  // 2. List Management (إدارة القوائم والمشاريع والمجلدات)
  { name: 'list_projects', description: 'استرجاع جميع القوائم والمشاريع المسجلة في الحساب الحالي' },
  { name: 'create_project', description: 'إنشاء قائمة أو مشروع جديد' },
  { name: 'update_project', description: 'تعديل إعدادات وخصائص قائمة أو مشروع موجود' },
  { name: 'delete_project', description: 'حذف قائمة أو مشروع نهائياً من TickTick (لا يمكن التراجع). المدخل المطلوب: projectId' },
  { name: 'get_project_by_id', description: 'استرجاع بيانات وتفاصيل قائمة محددة عبر المعرّف (List ID)' },
  { name: 'get_project_with_undone_tasks', description: 'استرجاع تفاصيل القائمة مع كافة المهام غير المنجزة داخلها' },
  { name: 'get_task_in_project', description: 'استرجاع مهمة محددة داخل قائمة معينة' },
  { name: 'list_columns', description: 'استرجاع جميع الأقسام (Sections/Columns) داخل قائمة محددة' },
  { name: 'create_column', description: 'إنشاء قسم جديد داخل قائمة محددة' },
  { name: 'update_column', description: 'إعادة تسمية أو تعديل قسم داخل قائمة محددة' },
  { name: 'list_project_groups', description: 'استرجاع كافة المجلدات ومجموعات المشاريع (Folders)' },
  { name: 'create_project_group', description: 'إنشاء مجلد جديد لتنظيم القوائم والمشاريع' },
  { name: 'update_project_group', description: 'إعادة تسمية مجلد مجموعات المشاريع' },
  { name: 'delete_project_group', description: 'حل أو حذف المجلد وإلغاء تجميع القوائم بداخله' },

  // 3. Task Management (إدارة وتعديل المهام والتعليقات والوسوم)
  { name: 'create_task', description: 'إنشاء مهمة جديدة بكافة الخصائص (العنوان، الوصف، التاريخ، الأولوية، القائمة، الوسوم)' },
  { name: 'batch_add_tasks', description: 'إضافة مجموعة مهام دفعة واحدة (Batch Create) مع تعيين حقول كل مهمة' },
  { name: 'complete_task', description: 'تحديد مهمة معينة كمنجزة' },
  { name: 'complete_tasks_in_project', description: 'تحديد عدة مهام في قائمة محددة كمنجزة دفعة واحدة (حتى 20 مهمة)' },
  { name: 'update_task', description: 'تعديل خصائص مهمة محددة (العنوان، الوصف، الموعد، الأولوية)' },
  { name: 'move_task', description: 'نقل مهمة من قائمة إلى قائمة أخرى' },
  { name: 'batch_update_tasks', description: 'تحديث خصائص عدة مهام دفعة واحدة' },
  { name: 'delete_task', description: 'حذف مهمة ونقلها إلى سلة المهملات' },
  { name: 'get_comment', description: 'استرجاع كافة التعليقات المسجلة على مهمة محددة' },
  { name: 'add_comment', description: 'إضافة تعليق جديد إلى مهمة محددة' },
  { name: 'delete_comment', description: 'حذف تعليق محدد من مهمة' },
  { name: 'assign_task', description: 'تعيين المهمة إلى عضو آخر في الفريق' },
  { name: 'unassign_task', description: 'إلغاء تعيين المهمة' },
  { name: 'project_member', description: 'عرض أعضاء القائمة أو المشروع المشترك' },
  { name: 'list_tags', description: 'استرجاع كافة الوسوم (Tags) المسجلة في الحساب' },
  { name: 'create_tag', description: 'إنشاء وسم جديد' },

  // 4. Habit Management (إدارة وتتبع العادات)
  { name: 'list_habits', description: 'استرجاع كافة العادات المسجلة في الحساب' },
  { name: 'list_habit_sections', description: 'استرجاع أقسام العادات في الحساب' },
  { name: 'create_habit', description: 'إنشاء عادة جديدة وتحديد إعداداتها' },
  { name: 'update_habit', description: 'تعديل إعدادات عادة موجودة' },
  { name: 'get_habit', description: 'استرجاع تفاصيل عادة محددة' },
  { name: 'get_habit_checkins', description: 'استرجاع سجلات تسجيل إنجاز عادة محددة' },
  { name: 'upsert_habit_checkins', description: 'تسجيل أو تحديث إنجاز عادة (Check-in) خلال الـ 90 يوماً الماضية' },

  // 5. Focus Record Management (سجلات وإدارة جلسات التركيز والبومودورو)
  { name: 'get_focuses_by_time', description: 'الاستعلام عن سجلات جلسات التركيز (Focus/Pomo) ضمن نطاق زمني حتى شهر' },
  { name: 'get_focus', description: 'استرجاع سجل تركيز محدد' },
  { name: 'create_focus', description: 'تسجيل جلسة تركيز جديدة' },
  { name: 'delete_focus', description: 'حذف سجل جلسة تركيز محدد' },

  // 6. Countdown (العدادات التنازلية)
  { name: 'list_countdowns', description: 'استرجاع كافة العدادات التنازلية (Countdowns) والمناسبات' },
]

// Default rich tool definitions for known services
export const SUPABASE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'supabase_list_tables',
    description:
      'استكشاف وعرض كافة جداول قاعدة بيانات Supabase الخاصة بالمستخدم (الاسم وأعمدة كل جدول). استخدمها أولاً لكي يعرف الوكيل هيكل قاعدة البيانات وأسماء الجداول المتاحة.',
  },
  {
    name: 'supabase_describe_table',
    description:
      'وصف تفصيلي لأعمدة جدول معين في Supabase (الأسماء والأنواع). المدخل المطلوب: table (اسم الجدول).',
  },
  {
    name: 'supabase_query_table',
    description:
      'قراءة واستعلام صفوف من جدول في Supabase عبر PostgREST. المدخلات: table (إلزامي)، select (الأعمدة، افتراضي *)، limit، order، وأي فلاتر PostgREST مثل status=eq.active أو created_at=gte.2024-01-01.',
  },
  {
    name: 'supabase_insert_row',
    description:
      'إدراج صف جديد في جدول Supabase. المدخلات: table (إلزامي)، row (كائن يحتوي بيانات الصف). يتطلب صلاحيات الكتابة.',
  },
  {
    name: 'supabase_update_row',
    description:
      'تحديث صفوف في جدول Supabase. المدخلات: table (إلزامي)، match (شرط التطابق مثل {id: 5})، patch (القيم الجديدة).',
  },
  {
    name: 'supabase_delete_row',
    description:
      'حذف صفوف من جدول Supabase. المدخلات: table (إلزامي)، match (شرط التطابق مثل {id: 5}).',
  },
  {
    name: 'supabase_run_sql',
    description:
      'تنفيذ أي استعلام SQL حر (SELECT/INSERT/UPDATE/DDL) داخل مشروع Supabase الخاص بالمستخدم عبر Management API. يتطلب إضافة Supabase Personal Access Token عند الربط. المدخل: sql (نص الاستعلام).',
  },
]

// Vercel MCP Tools (Official Specification from https://mcp.vercel.com)
export const VERCEL_MCP_TOOLS: McpToolDefinition[] = [
  // 1. Documentation Tools
  {
    name: 'search_vercel_documentation',
    description:
      'البحث في توثيق Vercel الرسمي عن موضوعات وإرشادات محددة (مثل: routing, data-fetching, domains). المدخلات: topic (إلزامي)، tokens (افتراضي 2500).',
  },

  // 2. Project Management Tools
  {
    name: 'list_teams',
    description:
      'عرض واسترجاع كافة فرق العمل (Teams) التي ينتمي إليها المستخدم الموثق كعضو في Vercel مع المعرفات (team_...) والـ slugs.',
  },
  {
    name: 'list_projects',
    description:
      'استعراض كافة مشاريع Vercel المرتبطة بالمستخدم أو الفريق. المدخلات: teamId (إلزامي: معرّف الفريق team_... أو الـ slug الخاص به، ويمكن جلبه عبر list_teams).',
  },
  {
    name: 'get_project',
    description:
      'جلب معلومات تفصيلية عن مشروع Vercel محدد تشمل إطار العمل (Framework) والنطاقات وآخر عملية نشر. المدخلات: projectId (إلزامي: معرّف المشروع prj_... أو اسمه)، teamId (إلزامي).',
  },

  // 3. Deployment Tools
  {
    name: 'list_deployments',
    description:
      'عرض قائمة عمليات النشر (Deployments) لمشروع محدد مع تاريخ ووقت الإنشاء والحالة (READY, ERROR...) والهدف (production/preview). المدخلات: projectId (إلزامي)، teamId (إلزامي)، since (اختياري)، until (اختياري).',
  },
  {
    name: 'get_deployment',
    description:
      'استرجاع تفاصيل كاملة لعملية نشر معينة بما فيها حالة البناء والمناطق والبيانات الوصفية. المدخلات: idOrUrl (إلزامي: معرف النشر dpl_... أو الرابط المضيف)، teamId (إلزامي).',
  },
  {
    name: 'get_deployment_build_logs',
    description:
      'استرجاع سجلات البناء (Build logs) لعملية نشر معينة لتشخيص أخطاء التجميع. المدخلات: idOrUrl (إلزامي)، teamId (إلزامي)، direction (tail أو head، افتراضي tail)، errorsOnly (منطقي، افتراضي false)، limit (افتراضي 100)، since، until، buildId.',
  },
  {
    name: 'get_runtime_logs',
    description:
      'استرجاع سجلات التشغيل الحية (Runtime logs) وتفاصيل console.log وأخطاء دوال Vercel Functions أثناء الطلبات مع إمكانية التصفية. المدخلات: projectId (إلزامي)، teamId (إلزامي)، deploymentId، environment (production/preview)، level (مصفوفة: error, warning, info)، statusCode، source، since (افتراضي 24h ago)، until (افتراضي now)، limit (افتراضي 50)، query، requestId، group_by.',
  },
  {
    name: 'get_runtime_errors',
    description:
      'استرجاع مجموعات وأكواد أخطاء التشغيل المجمعة (Runtime error clusters) لمشروع معين لتشخيص أخطاء الإنتاج قبل فحص السجلات الفردية. المدخلات: projectId (إلزامي)، teamId (إلزامي)، since (افتراضي 24h ago)، until (افتراضي now)، routes.',
  },
  {
    name: 'deploy_to_vercel',
    description:
      'نشر ملفات مشروع مباشرة إلى Vercel دون الحاجة لمستودع Git أو Vercel CLI. المدخلات: target (إلزامي: preview أو production)، name (اسم المشروع، إلزامي)، files (مصفوفة كائنات الملفات {file, data, encoding}، إلزامي)، teamId (اختياري)، projectSettings (إعدادات البناء: framework, buildCommand, installCommand...).',
  },

  // 4. Web Analytics Tools
  {
    name: 'get_web_analytics',
    description:
      'الاستعلام عن تحليلات زوار الموقع والصفحات والأحداث (Web Analytics) إما بنمط الإجمالي (count) أو التجميع حسب الأبعاد (aggregate). المدخلات: projectId (إلزامي)، teamId (اختياري)، dataset (visits أو events، افتراضي visits)، mode (count أو aggregate)، since، until، by (مصفوفة أبعاد مثل route, country, deviceType)، filter (مرشح OData)، limit (افتراضي 10).',
  },

  // 5. Agent Runs Observability Tools
  {
    name: 'list_agent_run_projects',
    description:
      'استعراض المشاريع التي تتضمن بيانات مراقبة وسجلات تشغيل لوكلاء الذكاء الاصطناعي المبنيين بإطار eve على Vercel مع معدلات مدد التشغيل. المدخلات: teamId (إلزامي)، environment (افتراضي production)، period (مثل 1d, 7d)، from، to.',
  },
  {
    name: 'list_agent_runs',
    description:
      'عرض قائمة سجلات تشغيل الوكلاء الذكية (Agent Runs) لمشروع معين بما يشمل الملخصات والحالة والنموذج واستهلاك التوكنز. المدخلات: teamId (إلزامي)، projectId (إلزامي)، environment (افتراضي production)، period، from، to، page (افتراضي 1)، pageSize، search.',
  },
  {
    name: 'get_agent_run',
    description:
      'استرجاع بيانات وصفية وأحداث تفصيلية لدورة تشغيل وكيل ذكي معينة (Agent Run). المدخلات: teamId (إلزامي)، projectId (إلزامي)، runId (معرف التشغيل wrun_...، إلزامي)، environment، period، from، to.',
  },
  {
    name: 'get_agent_run_trace',
    description:
      'استرجاع التتبع الكامل لدورة تشغيل الوكيل الذكي (Trace) بما فيها أدوار المحادثة واستدلال النموذج واستدعاءات الأدوات وتفاصيل المدخلات والمخرجات. المدخلات: teamId (إلزامي)، projectId (إلزامي)، runId (إلزامي)، environment، period، from، to، maxFieldLength (افتراضي 8000).',
  },

  // 6. Domain Management Tools
  {
    name: 'check_domain_availability_and_price',
    description:
      'فحص توفر أسماء النطاقات للشراء والاستعلام عن أسعار تسجيلها في Vercel. المدخلات: names (مصفوفة بأسماء النطاقات المراد فحصها، إلزامي).',
  },

  // 7. Purchase Tools
  {
    name: 'get_purchase_quote',
    description:
      'الحصول على عرض سعر رسمي موثق (Quote) لأي عملية شراء (credits, domain, addon, pro) والحصول على مفتاح idempotencyKey المطلوب لتأكيد الشراء. المدخلات: product (إلزامي: credits, domain, addon, pro)، teamId (إلزامي)، creditType (v0, gateway, agent)، amount (بالدولار)، domain (اسم النطاق)، years (عدد السنوات)، autoRenew، productAlias، quantity.',
  },
  {
    name: 'buy_pro',
    description:
      'ترقية حساب الفريق إلى اشتراك Vercel Pro الشهري المدفوع. يتطلب مفتاح idempotencyKey من get_purchase_quote وتأكيد صريح. المدخلات: teamId (إلزامي)، confirm (إلزامي true)، idempotencyKey (إلزامي).',
  },
  {
    name: 'buy_credits',
    description:
      'شراء رصيد مسبق الدفع لـ AI Gateway أو v0 أو Vercel Agent بالدولار الكامل. المدخلات: creditType (v0, gateway, agent، إلزامي)، amount (مبلغ بالدولار 1-1000، إلزامي)، teamId (إلزامي)، confirm (إلزامي true)، idempotencyKey (إلزامي).',
  },
  {
    name: 'buy_addon',
    description:
      'شراء إضافة أو ملحق لفريق Vercel (حالياً متاح ملحق siem لتفريغ السجلات). المدخلات: productAlias (إلزامي: siem)، quantity (الكمية، إلزامي)، teamId (إلزامي)، confirm (إلزامي true)، idempotencyKey (إلزامي).',
  },
  {
    name: 'buy_domain',
    description:
      'تسجيل وشراء نطاق (Domain) محدد لفريق Vercel مع تزويد بيانات المسجل WHOIS وسعر التأكيد المقتبس. المدخلات: domain (إلزامي)، years (إلزامي)، autoRenew (افتراضي true)، expectedPrice (إلزامي من الكوتة)، contact (كائن بيانات المسجل: firstName, lastName, email, phone, address1, city, state, zip, country)، teamId (إلزامي)، confirm (إلزامي true)، idempotencyKey (إلزامي).',
  },
  {
    name: 'get_domain_order',
    description:
      'الاستعلام عن حالة إتمام طلب شراء النطاق والتأكد من نجاح التسجيل غير المتزامن. المدخلات: orderId (إلزامي من buy_domain)، teamId (اختياري).',
  },

  // 8. Access Tools
  {
    name: 'get_access_to_vercel_url',
    description:
      'إنشاء رابط مشاركة مؤقت يمنح صلاحية الوصول إلى عمليات النشر المحمية بحماية Vercel Authentication. المدخلات: url (رابط النشر الكامل، إلزامي).',
  },
  {
    name: 'web_fetch_vercel_url',
    description:
      'جلب المحتوى وقراءة الردود مباشرة من رابط نشر Vercel مع المصادقة التلقائية عند وجود حماية. المدخلات: url (الرابط الكامل متضمناً المسار، إلزامي).',
  },

  // 9. Design Import Tools
  {
    name: 'import-claude-design-from-url',
    description:
      'استيراد حزمة تصميم HTML مكتفية ذاتياً من Claude Design ونشرها مباشرة كمشروع في Vercel. المدخلات: url (رابط claudeusercontent.com عام صالح، إلزامي)، title (اختياري)، claude_design_project_id (اختياري).',
  },

  // 10. Toolbar Tools
  {
    name: 'list_toolbar_threads',
    description:
      'استعراض سلاسل تعليقات شريط أدوات Vercel Toolbar على عمليات النشر لفريق محدد. المدخلات: teamId (إلزامي)، projectId، branch، status (resolved أو unresolved، افتراضي unresolved)، page، search، limit (افتراضي 20)، offset.',
  },
  {
    name: 'get_toolbar_thread',
    description:
      'استرجاع المحادثة الكاملة لسلسلة تعليقات في Vercel Toolbar بما فيها كافة الرسائل والسياق. المدخلات: threadId (إلزامي tbt_...)، teamId (إلزامي).',
  },
  {
    name: 'change_toolbar_thread_resolve_status',
    description:
      'تغيير حالة حل سلسلة تعليقات في Vercel Toolbar (تحديدها كمنتهية أو إعادة فتحها). المدخلات: threadId (إلزامي)، teamId (إلزامي)، resolved (منطقي، إلزامي).',
  },
  {
    name: 'reply_to_toolbar_thread',
    description:
      'إضافة رد جديد إلى محادثة أو سلسلة تعليقات في Vercel Toolbar بتنسيق Markdown. المدخلات: threadId (إلزامي)، teamId (إلزامي)، markdown (نص الرد، إلزامي).',
  },
  {
    name: 'edit_toolbar_message',
    description:
      'تعديل محتوى رسالة موجودة مسبقاً في سلسلة تعليقات Vercel Toolbar. المدخلات: threadId (إلزامي)، messageId (معرف الرسالة msg_...، إلزامي)، teamId (إلزامي)، markdown (النص المحدث، إلزامي).',
  },
  {
    name: 'add_toolbar_reaction',
    description:
      'إضافة تفاعل إيموجي (Emoji Reaction مثل 👍) على رسالة في Vercel Toolbar. المدخلات: threadId (إلزامي)، messageId (إلزامي)، teamId (إلزامي)، emoji (إلزامي).',
  },

  // 11. CLI Tools
  {
    name: 'use_vercel_cli',
    description:
      'توجيه النموذج لاستخدام أوامر Vercel CLI في سطر الأوامر مع راية --help للحصول على معلومات النشر والتحكم. المدخلات: action (ما تريد تحقيقه عبر CLI، إلزامي)، command (أمر Vercel CLI محدد، اختياري).',
  },
]

// Default rich tool definitions for known services
export const DEFAULT_TOOLS_BY_SERVICE: Record<string, McpToolDefinition[]> = {
  ticktick: TICKTICK_MCP_TOOLS,
  supabase: SUPABASE_MCP_TOOLS,
  vercel: VERCEL_MCP_TOOLS,
  'Vercel MCP': VERCEL_MCP_TOOLS,
  '800 Academy': [
    { name: 'update_package', description: 'تعديل بيانات وسعر وحالة وصلاحية باقات واشتراكات المواد في نظام 800 Academy وإرسال التغييرات مباشرة للخادم' },
    { name: 'create_package', description: 'إنشاء وإضافة باقة أو اشتراك جديد لمادة في نظام 800 Academy وإرسالها مباشرة للخادم' },
    { name: 'get_packages', description: 'استرجاع كافة باقات واشتراكات الطلاب وعروض المواد مع المعرّفات (IDs)، الأسعار بالجنيه المصري (EGP)، وتواريخ الانتهاء' },
    { name: 'get_subjects', description: 'استعراض كافة المواد والمسارات الدراسية (EST 1 Literacy/Math, EST 2 Math, Digital SAT)' },
    { name: 'list_exams', description: 'استعراض كافة الامتحانات المتاحة في المنصة (أكثر من 40 امتحان مع أرقام الاختبارات والنقاط)' },
    { name: 'filter_questions', description: 'البحث والتصفية في بنك الأسئلة المركزي الموحد (النوع، الصعوبة، نص السؤال)' },
    { name: 'list_units', description: 'استعراض الوحدات الدراسية والمناهج (Heart of Algebra, Passport to Advanced Math)' },
    { name: 'get_system_status', description: 'فحص وتشخيص شامل لحالة المنصة وقاعدة البيانات وسرعة الاستجابة' },
  ],
  github: [
    { name: 'github_create_issue', description: 'إنشاء Issue جديد في مستودع محدد' },
    { name: 'github_list_repos', description: 'استعراض المستودعات الخاصة بك' },
    { name: 'github_create_pull_request', description: 'إنشاء طلب سحب (Pull Request) جديد' },
  ],
  notion: [
    { name: 'notion_create_page', description: 'إنشاء صفحة جديدة في مساحة عمل Notion' },
    { name: 'notion_search', description: 'البحث في قواعد البيانات والصفحات' },
    { name: 'notion_update_database', description: 'تحديث سجلات قاعدة بيانات Notion' },
  ],
  default: [
    { name: 'mcp_execute_tool', description: 'تنفيذ أمر أو إجراء مخصص على الخادم' },
    { name: 'mcp_query_resource', description: 'الاستعلام عن مورد أو قراءة بيانات من الخادم' },
  ],
}

// Initial pre-configured servers
const INITIAL_SERVERS: McpServer[] = [
  {
    id: 'mcp_800academy',
    name: '800 Academy MCP',
    url: 'http://localhost:3000/mcp',
    service: '800 Academy',
    status: 'connected',
    isEnabled: true,
    connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    tools: DEFAULT_TOOLS_BY_SERVICE['800 Academy'],
  },
]

// TickTick is surfaced as a connected MCP server (using its token API) so agents
// can discover AND call its tools. It is only injected when a token is present.
export const TICKTICK_SERVER: McpServer = {
  id: 'mcp_ticktick',
  name: 'TickTick MCP',
  url: '',
  service: 'ticktick',
  status: 'connected',
  isEnabled: true,
  connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  tools: TICKTICK_MCP_TOOLS,
}

// Supabase is surfaced as a connected MCP server so the agent can introspect and
// query the user's OWN Supabase project. Credentials are read live from the
// separate browser-only Supabase connection store (never persisted to our DB).
export const SUPABASE_SERVER: McpServer = {
  id: 'mcp_supabase',
  name: 'Supabase MCP',
  url: '',
  service: 'supabase',
  status: 'connected',
  isEnabled: true,
  connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  tools: SUPABASE_MCP_TOOLS,
}

// Vercel is surfaced as a connected MCP server directly via https://mcp.vercel.com
export const VERCEL_SERVER: McpServer = {
  id: 'mcp_vercel',
  name: 'Vercel MCP',
  url: 'https://mcp.vercel.com',
  service: 'vercel',
  status: 'connected',
  isEnabled: true,
  connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  tools: VERCEL_MCP_TOOLS,
}

function normalizeTools(rawTools: (string | McpToolDefinition)[] = []): McpToolDefinition[] {
  return rawTools.map((t) => {
    if (typeof t === 'string') {
      return {
        name: t,
        description: `أداة ${t} التابعة لخادم الـ MCP`,
      }
    }
    return t
  })
}

export const McpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [servers, setServers] = useState<McpServer[]>([])

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem(STORAGE_MCP_KEY)
    let currentServers: McpServer[] = []

    if (saved !== null) {
      try {
        const parsed: any[] = JSON.parse(saved)
        currentServers = parsed.map((s) => ({
          ...s,
          isEnabled: s.isEnabled !== undefined ? s.isEnabled : true,
          tools: normalizeTools(s.tools || []),
        }))
      } catch (e) {
        console.error('Error parsing stored MCP servers:', e)
        currentServers = []
      }
    } else {
      // First-time visit only: initialize with default servers and persist
      currentServers = INITIAL_SERVERS
      localStorage.setItem(STORAGE_MCP_KEY, JSON.stringify(currentServers))
    }

    setServers(currentServers)

    // Background auto-discovery for servers with active URLs
    const autoDiscover = async () => {
      let hasChanges = false
      const updated = await Promise.all(
        currentServers.map(async (srv) => {
          if (srv.url && (srv.url.startsWith('http://') || srv.url.startsWith('https://'))) {
            try {
              const res = await discoverMcpToolsFromUrl(srv.url, srv.authToken)
              if (res.success && res.tools.length > 0 && res.tools.length !== srv.tools.length) {
                hasChanges = true
                return { ...srv, tools: res.tools }
              }
            } catch {
              // Ignore background discovery fail
            }
          }
          return srv
        })
      )

      if (hasChanges) {
        setServers(updated)
        localStorage.setItem(STORAGE_MCP_KEY, JSON.stringify(updated))
      }
    }

    autoDiscover()
  }, [])

  const saveServers = (updated: McpServer[]) => {
    setServers(updated)
    localStorage.setItem(STORAGE_MCP_KEY, JSON.stringify(updated))
  }

  const connectServer = async ({
    name,
    url,
    service = 'custom',
    authToken,
    tools,
    isEnabled = true,
  }: {
    name: string
    url: string
    service?: string
    authToken?: string
    tools?: (string | McpToolDefinition)[]
    isEnabled?: boolean
  }) => {
    const existingIndex = servers.findIndex(
      (s) => s.url.toLowerCase() === url.toLowerCase() || s.name.toLowerCase() === name.toLowerCase()
    )

    let matchedTools: McpToolDefinition[] = []

    // 1. If tools were explicitly passed, use them
    if (tools && tools.length > 0) {
      matchedTools = normalizeTools(tools)
    } else if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // 2. DYNAMIC MCP TOOL DISCOVERY: Query tools/list directly from the endpoint!
      try {
        const discovery = await discoverMcpToolsFromUrl(url, authToken)
        if (discovery.success && discovery.tools.length > 0) {
          matchedTools = discovery.tools
        }
      } catch (err) {
        console.warn('Auto discovery during connect failed:', err)
      }
    }

    // 3. Fallbacks if discovery returned empty
    if (matchedTools.length === 0) {
      if (name.includes('800') || service.includes('800')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE['800 Academy']
      } else if (name.toLowerCase().includes('github') || service.toLowerCase().includes('github')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.github
      } else if (name.toLowerCase().includes('notion') || service.toLowerCase().includes('notion')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.notion
      } else if (name.toLowerCase().includes('tick') || service.toLowerCase().includes('tick')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.ticktick
      } else if (
        name.toLowerCase().includes('vercel') ||
        service.toLowerCase().includes('vercel') ||
        url.toLowerCase().includes('vercel')
      ) {
        matchedTools = VERCEL_MCP_TOOLS
      } else {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.default
      }
    }

    const newServer: McpServer = {
      id: existingIndex >= 0 ? servers[existingIndex].id : 'mcp_' + Date.now(),
      name: name.trim() || 'Custom MCP Server',
      url: url.trim(),
      service: service.trim(),
      status: 'connected',
      isEnabled,
      connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      authToken: authToken?.trim() || undefined,
      tools: matchedTools,
    }

    let updated: McpServer[]
    if (existingIndex >= 0) {
      updated = servers.map((s, idx) => (idx === existingIndex ? newServer : s))
    } else {
      updated = [...servers, newServer]
    }

    saveServers(updated)

    // Sync with Supabase if table exists
    try {
      await supabase.from('mcp_servers').upsert({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        service: newServer.service,
        status: newServer.status,
        is_enabled: newServer.isEnabled,
        connected_at: newServer.connectedAt,
        auth_token: newServer.authToken,
        tools: newServer.tools,
      })
    } catch {
      // Ignore Supabase error if table doesn't exist
    }
  }

  const discoverServerTools = async (
    serverId: string
  ): Promise<{ success: boolean; count: number; tools: McpToolDefinition[] }> => {
    const srv = servers.find((s) => s.id === serverId)
    if (!srv || !srv.url) {
      return { success: false, count: 0, tools: [] }
    }

    const res = await discoverMcpToolsFromUrl(srv.url, srv.authToken)
    if (res.success && res.tools.length > 0) {
      const updated = servers.map((s) => (s.id === serverId ? { ...s, tools: res.tools } : s))
      saveServers(updated)
      return { success: true, count: res.tools.length, tools: res.tools }
    }

    return { success: false, count: 0, tools: [] }
  }

  const disconnectServer = async (id: string) => {
    const target = servers.find((s) => s.id === id)

    // If removing TickTick server, also clear token so it does not resurrect
    if (id === 'mcp_ticktick' || target?.service === 'ticktick' || target?.name.toLowerCase().includes('tick')) {
      clearTickTickToken()
    }

    // If removing Supabase server, also clear credentials
    if (id === 'mcp_supabase' || target?.service === 'supabase' || target?.name.toLowerCase().includes('supabase')) {
      clearSupabaseConnection()
    }

    // If removing Vercel server, also clear token
    if (id === 'mcp_vercel' || target?.service === 'vercel' || target?.name.toLowerCase().includes('vercel') || target?.url.includes('vercel')) {
      clearVercelToken()
    }

    const updated = servers.filter((s) => s.id !== id)
    saveServers(updated)

    try {
      await supabase.from('mcp_servers').delete().eq('id', id)
    } catch {
      // Ignore
    }
  }

  const toggleServerEnabled = async (id: string, enabled?: boolean) => {
    const updated = servers.map((s) => {
      if (s.id === id) {
        const nextState = enabled !== undefined ? enabled : !s.isEnabled
        return { ...s, isEnabled: nextState }
      }
      return s
    })
    saveServers(updated)

    try {
      const target = updated.find((s) => s.id === id)
      if (target) {
        await supabase.from('mcp_servers').update({ is_enabled: target.isEnabled }).eq('id', id)
      }
    } catch {
      // Ignore
    }
  }

  const addToolToServer = async (serverId: string, tool: McpToolDefinition) => {
    const updated = servers.map((s) => {
      if (s.id === serverId) {
        const exists = s.tools.some((t) => t.name === tool.name)
        if (exists) return s
        return { ...s, tools: [...s.tools, tool] }
      }
      return s
    })
    saveServers(updated)
  }

  const removeToolFromServer = async (serverId: string, toolName: string) => {
    const updated = servers.map((s) => {
      if (s.id === serverId) {
        return { ...s, tools: s.tools.filter((t) => t.name !== toolName) }
      }
      return s
    })
    saveServers(updated)
  }

  const getServerByUrl = (url: string) => servers.find((s) => s.url.toLowerCase() === url.toLowerCase())
  const getServerByName = (name: string) => servers.find((s) => s.name.toLowerCase() === name.toLowerCase())

  return (
    <McpContext.Provider
      value={{
        servers,
        connectServer,
        disconnectServer,
        toggleServerEnabled,
        addToolToServer,
        removeToolFromServer,
        discoverServerTools,
        getServerByUrl,
        getServerByName,
      }}
    >
      {children}
    </McpContext.Provider>
  )
}

export const useMcp = () => {
  const context = useContext(McpContext)
  if (!context) {
    throw new Error('useMcp must be used within an McpProvider')
  }
  return context
}
