import { useMemo, useState } from 'react';
import { X, Send, Mail, Inbox, TestTube2, Settings2, ChevronDown, CheckCircle2, Loader2, MailX } from 'lucide-react';
import { t } from '../utils/translations';
import { api } from '../utils/api';

export default function EmailModal({ prefix, getHtml, getSheets, landscape, onClose, onSent }: {
  prefix: string;
  getHtml: () => string;
  getSheets: () => any[];
  landscape?: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(prefix + ' — ' + new Date().toLocaleDateString());
  const [format, setFormat] = useState('pdf');
  const [showSmtp, setShowSmtp] = useState(false);
  const [smtp, setSmtp] = useState<any>({ host: 'smtp.gmail.com', port: 587, secure: false, user: '', pass: '', from: '' });

  useMemo(async () => {
    const s = await api.getSmtpSettings();
    if (s) setSmtp(s);
  }, []);

  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  const set = (k: string, v: any) => setSmtp((p: any) => ({ ...p, [k]: v }));

  const doTest = async () => {
    setStatus('');
    try {
      await api.sendReportEmail({
        smtp, to: smtp.from || smtp.user || to,
        from: smtp.from || smtp.user, subject: 'Test SMTP — DRH',
        format: 'pdf', prefix: 'TEST_SMTP',
        html: '<p>Ceci est un test de configuration SMTP. Votre compte Gmail/Gmail est prêt.</p>',
        sheets: [], landscape: false,
      });
      setStatus('ok');
    } catch (e) { setStatus('err:' + String((e as any)?.message || e)); }
  };

  const doSend = async () => {
    if (!to || !smtp.user || !smtp.pass) { setStatus('missing'); return; }
    setSending(true); setStatus('');
    try {
      const res = await api.sendReportEmail({
        smtp,
        to,
        from: smtp.from || smtp.user,
        subject: subject || prefix,
        format,
        prefix,
        html: format !== 'xlsx' ? getHtml() : '',
        sheets: format === 'xlsx' ? getSheets() : [],
        landscape: !!landscape,
      });
      if (res && res.success) { setStatus('sent'); onSent?.(); setTimeout(onClose, 900); }
      else setStatus('err:' + String((res && res.error) || ''));
    } catch (e) { setStatus('err:' + String((e as any)?.message || e)); }
    finally { setSending(false); }
  };

  const input = 'w-full px-3.5 py-2.5 rounded-xl text-sm bg-white border border-slate-200 dark:!bg-slate-800 dark:!border-slate-600 outline-none focus:ring-2 focus:ring-amber-400/60 placeholder:text-slate-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:!bg-slate-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:!border-slate-600/50 p-6 animate-scaleIn max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="flex items-center gap-2 text-lg font-bold text-surface-800 dark:!text-amber-300">
            <span className="w-9 h-9 rounded-xl bg-red-50 dark:!bg-red-500/15 flex items-center justify-center"><Mail className="w-5 h-5 text-red-500" /></span>
            {t('emailTitle')}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:!bg-slate-700 flex items-center justify-center transition-colors"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:!text-slate-400 mb-4">{t('emailSubtitle')}</p>

        <div className="space-y-3">
          <div>
            <label className="label-field">{t('emailTo')}</label>
            <input className={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinataire@gmail.com" />
          </div>
          <div>
            <label className="label-field">{t('emailSubject')}</label>
            <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="label-field">{t('emailFormat')}</label>
            <div className="grid grid-cols-3 gap-2">
              {['pdf', 'xlsx', 'doc'].map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={`py-2.5 rounded-xl text-xs font-bold transition-all ${format === f ? 'bg-gradient-to-b from-[#ffe066] to-[#f7c948] text-[#14305a] shadow-[0_4px_12px_-2px_rgba(245,166,35,0.5)]' : 'bg-slate-100 dark:!bg-slate-700 text-slate-600 dark:!text-slate-300 hover:bg-slate-200'}`}>
                  {f === 'pdf' ? 'PDF' : f === 'xlsx' ? 'Excel' : 'Word'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setShowSmtp(o => !o)} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:!border-slate-600 text-xs font-semibold text-slate-600 dark:!text-slate-300 hover:bg-slate-50 dark:hover:!bg-slate-700 transition-colors">
            <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> {t('emailSmtpConfig')} {smtp.user && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showSmtp ? 'rotate-180' : ''}`} />
          </button>

          {showSmtp && (
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:!bg-slate-700/40 border border-slate-200 dark:!border-slate-600/50 animate-fadeIn">
              <div className="col-span-2">
                <label className="label-field">{t('emailHost')}</label>
                <input className={input} value={smtp.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="label-field">{t('emailPort')}</label>
                <input className={input} value={smtp.port} onChange={(e) => set('port', e.target.value)} placeholder="587" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:!text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!smtp.secure} onChange={(e) => set('secure', e.target.checked)} className="accent-amber-500 w-4 h-4" />
                  SSL {smtp.secure ? '(465)' : ''}
                </label>
              </div>
              <div className="col-span-2">
                <label className="label-field">{t('emailUser')} <span className="text-red-400">*</span></label>
                <input className={input} value={smtp.user} onChange={(e) => set('user', e.target.value)} placeholder="votrecompte@gmail.com" />
              </div>
              <div className="col-span-2">
                <label className="label-field">{t('emailPass')} <span className="text-red-400">*</span></label>
                <input type="password" className={input} value={smtp.pass} onChange={(e) => set('pass', e.target.value)} placeholder="Mot de passe d'application Gmail (16 lettres)" />
              </div>
            </div>
          )}
        </div>

        {status === 'sent' && <p className="mt-3 text-xs font-semibold text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {t('emailSent')}</p>}
        {status === 'ok' && <p className="mt-3 text-xs font-semibold text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {t('emailTestOk')}</p>}
        {status && (status === 'missing') && <p className="mt-3 text-xs font-semibold text-amber-600 flex items-center gap-1.5"><Inbox className="w-4 h-4" /> {t('emailMissing')}</p>}
        {status && status.startsWith('err:') && <p className="mt-3 text-xs font-semibold text-red-600 flex items-center gap-1.5 break-all"><MailX className="w-4 h-4 shrink-0" /> {status.slice(4)}</p>}

        <div className="flex items-center gap-2 mt-5">
          <button onClick={doTest} disabled={sending} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:!text-slate-300 border border-slate-300 dark:!border-slate-600 hover:bg-slate-50 dark:hover:!bg-slate-700 transition-colors flex items-center justify-center gap-2">
            <TestTube2 className="w-4 h-4" /> {t('emailTest')}
          </button>
          <button onClick={doSend} disabled={sending} className="flex-[1.6] py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-[#f7c948] via-[#f5a623] to-[#e6890a] shadow-[0_4px_14px_-2px_rgba(245,166,35,0.6)] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t('emailSend')}
          </button>
        </div>
      </div>
    </div>
  );
}
