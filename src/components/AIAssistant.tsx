import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { X, Send, Trash2, Bot, User, Key, Check } from 'lucide-react';
import { AI_PROVIDERS, aiProviderById } from '../utils/aiProviders';

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: { tool: string; ok: boolean }[];
}

export default function AIAssistant({ open, onClose }: AIAssistantProps) {
  const { t, lang, dir } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState(() => { try { return localStorage.getItem('drh_ai_provider') || 'pollinations'; } catch { return 'pollinations'; } });
  const [aiModel, setAiModel] = useState(() => { try { return localStorage.getItem('drh_ai_model') || ''; } catch { return ''; } });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('drh_ai_key') || '';
    setApiKey(saved);
    const storedProv = localStorage.getItem('drh_ai_provider') || 'pollinations';
    if (!saved) {
      api.getSettings().then((s: any) => {
        const dbKey = s?.ai_api_key || '';
        if (dbKey) {
          setApiKey(dbKey);
          localStorage.setItem('drh_ai_key', dbKey);
        }
        const dbProv = s?.ai_api_provider || storedProv;
        setAiProvider(dbProv);
        const dbModel = s?.ai_api_model || localStorage.getItem('drh_ai_model') || '';
        setAiModel(dbModel);
        if (!dbKey && !aiProviderById(dbProv).free) {
          setShowKeyInput(true);
        }
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const systemPrompt = lang === 'ar'
    ? 'أنت مساعد ذكي لإدارة الموارد البشرية في نظام DRH. أجب بالعربية. يجب أن تكون مختصراً ومفيداً. يمكنك مساعدة المستخدم في إدارة الموظفين، الحضور والغياب، الإجازات، الرواتب، وأي استفسارات م HR.'
    : 'You are an AI assistant for the HR Management System DRH. Answer in French. Be concise and helpful. You can help with employee management, attendance, leaves, payroll, and any HR-related questions.';
  const agentRules = lang === 'ar'
    ? 'أنت وكيل مستقل في برنامج DRH: يمكنك تنفيذ إجراءات عبر الأدوات (الاطلاع، التوظيف، التعديل، الحضور، العطل، الوظائف). استعملها عند طلب إجراء أو معلومة. إن نقصت معلومة ضرورية (الاسم، التواريخ...) اسأل عنها قبل التنفيذ. بعد كل إجراء أكد النتيجة بوضوح.'
    : 'Tu es un agent autonome du logiciel DRH : tu peux agir via des outils (consulter, embaucher, modifier, presence, conges, fonctions). Utilise-les des que l\'utilisateur demande une action ou une info. Si une info obligatoire manque (nom, dates...), demande-la avant d\'agir. Apres chaque action, confirme clairement le resultat.';

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const needKey = !aiProviderById(aiProvider).free;
    if (needKey && !apiKey) { setShowKeyInput(true); return; }

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const liveCtx = await buildLiveContext();
    const apiMessages = [
      { role: 'system', content: systemPrompt + '\n' + agentRules + (liveCtx ? '\n\n=== DONNEES REELLES DE L\'ENTREPRISE (base DRH, a jour) — base tes reponses sur ces donnees pour toute question sur l\'entreprise ===\n' + liveCtx : '') },
      ...newMessages.slice(-20),
    ];

    const result = await api.chatAI(apiMessages, apiKey, aiProvider, aiModel || undefined, true);
    setLoading(false);

    if (result.success) {
      setMessages([...newMessages, { role: 'assistant', content: result.content, actions: result.actions || [] }]);
    } else {
      const err = String(result.error || 'Unknown');
      const hint = /401/.test(err) ? (lang === 'ar' ? ' — مفتاح API غير صالح، تحقق من المفتاح والمزود' : ' — clé API invalide, vérifiez la clé et le fournisseur') : '';
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err}${hint}` }]);
    }
  };

  const buildLiveContext = async (): Promise<string> => {
    try {
      const [stats, emps, expiring, leaves] = await Promise.all([
        api.getStats(), api.getEmployees(), api.getContractsExpiring(), api.getLeaves(),
      ]);
      const L: string[] = [];
      const s: any = stats || {};
      L.push(`Effectif total: ${s.totalEmployees ?? '?'} (actifs: ${s.activeEmployees ?? '?'})`);
      L.push(`Fonctions: ${s.totalDepartments ?? '?'} | Conges en attente: ${s.pendingLeaves ?? '?'} | Contrats expirant (15j): ${s.expiringContracts ?? '?'}`);
      const list: any[] = Array.isArray(emps) ? emps : [];
      L.push(`Employes (${list.length}):`);
      list.slice(0, 120).forEach((e: any) => {
        L.push(`- ${e.matricule || ''} | ${e.last_name || ''} ${e.first_name || ''} | ${e.position || '-'} | ${e.department_name || '-'} | ${e.contract_type || ''} | ${e.status || ''}`);
      });
      if (list.length > 120) L.push(`... et ${list.length - 120} autres.`);
      const depts: any[] = Array.isArray(s.departmentStats) ? s.departmentStats : [];
      if (depts.length) L.push('Par fonction: ' + depts.map((d: any) => `${d.name}(${d.count})`).join(', '));
      const exp: any[] = Array.isArray(expiring) ? expiring : [];
      if (exp.length) L.push('Contrats bientot expires: ' + exp.slice(0, 20).map((x: any) => `${x.last_name} ${x.first_name} (${x.end_date})`).join(', '));
      const lv: any[] = Array.isArray(leaves) ? leaves.filter((l: any) => l.status === 'pending') : [];
      if (lv.length) L.push('Conges en attente: ' + lv.slice(0, 20).map((l: any) => `${l.last_name} ${l.first_name} (${l.start_date || l.from || ''} -> ${l.end_date || l.to || ''})`).join(', '));
      return L.join('\n');
    } catch {
      return '';
    }
  };

  const saveApiKey = () => {
    localStorage.setItem('drh_ai_key', apiKey);
    localStorage.setItem('drh_ai_provider', aiProvider);
    if (aiModel) localStorage.setItem('drh_ai_model', aiModel);
    else localStorage.removeItem('drh_ai_model');
    setShowKeyInput(false);
  };

  const testConnection = async () => {
    if (testing) return;
    const needKey = !aiProviderById(aiProvider).free;
    if (needKey && !apiKey.trim()) return;
    setTesting(true);
    setTestMsg('');
    try {
      const res = await api.chatAI(
        [{ role: 'user', content: 'Reply with the single word OK' }],
        apiKey.trim(), aiProvider, aiModel || undefined
      );
      if (res && res.success) setTestMsg('OK');
      else setTestMsg('ERR:' + String((res && res.error) || 'Unknown'));
    } catch (e) {
      setTestMsg('ERR:' + String((e as any)?.message || e));
    }
    setTesting(false);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl h-[85vh] flex flex-col animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
        style={{ direction: dir }}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-100 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-800">AI</h2>
              <p className="text-xs text-surface-400">{aiProviderById(aiProvider).name} • {lang === 'ar' ? 'مساعد الموارد البشرية' : 'Assistant RH'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowKeyInput(true)} className="p-2 hover:bg-surface-100 rounded-lg text-surface-400 hover:text-[#14305a] transition-all" title={aiProviderById(aiProvider).name}>
              <Key className="w-4 h-4" />
            </button>
            <button onClick={() => setMessages([])} className="p-2 hover:bg-surface-100 rounded-lg text-surface-400 hover:text-red-500 transition-all" title={lang === 'ar' ? 'مسح' : 'Clear'}>
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-lg text-surface-400 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showKeyInput ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-surface-800">{lang === 'ar' ? 'أدخل مفتاح API' : 'Entrez votre clé API'}</h3>
              <div className="flex gap-2 justify-center flex-wrap">
                {AI_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setAiProvider(p.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${aiProvider === p.id ? 'bg-gradient-to-b from-[#ffe066] to-[#f5a623] text-[#14305a] border-amber-400 shadow' : 'bg-white text-surface-500 border-slate-200 hover:bg-slate-50 dark:!bg-slate-800 dark:!text-slate-300 dark:!border-slate-600'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="text-sm text-surface-500">
                {aiProviderById(aiProvider).free
                  ? (lang === 'ar' ? 'يعمل مباشرة بدون مفتاح' : 'Fonctionne sans clé')
                  : (<>{lang === 'ar' ? `أدخل مفتاح ${aiProviderById(aiProvider).name} API للبدء` : `Entrez votre clé API ${aiProviderById(aiProvider).name} pour commencer`}{' '}
                <a href={aiProviderById(aiProvider).url} target="_blank" rel="noopener" className="text-[#1e40af] dark:!text-amber-400 hover:underline font-medium">{aiProviderById(aiProvider).url.replace('https://', '')}</a></>)}
              </p>
              {!aiProviderById(aiProvider).free && (
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="input-field text-center font-mono"
                />
              )}
              <input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder={`${lang === 'ar' ? 'الموديل (افتراضي' : 'Modèle (défaut'}: ${aiProviderById(aiProvider).model})`}
                className="input-field text-center font-mono"
              />
              <button onClick={saveApiKey} className="btn-primary w-full justify-center">
                {lang === 'ar' ? 'حفظ والبدء' : 'Enregistrer'}
              </button>
              <button onClick={testConnection} disabled={testing || (!aiProviderById(aiProvider).free && !apiKey.trim())} className="btn-secondary w-full justify-center disabled:opacity-50">
                {testing ? '...' : (lang === 'ar' ? 'اختبار الاتصال' : 'Tester la connexion')}
              </button>
              {testMsg === 'OK' && (
                <p className="text-sm font-semibold text-emerald-600 dark:!text-emerald-400">{lang === 'ar' ? 'الاتصال يعمل بنجاح' : 'Connexion réussie'}</p>
              )}
              {testMsg.startsWith('ERR:') && (
                <p className="text-xs font-medium text-red-600 dark:!text-red-400 break-all" dir="ltr">{testMsg.slice(4)}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-surface-800 mb-2">
                    {lang === 'ar' ? 'مرحباً! أنا مساعدك الذكي' : 'Bonjour ! Je suis votre assistant IA'}
                  </h3>
                  <p className="text-sm text-surface-400 max-w-sm mx-auto">
                    {lang === 'ar' ? 'اسألني أي شيء عن إدارة الموارد البشرية' : 'Posez-moi des questions sur la gestion des RH'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      lang === 'ar' ? 'عدد الموظفين' : 'Nombre d\'employés',
                      lang === 'ar' ? 'تقرير الرواتب' : 'Rapport de paie',
                      lang === 'ar' ? 'نصائح إدارية' : 'Conseils RH',
                    ].map((s, i) => (
                      <button key={i} onClick={() => setInput(s)} className="px-3 py-1.5 bg-white hover:bg-[#f3f6fc] text-sm text-surface-600 hover:text-[#14305a] rounded-full transition-all border border-slate-200 hover:border-[#14305a]/30 dark:!bg-slate-800 dark:!text-slate-300 dark:hover:!text-amber-300 dark:!border-slate-600">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#14305a] to-[#20487c] text-white rounded-br-sm'
                      : 'bg-white text-surface-800 border border-slate-200 shadow-sm rounded-bl-sm dark:!bg-slate-800 dark:!text-slate-100 dark:!border-slate-600'
                  }`}>
                    {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.actions.map((a, j) => (
                          <span key={j} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${a.ok ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:!bg-emerald-500/10 dark:!text-emerald-300 dark:!border-emerald-500/30' : 'bg-red-50 text-red-600 border-red-200 dark:!bg-red-500/10 dark:!text-red-300 dark:!border-red-500/30'}`}>
                            {a.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {a.tool}
                          </span>
                        ))}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-surface-500" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-sm border border-slate-200 shadow-sm dark:!bg-slate-800 dark:!border-slate-600">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-surface-100">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={lang === 'ar' ? 'اكتب سؤالك...' : 'Tapez votre message...'}
                  className="input-field flex-1"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
