import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { Minus, Square, X, Search, Bell, Sparkles, Globe, Sun, Moon, CheckCheck } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';

export default function TitleBar() {
  const { lang, setLang, t, dir } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifs = async () => {
    const notifs = await api.getNotifications();
    setNotifications(notifs || []);
  };

  useEffect(() => { loadNotifs(); }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notifications.filter(n => !n.is_read).length;

  const markRead = async () => {
    await api.markNotificationsRead();
    loadNotifs();
  };

  return (
    <div className={`h-12 flex items-center justify-between px-0 select-none draggable ${theme === 'dark' ? 'bg-slate-800' : 'gradient-primary'}`}>
      <div className="flex items-center gap-3 px-4">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-white/20'}`}>
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
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 h-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs font-medium"
          title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
        >
          {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => {
            const langs: Array<'fr' | 'ar' | 'en'> = ['fr', 'ar', 'en'];
            const idx = langs.indexOf(lang);
            setLang(langs[(idx + 1) % langs.length]);
          }}
          className="flex items-center gap-1.5 px-3 h-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs font-medium"
          title={lang === 'fr' ? 'العربية' : lang === 'ar' ? 'English' : 'Français'}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'AR' : lang === 'ar' ? 'EN' : 'FR'}</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(!showNotif); if (!showNotif) loadNotifs(); }}
            className="relative w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className={`absolute top-1.5 ${dir === 'rtl' ? 'left-1' : 'right-1'} min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold`}>
                {unread}
              </span>
            )}
          </button>

          {showNotif && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} top-11 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-xl backdrop-blur-md p-2 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 z-50' : 'bg-white/95 border-slate-200 z-50'}`}>
              <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-surface-800'}`}>{t('tbNotifications')}</span>
                {notifications.length > 0 && (
                  <button onClick={markRead} className={`flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-surface-400 hover:text-primary'} transition-all`}>
                    <CheckCheck className="w-3.5 h-3.5" /> {t('tbMarkAllRead')}
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className={`px-2 py-4 text-center text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-surface-400'}`}>{t('tbNoNotifications')}</p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`px-3 py-2.5 rounded-lg mb-1 border ${n.is_read ? (theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white') : (theme === 'dark' ? 'border-blue-500/40 bg-blue-500/10' : 'border-blue-100 bg-blue-50')}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-slate-300' : 'bg-blue-500'}`} />
                      <div>
                        <p className={`text-xs font-medium leading-snug ${theme === 'dark' ? 'text-slate-100' : 'text-surface-700'}`}>{n.message}</p>
                        {n.created_at && <p className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-surface-400'}`}>{n.created_at}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
