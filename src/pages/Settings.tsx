import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Settings as SettingsType } from '../types';
import { useLang } from '../context/LangContext';
import { Settings as SettingsIcon, Save, Building2, Printer, Key } from 'lucide-react';

interface SettingsProps { navigateTo: (page: string, id?: number) => void; }

export default function Settings({ navigateTo }: SettingsProps) {
  const { t, lang } = useLang();
  const [settings, setSettings] = useState<SettingsType>({ company_name: '', company_address: '', company_phone: '', company_email: '' });
  const [saved, setSaved] = useState(false);
  const [aiKey, setAiKey] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const data = await api.getSettings();
    setSettings(data);
    const savedKey = data?.ai_api_key || localStorage.getItem('drh_ai_key') || '';
    setAiKey(savedKey);
  };

  const handleSave = async () => {
    await api.updateSettings({ ...settings, ai_api_key: aiKey });
    if (aiKey) localStorage.setItem('drh_ai_key', aiKey);
    else localStorage.removeItem('drh_ai_key');
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
      <p style="margin:20px 0;font-size:14px;color:#059669">${t('printPrintSuccess')}</p>`;
    const w = window.open('', '_blank', 'width=800,height=500');
    if (w) { w.document.write(`<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;padding:20px">${content}</body></html>`); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-800">{t('setTitle')}</h1><p className="text-sm text-surface-500 mt-1">{t('setSubtitle')}</p></div>
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-4 h-4" /> {t('setSave')}
          {saved && <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{t('setSaved')}</span>}
        </button>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6"><Building2 className="w-5 h-5 text-primary-500" /><h2 className="text-base font-semibold text-surface-800">{t('setCompany')}</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className="label-field">{t('setCompanyName')}</label><input value={settings.company_name} onChange={(e) => setSettings({...settings, company_name: e.target.value})} className="input-field" /></div>
          <div><label className="label-field">{t('setCompanyEmail')}</label><input type="email" value={settings.company_email} onChange={(e) => setSettings({...settings, company_email: e.target.value})} className="input-field" /></div>
          <div><label className="label-field">{t('setCompanyPhone')}</label><input value={settings.company_phone} onChange={(e) => setSettings({...settings, company_phone: e.target.value})} className="input-field" /></div>
          <div><label className="label-field">{t('setCompanyAddress')}</label><input value={settings.company_address} onChange={(e) => setSettings({...settings, company_address: e.target.value})} className="input-field" /></div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6"><SettingsIcon className="w-5 h-5 text-primary-500" /><h2 className="text-base font-semibold text-surface-800">{t('setSystem')}</h2></div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl">
            <div><p className="text-sm font-medium text-surface-700">{t('setPrintTest')}</p><p className="text-xs text-surface-400">{t('setPrintTestHint')}</p></div>
            <button onClick={handlePrintTest} className="btn-secondary"><Printer className="w-4 h-4" /> {t('setPrintTest')}</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl">
            <div><p className="text-sm font-medium text-surface-700">{t('setVersion')}</p><p className="text-xs text-surface-400">{t('setVersionVal')}</p></div>
            <span className="badge badge-success">{t('setLatest')}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl">
            <div><p className="text-sm font-medium text-surface-700">{t('setDatabase')}</p><p className="text-xs text-surface-400">{t('setDatabaseVal')}</p></div>
            <span className="badge badge-success">{t('setConnected')}</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"><span className="text-white text-[10px] font-bold">AI</span></div>
          <h2 className="text-base font-semibold text-surface-800">DeepSeek AI</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-surface-700">{lang === 'ar' ? 'مفتاح DeepSeek API' : 'Clé API DeepSeek'}</p>
              <p className="text-xs text-surface-400 mt-0.5">{lang === 'ar' ? 'أدخل مفتاح API للمساعد الذكي' : 'Entrez votre clé API pour l\'assistant IA'}</p>
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label-field">API Key</label>
              <input
                type="password"
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder="sk-..."
                className="input-field font-mono"
              />
            </div>
            <div className="pb-0.5">
              <button onClick={() => { if (aiKey) localStorage.setItem('drh_ai_key', aiKey); else localStorage.removeItem('drh_ai_key'); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="btn-secondary">
                <Key className="w-4 h-4" /> {lang === 'ar' ? 'حفظ' : 'Sauvegarder'}
              </button>
            </div>
          </div>
          <div className="bg-surface-50 rounded-xl p-4 text-sm text-surface-500">
            <p>{lang === 'ar' ? 'احصل على مفتاح API من' : 'Obtenez votre clé API sur'} <a href="https://platform.deepseek.com" target="_blank" rel="noopener" className="text-primary-500 hover:underline">platform.deepseek.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
