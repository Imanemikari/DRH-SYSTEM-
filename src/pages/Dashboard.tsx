import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Stats } from '../types';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users, Building2, CalendarCheck, CalendarOff,
  UserPlus, ArrowUpRight, Clock, Briefcase, ChevronRight
} from 'lucide-react';

interface DashboardProps {
  navigateTo: (page: string, id?: number) => void;
  onAI?: () => void;
}

const COLORS = ['#1e40af', '#0ea5a4', '#f5a623', '#64748b', '#7c3aed', '#0e7490', '#b4521e', '#15803d'];

export default function Dashboard({ navigateTo, onAI }: DashboardProps) {
  const { t, lang } = useLang();
  const { formatCurrency, formatDate } = useHelpers();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const expiring = stats.expiringContracts || 0;
  const hasExpiring = expiring > 0;
  const today = new Date();

  const statCards = [
    { label: t('dashTotalEmployees'), value: stats.totalEmployees, icon: Users, accent: '#60a5fa', change: null as string | null },
    { label: t('dashActiveEmployees'), value: stats.activeEmployees, icon: Briefcase, accent: '#34d399', change: null as string | null },
    { label: t('dashDepartments'), value: stats.totalDepartments, icon: Building2, accent: '#f5a623', change: null as string | null },
    { label: t('dashPendingLeaves'), value: stats.pendingLeaves, icon: CalendarOff, accent: '#fb923c', change: null as string | null },
  ];

  return (
    <div className="space-y-6">
      {/* ===== HERO / PRIVATE BANKING BANNER ===== */}
      <div className="bank-hero bank-hero-grid relative overflow-hidden rounded-3xl px-8 py-8 text-white shadow-premium">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 hero-glow">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today)}
              </span>
            </div>
            <p className="page-eyebrow !text-amber-300/90">{t('pgDashKicker')}</p>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">{t('navDashboard')}</h1>
            <p className="text-white/70 text-sm mt-1.5 max-w-xl">{t('dashWelcome')}</p>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button onClick={() => navigateTo('employees')} className="toolbar-btn toolbar-btn-gold gold-glow gold-sheen">
                <UserPlus className="w-4 h-4" /> {t('dashAddEmployee')}
              </button>
              <button onClick={() => navigateTo('attendance')} className="toolbar-btn toolbar-btn-ghost dark:!bg-white/10 dark:!text-white dark:!border-white/15 dark:!hover:bg-white/20">
                <CalendarCheck className="w-4 h-4 text-emerald-400" /> {t('dashRecordAttendance')}
              </button>
              <button onClick={() => navigateTo('leaves')} className="toolbar-btn toolbar-btn-ghost dark:!bg-white/10 dark:!text-white dark:!border-white/15 dark:!hover:bg-white/20">
                <CalendarOff className="w-4 h-4 text-amber-400" /> {t('dashLeaveRequest')}
              </button>
            </div>
          </div>

          <div className="lg:w-80 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/50">{t('dashTotalEmployees')}</span>
              <span className="w-8 h-8 rounded-lg bank-gold-bg flex items-center justify-center text-white">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl lg:text-4xl font-bold bank-stat-number">{stats.totalEmployees}</p>
                <div className="flex items-center gap-1 mt-2 text-emerald-400 text-xs font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+{stats.activeEmployees || 0} actif</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/50 uppercase tracking-widest">{t('dashDepartments')}</p>
                <p className="text-xl font-semibold bank-stat-number mt-1 text-amber-300">{stats.totalDepartments}</p>
              </div>
            </div>
            {hasExpiring ? (
              <button onClick={() => navigateTo('contracts')} className="mt-5 w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-400/30 hover:bg-red-500/25 transition-colors group">
                <span className="flex items-center gap-2 text-xs font-medium text-red-300">
                  <Clock className="w-3.5 h-3.5 animate-pulse" /> {t('conExpiringTitle')}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-red-300 bank-stat-number">
                  {expiring} <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            ) : (
              <div className="mt-5 flex items-center gap-2 px-1 text-[11px] text-white/40 font-medium uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('conNoExpiring')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== STAT TILES ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bank-panel p-5 group hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300 border-t-2"
              style={{ borderTopColor: card.accent }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider bank-muted">{card.label}</p>
                  <p className="text-2xl lg:text-[27px] font-bold mt-2 bank-stat-number text-surface-800 dark:!text-slate-100">{card.value}</p>
                  {card.change && (
                    <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 dark:!text-emerald-400">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>{card.change}</span>
                      <span className="bank-muted font-normal">· {t('dashThisMonth')}</span>
                    </div>
                  )}
                </div>
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${card.accent}1a`, color: card.accent }}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== DATA GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Department distribution */}
        <div className="bank-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{t('dashDeptDistribution')}</h3>
            <div className="flex items-center gap-1.5 text-[11px] font-medium bank-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {t('dashThisMonth')}
            </div>
          </div>

          {stats.departmentStats.length === 0 ? (
            <p className="text-sm text-center py-10 text-surface-400">{t('dashNoEmployees')}</p>
          ) : (
            <div className="space-y-4">
              {stats.departmentStats.map((dept: any, i: number) => {
                const total = stats.departmentStats.reduce((s: number, d: any) => s + d.count, 0) || 1;
                const pct = Math.round((dept.count / total) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-surface-700 dark:!text-slate-200 truncate">{dept.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs tabnum text-slate-500 dark:!text-slate-400">{dept.count}</span>
                        <span className="text-[11px] tabnum font-semibold text-slate-400 dark:!text-slate-500 w-9 text-right">{pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:!bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`flex flex-wrap gap-x-4 gap-y-2 mt-6 pt-4 border-t bank-divider`}>
            {stats.departmentStats.map((dept: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:!text-slate-300">
                <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                {dept.name} <span className="bank-muted tabnum">({dept.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent hires */}
        <div className="bank-panel p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{t('dashRecentEmployees')}</h3>
            <button onClick={() => navigateTo('employees')} className="bank-link flex items-center gap-1">
              {t('dashViewAll')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y bank-divider">
            {stats.recentEmployees.map((emp: any, i: number) => (
              <div
                key={i}
                onClick={() => navigateTo('employees', emp.id)}
                className={`flex items-center gap-3 py-2.5 px-2 rounded-xl cursor-pointer transition-all ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}
              >
                <div className="relative w-9 h-9 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                  {emp.photo_path ? (
                    <img src={emp.photo_path} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{emp.first_name?.[0] || ''}{emp.last_name?.[0] || ''}</span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate text-surface-800 dark:!text-slate-100">
                    {emp.last_name} {emp.first_name}
                  </p>
                  <p className="text-xs truncate text-slate-500 dark:!text-slate-400 mt-0.5">
                    {emp.position || '-'} <span className="text-slate-300 dark:!text-slate-600 mx-1">•</span> {emp.department_name || '-'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium tabnum text-slate-500 dark:!text-slate-400">{formatDate(emp.hire_date)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:!text-slate-500 mt-0.5">{t('empHireDate')}</p>
                </div>
              </div>
            ))}
            {stats.recentEmployees.length === 0 && (
              <div className="text-center py-10 text-sm text-slate-400 dark:!text-slate-500">{t('dashNoEmployees')}</div>
            )}
          </div>
        </div>
      </div>

      {/* ===== QUICK ACTIONS ===== */}
      <div className="bank-panel p-6">
        <h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100 mb-4">{t('dashQuickActions')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => navigateTo('employees')} className="group flex flex-col items-start gap-3 p-4 rounded-2xl border border-slate-200/70 dark:!border-slate-700 hover:border-blue-200 dark:hover:!border-blue-700 hover:bg-blue-50/50 dark:hover:!bg-blue-950/40 transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 dark:!bg-blue-900/50 text-blue-600 dark:!text-blue-400 group-hover:scale-110 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-[13px] font-medium text-surface-700 dark:!text-slate-200">{t('dashAddEmployee')}</span>
          </button>
          <button onClick={() => navigateTo('attendance')} className="group flex flex-col items-start gap-3 p-4 rounded-2xl border border-slate-200/70 dark:!border-slate-700 hover:border-emerald-200 dark:hover:!border-emerald-700 hover:bg-emerald-50/50 dark:hover:!bg-emerald-950/40 transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 dark:!bg-emerald-900/50 text-emerald-600 dark:!text-emerald-400 group-hover:scale-110 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="text-[13px] font-medium text-surface-700 dark:!text-slate-200">{t('dashRecordAttendance')}</span>
          </button>
          <button onClick={() => navigateTo('leaves')} className="group flex flex-col items-start gap-3 p-4 rounded-2xl border border-slate-200/70 dark:!border-slate-700 hover:border-amber-200 dark:hover:!border-amber-700 hover:bg-amber-50/50 dark:hover:!bg-amber-950/40 transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:!bg-amber-900/50 text-amber-600 dark:!text-amber-400 group-hover:scale-110 transition-transform">
              <CalendarOff className="w-5 h-5" />
            </div>
            <span className="text-[13px] font-medium text-surface-700 dark:!text-slate-200">{t('dashLeaveRequest')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}