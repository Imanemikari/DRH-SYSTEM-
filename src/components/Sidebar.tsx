import {
  LayoutDashboard, Users, Building2, Calendar, CalendarOff,
  Wallet, Settings, ChevronLeft, ChevronRight, Sparkles, FileText
} from 'lucide-react';
import { useLang } from '../context/LangContext';

type Page = 'dashboard' | 'employees' | 'employee-detail' | 'departments' | 'attendance' | 'leaves' | 'payroll' | 'settings' | 'avendant';

interface SidebarProps {
  currentPage: Page;
  navigateTo: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
  onAI: () => void;
}

export default function Sidebar({ currentPage, navigateTo, collapsed, onToggle, onAI }: SidebarProps) {
  const { t, dir } = useLang();

  const menuItems: { id: Page; labelKey: string; icon: any }[] = [
    { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard },
    { id: 'employees', labelKey: 'navEmployees', icon: Users },
    { id: 'departments', labelKey: 'navDepartments', icon: Building2 },
    { id: 'attendance', labelKey: 'navAttendance', icon: Calendar },
    { id: 'leaves', labelKey: 'navLeaves', icon: CalendarOff },
    { id: 'avendant', labelKey: 'navAvendant', icon: FileText },
    { id: 'payroll', labelKey: 'navPayroll', icon: Wallet },
    { id: 'settings', labelKey: 'navSettings', icon: Settings },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-[72px]' : 'w-64'
      } h-full bg-white/90 backdrop-blur-lg border-l border-white/30 flex flex-col transition-all duration-300 ease-in-out no-print`}
      style={{ borderRight: dir === 'rtl' ? 'none' : undefined, borderLeft: dir === 'ltr' ? '1px solid #e2e8f0' : undefined }}
    >
      <div className="h-16 flex items-center justify-center border-b border-surface-100 px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-surface-800">{t('appShort')}</h1>
              <p className="text-[10px] text-surface-400 leading-tight">{t('appDesc')}</p>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`sidebar-link w-full ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]' : 'icon-glow'}`} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button
          onClick={onAI}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 bg-gradient-to-l from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] ${
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

      <div className="border-t border-surface-100 p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-surface-400 hover:text-surface-600 hover:bg-surface-50 rounded-xl transition-all"
        >
          {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">{t('navCollapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
