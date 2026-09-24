import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { t } from '../utils/translations';
import { sha256Hex, makeSalt, ACCESS_MAX_ATTEMPTS, ACCESS_LOCK_MINUTES, OWNER_EMAIL } from '../utils/accessCode';
import { KeyRound, Lock, ShieldAlert, Loader2 } from 'lucide-react';

export default function AccessLock({ onUnlock }: { onUnlock: () => void }) {
  const { lang, dir } = useLang();
  const L = (k: string): string => String(t(k, lang));
  const [mode, setMode] = useState<'loading' | 'setup' | 'lock'>('loading');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(ACCESS_MAX_ATTEMPTS);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [salt, setSalt] = useState('');
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s: any = await api.getSettings();
        if (s && s.access_code_hash) {
          setSalt(s.access_code_salt || '');
          const failed = parseInt(s.access_failed_count || '0', 10) || 0;
          setAttemptsLeft(Math.max(0, ACCESS_MAX_ATTEMPTS - failed));
          const lu = parseInt(s.access_locked_until || '0', 10) || 0;
          if (lu > Date.now()) setLockedUntil(lu);
          setMode('lock');
        } else {
          setMode('setup');
        }
      } catch {
        setMode('lock');
      }
      try {
        const smtp: any = await api.getSmtpSettings();
        setSmtpOk(!!(smtp && smtp.user && smtp.pass));
      } catch {
        setSmtpOk(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const iv = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(0);
        setAttemptsLeft(ACCESS_MAX_ATTEMPTS);
        setError('');
        try { api.updateSettings({ access_failed_count: '0', access_locked_until: '' }); } catch { /* noop */ }
        window.clearInterval(iv);
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [lockedUntil]);

  const sendIntrusionAlert = async () => {
    const dt = new Date().toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-TN');
    try {
      await api.addNotification('security', "Tentative d'intrusion : 3 codes errones (" + dt + ')');
    } catch { /* noop */ }
    const tgText = "DRH System - Tentative d'intrusion : 3 codes errones (" + dt + ')';
    try {
      const tg: any = await api.sendTelegram(tgText);
      if (!(tg && tg.success)) { try { await api.queueAlert('telegram', { text: tgText }); } catch { /* noop */ } }
    } catch {
      try { await api.queueAlert('telegram', { text: tgText }); } catch { /* noop */ }
    }
    try {
      const smtp: any = await api.getSmtpSettings();
      if (!smtp || !smtp.user || !smtp.pass) return;
      const mailHtml = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;padding:24px;color:#111" dir="ltr">'
        + '<h2 style="color:#b91c1c">DRH System - intrusion attempt</h2>'
        + '<p>Someone failed the access code 3 times.</p>'
        + '<p><b>Date:</b> ' + dt + '</p>'
        + '<p><b>Program:</b> DRH-System</p>'
        + '</body></html>';
      const em: any = await api.sendReportEmail({
        smtp,
        to: OWNER_EMAIL,
        from: smtp.from || smtp.user,
        subject: "DRH - Tentative d'intrusion detectee",
        format: 'pdf',
        prefix: 'SECURITE_',
        html: mailHtml,
        sheets: [],
        landscape: false,
      });
      if (!(em && em.success)) { try { await api.queueAlert('email', { to: OWNER_EMAIL, subject: "DRH - Tentative d'intrusion", html: mailHtml }); } catch { /* noop */ } }
    } catch { /* silent: alert is best-effort */ }
  };

  const handleUnlock = async () => {
    if (busy || lockedUntil > Date.now() || !code) return;
    setBusy(true);
    setError('');
    try {
      const s: any = await api.getSettings();
      const h = await sha256Hex(salt + '::' + code);
      if (s && s.access_code_hash && s.access_code_hash === h) {
        try { await api.updateSettings({ access_failed_count: '0', access_locked_until: '' }); } catch { /* noop */ }
        onUnlock();
      } else {
        const failed = (parseInt(s?.access_failed_count || '0', 10) || 0) + 1;
        try { await api.updateSettings({ access_failed_count: String(failed) }); } catch { /* noop */ }
        const left = Math.max(0, ACCESS_MAX_ATTEMPTS - failed);
        setAttemptsLeft(left);
        if (left <= 0) {
          const until = Date.now() + ACCESS_LOCK_MINUTES * 60000;
          setLockedUntil(until);
          try { await api.updateSettings({ access_locked_until: String(until) }); } catch { /* noop */ }
          sendIntrusionAlert();
          setError(L('lockLocked'));
        } else {
          setError(L('lockError'));
        }
        setCode('');
      }
    } catch {
      setError(L('lockError'));
    }
    setBusy(false);
  };

  const handleCreate = async () => {
    if (busy) return;
    if (code.length < 4) { setError(L('lockTooShort')); return; }
    if (code !== confirm) { setError(L('lockMismatch')); return; }
    setBusy(true);
    setError('');
    try {
      const s = makeSalt();
      const h = await sha256Hex(s + '::' + code);
      await api.updateSettings({ access_code_hash: h, access_code_salt: s, access_failed_count: '0', access_locked_until: '' });
      onUnlock();
    } catch {
      setError(L('lockError'));
    }
    setBusy(false);
  };

  const waitMin = lockedUntil > now ? Math.ceil((lockedUntil - now) / 60000) : 0;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'radial-gradient(700px 320px at 12% 8%, rgba(247,201,72,0.14), transparent 60%), radial-gradient(800px 400px at 88% 95%, rgba(32,72,124,0.55), transparent 60%), linear-gradient(135deg, #0b1b33 0%, #14305a 55%, #0a1730 100%)' }}
    >
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-scaleIn my-auto bg-white dark:!bg-slate-800">
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, transparent, #f7c948, transparent)' }} />
        <div className="p-8">
          <div className="flex flex-col items-center text-center">
            <span className="w-14 h-14 rounded-2xl bank-gold-bg gold-glow flex items-center justify-center">
              {mode === 'setup' ? <KeyRound className="w-7 h-7 text-white" /> : <Lock className="w-7 h-7 text-white" />}
            </span>
            <h1 className="mt-4 text-xl font-bold text-surface-800 dark:!text-slate-100">
              {mode === 'setup' ? L('lockSetupTitle') : L('lockTitle')}
            </h1>
            <p className="mt-1 text-xs text-surface-500 dark:!text-slate-400">
              {mode === 'setup' ? L('lockSetupSub') : L('lockSubtitle')}
            </p>
          </div>

          {mode === 'loading' ? (
            <div className="mt-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : mode === 'setup' ? (
            <div className="mt-6 space-y-3">
              <div>
                <label className="label-field">{L('lockNewCode')}</label>
                <input type="password" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} dir="ltr" autoComplete="new-password" className="input-field font-mono text-center tracking-[0.3em]" />
              </div>
              <div>
                <label className="label-field">{L('lockConfirmCode')}</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} dir="ltr" autoComplete="new-password" className="input-field font-mono text-center tracking-[0.3em]" />
              </div>
              {error && <p className="text-xs font-semibold text-red-600 dark:!text-red-400 text-center">{error}</p>}
              <button onClick={handleCreate} disabled={busy} className="tool-action tool-action-gold w-full justify-center !py-3 disabled:opacity-60">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                <span>{L('lockCreate')}</span>
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <div>
                <label className="label-field">{L('lockPlaceholder')}</label>
                <input type="password" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} dir="ltr" autoComplete="current-password" disabled={lockedUntil > now} className="input-field font-mono text-center tracking-[0.3em] disabled:opacity-50" />
              </div>
              {error && (
                <p className="text-xs font-semibold text-red-600 dark:!text-red-400 text-center flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}
              {!error && attemptsLeft < ACCESS_MAX_ATTEMPTS && lockedUntil <= now && (
                <p className="text-[11px] text-amber-600 dark:!text-amber-400 text-center">{L('lockRemaining')}: {attemptsLeft}</p>
              )}
              {lockedUntil > now && (
                <p className="text-xs font-bold text-amber-600 dark:!text-amber-300 text-center">{L('lockWait')} {waitMin} {L('lockMinutes')}</p>
              )}
              <button onClick={handleUnlock} disabled={busy || lockedUntil > now} className="tool-action tool-action-gold w-full justify-center !py-3 disabled:opacity-60">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                <span>{L('lockUnlock')}</span>
              </button>
              {smtpOk !== null && (
                <p className={`text-[11px] text-center flex items-center justify-center gap-1.5 ${smtpOk ? 'text-emerald-600 dark:!text-emerald-400' : 'text-amber-600 dark:!text-amber-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${smtpOk ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {smtpOk ? L('lockSmtpOk') : L('lockSmtpMissing')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
