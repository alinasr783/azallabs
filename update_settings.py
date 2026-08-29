import re

file_path = r"c:\Users\UK\Desktop\dev\AzalLabs\src\pages\SettingsPage.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We need to split just before `  return (` which is around line 367.
match = re.search(r'([\s\S]*?)(\s+return \([\s\S]*?)(?=\s*\}\s*)$', content)
if not match:
    print("Could not find return statement")
    exit(1)

before = match.group(1)

new_jsx = """
  return (
    <div
      className="min-h-screen bg-[#0d0e11] text-[#f3f3ee]"
      dir="rtl"
      style={{ fontFamily: "'Comic Relief', 'Amiri', system-ui, serif" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0d0e11] border-b border-[#2c2e3a] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-[#9da0a8] hover:text-[#f3f3ee] transition-colors cursor-pointer text-sm font-medium"
            title="العودة إلى المحادثة"
          >
            ← عودة
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-[#f3f3ee]">
              Azal Labs
            </h1>
            <span className="text-[#6b6e79]">/</span>
            <span className="text-sm text-[#cc785c]">الإعدادات</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 border-b border-[#2c2e3a] bg-[#0d0e11] flex gap-6 overflow-x-auto">
        <button
          onClick={() => handleTabChange('llm')}
          className={`py-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'llm'
              ? 'text-[#cc785c] border-b-2 border-[#cc785c]'
              : 'text-[#9da0a8] hover:text-[#f3f3ee]'
          }`}
        >
          النماذج (LLM)
        </button>
        <button
          onClick={() => handleTabChange('system-prompt')}
          className={`py-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'system-prompt'
              ? 'text-[#cc785c] border-b-2 border-[#cc785c]'
              : 'text-[#9da0a8] hover:text-[#f3f3ee]'
          }`}
        >
          التعليمات التوجيهية
        </button>
        <button
          onClick={() => handleTabChange('memory')}
          className={`py-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'memory'
              ? 'text-[#cc785c] border-b-2 border-[#cc785c]'
              : 'text-[#9da0a8] hover:text-[#f3f3ee]'
          }`}
        >
          الذاكرة الدائمة
        </button>
        <button
          onClick={() => handleTabChange('mcp')}
          className={`py-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'mcp'
              ? 'text-[#cc785c] border-b-2 border-[#cc785c]'
              : 'text-[#9da0a8] hover:text-[#f3f3ee]'
          }`}
        >
          خوادم الربط (MCP)
        </button>
      </div>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* ==================== TAB 1: LLM ==================== */}
        {activeTab === 'llm' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#f3f3ee]">❯ تكوين نماذج الذكاء الاصطناعي (LLM)</h2>
              <p className="text-xs text-[#9da0a8] mt-1">إعداد مفاتيح الاتصال (API Keys) واختيار النموذج المناسب.</p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {/* Gemini */}
              <div className={`p-5 rounded-lg border transition-all ${
                llmConfig.activeProvider === 'gemini' ? 'border-[#cc785c] bg-[#1a1b22]' : 'border-[#2c2e3a] bg-[#14151a]'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#f3f3ee]">Google Gemini</h3>
                    <p className="text-xs text-[#6b6e79]">نماذج متعددة الوسائط متطورة وفائقة السرعة في الاستنتاج</p>
                  </div>
                  {llmConfig.activeProvider === 'gemini' ? (
                    <span className="text-xs text-[#cc785c] font-bold">[ نشط ]</span>
                  ) : (
                    <button onClick={() => setActiveProvider('gemini')} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">[ تفعيل ]</button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">مفتاح (API Key)</label>
                    <input
                      type="password"
                      value={llmConfig.gemini.apiKey}
                      onChange={(e) => updateProviderSettings('gemini', { apiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">اسم النموذج</label>
                    <input
                      type="text"
                      value={llmConfig.gemini.model}
                      onChange={(e) => updateProviderSettings('gemini', { model: e.target.value })}
                      placeholder="e.g. gemini-3.5-flash"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none mb-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      {GEMINI_MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateProviderSettings('gemini', { model: m.id })}
                          className={`text-xs px-2 py-1 transition-colors ${
                            llmConfig.gemini.model === m.id ? 'bg-[#f3f3ee] text-[#0d0e11]' : 'text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                        >
                          [ {m.name} ]
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* OpenAI */}
              <div className={`p-5 rounded-lg border transition-all ${
                llmConfig.activeProvider === 'openai' ? 'border-[#cc785c] bg-[#1a1b22]' : 'border-[#2c2e3a] bg-[#14151a]'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#f3f3ee]">OpenAI / ChatGPT</h3>
                    <p className="text-xs text-[#6b6e79]">نماذج (GPT-4o) ونماذج التفكير المتقدم</p>
                  </div>
                  {llmConfig.activeProvider === 'openai' ? (
                    <span className="text-xs text-[#cc785c] font-bold">[ نشط ]</span>
                  ) : (
                    <button onClick={() => setActiveProvider('openai')} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">[ تفعيل ]</button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">مفتاح (API Key)</label>
                    <input
                      type="password"
                      value={llmConfig.openai.apiKey}
                      onChange={(e) => updateProviderSettings('openai', { apiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">اسم النموذج</label>
                    <input
                      type="text"
                      value={llmConfig.openai.model}
                      onChange={(e) => updateProviderSettings('openai', { model: e.target.value })}
                      placeholder="e.g. gpt-4o-mini"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none mb-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      {OPENAI_MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateProviderSettings('openai', { model: m.id })}
                          className={`text-xs px-2 py-1 transition-colors ${
                            llmConfig.openai.model === m.id ? 'bg-[#f3f3ee] text-[#0d0e11]' : 'text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                        >
                          [ {m.name} ]
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* DeepSeek */}
              <div className={`p-5 rounded-lg border transition-all ${
                llmConfig.activeProvider === 'deepseek' ? 'border-[#cc785c] bg-[#1a1b22]' : 'border-[#2c2e3a] bg-[#14151a]'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#f3f3ee]">DeepSeek</h3>
                    <p className="text-xs text-[#6b6e79]">نماذج (DeepSeek-V3) و (DeepSeek-R1) للتفكير المعمق</p>
                  </div>
                  {llmConfig.activeProvider === 'deepseek' ? (
                    <span className="text-xs text-[#cc785c] font-bold">[ نشط ]</span>
                  ) : (
                    <button onClick={() => setActiveProvider('deepseek')} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">[ تفعيل ]</button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">مفتاح (API Key)</label>
                    <input
                      type="password"
                      value={llmConfig.deepseek.apiKey}
                      onChange={(e) => updateProviderSettings('deepseek', { apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">اسم النموذج</label>
                    <input
                      type="text"
                      value={llmConfig.deepseek.model}
                      onChange={(e) => updateProviderSettings('deepseek', { model: e.target.value })}
                      placeholder="e.g. deepseek-chat"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none mb-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      {DEEPSEEK_MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateProviderSettings('deepseek', { model: m.id })}
                          className={`text-xs px-2 py-1 transition-colors ${
                            llmConfig.deepseek.model === m.id ? 'bg-[#f3f3ee] text-[#0d0e11]' : 'text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                        >
                          [ {m.name} ]
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom */}
              <div className={`p-5 rounded-lg border transition-all ${
                llmConfig.activeProvider === 'custom' ? 'border-[#cc785c] bg-[#1a1b22]' : 'border-[#2c2e3a] bg-[#14151a]'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#f3f3ee]">خادم مخصص (OpenAI-Compatible)</h3>
                    <p className="text-xs text-[#6b6e79]">Groq, Ollama, vLLM...</p>
                  </div>
                  {llmConfig.activeProvider === 'custom' ? (
                    <span className="text-xs text-[#cc785c] font-bold">[ نشط ]</span>
                  ) : (
                    <button onClick={() => setActiveProvider('custom')} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">[ تفعيل ]</button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">رابط نقطة النهاية (Endpoint)</label>
                    <input
                      type="text"
                      value={llmConfig.custom.endpoint}
                      onChange={(e) => updateProviderSettings('custom', { endpoint: e.target.value })}
                      placeholder="https://api.groq.com/openai/v1/chat/completions"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">مفتاح (API Key)</label>
                    <input
                      type="password"
                      value={llmConfig.custom.apiKey}
                      onChange={(e) => updateProviderSettings('custom', { apiKey: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">اسم النموذج</label>
                    <input
                      type="text"
                      value={llmConfig.custom.model}
                      onChange={(e) => updateProviderSettings('custom', { model: e.target.value })}
                      placeholder="e.g. llama-3.3-70b-versatile"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] outline-none mb-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      {CUSTOM_PRESETS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateProviderSettings('custom', { model: m.id, endpoint: m.endpoint })}
                          className={`text-xs px-2 py-1 transition-colors ${
                            llmConfig.custom.model === m.id ? 'bg-[#f3f3ee] text-[#0d0e11]' : 'text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                        >
                          [ {m.name} ]
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB 2: SYSTEM PROMPT ==================== */}
        {activeTab === 'system-prompt' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#f3f3ee]">❯ التعليمات التوجيهية للنظام</h2>
                <p className="text-xs text-[#9da0a8] mt-1">تحديد القواعد السلوكية، وإرشادات الدقة.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={handleResetSystemPrompt} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">[ استعادة الافتراضي ]</button>
                <button onClick={handleSaveSystemPrompt} disabled={isSavingConfig} className="text-xs text-[#cc785c] hover:text-[#be684e] font-bold">
                  {isSavingConfig ? '[ جاري الحفظ... ]' : '[ حفظ التوجيه ]'}
                </button>
              </div>
            </div>

            {systemPromptMsg && (
              <div className={`p-3 rounded-lg border text-xs ${systemPromptMsg.type === 'success' ? 'border-emerald-800 text-emerald-400' : 'border-red-800 text-red-400'}`}>
                {systemPromptMsg.text}
              </div>
            )}

            <div className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a] space-y-4">
              <h3 className="text-sm font-bold text-[#9da0a8]">قوالب سلوك الوكيل:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SYSTEM_PROMPT_PRESETS.map(preset => {
                  const isSelected = editedSystemPrompt.trim() === preset.prompt.trim();
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setEditedSystemPrompt(preset.prompt)}
                      className={`text-right p-3 rounded-lg border transition-all ${
                        isSelected ? 'border-[#cc785c] text-[#f3f3ee] bg-[#1a1b22]' : 'border-[#2c2e3a] text-[#9da0a8] hover:border-[#6b6e79]'
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">{preset.name} {isSelected && '*'}</div>
                      <div className="text-[10px] text-[#6b6e79]">{preset.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a] space-y-3">
              <div className="flex justify-between items-center text-xs text-[#9da0a8]">
                <span>system_prompt.md</span>
                <button onClick={() => navigator.clipboard.writeText(editedSystemPrompt)} className="hover:text-[#f3f3ee]">[ نسخ ]</button>
              </div>
              <textarea
                value={editedSystemPrompt}
                onChange={(e) => setEditedSystemPrompt(e.target.value)}
                rows={12}
                className="w-full bg-[#0d0e11] border border-[#2c2e3a] rounded-lg p-3 font-mono text-xs text-[#f3f3ee] resize-y outline-none focus:border-[#cc785c]"
              />
            </div>

            <div className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a] space-y-4">
              <h3 className="text-sm font-bold text-[#f3f3ee]">❯ اختبار التوجيه (Terminal Mode)</h3>
              <form onSubmit={handleTestSystemPrompt} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute right-3 top-2 text-[#cc785c] font-bold">❯</span>
                  <input
                    type="text"
                    value={promptTestInput}
                    onChange={(e) => setPromptTestInput(e.target.value)}
                    placeholder="اكتب استفساراً..."
                    className="w-full pr-8 pl-3 py-2 rounded-lg bg-[#0d0e11] border border-[#2c2e3a] text-xs text-[#f3f3ee] outline-none focus:border-[#cc785c]"
                  />
                </div>
                <button type="submit" disabled={!promptTestInput.trim() || isTestingPrompt} className="px-4 py-2 bg-[#cc785c] text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-[#be684e]">
                  {isTestingPrompt ? 'جاري...' : 'إرسال'}
                </button>
              </form>

              {promptTestOutput && (
                <div className="p-4 rounded-lg bg-[#0d0e11] border border-[#2c2e3a] font-mono text-xs text-[#f3f3ee] whitespace-pre-wrap leading-relaxed">
                  {promptTestOutput}
                  {isTestingPrompt && <span className="inline-block w-2 h-4 bg-[#cc785c] mr-1 animate-pulse" />}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== TAB 3: MEMORY ==================== */}
        {activeTab === 'memory' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#f3f3ee]">❯ الذاكرة الدائمة (memory.txt)</h2>
                <p className="text-xs text-[#9da0a8] mt-1">يحتفظ تلقائياً ببياناتك وتفضيلاتك.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={handleDownloadMemory} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">[ تحميل ]</button>
                <button onClick={handleResetMemory} className="text-xs text-red-400 hover:text-red-300">[ مسح ]</button>
                <button onClick={handleSaveMemory} disabled={isSavingMemory} className="text-xs text-[#cc785c] hover:text-[#be684e] font-bold">
                  {isSavingMemory ? '[ جاري الحفظ... ]' : '[ حفظ الذاكرة ]'}
                </button>
              </div>
            </div>

            {memorySavedSuccess && (
              <div className="p-3 rounded-lg border border-emerald-800 text-xs text-emerald-400">
                تم حفظ الذاكرة بنجاح!
              </div>
            )}

            <div className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a]">
              <textarea
                value={editedMemory}
                onChange={(e) => setEditedMemory(e.target.value)}
                rows={18}
                className="w-full bg-[#0d0e11] border border-[#2c2e3a] rounded-lg p-3 font-mono text-xs text-[#f3f3ee] resize-y outline-none focus:border-[#cc785c]"
              />
            </div>
          </section>
        )}

        {/* ==================== TAB 4: MCP ==================== */}
        {activeTab === 'mcp' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#f3f3ee]">❯ خوادم الربط (MCP)</h2>
              <p className="text-xs text-[#9da0a8] mt-1">إدارة أدوات الوكيل والتكامل مع الخدمات.</p>
            </div>

            {/* TickTick */}
            <div className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#f3f3ee]">TickTick Integration</h3>
                  <p className="text-xs text-[#6b6e79]">ربط حساب (TickTick) لإدارة المهام</p>
                </div>
                <div>
                  {isTickTickConnected ? (
                    <div className="flex gap-3 items-center">
                      <span className="text-xs text-emerald-400">[ متصل ]</span>
                      <button onClick={handleTestTickTick} disabled={isCreatingTickTickTask} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">
                        [ إنشاء مهمة اختبار ]
                      </button>
                      <button onClick={handleDisconnectTickTick} className="text-xs text-red-400 hover:text-red-300">
                        [ قطع ]
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleConnectTickTick} className="text-xs text-[#cc785c] hover:text-[#be684e] font-bold">
                      [ ربط الحساب ]
                    </button>
                  )}
                </div>
              </div>
              {tickTickSuccessMsg && (
                <div className="p-3 mt-3 rounded-lg border border-emerald-800 text-xs text-emerald-400">
                  {tickTickSuccessMsg}
                </div>
              )}
            </div>

            {/* Active Servers */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-[#f3f3ee]">الخوادم النشطة ({servers.length})</h3>
                {!servers.some(s => s.name.includes('800 Academy')) && (
                  <button onClick={handleAdd800AcademyPreset} className="text-xs text-[#cc785c] hover:text-[#be684e]">
                    [ + 800 Academy ]
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {servers.map(server => (
                  <div key={server.id} className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-[#f3f3ee]">{server.name}</div>
                        <div className="text-xs text-[#6b6e79] mt-1">{server.url || 'محلي'}</div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setExpandedServerId(expandedServerId === server.id ? null : server.id)} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">
                          {expandedServerId === server.id ? '[ إخفاء الأدوات ]' : '[ عرض الأدوات ]'}
                        </button>
                        {server.url && (
                          <button onClick={() => handleDiscoverTools(server.id)} disabled={discoveringServerId === server.id} className="text-xs text-[#9da0a8] hover:text-[#f3f3ee]">
                            [ تحديث الأدوات ]
                          </button>
                        )}
                        <button onClick={() => disconnectServer(server.id)} className="text-xs text-red-400 hover:text-red-300">
                          [ حذف ]
                        </button>
                      </div>
                    </div>

                    {discoverySuccessMsg?.id === server.id && (
                      <div className="mt-3 p-2 rounded border border-purple-800 text-xs text-purple-400">
                        {discoverySuccessMsg.msg}
                      </div>
                    )}

                    {expandedServerId === server.id && (
                      <div className="mt-4 pt-4 border-t border-[#2c2e3a]">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold text-[#9da0a8]">الأدوات ({server.tools?.length || 0}):</span>
                          <button onClick={() => setAddingToolServerId(server.id)} className="text-xs text-[#cc785c] hover:text-[#be684e]">[ + أداة يدوية ]</button>
                        </div>
                        
                        {addingToolServerId === server.id && (
                          <div className="mb-3 flex gap-2">
                            <input
                              type="text"
                              value={newToolName}
                              onChange={(e) => setNewToolName(e.target.value)}
                              placeholder="اسم الأداة"
                              className="w-1/3 px-3 py-1.5 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] outline-none"
                            />
                            <input
                              type="text"
                              value={newToolDesc}
                              onChange={(e) => setNewToolDesc(e.target.value)}
                              placeholder="الوصف"
                              className="flex-1 px-3 py-1.5 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] outline-none"
                            />
                            <button onClick={() => handleAddNewTool(server.id)} className="px-3 py-1 bg-[#cc785c] text-white text-xs rounded-lg">إضافة</button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {server.tools?.map((tool, idx) => (
                            <div key={idx} className="p-2 border border-[#2c2e3a] bg-[#0d0e11] rounded text-xs">
                              <div className="font-bold text-[#cc785c] mb-1">{tool.name}</div>
                              <div className="text-[#6b6e79] truncate">{tool.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Server */}
            <div className="p-5 rounded-lg border border-[#2c2e3a] bg-[#14151a]">
              <h3 className="text-sm font-bold text-[#f3f3ee] mb-4">إضافة خادم مخصص (Custom MCP)</h3>
              <form onSubmit={handleAddCustomServer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">الاسم</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. My Tools"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9da0a8] mb-1">الرابط (URL) *</label>
                    <input
                      type="url"
                      required
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="http://localhost:3000"
                      className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] outline-none focus:border-[#cc785c]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#9da0a8] mb-1">الرمز (Token)</label>
                  <input
                    type="password"
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={!customUrl.trim() || isAddingCustom} className="px-4 py-2 bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold rounded-lg disabled:opacity-50">
                    {isAddingCustom ? 'جاري الاتصال...' : 'إضافة الخادم'}
                  </button>
                </div>
              </form>
              {customSuccess && (
                <div className="mt-4 p-3 rounded-lg border border-emerald-800 text-xs text-emerald-400">
                  تمت إضافة الخادم بنجاح!
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(before + new_jsx)

print("Update complete")
