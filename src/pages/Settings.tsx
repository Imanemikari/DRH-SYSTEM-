import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Settings as SettingsType } from '../types';
import { useLang } from '../context/LangContext';
import { Settings as SettingsIcon, Save, Building2, Printer, Key, Bot, Lock, Send } from 'lucide-react';
import { AI_PROVIDERS, aiProviderById } from '../utils/aiProviders';
import { makeSeal, sealFooterHtml } from '../utils/docSeal';
import { sha256Hex, makeSalt } from '../utils/accessCode';

interface SettingsProps { navigateTo: (page: string, id?: number) => void; }

export default function Settings({ navigateTo }: SettingsProps) {
  const { t, lang } = useLang();
  const [settings, setSettings] = useState<SettingsType>({ company_name: '', company_address: '', company_phone: '', company_email: '' });
  const [saved, setSaved] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [curCode, setCurCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [cfCode, setCfCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const [codeOk, setCodeOk] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [tgMsg, setTgMsg] = useState('');
  const [tgOk, setTgOk] = useState(false);
  const [aiProvider, setAiProvider] = useState('pollinations');
  const [aiModel, setAiModel] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const data = await api.getSettings();
    setSettings(data);
    const savedKey = data?.ai_api_key || localStorage.getItem('drh_ai_key') || '';
    setAiKey(savedKey);
    const savedProv = data?.ai_api_provider || localStorage.getItem('drh_ai_provider') || 'pollinations';
    setAiProvider(savedProv);
    const savedModel = data?.ai_api_model || localStorage.getItem('drh_ai_model') || '';
    setAiModel(savedModel);
    setTgToken(data?.telegram_bot_token || '');
    setTgChat(data?.telegram_chat_id || '');
  };

  const persistAiLocal = (key: string, prov: string, model: string) => {
    if (key) localStorage.setItem('drh_ai_key', key);
    else localStorage.removeItem('drh_ai_key');
    localStorage.setItem('drh_ai_provider', prov);
    if (model) localStorage.setItem('drh_ai_model', model);
    else localStorage.removeItem('drh_ai_model');
  };

  const handleSave = async () => {
    await api.updateSettings({ ...settings, ai_api_key: aiKey, ai_api_provider: aiProvider, ai_api_model: aiModel });
    persistAiLocal(aiKey, aiProvider, aiModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePrintTest = () => {
    const content = `
      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1e40af;padding-bottom:15px">
        <div style="font-size:24px;font-weight:bold;color:#1e40af">${settings.company_name || t('printTestPage')}</div>
        <div style="color:#666;font-size:12px">${t('printDate')}: ${new Date().toLocaleDateString('fr-TN')}</div>
      </div>
      <p style="margin:8px 0;font-size:14px"><strong>${t('setCompanyAddress')}:</strong> ${settings.company_address || '-'}</p>
      <p style="margin:8px 0;font-size:14px"><strong>${t('setCompanyPhone')}:</strong> ${settings.company_phone || '-'}</p>
      <p style="margin:8px 0;font-size:14px"><strong>${t('setCompanyEmail')}:</strong> ${settings.company_email || '-'}</p>
      <p style="margin:20px 0;font-size:14px;color:#059669">${t('printPrintSuccess')}</p>
      ${sealFooterHtml(makeSeal({ title: String(t('printTestPage')), rows: [[String(t('setCompanyName')), settings.company_name || '-'], [String(t('setCompanyAddress')), settings.company_address || '-'], [String(t('setCompanyPhone')), settings.company_phone || '-'], [String(t('setCompanyEmail')), settings.company_email || '-']] }))}`;
    const w = window.open('', '_blank', 'width=800,height=500');
    if (w) { w.document.write(`<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;padding:20px">${content}</body></html>`); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{t('setTitle')}</h1>
            <p className="page-h1-sub">{t('setSubtitle')}</p>
          </div>
        </div>
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-4 h-4" /> {t('setSave')}
          {saved && <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{t('setSaved')}</span>}
        </button>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div><h2 className="text-base font-semibold text-surface-800">{t('setCompany')}</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className="label-field">{t('setCompanyName')}</label><input value={settings.company_name} onChange={(e) => setSettings({...settings, company_name: e.target.value})} className="input-field" /></div>
          <div><label className="label-field">{t('setCompanyEmail')}</label><input type="email" value={settings.company_email} onChange={(e) => setSettings({...settings, company_email: e.target.value})} className="input-field" /></div>
          <div><label className="label-field">{t('setCompanyPhone')}</label><input value={settings.company_phone} onChange={(e) => setSettings({...settings, company_phone: e.target.value})} className="input-field" /></div>
          <div><label className="label-field">{t('setCompanyAddress')}</label><input value={settings.company_address} onChange={(e) => setSettings({...settings, company_address: e.target.value})} className="input-field" /></div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><SettingsIcon className="w-4 h-4 text-white" /></div><h2 className="text-base font-semibold text-surface-800">{t('setSystem')}</h2></div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:!bg-slate-700/50 rounded-xl">
            <div><p className="text-sm font-medium text-surface-700">{t('setPrintTest')}</p><p className="text-xs text-surface-400">{t('setPrintTestHint')}</p></div>
            <button onClick={handlePrintTest} className="btn-secondary"><Printer className="w-4 h-4" /> {t('setPrintTest')}</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:!bg-slate-700/50 rounded-xl">
            <div><p className="text-sm font-medium text-surface-700">{t('setVersion')}</p><p className="text-xs text-surface-400">{t('setVersionVal')}</p></div>
            <span className="badge badge-success">{t('setLatest')}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:!bg-slate-700/50 rounded-xl">
            <div><p className="text-sm font-medium text-surface-700">{t('setDatabase')}</p><p className="text-xs text-surface-400">{t('setDatabaseVal')}</p></div>
            <span className="badge badge-success">{t('setConnected')}</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20"><Bot className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-surface-800 dark:!text-slate-100">AI</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-b from-[#ffe066] to-[#f5a623] text-[#14305a] shadow">{aiProviderById(aiProvider).name}</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-surface-700">{lang === 'ar' ? 'مفتاح API الخاص بك' : 'Votre clé API'}</p>
              <p className="text-xs text-surface-400 mt-0.5">{lang === 'ar' ? 'اختر المزود وأدخل مفتاحك المدفوع للمساعد الذكي' : 'Choisissez le fournisseur et entrez votre clé payante'}</p>
            </div>
          </div>
          <div>
            <label className="label-field">{lang === 'ar' ? 'مزود الذكاء الاصطناعي' : 'Fournisseur IA'}</label>
            <div className="flex gap-2 flex-wrap">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAiProvider(p.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${aiProvider === p.id ? 'bg-gradient-to-b from-[#ffe066] to-[#f5a623] text-[#14305a] border-amber-400 shadow' : 'bg-white text-surface-600 border-slate-200 hover:bg-slate-50 dark:!bg-slate-800 dark:!text-slate-300 dark:!border-slate-600'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="label-field">API Key ({aiProviderById(aiProvider).name})</label>
              <input
                type="password"
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder="sk-..."
                className="input-field font-mono"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="label-field">{lang === 'ar' ? 'الموديل (اختياري)' : 'Modèle (optionnel)'}</label>
              <input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder={aiProviderById(aiProvider).model}
                className="input-field font-mono"
              />
            </div>
            <div className="pb-0.5">
              <button onClick={() => { persistAiLocal(aiKey, aiProvider, aiModel); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="btn-secondary">
                <Key className="w-4 h-4" /> {lang === 'ar' ? 'حفظ' : 'Sauvegarder'}
              </button>
            </div>
          </div>
          <div className="bg-slate-50 dark:!bg-slate-700/50 rounded-xl p-4 text-sm text-surface-500">
            <p>{lang === 'ar' ? 'احصل على مفتاح API من' : 'Obtenez votre clé API sur'} <a href={aiProviderById(aiProvider).url} target="_blank" rel="noopener" className="font-medium text-[#1e40af] dark:!text-amber-400 hover:underline">{aiProviderById(aiProvider).url.replace('https://', '')}</a></p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><Lock className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-surface-800 dark:!text-slate-100">{t('lockChange')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="label-field">{t('lockCurrent')}</label><input type="password" value={curCode} onChange={(e) => setCurCode(e.target.value)} dir="ltr" autoComplete="current-password" className="input-field font-mono text-center" /></div>
          <div><label className="label-field">{t('lockNewCode')}</label><input type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} dir="ltr" autoComplete="new-password" className="input-field font-mono text-center" /></div>
          <div><label className="label-field">{t('lockConfirmCode')}</label><input type="password" value={cfCode} onChange={(e) => setCfCode(e.target.value)} dir="ltr" autoComplete="new-password" className="input-field font-mono text-center" /></div>
        </div>
        {codeMsg && <p className={`mt-3 text-xs font-semibold text-center ${codeOk ? 'text-emerald-600 dark:!text-emerald-400' : 'text-red-600 dark:!text-red-400'}`}>{codeMsg}</p>}
        <div className="mt-4 flex justify-end">
          <button onClick={async () => {
            setCodeOk(false);
            if (newCode.length < 4) { setCodeMsg(String(t('lockTooShort'))); return; }
            if (newCode !== cfCode) { setCodeMsg(String(t('lockMismatch'))); return; }
            try {
              const s: any = await api.getSettings();
              const h = await sha256Hex((s?.access_code_salt || '') + '::' + curCode);
              if (!s?.access_code_hash || s.access_code_hash !== h) { setCodeMsg(String(t('lockError'))); return; }
              const ns = makeSalt();
              const nh = await sha256Hex(ns + '::' + newCode);
              await api.updateSettings({ access_code_hash: nh, access_code_salt: ns, access_failed_count: '0', access_locked_until: '' });
              setCurCode(''); setNewCode(''); setCfCode('');
              setCodeOk(true); setCodeMsg(String(t('lockChanged')));
            } catch { setCodeMsg(String(t('lockError'))); }
          }} className="btn-secondary"><Key className="w-4 h-4" /> {t('lockChange')}</button>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center"><Send className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-surface-800 dark:!text-slate-100">{lang === 'ar' ? 'تنبيهات تيليجرام' : 'Alertes Telegram'}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label-field">Bot Token</label><input type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value.trim())} dir="ltr" autoComplete="off" placeholder="123456:ABC..." className="input-field font-mono" /></div>
          <div><label className="label-field">Chat ID</label><input value={tgChat} onChange={(e) => setTgChat(e.target.value.trim())} dir="ltr" autoComplete="off" placeholder="1645692482" className="input-field font-mono" /></div>
        </div>
        {tgMsg && <p className={`mt-3 text-xs font-semibold text-center ${tgOk ? 'text-emerald-600 dark:!text-emerald-400' : 'text-red-600 dark:!text-red-400'}`}>{tgMsg}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={async () => {
            setTgOk(false);
            try {
              await api.updateSettings({ telegram_bot_token: tgToken, telegram_chat_id: tgChat });
              const r: any = await api.sendTelegram('DRH System : test Telegram OK');
              if (r && r.success) { setTgOk(true); setTgMsg(lang === 'ar' ? 'تم الإرسال بنجاح' : 'Envoyé avec succès'); }
              else setTgMsg(String((r && r.error) || 'Erreur'));
            } catch { setTgMsg('Erreur'); }
          }} className="btn-secondary"><Send className="w-4 h-4" /> {lang === 'ar' ? 'حفظ واختبار' : 'Sauver + tester'}</button>
        </div>
      </div>
    </div>
  );
}
