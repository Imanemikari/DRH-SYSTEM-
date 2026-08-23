import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Stats } from '../types';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import {
  Users, Building2, Calendar, CalendarOff, Wallet, TrendingUp,
  UserPlus, ArrowUpLeft, Sparkles
} from 'lucide-react';

interface DashboardProps {
  navigateTo: (page: string, id?: number) => void;
  onAI?: () => void;
}

const COLORS = ['#1e40af', '#059669', '#f59e0b', '#ef4444', '#7c3aed', '#06b6d4', '#ec4899', '#14b8a6'];

export default function Dashboard({ navigateTo, onAI }: DashboardProps) {
  const { t, lang, tArray } = useLang();
  const { formatCurrency, formatDate } = useHelpers();
  const months = tArray('months');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    const data = await api.getStats();
    setStats(data);
  };

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const statCards = [
    { label: t('dashTotalEmployees'), value: stats.totalEmployees, icon: Users, gradient: 'gradient-primary', change: '+2%' },
    { label: t('dashActiveEmployees'), value: stats.activeEmployees, icon: TrendingUp, gradient: 'gradient-accent', change: '+5%' },
    { label: t('dashDepartments'), value: stats.totalDepartments, icon: Building2, gradient: 'gradient-purple', change: '' },
    { label: t('dashPendingLeaves'), value: stats.pendingLeaves, icon: CalendarOff, gradient: 'gradient-warm', change: '' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">{t('navDashboard')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('dashWelcome')}</p>
        </div>
        <button onClick={onAI} className="btn-primary">
          <Sparkles className="w-4 h-4 icon-glow" />
          {t('dashAIAnalysis')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="stat-card animate-slideIn" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-surface-500">{card.label}</p>
                  <p className="text-2xl font-bold text-surface-800 mt-1">{card.value}</p>
                  {card.change && (
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpLeft className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-medium text-green-600">{card.change}</span>
                      <span className="text-xs text-surface-400">{t('dashThisMonth')}</span>
                    </div>
                  )}
                </div>
                <div className={`w-11 h-11 rounded-xl ${card.gradient} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-5 h-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-surface-700 mb-4">{t('dashDeptDistribution')}</h3>
          <div className="space-y-3">
            {stats.departmentStats.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-8">{t('dashNoEmployees')}</p>
            )}
            {stats.departmentStats.map((dept: any, i: number) => {
              const maxCount = Math.max(...stats.departmentStats.map((d: any) => d.count), 1);
              const pct = Math.round((dept.count / maxCount) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-surface-600">{dept.name}</span>
                    <span className="text-xs font-bold text-surface-800">{dept.count}</span>
                  </div>
                  <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-surface-100">
            {stats.departmentStats.map((dept: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-surface-600">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {dept.name} ({dept.count})
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-700">{t('dashRecentEmployees')}</h3>
            <button onClick={() => navigateTo('employees')} className="text-xs text-primary-500 hover:text-primary-600 font-medium">{t('dashViewAll')}</button>
          </div>
          <div className="space-y-3">
            {stats.recentEmployees.map((emp: any, i: number) => (
              <div key={i} onClick={() => navigateTo('employees', emp.id)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 cursor-pointer transition-all">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {emp.photo_path ? <img src={emp.photo_path} alt="" className="w-full h-full rounded-full object-cover" /> : `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{emp.first_name} {emp.last_name}</p>
                  <p className="text-xs text-surface-400 truncate">{emp.position || '-'} - {emp.department_name || '-'}</p>
                </div>
                <div className="text-left"><p className="text-xs text-surface-400">{formatDate(emp.hire_date)}</p></div>
              </div>
            ))}
            {stats.recentEmployees.length === 0 && <div className="text-center py-8 text-surface-400 text-sm">{t('dashNoEmployees')}</div>}
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-surface-700 mb-4">{t('dashQuickActions')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => navigateTo('employees')} className="flex items-center gap-3 p-4 rounded-xl border border-surface-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all group">
            <UserPlus className="w-5 h-5 text-primary-500 group-hover:scale-110 transition-transform icon-glow" />
            <span className="text-sm font-medium text-surface-700">{t('dashAddEmployee')}</span>
          </button>
          <button onClick={() => navigateTo('attendance')} className="flex items-center gap-3 p-4 rounded-xl border border-surface-100 hover:border-green-200 hover:bg-green-50/50 transition-all group">
            <Calendar className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform icon-glow" />
            <span className="text-sm font-medium text-surface-700">{t('dashRecordAttendance')}</span>
          </button>
          <button onClick={() => navigateTo('leaves')} className="flex items-center gap-3 p-4 rounded-xl border border-surface-100 hover:border-amber-200 hover:bg-amber-50/50 transition-all group">
            <CalendarOff className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform icon-glow" />
            <span className="text-sm font-medium text-surface-700">{t('dashLeaveRequest')}</span>
          </button>
          <button onClick={() => navigateTo('payroll')} className="flex items-center gap-3 p-4 rounded-xl border border-surface-100 hover:border-purple-200 hover:bg-purple-50/50 transition-all group">
            <Wallet className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform icon-glow" />
            <span className="text-sm font-medium text-surface-700">{t('dashPayroll')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
