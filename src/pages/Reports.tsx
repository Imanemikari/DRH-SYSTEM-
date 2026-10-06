import { useMemo, useState, useEffect } from 'react';
import { api } from '../utils/api';
import EmailModal from '../components/EmailModal';
import { useHelpers } from '../utils/helpers';
import { makeSeal, sealFooterHtml } from '../utils/docSeal';
import { useLang } from '../context/LangContext';
import {
  BarChart3, Users, UserCheck, UserMinus, Building2, UserPlus, FileText,
  RefreshCw, Printer, FileSpreadsheet, FileType, Clock, MapPin, TrendingUp, Layers,
  Activity,   Sparkles, Calendar, ChevronDown, Mail,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from 'recharts';

interface ReportsProps {
  navigateTo: (page: string, id?: number) => void;
}

const COLORS = ['#14305a', '#f5a623', '#20487c', '#f7c948', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const CODES = ['P', 'CR', 'CA', 'JF', 'CM', 'CD', 'AA', 'AI', 'AT', 'SS', 'MAT'] as const;
const CODE_COLOR: Record<string, string> = {
  P: '#10b981', CR: '#3b82f6', CA: '#f5a623', JF: '#ef4444', CM: '#ec4899',
  CD: '#8b5cf6', AA: '#06b6d4', AI: '#64748b', AT: '#f97316', SS: '#65a30d', MAT: '#d946ef',
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#14305a', color: '#fff', border: '1px solid #f5a623', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
      {label !== undefined && label !== '' && <p style={{ fontWeight: 700, marginBottom: 4, color: '#f7c948' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: '2px 0', color: '#e2e8f0' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, marginInlineEnd: 6, background: p.color || p.fill || '#f5a623' }} />
          {p.name}: <span style={{ fontWeight: 700, color: '#fff' }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const Section = ({ title, icon: Icon, t }: any) => (
  <div className="flex items-center gap-2 pt-1">
    <span className="w-1.5 h-5 rounded-full bank-gold-bg" />
    <Icon className="w-4 h-4 text-[#f5a623]" />
    <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-surface-600 dark:!text-slate-300">{title}</h2>
    <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
  </div>
);

export default function Reports({ navigateTo }: ReportsProps) {
  const { t, lang, tArray } = useLang();
  const { getStatusLabel } = useHelpers();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [companyName, setCompanyName] = useState('DRH System');

  const months = tArray('payMonths');

  useEffect(() => { loadData(); }, [year, month]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const loadData = async () => {
    setLoading(true);
    const [res, settings] = await Promise.all([api.getReports({ year, month }), api.getSettings()]);
    setData(res);
    if (settings && settings.company_name) setCompanyName(settings.company_name);
    setLoading(false);
  };

  const monthLabel = months[month - 1] || String(month);
  const title = `${t('repTitle')} — ${monthLabel} ${year}`;

  const safe = (arr: any) => (Array.isArray(arr) ? arr.filter(x => x && x.name != null && x.name !== '') : []);
  const sum = (arr: any) => safe(arr).reduce((s, x) => s + (x.count || 0), 0);

  const buildExportHTML = () => {
    const kpiRows = [
      [t('repKpiTotal'), data?.summary?.total], [t('repKpiActive'), data?.summary?.active],
      [t('repKpiOnLeave'), data?.summary?.on_leave], [t('repKpiTerminated'), data?.summary?.terminated],
      [t('repKpiDepartments'), data?.summary?.departments], [t('repKpiHiresYear'), data?.summary?.hires_year],
      [t('repKpiDocuments'), data?.summary?.documents], [t('repOvertime'), (data?.overtime?.total || 0) + ' h'],
    ];
    const simpleTable = (headers: string[], rows: any[][]) =>
      `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const section = (ttl: string, tbl: string) => `<h2>${ttl}</h2>${tbl}`;

    const fnRows = safe(data?.byDepartment).map(r => [r.name, r.count]);
    const ctRows = safe(data?.byContractType).map(r => [r.name, r.count]);
    const stRows = safe(data?.byStatus).map(r => [r.name, r.count]);
    const posRows = safe(data?.byPosition).map(r => [r.name, r.count]);
    const hireRows = (data?.hiresByMonth || []).map((r: any) => [months[r.month - 1] || r.month, r.count]);
    const leaveRows = safe(data?.leavesByType).map(r => [r.name, r.count, r.days]);
    const attRows = CODES.map(c => [t('pdCode' + c), data?.attendance?.[c] || 0]);
    const otRows = (data?.overtimeTop || []).map((r: any) => [`${r.last_name} ${r.first_name}`, r.h50 || 0, r.h75 || 0, r.h100 || 0, r.total || 0]);
    const docRows = safe(data?.docsByGroup).map(r => [r.name, r.count]);
    const ageRows = (data?.ageGroups || []).map((r: any) => [r.name, r.count]);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: Arial, Helvetica, sans-serif; color:#111; }
      .head { text-align:center; border-bottom:2px solid #14305a; padding-bottom:8px; margin-bottom:14px; }
      .head .co { font-size:16pt; font-weight:bold; color:#14305a; }
      .head .tt { font-size:12pt; font-weight:bold; color:#14305a; margin-top:3px; }
      h2 { font-size:11pt; color:#14305a; margin:16px 0 6px; border-left:4px solid #f5a623; padding-left:6px; }
      table { width:100%; border-collapse:collapse; margin-bottom:6px; }
      th, td { border:1px solid #555; padding:3px 6px; font-size:9.5pt; }
      th { background:#14305a; color:#fff; text-align:center; }
      td:first-child { text-align:left; } td { text-align:center; }
      .kpi td:first-child { text-align:left; font-weight:bold; }
    </style></head><body>
      <div class="head"><div class="co">${companyName}</div><div class="tt">${title.toUpperCase()}</div></div>
      ${section(t('repTitle'), simpleTable([t('repEmployee'), t('repCount')], kpiRows as any[][]).replace('<table>', '<table class="kpi">'))}
      ${section(t('repByDepartment'), simpleTable([t('repByDepartment'), t('repCount')], fnRows))}
      ${section(t('repByContract'), simpleTable([t('repByContract'), t('repCount')], ctRows))}
      ${section(t('repByStatus'), simpleTable([t('repByStatus'), t('repCount')], stRows))}
      ${section(t('repByPosition'), simpleTable([t('repByPosition'), t('repCount')], posRows))}
      ${section(t('repHiresByMonth'), simpleTable([t('repMonth'), t('repCount')], hireRows))}
      ${section(t('repLeavesByType'), simpleTable([t('repLeavesByType'), t('repCount'), t('repDays')], leaveRows))}
      ${section(t('repAttendance'), simpleTable([t('repAttendance'), t('repCount')], attRows))}
      ${section(t('repTopOvertime'), simpleTable([t('repEmployee'), 'H50%', 'H75%', 'H100%', t('repTotal')], otRows))}
      ${section(t('repDocs'), simpleTable([t('repDocs'), t('repCount')], docRows))}
      ${section(t('repAgeGroups'), simpleTable([t('repAgeGroups'), t('repCount')], ageRows))}
      ${sealFooterHtml(makeSeal({ title: String(title), rows: [kpiRows, fnRows, ctRows, stRows, posRows, hireRows, leaveRows, attRows, otRows, docRows, ageRows].flatMap(rs => rs.map(r => r.map(c => String(c ?? '')))) }))}
    </body></html>`;
  };

  const buildWorkbook = () => {
    const W = (cm: number) => Math.round(cm * 5.4 * 10) / 10;
    const st = (v: string, s?: number) => ({ v, s: s ?? 0 });
    const n = (v: number, s?: number) => ({ v, s: s ?? 0 });
    const pair = (ttl: string, rows: any[][], w1 = W(6), w2 = W(2)) => {
      const rws: any[][] = [
        [st(companyName, 4), null],
        [st(ttl, 5), null],
        [st(t('repEmployee'), 1), st(t('repCount'), 1)],
        ...rows.map(r => [st(String(r[0] ?? ''), 2), n(Number(r[1]) || 0, 0)]),
      ];
      return { name: '', rows: rws, widths: [w1, w2], merges: [{ r: 1, c: 1, r2: 1, c2: 2 }, { r: 2, c: 1, r2: 2, c2: 2 }] };
    };
    const sheets: any[] = [];
    const add = (name: string, sht: any) => { sht.name = name; sheets.push(sht); };
    add('RESUME', pair(t('repTitle'), [
      [t('repKpiTotal'), data?.summary?.total], [t('repKpiActive'), data?.summary?.active],
      [t('repKpiOnLeave'), data?.summary?.on_leave], [t('repKpiTerminated'), data?.summary?.terminated],
      [t('repKpiDepartments'), data?.summary?.departments], [t('repKpiHiresYear'), data?.summary?.hires_year],
      [t('repKpiDocuments'), data?.summary?.documents], [t('repOvertime'), Math.round(data?.overtime?.total || 0)],
    ]));
    add('PAR FONCTION', pair(t('repByDepartment'), safe(data?.byDepartment).map(r => [r.name, r.count])));
    add('PAR CONTRAT', pair(t('repByContract'), safe(data?.byContractType).map(r => [r.name, r.count])));
    add('PAR STATUT', pair(t('repByStatus'), safe(data?.byStatus).map(r => [r.name, r.count])));
    add('EMBAUCHES', pair(t('repHiresByMonth'), (data?.hiresByMonth || []).map((r: any) => [months[r.month - 1] || r.month, r.count])));
    add('CONGES', pair(t('repLeavesByType'), safe(data?.leavesByType).map(r => [r.name, r.count])));
    add('POINTAGE', pair(t('repAttendance'), CODES.map(c => [t('pdCode' + c), data?.attendance?.[c] || 0])));
    add('HEURES SUP', pair(t('repTopOvertime'), (data?.overtimeTop || []).map((r: any) => [`${r.last_name} ${r.first_name}`, r.total || 0]), W(6), W(2)));
    add('DOCUMENTS', pair(t('repDocs'), safe(data?.docsByGroup).map(r => [r.name, r.count])));
    add('AGES', pair(t('repAgeGroups'), (data?.ageGroups || []).map((r: any) => [r.name, r.count])));
    return sheets;
  };

  const doExport = async (format: string) => {
    setExportOpen(false);
    let res: any;
    if (format === 'xlsx') res = await api.exportXlsx(buildWorkbook(), 'RAPPORTS_');
    else res = await api.exportPointage(buildExportHTML(), format, 'RAPPORTS_');
    if (res && res.success) showToast(t('repExported'));
    else if (res && res.error !== 'Cancelled') alert(t('hsExportFailed') + ': ' + (res.error || ''));
  };

  const doPrint = async () => {
    setExportOpen(false);
    showToast(t('pdPrintSending'));
    const res = await api.printHtml(buildExportHTML(), false);
    if (res && res.success) showToast(t('pdPrintDone'));
    else if (res && String(res.error).toLowerCase() !== 'cancelled') alert(t('pdPrintFailed') + ': ' + (res.error || ''));
  };

  const kpis = [
    { label: t('repKpiTotal'), value: data?.summary?.total || 0, icon: Users, color: '#14305a' },
    { label: t('repKpiActive'), value: data?.summary?.active || 0, icon: UserCheck, color: '#10b981' },
    { label: t('repKpiOnLeave'), value: data?.summary?.on_leave || 0, icon: Clock, color: '#f5a623' },
    { label: t('repKpiTerminated'), value: data?.summary?.terminated || 0, icon: UserMinus, color: '#ef4444' },
    { label: t('repKpiDepartments'), value: data?.summary?.departments || 0, icon: Building2, color: '#20487c' },
    { label: t('repKpiHiresYear'), value: data?.summary?.hires_year || 0, icon: UserPlus, color: '#3b82f6' },
    { label: t('repKpiDocuments'), value: data?.summary?.documents || 0, icon: FileText, color: '#8b5cf6' },
    { label: t('repOvertime'), value: `${data?.overtime?.total || 0} h`, icon: Clock, color: '#e9a820' },
  ];

  const total = data?.summary?.total || 0;
  const active = data?.summary?.active || 0;
  const activityRate = total ? Math.round((active / total) * 100) : 0;
  const topDept = safe(data?.byDepartment)[0];
  const otTop = Array.isArray(data?.overtimeTop) ? data.overtimeTop : [];
  const topOt = otTop[0];

  const insights = [
    { icon: Building2, color: '#20487c', label: t('repInsightTopDept'), value: topDept ? topDept.name : '—', sub: topDept ? `${topDept.count} ${t('repUnitEmployees')}` : '' },
    { icon: Activity, color: '#10b981', label: t('repInsightActivity'), value: `${activityRate}%`, sub: `${active}/${total} ${t('repUnitEmployees')}` },
    { icon: Clock, color: '#f5a623', label: t('repTopOvertime'), value: topOt ? `${topOt.total} h` : '0 h', sub: topOt ? `${topOt.last_name} ${topOt.first_name}` : t('repNoData') },
    { icon: FileText, color: '#8b5cf6', label: t('repKpiDocuments'), value: String(data?.summary?.documents || 0), sub: t('repDocs') },
  ];

  const KPICard = ({ k }: any) => (
    <div className="glass-card p-4 relative overflow-hidden group hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300">
      <div className="absolute -end-5 -top-5 w-20 h-20 rounded-full opacity-[0.08] transition-transform duration-500 group-hover:scale-125" style={{ background: k.color }} />
      <div className="flex items-center gap-3 relative">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ background: k.color + '1f', color: k.color }}>
          <k.icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-surface-400 truncate">{k.label}</p>
          <p className="text-lg font-bold bank-stat-number text-surface-800 dark:!text-slate-100 truncate">{k.value}</p>
        </div>
      </div>
    </div>
  );

  const ChartCard = ({ title: ctitle, children, icon: Icon, height = 260, centerLabel, centerValue }: any) => (
    <div className="glass-card p-4 hover:shadow-card-hover transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#f5a623]/15 flex items-center justify-center">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#f5a623]" />}
        </div>
        <h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{ctitle}</h3>
      </div>
      <div className="relative" style={{ height }}>
        {children}
        {centerLabel !== undefined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold bank-stat-number text-surface-800 dark:!text-slate-100">{centerValue}</span>
            <span className="text-[10px] uppercase tracking-wide text-surface-400">{centerLabel}</span>
          </div>
        )}
      </div>
    </div>
  );

  const donut = (arr: any, totalVal: number) => (
    <ResponsiveContainer width="100%" height="100%">
      <RPieChart>
        <Pie data={safe(arr)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
          {safe(arr).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </RPieChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="bank-hero bank-hero-grid rounded-2xl p-5 sm:p-6 text-white shadow-premium relative z-10 animate-fadeIn">
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true"><div className="mirror-sweep" /></div>
        <div className="flex items-start justify-between flex-wrap gap-4 relative">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="absolute -inset-2.5 rounded-[1.75rem] bg-[#f7c948]/35 blur-xl animate-pulse" />
              <img src="./logo.png" alt="DRH System" className="relative w-20 h-20 rounded-3xl shadow-2xl ring-2 ring-[#ffe066] gold-glow" />
            </div>
            <div>
              {companyName && <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/90 font-semibold">{companyName}</p>}
              <h1 className="text-xl font-bold bank-stat-number">{t('repTitle')}</h1>
              <p className="text-xs text-blue-200/80 mt-0.5">{t('repSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1.5 py-1 backdrop-blur border border-white/15">
              <Calendar className="w-3.5 h-3.5 text-amber-300 ms-1.5" />
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer px-1 py-1 [&>option]:text-slate-900">
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <span className="text-white/30">|</span>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer px-1 py-1 [&>option]:text-slate-900">
                {[year - 2, year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={loadData} className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors" title={t('repRefresh')}><RefreshCw className="w-3.5 h-3.5" /></button>
            </div>

          <button onClick={() => setEmailOpen(true)} className="tool-action tool-action-mail">
            <Mail className="w-4 h-4" /> {t('repEmailSend')}
          </button>
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)} className="tool-action tool-action-gold">
                <Printer className="w-4 h-4" />
                <span>{t('repExport')}</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-80 transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <div className="absolute end-0 mt-2 w-52 rounded-2xl border border-slate-200/70 dark:!border-slate-600 bg-white dark:!bg-slate-800 shadow-xl shadow-slate-900/10 z-50 overflow-hidden p-1.5 animate-scaleIn" onMouseLeave={() => setExportOpen(false)}>
                  <button onClick={doPrint} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-amber-50 dark:hover:!bg-slate-700 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 dark:!bg-amber-500/20 flex items-center justify-center shrink-0"><Printer className="w-4 h-4 text-amber-600" /></span>
                    <span className="text-xs font-semibold">{t('repPrint')}</span>
                  </button>
                  <div className="h-px bg-slate-100 dark:!bg-slate-700 my-1" />
                  <button onClick={() => doExport('pdf')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-red-50 dark:hover:!bg-slate-700 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-red-50 dark:!bg-red-500/20 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-red-500" /></span>
                    <span className="text-xs font-semibold">{t('repExportPdf')}</span>
                  </button>
                  <button onClick={() => doExport('xlsx')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-emerald-50 dark:hover:!bg-slate-700 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:!bg-emerald-500/20 flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /></span>
                    <span className="text-xs font-semibold">{t('repExportExcel')}</span>
                  </button>
                  <button onClick={() => doExport('doc')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-blue-50 dark:hover:!bg-slate-700 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 dark:!bg-blue-500/20 flex items-center justify-center shrink-0"><FileType className="w-4 h-4 text-blue-600" /></span>
                    <span className="text-xs font-semibold">{t('repExportWord')}</span>
                  </button>
                  <div className="h-px bg-slate-100 dark:!bg-slate-700 my-1" />
                  <button onClick={() => setEmailOpen(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-red-50 dark:hover:!bg-red-500/10 transition-colors">
                    <span className="w-8 h-8 rounded-lg bg-red-50 dark:!bg-red-500/15 flex items-center justify-center shrink-0"><span className="text-base leading-none">&#9993;</span></span>
                    <span className="text-xs font-semibold">{t('repEmailSend')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10 text-[11px] text-blue-100/70 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10"><Calendar className="w-3 h-3 text-amber-300" /> {monthLabel} {year}</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-amber-300" /> {t('repGenerated')} {new Date().toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* INSIGHTS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {insights.map((it, i) => (
              <div key={i} className="glass-card p-4 border-s-4 relative overflow-hidden hover:-translate-y-0.5 transition-transform duration-300" style={{ borderInlineStartColor: it.color }}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">{it.label}</p>
                  <it.icon className="w-4 h-4" style={{ color: it.color }} />
                </div>
                <p className="text-lg font-bold bank-stat-number text-surface-800 dark:!text-slate-100 mt-1.5 truncate" title={String(it.value)}>{it.value}</p>
                <p className="text-[11px] text-surface-400 mt-0.5 truncate">{it.sub}</p>
              </div>
            ))}
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map((k, i) => <KPICard key={i} k={k} />)}
          </div>

          {/* EFFECTIF & STRUCTURE */}
          <Section title={t('repSectionEffectif')} icon={Users} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t('repByDepartment')} icon={Building2}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safe(data.byDepartment)} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.25} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-28} textAnchor="end" height={74} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(245,166,35,0.12)' }} />
                  <Bar dataKey="count" name={t('repCount')} radius={[7, 7, 0, 0]} background={{ fill: 'rgba(148,163,184,0.08)' }} maxBarSize={46}>
                    {safe(data.byDepartment).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('repByContract')} icon={Layers} centerLabel={t('repCount')} centerValue={sum(data.byContractType)}>
              {donut(data.byContractType)}
            </ChartCard>

            <ChartCard title={t('repByStatus')} icon={Users} centerLabel={t('repCount')} centerValue={sum(data.byStatus)}>
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie data={safe(data.byStatus).map((r: any) => ({ ...r, name: getStatusLabel(r.name) }))} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
                    {safe(data.byStatus).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RPieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('repByPosition')} icon={Layers} height={340}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safe(data.byPosition)} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gPos" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#20487c" /><stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.25} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 9.5, fill: '#94a3b8' }} tickFormatter={(v: string) => (v && v.length > 30 ? v.slice(0, 29) + '…' : v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.10)' }} />
                  <Bar dataKey="count" name={t('repCount')} fill="url(#gPos)" radius={[0, 7, 7, 0]} maxBarSize={18} background={{ fill: 'rgba(148,163,184,0.08)' }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ACTIVITE / TEMPS / CONGES */}
          <Section title={t('repSectionActivity')} icon={Clock} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t('repHiresByMonth')} icon={TrendingUp}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(data.hiresByMonth || []).map((r: any) => ({ ...r, name: months[r.month - 1] }))} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gHire" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f5a623" stopOpacity={0.45} /><stop offset="100%" stopColor="#f5a623" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.25} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-28} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#f5a623', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="count" name={t('repCount')} stroke="#f5a623" strokeWidth={3} fill="url(#gHire)" dot={{ r: 3, fill: '#14305a', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f5a623' }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('repLeavesByType')} icon={Clock}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safe(data.leavesByType)} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gLeave" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.25} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-28} textAnchor="end" height={74} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.10)' }} />
                  <Bar dataKey="count" name={t('repCount')} fill="url(#gLeave)" radius={[7, 7, 0, 0]} maxBarSize={46} background={{ fill: 'rgba(148,163,184,0.08)' }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('repAgeGroups')} icon={Users}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ageGroups || []} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.25} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(168,85,247,0.10)' }} />
                  <Bar dataKey="count" name={t('repCount')} fill="url(#gAge)" radius={[7, 7, 0, 0]} maxBarSize={46} background={{ fill: 'rgba(148,163,184,0.08)' }} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('repAttendance')} icon={BarChart3}>
              <div className="h-full flex flex-col justify-center gap-3">
                <div className="grid grid-cols-3 gap-2">
                  {CODES.map(c => (
                    <div key={c} className="flex items-center justify-between px-3 py-2 rounded-xl transition-transform hover:-translate-y-0.5" style={{ background: CODE_COLOR[c] + '18', border: `1px solid ${CODE_COLOR[c]}44` }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CODE_COLOR[c] }} />
                        <span className="text-[10px] font-bold shrink-0" style={{ color: CODE_COLOR[c] }}>{c}</span>
                        <span className="text-[10px] text-surface-500 dark:!text-slate-400 truncate">{t('pdCode' + c)}</span>
                      </div>
                      <span className="text-sm font-bold tabnum text-surface-800 dark:!text-slate-100">{data.attendance?.[c] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>

          {/* HEURES SUP & DOCUMENTS */}
          <Section title={t('repSectionPayDocs')} icon={Clock} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-4 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#f5a623]/15 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-[#f5a623]" /></div>
                <h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{t('repOvertime')}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-100 dark:!bg-slate-700/50"><p className="text-[10px] uppercase tracking-wide text-surface-400">H50%</p><p className="text-lg font-bold tabnum mt-0.5 text-surface-800 dark:!text-slate-100">{data.overtime?.h50 || 0}</p></div>
                <div className="p-3 rounded-xl bg-slate-100 dark:!bg-slate-700/50"><p className="text-[10px] uppercase tracking-wide text-surface-400">H75%</p><p className="text-lg font-bold tabnum mt-0.5 text-surface-800 dark:!text-slate-100">{data.overtime?.h75 || 0}</p></div>
                <div className="p-3 rounded-xl bg-slate-100 dark:!bg-slate-700/50"><p className="text-[10px] uppercase tracking-wide text-surface-400">H100%</p><p className="text-lg font-bold tabnum mt-0.5 text-surface-800 dark:!text-slate-100">{data.overtime?.h100 || 0}</p></div>
                <div className="p-3 rounded-xl bank-gold-bg"><p className="text-[10px] uppercase tracking-wide text-[#14305a]/70 font-semibold">{t('repTotal')}</p><p className="text-lg font-bold tabnum mt-0.5 text-[#14305a]">{data.overtime?.total || 0}</p></div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center"><MapPin className="w-3.5 h-3.5 text-[#8b5cf6]" /></div>
                <h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{t('repRotation')}</h3>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:!bg-slate-700/50"><span className="text-xs text-surface-600 dark:!text-slate-300">{t('repKpiTotal')}</span><span className="font-bold tabnum text-surface-800 dark:!text-slate-100">{data.rotation?.total || 0}</span></div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:!bg-amber-900/20"><span className="text-xs text-amber-700 dark:!text-amber-400">{t('repOnLeaveRot')}</span><span className="font-bold tabnum text-amber-600 dark:!text-amber-400">{data.rotation?.on_leave || 0}</span></div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:!bg-emerald-900/20"><span className="text-xs text-emerald-700 dark:!text-emerald-400">{t('repEligibleRot')}</span><span className="font-bold tabnum text-emerald-600 dark:!text-emerald-400">{data.rotation?.eligible || 0}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-[#f5a623]/15 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-[#f5a623]" /></div><h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{t('repTopOvertime')}</h3></div>
              <table className="w-full">
                <thead><tr className="table-header"><th className="px-3 py-2 text-start text-[11px]">{t('repEmployee')}</th><th className="px-2 py-2 text-end text-[11px]">H50</th><th className="px-2 py-2 text-end text-[11px]">H75</th><th className="px-2 py-2 text-end text-[11px]">H100</th><th className="px-3 py-2 text-end text-[11px]">{t('repTotal')}</th></tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-slate-700">
                  {otTop.map((r: any, i: number) => (
                    <tr key={i} className="table-row-hover"><td className="px-3 py-1.5 text-xs text-surface-700 dark:!text-slate-200">{r.last_name} {r.first_name}</td><td className="px-2 py-1.5 text-end text-xs tabnum">{r.h50 || 0}</td><td className="px-2 py-1.5 text-end text-xs tabnum">{r.h75 || 0}</td><td className="px-2 py-1.5 text-end text-xs tabnum">{r.h100 || 0}</td><td className="px-3 py-1.5 text-end text-xs font-bold tabnum text-[#14305a] dark:!text-amber-300">{r.total || 0}</td></tr>
                  ))}
                  {otTop.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-surface-400">{t('repNoData')}</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-[#8b5cf6]" /></div><h3 className="text-sm font-semibold text-surface-800 dark:!text-slate-100">{t('repDocs')}</h3></div>
              <ResponsiveContainer width="100%" height={230}>
                <RPieChart>
                  <Pie data={safe(data.docsByGroup)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                    {safe(data.docsByGroup).map((_: any, i: number) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-center text-[11px] text-surface-400 pt-2">{t('repGenerated')} · DRH System © {year}</p>
        </>
      )}

      {emailOpen && (
        <EmailModal
          prefix="RAPPORTS_"
          getHtml={buildExportHTML}
          getSheets={buildWorkbook}
          landscape={false}
          onClose={() => setEmailOpen(false)}
          onSent={() => { setEmailOpen(false); showToast(t('emailSent')); }}
        />
      )}

      {toast && <div className="fixed bottom-6 end-6 z-[100] px-4 py-3 rounded-xl bg-[#14305a] text-white text-sm shadow-lg animate-scaleIn border border-[#f5a623]/50">{toast}</div>}
    </div>
  );
}
