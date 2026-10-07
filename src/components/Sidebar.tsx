import {
  LayoutDashboard, Users, Building2, Calendar, CalendarOff,
  Settings, ChevronLeft, ChevronRight, Sparkles, FileText, FileWarning, RefreshCcw, ClipboardCheck, Timer, FolderOpen, BarChart3, Scale
} from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';

type Page = 'dashboard' | 'employees' | 'employee-detail' | 'departments' | 'attendance' | 'leaves' | 'contracts' | 'settings' | 'avendant' | 'documents' | 'rotation' | 'pointage' | 'heures-supp' | 'droit-cr' | 'reports';

interface SidebarProps {
  currentPage: Page;
  navigateTo: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
  onAI: () => void;
}

export default function Sidebar({ currentPage, navigateTo, collapsed, onToggle, onAI }: SidebarProps) {
  const { t, dir } = useLang();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const menuItems: { id: Page; labelKey: string; icon: any }[] = [
    { id: 'reports', labelKey: 'navReports', icon: BarChart3 },
    { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard },
    { id: 'employees', labelKey: 'navEmployees', icon: Users },
    { id: 'departments', labelKey: 'navDepartments', icon: Building2 },
    { id: 'attendance', labelKey: 'navAttendance', icon: Calendar },
    { id: 'pointage', labelKey: 'navPointage', icon: ClipboardCheck },
    { id: 'heures-supp', labelKey: 'navHeuresSupp', icon: Timer },
    { id: 'droit-cr', labelKey: 'navDroitCr', icon: Scale },
    { id: 'leaves', labelKey: 'navLeaves', icon: CalendarOff },
    { id: 'contracts', labelKey: 'navContracts', icon: FileWarning },
    { id: 'rotation', labelKey: 'navDeplacement', icon: RefreshCcw },
    { id: 'avendant', labelKey: 'navAvendant', icon: FileText },
    { id: 'documents', labelKey: 'navDocuments', icon: FolderOpen },
    { id: 'settings', labelKey: 'navSettings', icon: Settings },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-[72px]' : 'w-64'
      } h-full flex flex-col transition-all duration-300 ease-in-out no-print sidebar-bank sidebar-3d ${isDark ? 'border-r border-slate-700/50' : 'border-r border-white/10'}`}
    >
      <div className={`h-16 flex items-center justify-center border-b px-4 ${isDark ? 'border-slate-700/50' : 'border-white/10'}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bank-gold-bg gold-glow gold-sheen tile-3d flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">{t('appShort')}</h1>
              <p className="text-[10px] leading-tight text-white/50">{t('appDesc')}</p>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bank-gold-bg gold-glow gold-sheen tile-3d flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <nav className="side-nav flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`side-link ${isActive ? 'active' : ''} w-full rounded-xl flex items-center gap-3 text-sm font-medium ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'
              }`}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button
          onClick={onAI}
          className={`ai-3d w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 bg-gradient-to-l from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? t('navAI') : undefined}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          {!collapsed && <span>{t('navAI')}</span>}
        </button>
      </div>

      <div className={`border-t p-3 ${isDark ? 'border-slate-700/50' : 'border-white/10'}`}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all text-white/50 hover:text-white hover:bg-white/10"
        >
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">{t('navCollapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
