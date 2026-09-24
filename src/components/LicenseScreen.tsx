import { useState } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { t } from '../utils/translations';
import {
  ShieldCheck, KeyRound, ClipboardPaste, Mail, CheckCircle2,
  XCircle, Loader2, Eye, Sparkles, Terminal, Briefcase, Flame, Medal,
} from 'lucide-react';

interface LicenseScreenProps {
  onActivated: () => void;
  onDemo?: () => void;
}

export default function LicenseScreen({ onActivated, onDemo }: LicenseScreenProps) {
  const { lang, dir } = useLang();
  const L = (k: string): string => String(t(k, lang));
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!key.trim()) {
      setError(L('licEmpty'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.activateLicense(key.trim());
      if (result.valid) {
        setSuccess(L('licActivated'));
        setTimeout(() => onActivated(), 1500);
      } else {
        setError(result.error || L('licEmpty'));
      }
    } catch {
      setError(L('licCheckErr'));
    }
    setLoading(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setKey(text.trim().toUpperCase());
    } catch {
      // clipboard not available
    }
  };

  const feats = ['licF1', 'licF2', 'licF3', 'licF4', 'licF5'];

const sponsors = [
  { name: 'NVIDIA', Icon: Eye, mark: 'eye', bg: 'linear-gradient(135deg, #86c900 0%, #76B900 45%, #5a8f00 100%)', glow: '0 6px 16px -6px rgba(118,185,0,0.65)' },
  { name: 'OPENCODE', Icon: Terminal, mark: 'term', bg: 'linear-gradient(135deg, #475569 0%, #1e293b 60%, #0f172a 100%)', glow: '0 6px 16px -6px rgba(15,23,42,0.8)' },
  { name: 'OPENWORK', Icon: Briefcase, mark: null as string | null, bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', glow: '0 6px 16px -6px rgba(37,99,235,0.65)' },
  { name: 'BRAVE', Icon: Flame, mark: null as string | null, bg: 'linear-gradient(135deg, #fb7a3b 0%, #f04e23 50%, #c81e1e 100%)', glow: '0 6px 16px -6px rgba(240,78,35,0.65)' },
];

function SponsorMark({ mark, Icon }: { mark: string | null; Icon: any }) {
  if (mark === 'eye') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
        <path d="M3 16C7 9.5 11.5 6.5 16 6.5S25 9.5 29 16c-4 6.5-8.5 9.5-13 9.5S7 22.5 3 16z" stroke="white" strokeWidth={2.4} />
        <circle cx="16" cy="16" r="4.2" fill="white" />
        <circle cx="17.5" cy="14.5" r="1.3" fill="#5a8f00" />
      </svg>
    );
  }
  if (mark === 'term') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" stroke="white" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 9.5l7.5 6.5L9 22.5" />
        <line x1="17.5" y1="23" x2="25" y2="23" />
      </svg>
    );
  }
  return <Icon className="w-5 h-5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />;
}

