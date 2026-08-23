import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { X, Send, Sparkles, Trash2, Bot, User } from 'lucide-react';

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant({ open, onClose }: AIAssistantProps) {
  const { t, lang, dir } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('drh_ai_key') || '';
    setApiKey(saved);
    if (!saved) {
      api.getSettings().then((s: any) => {
        const dbKey = s?.ai_api_key || '';
        if (dbKey) {
          setApiKey(dbKey);
          localStorage.setItem('drh_ai_key', dbKey);
        } else {
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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!apiKey) { setShowKeyInput(true); return; }

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...newMessages.slice(-20),
    ];

    const result = await api.chatAI(apiMessages, apiKey);
    setLoading(false);

    if (result.success) {
      setMessages([...newMessages, { role: 'assistant', content: result.content }]);
    } else {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${result.error}` }]);
    }
  };

  const saveApiKey = () => {
    localStorage.setItem('drh_ai_key', apiKey);
    setShowKeyInput(false);
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
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-800">DeepSeek AI</h2>
              <p className="text-xs text-surface-400">{lang === 'ar' ? 'مساعد الموارد البشرية' : 'Assistant RH'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-surface-800">{lang === 'ar' ? 'أدخل مفتاح API' : 'Entrez votre clé API'}</h3>
              <p className="text-sm text-surface-500">{lang === 'ar' ? 'أدخل مفتاح DeepSeek API للبدء' : 'Entrez votre clé API DeepSeek pour commencer'}</p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="input-field text-center font-mono"
              />
              <button onClick={saveApiKey} className="btn-primary w-full justify-center">
                {lang === 'ar' ? 'حفظ والبدء' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                    <Sparkles className="w-8 h-8 text-white" />
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
                      <button key={i} onClick={() => setInput(s)} className="px-3 py-1.5 bg-surface-50 hover:bg-primary-50 text-sm text-surface-600 hover:text-primary-600 rounded-full transition-all border border-surface-100 hover:border-primary-200">
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
                      ? 'bg-primary-500 text-white rounded-br-sm'
                      : 'bg-surface-50 text-surface-800 border border-surface-100 rounded-bl-sm'
                  }`}>
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
                  <div className="px-4 py-3 bg-surface-50 rounded-2xl rounded-bl-sm border border-surface-100">
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
