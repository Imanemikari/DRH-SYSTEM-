import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { useHelpers } from '../utils/helpers';
import { FileWarning, CalendarX2, BellRing, RefreshCw, ArrowRight, ArrowDownAZ, X, Edit2, Eye } from 'lucide-react';

interface ContractsProps {
  navigateTo: (page: string, id?: number) => void;
}

export default function Contracts({ navigateTo }: ContractsProps) {
  const { t, dir } = useLang();
  const { theme } = useTheme();
  const { formatDate } = useHelpers();
  const isDark = theme === 'dark';
  const [expiring, setExpiring] = useState<any[]>([]);
  const [allContracts, setAllContracts] = useState<any[]>([]);
  const [sortAZ, setSortAZ] = useState(false);
  const [quickEmp, setQuickEmp] = useState<any>(null);
  const [quickHire, setQuickHire] = useState('');
  const [quickEnd, setQuickEnd] = useState('');
  const [quickTermEnd, setQuickTermEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadData = async () => {
    const exp = await api.getContractsExpiring();
    setExpiring(exp || []);
    const emps = await api.getEmployees();
    const withEnd = (emps || []).filter((e: any) => e.end_date);
    setAllContracts(withEnd);
  };

  useEffect(() => { loadData(); }, []);

const openQuick = (emp: any) => {
    setQuickEmp(emp);
    setQuickHire(emp.hire_date || '');
    setQuickEnd(emp.end_date || '');
    setQuickTermEnd(emp.end_date || '');
  };

  const handleQuickSave = async () => {
    if (!quickEmp || saving) return;
    setSaving(true);
    try {
      const full = await api.getEmployee(quickEmp.id);
      if (full) {
        full.hire_date = quickHire;
        full.end_date = quickEnd;
        await api.updateEmployee(full);
        setQuickEmp(null);
        loadData();
        showToast(String(t('conSaved')));
      }
    } catch { /* noop */ }
    setSaving(false);
  };

  const handleTerminate = async () => {
    if (!quickEmp || saving) return;
    setSaving(true);
    try {
      const full = await api.getEmployee(quickEmp.id);
      if (full) {
        full.status = 'terminated';
        if (quickTermEnd) full.end_date = quickTermEnd;
        await api.updateEmployee(full);
        setQuickEmp(null);
        loadData();
        showToast(String(t('conSaved')));
      }
    } catch { /* noop */ }
    setSaving(false);
  };
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedContracts = sortAZ ? [...allContracts].sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '', 'fr')) : allContracts;
  const soonSorted = sortedContracts.filter((c: any) => c.end_date >= todayStr);
  const expiredSorted = sortedContracts.filter((c: any) => c.end_date < todayStr);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{t('conTitle')}</h1>
            <p className="page-h1-sub">{t('conSubtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSortAZ(v => !v)} title={t('empSortAZ')} className={`togg-btn ${sortAZ ? 'active' : ''}`}><ArrowDownAZ className="w-4 h-4" /> {t('empSortAZ')}</button>
          <button onClick={loadData} className="tool-action tool-action-refresh">
            <RefreshCw className="w-4 h-4" /> {t('conActualiser')}
          </button>
          <button onClick={() => navigateTo('employees')} className="btn-secondary">
            <BellRing className="w-4 h-4" /> {t('conViewAll')}
          </button>
        </div>
      </div>

      {/* Expiring within 15 days */}
      <div className={`glass-card p-5 border ${isDark ? 'border-amber-500/30' : 'border-amber-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
            <FileWarning className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-surface-700'}`}>{t('conExpiringTitle')}</h3>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-surface-400'}`}>{t('conExpiredToday')}</p>
          </div>
        </div>

        {expiring.length === 0 ? (
          <div className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-surface-400'}`}>{t('conNoExpiring')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expiring.map(emp => (
              <div
                key={emp.id}
                onClick={() => navigateTo('employees', emp.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all group ${emp.days_remaining <= 3 ? (isDark ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20' : 'border-red-200 bg-red-50 hover:bg-red-100/70') : (isDark ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20' : 'border-amber-200 bg-amber-50 hover:bg-amber-100/70')}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-surface-800'}`}>{emp.last_name} {emp.first_name}</p>
                    <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-surface-500'}`}>{emp.position || emp.department_name || '-'} · {emp.contract_type || '-'}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-surface-400'}`}>{t('empEndDate')}: {formatDate(emp.end_date)}</p>
                    <button onClick={(e) => { e.stopPropagation(); navigateTo('employees', emp.id); }} title={t('conViewFile')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#14305a] hover:text-[#f5a623] dark:!text-blue-400 dark:hover:!text-amber-300 transition-colors"><Eye className="w-3.5 h-3.5" /> {t('conViewFile')}</button>
                  </div>
                  <div className="text-left shrink-0">
<div className="w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 exp-circle border-red-400 text-red-500">
  <span className="text-lg font-bold leading-none text-center w-full">{emp.days_remaining}</span>
  <span className={`text-[9px] leading-none text-center w-full px-0.5 mt-0.5 ${isDark ? 'text-slate-400' : 'text-surface-500'}`}>{t('conDaysRemaining')}</span>
</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All contracts */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-surface-700'}`}>{t('conTitle')}</h3>
          <button onClick={() => navigateTo('employees')} className={`flex items-center gap-1 text-xs font-medium transition-all ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-[#14305a] hover:text-[#20487c]'}`}>
            {t('conViewAll')} <ArrowRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {allContracts.length === 0 ? (
          <div className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-surface-400'}`}>{t('conNoExpiring')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-surface-100'}`}>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('empMatricule')}</th>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('empName')}</th>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('empDepartment')}</th>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('empContractType')}</th>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('empEndDate')}</th>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('conDaysRemaining')}</th>
                  <th className={`text-left py-2 px-2 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-surface-400'}`}>{t('empStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {[...soonSorted, ...expiredSorted].map(emp => {
                  const remaining = Math.ceil((new Date(emp.end_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = remaining < 0;
                  return (
                    <tr
                      key={emp.id}
                onClick={() => openQuick(emp)}
                      className={`border-b cursor-pointer transition-all ${isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-surface-50 hover:bg-surface-50'}`}
                    >
                      <td className={`py-2 px-2 font-medium ${isDark ? 'text-slate-200' : 'text-surface-700'}`}>{emp.matricule}</td>
                      <td className={`py-2 px-2 ${isDark ? 'text-slate-200' : 'text-surface-700'}`}>{emp.last_name} {emp.first_name}</td>
                      <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-surface-500'}`}>{emp.department_name || '-'}</td>
                      <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-surface-500'}`}>{emp.contract_type || '-'}</td>
                      <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-surface-500'}`}>{formatDate(emp.end_date)}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${isExpired ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') : remaining <= 15 ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')}`}>
                          <CalendarX2 className="w-3 h-3" />
                          {isExpired ? t('conDanger') : `${remaining} ${t('conDaysRemaining')}`}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        {emp.renewal_date ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                            <RefreshCw className="w-3 h-3" /> {t('conRenewed')}
                          </span>
                        ) : (
                          <span className={isDark ? 'text-slate-300' : 'text-surface-500'}>{emp.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="glass-card px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-emerald-600 dark:!text-emerald-300 flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> {toast}
          </div>
        </div>
      )}

      {quickEmp && (
        <div className="modal-overlay" onClick={() => !saving && setQuickEmp(null)}>
          <div className="modal-content w-full max-w-sm p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-surface-800 dark:!text-slate-100">{quickEmp.last_name} {quickEmp.first_name}</h3>
              <button onClick={() => !saving && setQuickEmp(null)} className="p-2 hover:bg-surface-100 dark:hover:!bg-slate-700 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-surface-500 dark:!text-slate-400 mb-5">{quickEmp.matricule || ''} · {quickEmp.position || '-'} · {quickEmp.contract_type || '-'}</p>

            <p className="text-xs font-bold uppercase tracking-wide text-surface-500 dark:!text-slate-400 mb-2">{t('conQuickEdit')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">{t('empHireDate')}</label><input type="date" value={quickHire} onChange={(e) => setQuickHire(e.target.value)} className="input-field" /></div>
              <div><label className="label-field">{t('empEndDate')}</label><input type="date" value={quickEnd} onChange={(e) => setQuickEnd(e.target.value)} className="input-field" /></div>
            </div>
            <button onClick={handleQuickSave} disabled={saving} className="btn-primary w-full justify-center mt-3 disabled:opacity-50">
              <Edit2 className="w-4 h-4" /> {t('empUpdate')}
            </button>

            <div className="my-4 border-t border-surface-100 dark:!border-slate-700" />

            <p className="text-xs font-bold uppercase tracking-wide text-surface-500 dark:!text-slate-400 mb-1">{t('conTerminate')}</p>
            <p className="text-[11px] text-surface-400 dark:!text-slate-500 mb-2">{t('conTerminateHint')}</p>
            <div className="flex gap-2">
              <div className="flex-1"><label className="label-field">{t('empEndDate')}</label><input type="date" value={quickTermEnd} onChange={(e) => setQuickTermEnd(e.target.value)} className="input-field" /></div>
              <div className="flex items-end">
                <button onClick={handleTerminate} disabled={saving} className="btn-danger disabled:opacity-50">
                  <CalendarX2 className="w-4 h-4" /> {t('conTerminate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
