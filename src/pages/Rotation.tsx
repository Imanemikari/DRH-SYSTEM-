import { useState, useEffect, Fragment } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { useHelpers } from '../utils/helpers';
import { RefreshCw, CalendarCheck, AlertTriangle, CheckCircle2, ArrowDownAZ, X, Edit2, Edit3, CalendarOff, LogIn, Clock, Sun, Table2, Save, History, ChevronDown, ChevronUp } from 'lucide-react';

interface RotationProps {
  navigateTo: (page: string, id?: number) => void;
}

interface RotationRow {
  id: number;
  matricule: string;
  first_name: string;
  last_name: string;
  position: string;
  department_name: string;
  hire_date: string;
  status: string;
  cycle_start: string;
  sortie_date: string | null;
  worked_days: number;
  remaining: number;
  eligible: boolean;
  near_alert: boolean;
  leave_finished: boolean;
  rotation_status: string;
  leave_start: string;
  leave_end: string;
  leave_days: number;
}

interface CumulPeriod {
  id: number;
  cycle_start: string;
  cycle_end: string | null;
  worked_days: number;
  leave_start: string | null;
  leave_end: string | null;
  leave_days: number;
  return_date: string | null;
  notes: string;
}

interface CumulRow {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  department_name: string;
  current_status: string;
  current_cycle_start: string;
  current_worked: number;
  current_eligible: boolean;
  leave_start: string;
  leave_end: string;
  leave_days: number;
  periods: CumulPeriod[];
  total_worked: number;
  total_leave_taken: number;
  entitlement_days: number;
  solde_adjust: number;
  remaining_balance: number;
  owed_days: number;
}

