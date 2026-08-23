import { api } from '../utils/api';
import { Minus, Square, X, Search, Bell, Sparkles, Globe } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function TitleBar() {
  const { lang, setLang, t, dir } = useLang();

  return (
    <div className="h-12 bg-primary-600 gradient-primary flex items-center justify-between px-0 select-none draggable">
      <div className="flex items-center gap-3 px-4">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-sm tracking-wide">{t('appName')}</span>
      </div>

      <div className="flex-1 max-w-md mx-8 no-drag">
        <div className="relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className={`w-full py-1.5 bg-white/15 border border-white/20 rounded-lg text-white text-xs placeholder:text-white/40 focus:outline-none focus:bg-white/25 focus:border-white/40 transition-all ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 no-drag">
        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-1.5 px-3 h-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs font-medium"
          title={lang === 'fr' ? 'العربية' : 'Français'}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'AR' : 'FR'}</span>
        </button>

        <button className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all">
          <Bell className="w-4 h-4" />
        </button>
        <button onClick={() => api.minimize()} className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all">
          <Minus className="w-4 h-4" />
        </button>
        <button onClick={() => api.maximize()} className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all">
          <Square className="w-3 h-3" />
        </button>
        <button onClick={() => api.close()} className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-500/80 rounded-lg transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
