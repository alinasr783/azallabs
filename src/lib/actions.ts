export interface ActionParam {
  name: string
  type: string
  description: string
  required: boolean
}

export interface ActionDefinition {
  id: string
  name: string
  description: string
  category: 'planning' | 'productivity' | 'memory' | 'platform' | 'system'
  source: 'builtin' | 'mcp'
  mcpServer?: string
  parameters: ActionParam[]
  example?: string
}

export interface ActionCategoryNode {
  category: string
  description: string
  actions: ActionDefinition[]
}

// Built-in core actions that Azal Labs AI Agent natively supports
export const BUILTIN_ACTIONS: ActionDefinition[] = [
  // 1. Planning & ToDo Actions
  {
    id: 'create_todo_list',
    name: 'create_todo_list',
    description: 'Create and structure an interactive ToDo list displayed directly in the tasks panel on the side of the chat with step-by-step progress tracking.',
    category: 'planning',
    source: 'builtin',
    parameters: [
      { name: 'title', type: 'string', description: 'Title or goal of the task list', required: true },
      { name: 'items', type: 'array', description: 'List of items with id, title, and initial status (pending, in_progress, completed)', required: true },
    ],
    example: `:::todo-list
{
  "title": "SEO-Optimized Article Workflow",
  "items": [
    { "id": "1", "title": "Keyword and search intent research", "status": "completed" },
    { "id": "2", "title": "Draft content outline and sections", "status": "in_progress" },
    { "id": "3", "title": "Write comprehensive body content", "status": "pending" },
    { "id": "4", "title": "Publish and schedule in CMS", "status": "pending" }
  ]
}
:::`,
  },
  {
    id: 'update_todo_item',
    name: 'update_todo_item',
    description: 'Update the status of a specific task item in the active ToDo list (pending | in_progress | completed).',
    category: 'planning',
    source: 'builtin',
    parameters: [
      { name: 'itemId', type: 'string', description: 'ID of the item to update', required: true },
      { name: 'status', type: 'string', description: 'New status: pending | in_progress | completed', required: true },
    ],
  },

  // 2. Permanent Memory Actions
  {
    id: 'save_memory',
    name: 'save_memory',
    description: 'Persist an important piece of user information (role, preference, active project, decision) to permanent memory.',
    category: 'memory',
    source: 'builtin',
    parameters: [
      { name: 'category', type: 'string', description: 'Category: personal | preferences | projects | notes', required: true },
      { name: 'key', type: 'string', description: 'Key or attribute name', required: true },
      { name: 'value', type: 'string', description: 'Value to remember permanently', required: true },
    ],
    example: `:::update-memory
{
  "category": "preferences",
  "key": "working_style",
  "value": "Prefers concise, actionable responses with interactive ToDo lists"
}
:::`,
  },
  {
    id: 'get_memory',
    name: 'get_memory',
    description: 'Retrieve all current information stored in permanent user memory.',
    category: 'memory',
    source: 'builtin',
    parameters: [],
  },

  // 3. TickTick MCP Core Productivity Actions
  {
    id: 'ticktick_create_task',
    name: 'create_task',
    description: 'Create a real task in the user TickTick account specifying title, project, and due date.',
    category: 'productivity',
    source: 'mcp',
    mcpServer: 'TickTick MCP',
    parameters: [
      { name: 'title', type: 'string', description: 'Task title', required: true },
      { name: 'projectName', type: 'string', description: 'Target project or list name', required: false },
      { name: 'dueDate', type: 'string', description: 'Due date in ISO format', required: false },
    ],
  },
  {
    id: 'ticktick_update_task',
    name: 'update_task',
    description: 'Update the due date, title, or status of an existing task in TickTick.',
    category: 'productivity',
    source: 'mcp',
    mcpServer: 'TickTick MCP',
    parameters: [
      { name: 'taskId', type: 'string', description: 'TickTick task ID', required: true },
      { name: 'dueDate', type: 'string', description: 'Updated due date', required: false },
      { name: 'title', type: 'string', description: 'Updated title', required: false },
    ],
  },
  {
    id: 'ticktick_get_tasks',
    name: 'ticktick_get_tasks',
    description: 'Retrieve and inspect real tasks from a specified project in TickTick.',
    category: 'productivity',
    source: 'mcp',
    mcpServer: 'TickTick MCP',
    parameters: [
      { name: 'projectName', type: 'string', description: 'Project name to inspect', required: true },
    ],
  },
  {
    id: 'ticktick_list_projects',
    name: 'list_projects',
    description: 'Retrieve all project and list names from the user TickTick account.',
    category: 'productivity',
    source: 'mcp',
    mcpServer: 'TickTick MCP',
    parameters: [],
  },
]