export default function Rotation({ navigateTo }: RotationProps) {
  const { t } = useLang();
  const { formatDate } = useHelpers();
  const [rows, setRows] = useState<RotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAZ, setSortAZ] = useState(false);

  // Filters
  const [filterPositions, setFilterPositions] = useState<string[]>([]);
  const [entryFrom, setEntryFrom] = useState('');
  const [entryTo, setEntryTo] = useState('');

  // Cumulative ledger view
  const [cumulView, setCumulView] = useState(false);
  const [cumulData, setCumulData] = useState<CumulRow[]>([]);
  const [cumulLoading, setCumulLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [periodEdits, setPeriodEdits] = useState<Record<number, { worked_days: string; leave_days: string; return_date: string; cycle_end: string }>>({});
  const [soldeEditId, setSoldeEditId] = useState<number | null>(null);
  const [soldeEditValue, setSoldeEditValue] = useState('');
  const [soldeSaving, setSoldeSaving] = useState(false);

  // Edit dates modal
  const [editTarget, setEditTarget] = useState<RotationRow | null>(null);
  const [editEntry, setEditEntry] = useState('');
  const [editSortie, setEditSortie] = useState('');

  // Grant leave modal
  const [grantTarget, setGrantTarget] = useState<RotationRow | null>(null);
  const [grantDays, setGrantDays] = useState(8);
  const [grantError, setGrantError] = useState('');
  const [granting, setGranting] = useState(false);

  // Decision modal (leave ended)
  const [decisionTarget, setDecisionTarget] = useState<RotationRow | null>(null);
  const [decision, setDecision] = useState<'returned' | 'extended' | null>(null);
  const [extendDate, setExtendDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  const [toast, setToast] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (cumulView) loadCumul(); }, [cumulView]);

  const loadData = async () => {
    setLoading(true);
    const data = await api.getDeplacement();
    setRows(data || []);
    setLoading(false);
  };

  const loadCumul = async () => {
    setCumulLoading(true);
    const data = await api.getDeplacementCumul();
    setCumulData(data || []);
    setCumulLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const allPositions = Array.from(new Set(rows.map(r => r.position).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));

  const togglePosition = (pos: string) => {
    setFilterPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  const filteredRows = rows.filter(r => {
    if (filterPositions.length > 0 && !filterPositions.includes(r.position)) return false;
    if (entryFrom && r.cycle_start && r.cycle_start < entryFrom) return false;
    if (entryTo && r.cycle_start && r.cycle_start > entryTo) return false;
    return true;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortAZ) return (a.last_name || '').localeCompare(b.last_name || '', 'fr');
    return a.worked_days === b.worked_days ? (a.last_name || '').localeCompare(b.last_name || '', 'fr') : b.worked_days - a.worked_days;
  });

  // --- MODIFIER dates ---
  const openEdit = (row: RotationRow) => {
    setEditTarget(row);
    setEditEntry(row.cycle_start || '');
    setEditSortie(row.sortie_date || '');
  };

  const saveDates = async () => {
    if (!editTarget || !editEntry) return;
    const res = await api.updateDeplacementDates(editTarget.id, editEntry, editSortie || undefined);
    if (res?.success) {
      showToast(`${editTarget.last_name} ${editTarget.first_name} — dates mises à jour (${res.worked_days}j)`);
      setEditTarget(null);
      loadData();
    }
  };

  // --- GRANT LEAVE ---
  const openGrant = (row: RotationRow) => {
    setGrantTarget(row);
    setGrantDays(8);
    setGrantError('');
  };

  const handleGrant = async () => {
    if (!grantTarget) return;
    if (!grantDays || grantDays < 8) { setGrantError(t('rotMin8') as string); return; }
    setGranting(true);
    const res = await api.grantRotationLeave(grantTarget.id, grantDays);
    setGranting(false);
    if (res?.success) {
      const msg = (t('rotGrantedMsg') as string).replace('{days}', String(res.days)).replace('{start}', formatDate(res.leave_start)).replace('{end}', formatDate(res.leave_end));
      showToast(`${t('rotGranted')} — ${msg}`);
      setGrantTarget(null);
      loadData();
    } else {
      setGrantError(res?.error || 'Error');
    }
  };

  // --- DECISION (return / extend) ---
  const openDecision = (row: RotationRow) => {
    setDecisionTarget(row);
    setDecision(null);
    setExtendDate('');
    setReturnDate(new Date().toISOString().split('T')[0]);
  };

  const handleResolve = async () => {
    if (!decisionTarget || !decision) return;
    if (decision === 'extended' && !extendDate) return;
    if (decision === 'returned' && !returnDate) return;
    const res = await api.resolveRotationLeave(
      decisionTarget.id,
      decision,
      decision === 'extended' ? extendDate : undefined,
      decision === 'returned' ? returnDate : undefined,
      decision === 'returned' ? returnDate : undefined
    );
    if (res?.success) {
      showToast(decision === 'returned' ? `Nouveau cycle démarré` : `Congé prolongé`);
      setDecisionTarget(null);
      setDecision(null);
      loadData();
    }
  };

  // --- CUMUL DETAIL (inline expand) ---
  const toggleExpand = (row: CumulRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    const edits: Record<number, { worked_days: string; leave_days: string; return_date: string; cycle_end: string }> = {};
    row.periods.forEach(p => {
      edits[p.id] = { worked_days: String(p.worked_days), leave_days: String(p.leave_days), return_date: p.return_date || '', cycle_end: p.cycle_end || '' };
    });
    setPeriodEdits(edits);
  };

  const setPeriodField = (periodId: number, field: 'worked_days' | 'leave_days' | 'return_date' | 'cycle_end', value: string) => {
    setPeriodEdits(prev => {
      const base = prev[periodId] || { worked_days: '', leave_days: '', return_date: '', cycle_end: '' };
      return { ...prev, [periodId]: { ...base, [field]: value } };
    });
  };

  const savePeriod = async (periodId: number) => {
    const ed = periodEdits[periodId];
    if (!ed) return;
    const res = await api.updateCumulDays(periodId, parseInt(ed.worked_days) || 0, parseInt(ed.leave_days) || 0, ed.return_date || undefined, ed.cycle_end || undefined);
    if (res?.success) {
      showToast(`${t('rotSavedCumul')}`);
      loadCumul();
      loadData();
    }
  };

  // --- SOLDE RESTANT edit (modifier days directly) ---
  const openSoldeEdit = (row: CumulRow) => {
    setSoldeEditId(row.id);
    setSoldeEditValue(String(row.solde_adjust || 0));
  };

  const saveSolde = async (employeeId: number) => {
    setSoldeSaving(true);
    const res = await api.updateDeplacementSolde(employeeId, parseInt(soldeEditValue) || 0);
    setSoldeSaving(false);
    if (res?.success) {
      showToast(`${t('rotSavedSolde')} (${res.solde_adjust > 0 ? '+' : ''}${res.solde_adjust}j)`);
      setSoldeEditId(null);
      setSoldeEditValue('');
      loadCumul();
      loadData();
    }
  };

  const getStatusBadge = (row: RotationRow) => {
    if (row.leave_finished) return <span className="badge badge-warning">{t('rotDecisionNeeded')}</span>;
    if (row.rotation_status === 'on_leave') return <span className="badge badge-info">{t('rotOnLeave')}</span>;
    if (row.eligible) return <span className="badge badge-success">{t('rotEligible')}</span>;
    if (row.near_alert) return <span className="badge badge-danger">{t('rotAlert')}</span>;
    return <span className="badge badge-success">{t('rotActive')}</span>;
  };

  const total = rows.length;
  const eligibleCount = rows.filter(r => r.eligible).length;
  const onLeave = rows.filter(r => r.rotation_status === 'on_leave' && !r.leave_finished).length;
  const alertCount = rows.filter(r => r.near_alert).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{t('rotTitle')}</h1>
            <p className="page-h1-sub">{t('rotSubtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSortAZ(!sortAZ)} className={`togg-btn ${sortAZ ? 'active' : ''}`} title={t('empSortAZ')}>
            <ArrowDownAZ className="w-4 h-4" /><span>{t('empSortAZ')}</span>
          </button>
          <button onClick={() => setCumulView(!cumulView)} className={`togg-btn ${cumulView ? 'active' : ''}`} title={t('rotCumul')}>
            <Table2 className="w-4 h-4" /><span>{t('rotCumul')}</span>
          </button>
          <button onClick={loadData} className="tool-action tool-action-refresh"><RefreshCw className="w-4 h-4" /> {t('conActualiser')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center shadow-lg shadow-blue-900/25"><CalendarCheck className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('empNo')} DEPLACE</p><p className="text-lg font-bold tabnum text-surface-800">{total}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25"><CheckCircle2 className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('rotEligible')}</p><p className="text-lg font-bold tabnum text-emerald-600">{eligibleCount}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25"><AlertTriangle className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('rotAlert')}</p><p className="text-lg font-bold tabnum text-amber-600">{alertCount}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25"><CalendarOff className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('rotOnLeave')}</p><p className="text-lg font-bold tabnum text-red-600">{onLeave}</p></div></div></div>
      </div>

      {!cumulView && (
        <>
          {/* Filters: profession + entry date */}
          {allPositions.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide mr-1">{t('empFilterProfessions')}</span>
                {allPositions.map(pos => {
                  const checked = filterPositions.includes(pos);
                  return (
                    <label key={pos} className={`prof-check ${checked ? 'checked' : 'unchecked'} cursor-pointer`}>
                      <input type="checkbox" checked={checked} onChange={() => togglePosition(pos)} className="w-3.5 h-3.5 accent-[#f5a623]" />
                      <span className="text-xs">{pos}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center flex-wrap gap-3 mt-3">
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{t('rotEntryDate')}</span>
                <input type="date" value={entryFrom} onChange={(e) => setEntryFrom(e.target.value)} className="input-field !w-auto !py-1.5 !text-xs" title={t('rotFilterDateFrom')} />
                <span className="text-xs text-surface-400">→</span>
                <input type="date" value={entryTo} onChange={(e) => setEntryTo(e.target.value)} className="input-field !w-auto !py-1.5 !text-xs" title={t('rotFilterDateTo')} />
                {(filterPositions.length > 0 || entryFrom || entryTo) && (
                  <button onClick={() => { setFilterPositions([]); setEntryFrom(''); setEntryTo(''); }} className="text-xs text-red-500 hover:underline flex items-center gap-1"><X className="w-3.5 h-3.5" /> {t('rotClearFilters')}</button>
                )}
              </div>
            </div>
          )}

          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2 text-right text-[11px]">{t('empMatricule')}</th>
                  <th className="px-3 py-2 text-right text-[11px]">{t('empName')}</th>
                  <th className="px-3 py-2 text-right text-[11px]">{t('rotProfession')}</th>
                  <th className="px-3 py-2 text-center text-[11px]">{t('rotEntryDate')}</th>
                  <th className="px-3 py-2 text-center text-[11px]">{t('rotSortieDate')}</th>
                  <th className="px-3 py-2 text-right text-[11px]">{t('rotDaysWorked')}</th>
                  <th className="px-3 py-2 text-right text-[11px]">{t('rotRemaining')}</th>
                  <th className="px-3 py-2 text-right text-[11px]">{t('empStatus')}</th>
                  <th className="px-3 py-2 text-center text-[11px]">{t('empActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {sortedRows.map(row => {
                  const pct = Math.min(100, Math.round((row.worked_days / 22) * 100));
                  const barColor = row.rotation_status === 'on_leave' ? 'bg-blue-500' : row.eligible ? 'bg-emerald-500' : row.near_alert ? 'bg-red-500' : 'bg-[#f5a623]';
                  return (
                    <tr key={row.id} onClick={() => navigateTo('employees', row.id)} className="table-row-hover transition-colors cursor-pointer">
                      <td className="px-3 py-2 text-xs font-mono text-surface-600">{row.matricule}</td>
                      <td className="px-3 py-2 text-[13px] font-medium text-surface-800">{row.last_name} {row.first_name}</td>
                      <td className="px-3 py-2 text-xs text-surface-600">{row.position || '-'}</td>
                      <td className="px-3 py-2 text-center text-xs text-surface-600">{formatDate(row.cycle_start)}</td>
                      <td className="px-3 py-2 text-center text-xs text-surface-600">{row.sortie_date ? formatDate(row.sortie_date) : '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-100 dark:!bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold tabnum text-surface-700 dark:!text-slate-200">{row.worked_days}<span className="text-surface-400 font-normal">/22</span></span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs tabnum text-surface-600">{row.rotation_status === 'on_leave' ? '-' : row.remaining}</td>
                      <td className="px-3 py-2">{getStatusBadge(row)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(row)} className="icon-btn hover:!text-amber-500 hover:!bg-amber-50" title={t('empEdit')}><Edit2 className="w-3.5 h-3.5" /></button>
                          {row.rotation_status === 'on_leave' && !row.leave_finished && (
                            <span className="icon-btn !cursor-default text-amber-500 animate-pulse" title={t('rotOngoingHint')}>
                              <Sun className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {row.eligible && row.rotation_status === 'active' && (
                            <button onClick={() => openGrant(row)} className="icon-btn p-1.5 bg-emerald-500 text-white hover:!bg-emerald-600 shadow-lg shadow-emerald-500/30" title={`${t('rotValidateLeave')} — ${t('rotValidateHint')}`}><CalendarCheck className="w-4 h-4" /></button>
                          )}
                          {row.leave_finished && (
                            <button onClick={() => openDecision(row)} className="icon-btn p-1.5 bg-blue-500 text-white hover:!bg-blue-600 shadow-lg shadow-blue-500/30" title={t('rotResolve')}><LogIn className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-surface-400 text-sm">{t('rotNoData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* === CUMUL LEDGER VIEW === */}
      {cumulView && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:!border-slate-700">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-surface-800">{t('rotCumulTitle')}</h2>
            </div>
            <button onClick={loadCumul} className="icon-btn hover:!text-amber-500" title={t('conActualiser')}><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2 text-right text-[11px]">{t('empName')}</th>
                <th className="px-3 py-2 text-right text-[11px]">{t('rotProfession')}</th>
                <th className="px-3 py-2 text-right text-[11px]">{t('rotCumulWorked')}</th>
                <th className="px-3 py-2 text-right text-[11px]">{t('rotCumulEntitlement')}</th>
                <th className="px-3 py-2 text-right text-[11px]">{t('rotCumulTaken')}</th>
                <th className="px-3 py-2 text-right text-[11px]">{t('rotCumulBalance')}</th>
                <th className="px-3 py-2 text-center text-[11px]">{t('empActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {cumulLoading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400 text-sm">...</td></tr>
              )}
              {!cumulLoading && cumulData.map(row => {
                const isOpen = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="table-row-hover transition-colors">
                      <td className="px-3 py-2 text-[13px] font-medium text-surface-800">{row.last_name} {row.first_name}</td>
                      <td className="px-3 py-2 text-xs text-surface-600">{row.position || '-'}</td>
                      <td className="px-3 py-2 text-xs tabnum text-surface-700 dark:!text-slate-200">{row.total_worked}j</td>
                      <td className="px-3 py-2 text-xs tabnum text-emerald-600">{row.entitlement_days}j</td>
                      <td className="px-3 py-2 text-xs tabnum text-surface-600">{row.total_leave_taken}j</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className={`badge ${row.remaining_balance > 0 ? 'badge-success' : row.remaining_balance < 0 ? 'badge-danger' : 'badge-info'}`}>
                            {row.remaining_balance > 0 ? `+${row.remaining_balance}j` : row.remaining_balance < 0 ? `${row.remaining_balance}j` : '0j'}
                          </span>
                          {soldeEditId === row.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="number"
                                autoFocus
                                value={soldeEditValue}
                                onChange={(e) => setSoldeEditValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveSolde(row.id); if (e.key === 'Escape') setSoldeEditId(null); }}
                                className="input-field !w-16 !py-1 !px-1.5 !text-xs"
                                placeholder="0"
                              />
                              <button onClick={() => saveSolde(row.id)} disabled={soldeSaving} className="icon-btn p-1.5 bg-emerald-500 text-white hover:!bg-emerald-600" title={t('rotConfirm')}><Save className="w-3 h-3" /></button>
                              <button onClick={() => setSoldeEditId(null)} className="icon-btn hover:!text-red-500" title={t('rotCancel')}><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button onClick={() => openSoldeEdit(row)} className="icon-btn hover:!text-amber-500 hover:!bg-amber-50" title={t('rotEditSolde')}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleExpand(row)} className={`togg-btn ${isOpen ? 'active' : ''}`} title={t('rotEditPeriods')}>
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{t('rotPeriodsLink')} ({row.periods.length})</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface-50 dark:!bg-slate-800/40">
                        <td colSpan={7} className="px-4 py-4">
                          {/* Current cycle summary */}
                          <div className="mb-4 p-3 rounded-xl border border-dashed border-slate-300 dark:!border-slate-600 bg-white dark:!bg-slate-800/50">
                            <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wide mb-2">{t('rotCurrentCycle')}</p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                              <div><span className="text-surface-400 block">{t('rotEntryDate')}</span><span className="font-medium text-surface-700 dark:!text-slate-200">{formatDate(row.current_cycle_start)}</span></div>
                              <div><span className="text-surface-400 block">{t('rotDaysWorked')}</span><span className="font-bold tabnum text-surface-800 dark:!text-slate-100">{row.current_worked}j</span></div>
                              <div><span className="text-surface-400 block">{t('rotCumulEntitlement')}</span><span className="font-medium tabnum text-emerald-600">{row.entitlement_days}j</span></div>
                              <div>
                                <span className="text-surface-400 block">{t('empStatus')}</span>
                                <span className={`badge ${row.current_eligible ? 'badge-success' : row.current_status === 'on_leave' ? 'badge-info' : 'badge-warning'}`}>
                                  {row.current_eligible ? t('rotEligible') : row.current_status === 'on_leave' ? t('rotOnLeave') : t('rotActive')}
                                </span>
                              </div>
                              <div>
                                <span className="text-surface-400 block">{t('rotCumulBalance')}</span>
                                <span className={`badge ${row.remaining_balance > 0 ? 'badge-success' : row.remaining_balance < 0 ? 'badge-danger' : 'badge-info'}`}>
                                  {row.remaining_balance > 0 ? `+${row.remaining_balance}j` : row.remaining_balance < 0 ? `${row.remaining_balance}j` : '0j'}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Past periods */}
                          {row.periods.length > 0 && <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wide mb-2">{t('rotCumulTitle')}</p>}
                          {row.periods.length === 0 && (
                            <p className="text-center text-surface-400 text-xs py-3">{t('rotNoPeriods')}</p>
                          )}
                          <div className="space-y-3">
                            {row.periods.map(p => {
                              const ed = periodEdits[p.id] || { worked_days: String(p.worked_days), leave_days: String(p.leave_days), return_date: p.return_date || '', cycle_end: p.cycle_end || '' };
                              return (
                                <div key={p.id} className="border border-slate-200 dark:!border-slate-700 rounded-xl p-3 bg-white dark:!bg-slate-800/40">
                                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                    <p className="text-xs font-semibold text-surface-600">
                                      {t('rotPeriod')} {formatDate(p.cycle_start)}{p.cycle_end ? ` → ${formatDate(p.cycle_end)}` : ''}
                                    </p>
                                    {p.notes && <span className="badge badge-warning text-[11px]">{p.notes}</span>}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div>
                                      <label className="label-field">{t('rotDaysWorked')}</label>
                                      <input type="number" min={0} value={ed.worked_days} onChange={(e) => setPeriodField(p.id, 'worked_days', e.target.value)} className="input-field !py-1.5 !text-xs" />
                                    </div>
                                    <div>
                                      <label className="label-field">{t('rotLeaveDays')}</label>
                                      <input type="number" min={0} value={ed.leave_days} onChange={(e) => setPeriodField(p.id, 'leave_days', e.target.value)} className="input-field !py-1.5 !text-xs" />
                                    </div>
                                    <div>
                                      <label className="label-field">{t('rotReturnDate')}</label>
                                      <input type="date" value={ed.return_date} onChange={(e) => setPeriodField(p.id, 'return_date', e.target.value)} className="input-field !py-1.5 !text-xs" />
                                    </div>
                                    <div>
                                      <label className="label-field">{t('rotCycleEnd')}</label>
                                      <input type="date" value={ed.cycle_end} onChange={(e) => setPeriodField(p.id, 'cycle_end', e.target.value)} className="input-field !py-1.5 !text-xs" />
                                    </div>
                                    <div className="flex items-end">
                                      <button onClick={() => savePeriod(p.id)} className="btn-primary !py-1.5 !px-3 text-xs w-full flex items-center justify-center gap-1"><Save className="w-3.5 h-3.5" /> {t('rotSavePeriod')}</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!cumulLoading && cumulData.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400 text-sm">{t('rotNoData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* === EDIT DATES MODAL === */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal-content w-full max-w-md p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-800">{t('rotModifierDates')}</h2>
              <button onClick={() => setEditTarget(null)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {editTarget.first_name?.[0] || ''}{editTarget.last_name?.[0] || ''}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-800">{editTarget.last_name} {editTarget.first_name}</p>
                <p className="text-xs text-surface-500">{editTarget.matricule} · {editTarget.position || '-'}</p>
              </div>
            </div>
            <label className="label-field">{t('rotEntryDate')} *</label>
            <input type="date" value={editEntry} onChange={(e) => setEditEntry(e.target.value)} className="input-field" />
            <label className="label-field mt-3">{t('rotSortieDate')}</label>
            <input type="date" value={editSortie} onChange={(e) => setEditSortie(e.target.value)} className="input-field" />
            <p className="text-xs text-surface-400 mt-1">{t('rotSortieHint')}</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1">{t('rotCancel')}</button>
              <button onClick={saveDates} className="btn-primary flex-1">{t('rotConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* === GRANT LEAVE MODAL === */}
      {grantTarget && (
        <div className="modal-overlay" onClick={() => setGrantTarget(null)}>
          <div className="modal-content w-full max-w-md p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-800">{t('rotGrantTitle')}</h2>
              <button onClick={() => setGrantTarget(null)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:!bg-emerald-500/10 text-sm text-emerald-700 dark:!text-emerald-300">
              {t('rotGrantMsg')}
            </div>
            <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:!bg-blue-500/10 text-xs text-blue-600 dark:!text-blue-300 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 flex-shrink-0" /> {t('rotValidateHint')}
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {grantTarget.first_name?.[0] || ''}{grantTarget.last_name?.[0] || ''}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-800">{grantTarget.last_name} {grantTarget.first_name}</p>
                <p className="text-xs text-surface-500">{grantTarget.matricule} · {grantTarget.worked_days}j travaillés</p>
              </div>
            </div>
            <label className="label-field">{t('rotGrantDays')} *</label>
            <input type="number" min={8} value={grantDays} onChange={(e) => setGrantDays(parseInt(e.target.value) || 0)} className="input-field" />
            <p className="text-xs text-surface-400 mt-1">{t('rotDaysHint')}</p>
            {grantError && <p className="text-xs text-red-500 mt-2">{grantError}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setGrantTarget(null)} className="btn-secondary flex-1">{t('rotCancel')}</button>
              <button onClick={handleGrant} disabled={granting} className="btn-primary flex-1">{granting ? '...' : t('rotConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* === DECISION MODAL (leave ended) === */}
      {decisionTarget && (
        <div className="modal-overlay" onClick={() => setDecisionTarget(null)}>
          <div className="modal-content w-full max-w-md p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-800">{t('rotDecisionTitle')}</h2>
              <button onClick={() => setDecisionTarget(null)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:!bg-amber-500/10 text-sm text-amber-700 dark:!text-amber-300">
              {t('rotDecisionMsg')}
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {decisionTarget.first_name?.[0] || ''}{decisionTarget.last_name?.[0] || ''}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-800">{decisionTarget.last_name} {decisionTarget.first_name}</p>
                <p className="text-xs text-surface-500">{t('rotLeaveEnded')}: {formatDate(decisionTarget.leave_end)}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={() => setDecision('returned')}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                  decision === 'returned' ? 'border-emerald-500 bg-emerald-50 dark:!bg-emerald-500/10 text-emerald-700 dark:!text-emerald-300' : 'border-slate-200 dark:!border-slate-600 hover:bg-slate-50 dark:hover:!bg-slate-700'
                }`}
              >
                <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> {t('rotReturned')}</span>
                <span className="text-xs text-surface-400 block mt-1">{t('rotReturnedHint')}</span>
              </button>
              <button
                onClick={() => setDecision('extended')}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                  decision === 'extended' ? 'border-blue-500 bg-blue-50 dark:!bg-blue-500/10 text-blue-700 dark:!text-blue-300' : 'border-slate-200 dark:!border-slate-600 hover:bg-slate-50 dark:hover:!bg-slate-700'
                }`}
              >
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {t('rotExtended')}</span>
                <span className="text-xs text-surface-400 block mt-1">{t('rotExtendedHint')}</span>
              </button>
            </div>

            {decision === 'returned' && (
              <div className="mb-4">
                <label className="label-field">{t('rotReturnDate')} *</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="input-field" />
              </div>
            )}
            {decision === 'extended' && (
              <div className="mb-4">
                <label className="label-field">{t('rotNewLeaveEnd')} *</label>
                <input type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} className="input-field" />
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setDecisionTarget(null)} className="btn-secondary flex-1">{t('rotCancel')}</button>
              <button onClick={handleResolve} disabled={!decision} className="btn-primary flex-1">{t('rotConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="glass-card px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-emerald-600 dark:!text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {toast}
          </div>
        </div>
      )}
    </div>
  );
}