function SponsorGrid({ tone, label }: { tone: 'dark' | 'light'; label: string }) {
  const light = tone === 'light';
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className={`h-px flex-1 ${light ? 'bg-gradient-to-r from-transparent to-slate-300' : 'bg-gradient-to-r from-transparent to-white/25'}`} />
        <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${light ? 'text-slate-400' : 'text-amber-200/80'}`}>{label}</p>
        <span className={`h-px flex-1 ${light ? 'bg-gradient-to-l from-transparent to-slate-300' : 'bg-gradient-to-l from-transparent to-white/25'}`} />
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {sponsors.map((s) => (
          <div key={s.name} className="flex flex-col items-center group cursor-default">
            <span
              className="w-full h-12 rounded-2xl flex items-center justify-center border border-white/25 transition-all duration-200 group-hover:-translate-y-0.5"
              style={{ background: s.bg, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), ' + s.glow }}
            >
              <SponsorMark mark={s.mark} Icon={s.Icon} />
            </span>
            <span className={`mt-1.5 text-[10px] font-extrabold tracking-[0.14em] ${light ? 'text-slate-500' : 'text-white/80'}`}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'radial-gradient(700px 320px at 12% 8%, rgba(247,201,72,0.14), transparent 60%), radial-gradient(800px 400px at 88% 95%, rgba(32,72,124,0.55), transparent 60%), linear-gradient(135deg, #0b1b33 0%, #14305a 55%, #0a1730 100%)' }}
    >
      <div className="relative w-full max-w-3xl grid md:grid-cols-5 rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-scaleIn my-auto">
        {/* Brand panel */}
        <div
          className="hidden md:flex md:col-span-2 flex-col justify-between p-8 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #16305a 0%, #0b1b33 100%)' }}
        >
          <div className="absolute top-0 inset-x-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, #f7c948, transparent)' }} />
          <div>
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bank-gold-bg gold-glow flex items-center justify-center shrink-0">
                <KeyRound className="w-6 h-6 text-white" />
              </span>
              <div>
                <p className="text-xl font-bold tracking-tight">DRH <span className="bank-gold">System</span></p>
                <p className="text-[11px] text-white/50 mt-0.5">{L('appDesc')}</p>
              </div>
            </div>
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300/90 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> {L('licFeatTitle')}
              </p>
              <ul className="mt-4 space-y-3">
                {feats.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <span>{L(f)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-5 border-t border-white/10">
            <p className="text-[11px] text-white/50 mb-1.5">{L('licContact')}</p>
            <a href="mailto:toumi.bentamra@gmail.com" className="flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200 transition-colors">
              <Mail className="w-4 h-4" /> toumi.bentamra@gmail.com
            </a>
          </div>
          <div className="mt-6 pt-5 border-t border-white/10">
            {SponsorGrid({ tone: 'dark', label: L('licSponsors') })}
          </div>
        </div>

        {/* Form panel */}
        <div className="md:col-span-3 bg-white dark:!bg-slate-800 p-7 sm:p-9">
          <div className="flex items-center gap-3 md:hidden mb-6">
            <span className="w-11 h-11 rounded-2xl bank-gold-bg flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-white" />
            </span>
            <p className="text-lg font-bold text-surface-800 dark:!text-slate-100">DRH <span className="bank-gold">System</span></p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#14305a]/10 dark:!bg-amber-500/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#14305a] dark:!text-amber-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-surface-800 dark:!text-slate-100">{L('licTitle')}</h1>
              <p className="text-xs text-surface-500 dark:!text-slate-400 mt-0.5">{L('licSubtitle')}</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="label-field">{L('licSerial')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  placeholder="DRH-XXXXX-XXXXX-XXXXX..."
                  dir="ltr"
                  spellCheck={false}
                  autoComplete="off"
                  className="input-field font-mono uppercase !tracking-[0.06em] !ps-9 text-start"
                />
              </div>
              <button
                onClick={handlePaste}
                title={L('licPaste')}
                className="px-3.5 rounded-xl border border-slate-200 dark:!border-slate-600 text-slate-500 dark:!text-slate-300 hover:bg-slate-50 dark:hover:!bg-slate-700 hover:text-[#14305a] dark:hover:!text-amber-300 transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="hidden sm:inline">{L('licPaste')}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl text-[13px] font-medium text-center flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 dark:!bg-red-500/10 dark:!border-red-500/30 dark:!text-red-300 animate-scaleIn">
              <XCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {success && (
            <div className="mt-4 px-4 py-3 rounded-xl text-[13px] font-medium text-center flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-600 dark:!bg-emerald-500/10 dark:!border-emerald-500/30 dark:!text-emerald-300 animate-scaleIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !!success}
            className="tool-action tool-action-gold w-full justify-center !py-3 !text-[15px] mt-5 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            <span>{loading ? L('licActivating') : success ? L('licActivated') : L('licActivate')}</span>
          </button>

          {onDemo && !success && (
            <button
              onClick={onDemo}
              className="w-full py-3 mt-3 rounded-xl border border-slate-200 dark:!border-slate-600 text-slate-600 dark:!text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:!bg-slate-700 hover:border-[#14305a]/30 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" /> {L('licDemo')}
            </button>
          )}

          <p className="mt-5 text-center text-[11px] text-slate-400 dark:!text-slate-500">{L('licTrial')}</p>

          <div className="md:hidden mt-4 pt-4 border-t border-slate-100 dark:!border-slate-700 text-center">
            <p className="text-[11px] text-slate-400 dark:!text-slate-500 mb-1">{L('licContact')}</p>
            <a href="mailto:toumi.bentamra@gmail.com" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14305a] dark:!text-amber-300">
              <Mail className="w-3.5 h-3.5" /> toumi.bentamra@gmail.com
            </a>
          </div>
          <div className="md:hidden mt-4 pt-4 border-t border-slate-100 dark:!border-slate-700">
            {SponsorGrid({ tone: 'light', label: L('licSponsors') })}
          </div>
        </div>
      </div>
      <div className="fixed bottom-3 inset-x-0 z-[60] flex items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-white/60 pointer-events-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
        <Medal className="w-3.5 h-3.5 text-amber-300/80" />
        <span>All rights reserved &mdash; TOUMI.BENTAMRA</span>
      </div>
    </div>
  );
}