// Generate hierarchical action tree formatted for LLM system context detailing ALL connected MCPs and their tools
export function generateActionTreePrompt(connectedServers?: { server: string; tools: any[] }[]): string {
  let tree = `### 🌳 Actions Tree & Capabilities (All Available MCPs & Tools)
You have full authority to use and execute any of the following tools across all connected MCP servers:

1. 📋 **Planning & Workflow:**
   ├── \`create_todo_list\`: Generate an interactive ToDo list displayed on the tasks panel.
   └── \`update_todo_item\`: Update the status of a specific step (pending / in_progress / completed).

2. 🧠 **Permanent Memory Engine:**
   ├── \`save_memory\`: Persist user profile details, preferences, or project decisions to memory.txt.
   └── \`get_memory\`: Read and reference permanent memory data.
`

  if (connectedServers && connectedServers.length > 0) {
    connectedServers.forEach((srv, idx) => {
      const serverNum = idx + 3
      const tools = srv.tools || []
      tree += `\n${serverNum}. 🔌 **${srv.server}** (${tools.length} Tools Available):\n`
      if (tools.length === 0) {
        tree += `   └── (Connected, waiting for tool discovery)\n`
      } else {
        tools.forEach((t) => {
          const toolName = typeof t === 'string' ? t : t.name
          const toolDesc = typeof t === 'string' ? 'Execute action via MCP' : t.description || 'Live MCP tool'
          const toolParams = t.parameters || t.inputSchema?.properties
          const paramStr = toolParams ? ` [args: ${Object.keys(toolParams).join(', ')}]` : ''
          tree += `   ├── \`${toolName}\`${paramStr}: ${toolDesc}\n`
        })
      }
    })
  } else {
    // Default fallback display for TickTick & 800 Academy
    tree += `
3. ⚡ **TickTick MCP:**
   ├── \`create_task\` [title, projectName, dueDate]: إنشاء وجدولة مهمة حقيقية في حساب المستخدم على TickTick.
   ├── \`update_task\` [taskId, title, dueDate, status]: تعديل أو إنجاز مهمة في TickTick.
   ├── \`search_task\` [query]: البحث عن المهام بالكلمات المفتاحية واسترجاع المعرفات.
   ├── \`get_task_by_id\` [taskId]: جلب التفاصيل الكاملة لمهمة محددة.
   └── \`list_projects\`: استعراض كافة المجلدات والمشاريع والقوائم المسجلة.

4. 🎓 **800 Academy MCP:**
   ├── \`read_blogs\`: استعراض وقراءة المقالات والمدونات المنشورة في منصة 800 Academy مع المعرفات والحالة.
   ├── \`search_blogs\` [query]: البحث المتقدم في المقالات بالكلمات المفتاحية والتصنيفات.
   ├── \`read_exams\`: استعراض الامتحانات والاختبارات وتفاصيل الأسئلة والدرجات.
   ├── \`read_subjects\`: قراءة المواد والمسارات الدراسية (Math, Literacy, Science, etc.).
   ├── \`read_offers\`: استعراض باقات الاشتراك والأسعار المتاحة لكل مادة.
   └── \`update_offer\` [id, price_cents]: تعديل أسعار وباقات المنصة وتحديثها في قاعدة البيانات مباشرة.
`
  }

  tree += `
---
### 🛠️ How Every Agent Uses Any Tool:
Whenever an agent needs to use any tool from the Actions tree above to read or write data, output this exact block:
:::mcp-tool-call
{
  "server": "Server Name",
  "tool": "tool_name",
  "arguments": {
    "arg1": "value1"
  }
}
:::
The system intercepts this block automatically, executes the live tool, and returns the real data to the agent.`

  return tree
}
