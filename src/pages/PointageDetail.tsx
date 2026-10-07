import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import EmailSendButton from '../components/EmailSendButton';
import { moveInTable } from '../utils/gridNav';
import { makeSeal, sealFooterHtml } from '../utils/docSeal';
import { ChevronLeft, ChevronRight, RefreshCw, Trash2, CheckCircle2, Check, CalendarDays, Layers, MapPin, GalleryVertical, Printer, FileText, FileSpreadsheet, FileType, X } from 'lucide-react';

interface PointageProps {
  navigateTo: (page: string, id?: number) => void;
}

interface PointageEmployee {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  status: string;
  contract_type: string;
  matricule: string;
  transport?: string;
}

const CODES = [
  { key: 'P', cls: 'bg-emerald-500 text-white border-emerald-600' },
  { key: 'CR', cls: 'bg-blue-500 text-white border-blue-600' },
  { key: 'CA', cls: 'bg-amber-500 text-white border-amber-600' },
  { key: 'JF', cls: 'bg-red-500 text-white border-red-600' },
  { key: 'CM', cls: 'bg-rose-500 text-white border-rose-600' },
  { key: 'CD', cls: 'bg-violet-500 text-white border-violet-700' },
  { key: 'AA', cls: 'bg-cyan-500 text-white border-cyan-600' },
  { key: 'AI', cls: 'bg-slate-500 text-white border-slate-600' },
  { key: 'AT', cls: 'bg-orange-500 text-white border-orange-600' },
  { key: 'SS', cls: 'bg-lime-600 text-white border-lime-700' },
  { key: 'MAT', cls: 'bg-fuchsia-500 text-white border-fuchsia-600' },
] as const;

const CODE_STYLE: Record<string, string> = {
  P: 'bg-emerald-500 text-white border-emerald-600',
  CR: 'bg-blue-500 text-white border-blue-600',
  CA: 'bg-amber-500 text-white border-amber-600',
  JF: 'bg-red-500 text-white border-red-600',
  CM: 'bg-rose-500 text-white border-rose-600',
  CD: 'bg-violet-500 text-white border-violet-700',
  AA: 'bg-cyan-500 text-white border-cyan-600',
  AI: 'bg-slate-500 text-white border-slate-600',
  AT: 'bg-orange-500 text-white border-orange-600',
  SS: 'bg-lime-600 text-white border-lime-700',
  MAT: 'bg-fuchsia-500 text-white border-fuchsia-600',
};

const CODE_CYCLE: (string | null)[] = [null, 'P', 'CR', 'CA', 'JF', 'CM', 'CD', 'AA', 'AI', 'AT', 'SS', 'MAT'];

const DAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const PRESENCE_CODES = ['P', 'CR', 'CD', 'JF'];
const ABSENCE_CODES = ['AA', 'AI', 'CM', 'AT', 'SS', 'MAT'];
const INDEMNITY_CDD = { key: 'panier', label: 'PANIER' };
const INDEMNITY_DEPLACE = { key: 'deplacement', label: 'DEPLACEMENT' };

function hasIfsp(position?: string) {
  if (!position) return false;
  return /chauffeur[\s-]*de[\s-]*poids[\s-]*lourd|conducteur.{0,4}engin/i.test(position);
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function PointageDetail({ navigateTo }: PointageProps) {
  const { t } = useLang();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<PointageEmployee[]>([]);
  const [pointage, setPointage] = useState<Record<number, Record<string, string>>>({});
  const [hsRecords, setHsRecords] = useState<Record<number, { h50: number; h75: number; h100: number }>>({});
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [loading, setLoading] = useState(true);
  const [verso, setVerso] = useState(false);
  const [toast, setToast] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [pageSel, setPageSel] = useState<Record<string, boolean>>({});
  const anySel = Object.values(pageSel).some(Boolean);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => { loadData(); }, [year, month]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    const [res, settings, hs] = await Promise.all([api.getPointageDetail(year, month), api.getSettings(), api.getHeuresSupp(year, month)]);
    if (res) {
      const emps = (res.employees || []).slice().sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr'));
      setEmployees(emps);
      setPointage(res.pointage || {});
      setDaysInMonth(res.days || 30);
    }
    if (settings && settings.company_name) setCompanyName(settings.company_name);
    if (hs && hs.records) setHsRecords(hs.records);
    setLoading(false);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const handleCellClick = async (empId: number, date: string, current: string | undefined) => {
    const idx = CODE_CYCLE.indexOf(current || null);
    await setCell(empId, date, CODE_CYCLE[(idx + 1) % CODE_CYCLE.length]);
  };

  const setCell = async (empId: number, date: string, code: string | null) => {
    const optimistic = { ...pointage };
    if (code) {
      if (!optimistic[empId]) optimistic[empId] = {};
      optimistic[empId][date] = code;
    } else if (optimistic[empId]) {
      delete optimistic[empId][date];
    }
    setPointage(optimistic);
    await api.setPointageCell(empId, date, code || '');
  };

  const codeBuf = useRef('');
  const codeTimer = useRef<any>(null);

  const typeCode = (ch: string, empId: number, date: string) => {
    const buf = (codeBuf.current + ch).toUpperCase();
    const keys = CODES.map(c => c.key as string);
    if (keys.includes(buf)) {
      codeBuf.current = '';
      setCell(empId, date, buf);
      return;
    }
    if (keys.some(k => k.startsWith(buf))) codeBuf.current = buf;
    else codeBuf.current = '';
    clearTimeout(codeTimer.current);
    codeTimer.current = setTimeout(() => { codeBuf.current = ''; }, 800);
  };

  const dayHeaders = useMemo(() => {
    const headers: { day: number; dow: number; key: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      headers.push({ day: d, dow, key: dateKey(year, month, d) });
    }
    return headers;
  }, [year, month, daysInMonth]);

  const isToday = (key: string) => key === dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const clearMonth = async () => {
    if (!window.confirm(String(t('pdClearConfirm')))) return;
    await api.clearPointageMonth(year, month);
    await loadData();
    showToast(String(t('pdCleared')));
  };

  const regEmployees = useMemo(() => employees.filter(e => e.contract_type !== 'DEPLACE'), [employees]);
  const deplaceEmployees = useMemo(() => employees.filter(e => e.contract_type === 'DEPLACE'), [employees]);

  const totals = useMemo(() => {
    const ids = new Set(employees.map(e => e.id));
    const counts: Record<string, number> = {};
    CODES.forEach((c) => { counts[c.key] = 0; });
    Object.entries(pointage).forEach(([empId, m]) => {
      if (!ids.has(Number(empId))) return;
      Object.values(m).forEach((c) => { if (counts[c] !== undefined) counts[c]++; });
    });
    return counts;
  }, [pointage, employees]);

  const countCodes = (empId: number) => {
    const m = pointage[empId] || {};
    const counts: Record<string, number> = {};
    CODES.forEach((c) => { counts[c.key] = 0; });
    Object.values(m).forEach((c) => { if (counts[c] !== undefined) counts[c]++; });
    return counts;
  };

  const renderTable = (emps: PointageEmployee[], emptyLabel: string) => (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="table-header">
              <th className="sticky left-0 z-10 bg-white dark:!bg-slate-800 px-3 py-2 text-right text-[11px] min-w-[170px]">{t('empName')}</th>
              {dayHeaders.map(h => (
                <th key={h.key} className={`px-0.5 py-2 text-center ${isToday(h.key) ? 'bg-amber-50 dark:!bg-amber-500/10' : ''}`}>
                  <div className="text-[10px] font-bold text-surface-700 dark:!text-slate-200">{h.day}</div>
                  <div className="text-[9px] text-surface-400">{DAY_SHORT[h.dow]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading && (
              <tr><td colSpan={daysInMonth + 1} className="px-4 py-12 text-center text-surface-400 text-sm">...</td></tr>
            )}
            {!loading && emps.map((emp, ri) => (
              <tr key={emp.id} className="table-row-hover transition-colors">
                <td
                  className="sticky left-0 z-10 bg-white dark:!bg-slate-800 px-3 py-1.5 text-[12px] font-medium text-surface-800 whitespace-nowrap cursor-pointer"
                  onClick={() => navigateTo('employees', emp.id)}
                >
                  {emp.last_name} {emp.first_name}
                </td>
                {dayHeaders.map((h, ci) => {
                  const code = pointage[emp.id]?.[h.key];
                  const isTodayCell = isToday(h.key);
                  return (
                    <td key={h.key} className={`px-0.5 py-1 text-center ${isTodayCell ? 'bg-amber-50 dark:!bg-amber-500/10' : ''}`}>
                      <button
                        onClick={() => handleCellClick(emp.id, h.key, code)}
                        onKeyDown={(e) => {
                          if (moveInTable(e, ri, ci)) return;
                          if (e.key === 'Backspace' || e.key === 'Delete') { setCell(emp.id, h.key, null); return; }
                          if (/^[a-zA-Z]$/.test(e.key)) typeCode(e.key, emp.id, h.key);
                        }}
                        data-r={ri}
                        data-c={ci}
                        title={`${emp.last_name} ${emp.first_name} — ${h.key}`}
                        className={`w-7 h-7 rounded-lg border text-[10px] font-bold transition-all hover:ring-2 hover:ring-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none cursor-pointer ${
                          code ? CODE_STYLE[code] : 'border-slate-200 dark:!border-slate-600 text-surface-300 dark:!text-slate-500 hover:!bg-surface-100 dark:hover:!bg-slate-700'
                        }`}
                      >
                        {code || ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!loading && emps.length === 0 && (
              <tr><td colSpan={daysInMonth + 1} className="px-4 py-12 text-center text-surface-400 text-sm">{emptyLabel}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderVersoTable = (emps: PointageEmployee[], emptyLabel: string, indemnity: { key: string; label: string }) => (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="verso-table w-full min-w-[820px] text-[12.5px] border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr className="table-header">
              <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center text-[10.5px] whitespace-nowrap">{t('pdColNo')}</th>
              <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center text-[10.5px] whitespace-nowrap">{t('pdColMatricule')}</th>
              <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center text-[10.5px] whitespace-nowrap">{t('pdColName')}</th>
              <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center text-[10.5px] whitespace-nowrap">{t('pdColFonction')}</th>
              <th colSpan={4} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-[10.5px] tracking-wider font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15">{t('pdGroupPresences')}</th>
              <th colSpan={6} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-[10.5px] tracking-wider font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15">{t('pdGroupAbsences')}</th>
              <th colSpan={3} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-[10.5px] tracking-wider font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15">{t('pdGroupHs')}</th>
              <th colSpan={3} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-[10.5px] tracking-wider font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15">{t('pdGroupIndemnites')}</th>
            </tr>
            <tr className="table-header">
              {PRESENCE_CODES.map(c => <th key={c} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-surface-700 dark:text-slate-200">{c}</th>)}
              {ABSENCE_CODES.map(c => <th key={c} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-surface-700 dark:text-slate-200">{c}</th>)}
              <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-indigo-700 dark:text-indigo-300" style={{ width: '5.5cm' }}>{t('pdColH50')}</th>
              <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-indigo-700 dark:text-indigo-300" style={{ width: '5.5cm' }}>{t('pdColH75')}</th>
              <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-indigo-700 dark:text-indigo-300" style={{ width: '5.5cm' }}>{t('pdColH100')}</th>
              <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-amber-700 dark:text-amber-300">{t('pdColIfsp')}</th>
              <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-amber-700 dark:text-amber-300">{t('pdColTransport')}</th>
              <th className="border border-slate-300 dark:border-slate-600 px-1.5 py-1 text-center text-[10.5px] font-bold text-amber-700 dark:text-amber-300">{indemnity.label}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={20} className="border border-slate-300 dark:border-slate-600 px-3 py-10 text-center text-surface-400 text-sm">...</td></tr>
            )}
            {!loading && emps.map((emp, idx) => {
              const cnt = countCodes(emp.id);
              const hs = hsRecords[emp.id];
              return (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-surface-500">{idx + 1}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-surface-500 dark:text-slate-400 whitespace-nowrap">{emp.matricule || '-'}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-surface-800 dark:text-slate-200 whitespace-nowrap">{emp.last_name} {emp.first_name}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-surface-500 dark:text-slate-400 whitespace-nowrap text-[11.5px]">{emp.position || '-'}</td>
                  {PRESENCE_CODES.map((c, ci) => (
                    <td key={c} tabIndex={0} data-r={idx} data-c={ci} onKeyDown={(e) => { moveInTable(e, idx, ci); }} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-surface-700 dark:text-slate-200 focus:bg-amber-50 dark:focus:bg-amber-500/10 focus:outline-none">{cnt[c] || 0}</td>
                  ))}
                  {ABSENCE_CODES.map((c, i) => (
                    <td key={c} tabIndex={0} data-r={idx} data-c={PRESENCE_CODES.length + i} onKeyDown={(e) => { moveInTable(e, idx, PRESENCE_CODES.length + i); }} className="border border-slate-300 dark:border-slate-600 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-surface-700 dark:text-slate-200 focus:bg-amber-50 dark:focus:bg-amber-500/10 focus:outline-none">{cnt[c] || 0}</td>
                  ))}
                  <td className="border border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-500/10 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-indigo-700 dark:text-indigo-300">{hs ? hs.h50 : 0}</td>
                  <td className="border border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-500/10 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-indigo-700 dark:text-indigo-300">{hs ? hs.h75 : 0}</td>
                  <td className="border border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-500/10 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-indigo-700 dark:text-indigo-300">{hs ? hs.h100 : 0}</td>
                  <td className="border border-slate-300 dark:border-slate-600 bg-amber-50/50 dark:bg-amber-500/10 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-amber-700 dark:text-amber-300">{hasIfsp(emp.position) ? '25%' : '-'}</td>
                  <td className="border border-slate-300 dark:border-slate-600 bg-amber-50/50 dark:bg-amber-500/10 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-amber-700 dark:text-amber-300">{emp.transport || '-'}</td>
                  <td className="border border-slate-300 dark:border-slate-600 bg-amber-50/50 dark:bg-amber-500/10 px-1.5 py-1.5 text-center text-[12.5px] font-bold text-amber-700 dark:text-amber-300">{cnt.P || 0}</td>
                </tr>
              );
            })}
            {!loading && emps.length === 0 && (
              <tr><td colSpan={20} className="border border-slate-300 dark:border-slate-600 px-3 py-10 text-center text-surface-400 text-sm">{emptyLabel}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const buildExportHTML = (format: string, pages: string[]) => {
    const has = (key: string) => pages.includes(key);
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const dayHeads = dayHeaders.map(h => `<th style="font-size:8pt;background:#14305a;color:#fff;">${h.day}<br/>${DAY_SHORT[h.dow]}</th>`).join('');
    const rectoRows = (emps: PointageEmployee[]) => emps.map((emp, i) => {
      const cells = dayHeaders.map(h => {
        const code = pointage[emp.id]?.[h.key];
        return `<td style="font-size:8pt;text-align:center;">${code ? esc(code) : ''}</td>`;
      }).join('');
      return `<tr><td style="font-size:8pt;text-align:center;">${i + 1}</td><td style="font-size:8pt;font-weight:bold;white-space:nowrap;">${esc(emp.last_name)} ${esc(emp.first_name)}</td>${cells}</tr>`;
    }).join('');
    const nameHead = `<th style="font-size:8pt;background:#14305a;color:#fff;">N°</th><th style="font-size:9pt;background:#14305a;color:#fff;white-space:nowrap;">NOM ET PRENOM</th>`;

    const rectoTable = (emps: PointageEmployee[]) =>
      `<table><thead><tr>${nameHead}${dayHeads}</tr></thead><tbody>${rectoRows(emps)}</tbody></table>`;

    const versoTable = (emps: PointageEmployee[], indemnityLabel: string) => {
      const rows = emps.map((emp, idx) => {
        const cnt = countCodes(emp.id);
        const hs = hsRecords[emp.id];
        const indemnityVal = (indemnityLabel === 'PANIER' || indemnityLabel === 'DEPLACEMENT') ? String(cnt.P || 0) : '';
        const cells = [
          String(idx + 1), esc(emp.matricule) || '-', `${esc(emp.last_name)} ${esc(emp.first_name)}`, esc(emp.position) || '-',
          String(cnt.P || 0), String(cnt.CR || 0), String(cnt.CD || 0), String(cnt.JF || 0),
          String(cnt.AA || 0), String(cnt.AI || 0), String(cnt.CM || 0), String(cnt.AT || 0), String(cnt.SS || 0), String(cnt.MAT || 0),
          hs ? hs.h50 : 0, hs ? hs.h75 : 0, hs ? hs.h100 : 0,
          hasIfsp(emp.position) ? '25%' : '-', esc(emp.transport) || '-', indemnityVal,
        ];
        return `<tr>${cells.map((c, i) => `<td style="text-align:${i >= 2 && i <= 3 ? 'left' : 'center'};font-size:8pt;white-space:nowrap;">${c}</td>`).join('')}</tr>`;
      }).join('');
      const g = (label: string, span: number) => `<th colspan="${span}" style="font-size:8pt;background:#14305a;color:#fff;">${esc(label)}</th>`;
      const firstRow =
        `<th rowspan="2" style="font-size:8pt;background:#14305a;color:#fff;">N°</th>` +
        `<th rowspan="2" style="font-size:8pt;background:#14305a;color:#fff;">MATRICULE</th>` +
        `<th rowspan="2" style="font-size:8pt;background:#14305a;color:#fff;">NOM ET PRENOM</th>` +
        `<th rowspan="2" style="font-size:8pt;background:#14305a;color:#fff;">FONCTION</th>` +
        g('PRESENCES', 4) + g('ABSENCES', 6) + g('H/ SUPPLEMENTAIRE', 3) + g('INDEMNITES', 3);
      const secondRow =
        ['P', 'CR', 'CD', 'JF', 'AA', 'AI', 'CM', 'AT', 'SS', 'MAT', 'H50%', 'H75%', 'H100%', 'IFSP', 'TRANSPORT', indemnityLabel]
          .map(h => `<th style="font-size:8pt;background:#14305a;color:#fff;">${esc(h)}</th>`).join('');
      return `<table><thead><tr>${firstRow}</tr><tr>${secondRow}</tr></thead><tbody>${rows}</tbody></table>`;
    };

    const hasOnlyVerso = has('ver-cdi') || has('ver-dep');
    const pageTitle = `POINTAGE ${hasOnlyVerso && !has('rec-cdi') && !has('rec-dep') ? 'VERSO' : 'DÉTAILLÉ'}`;
    const headHtml =
      `<div class="co">${esc(companyName || 'DRH System')}</div>` +
      `<div class="tt">${pageTitle} — ${esc(monthLabel.toUpperCase())}</div>` +
      `<div class="ln"></div>`;

    const page = (tableHtml: string) =>
      `<div class="page"><div class="page-head">${headHtml}</div><div class="page-body">${tableHtml}</div></div>`;

    let body = '';
    if (has('rec-cdi')) body += page(rectoTable(regEmployees));
    if (has('rec-dep') && deplaceEmployees.length) body += page(rectoTable(deplaceEmployees));
    if (has('ver-cdi')) body += page(versoTable(regEmployees, 'PANIER'));
    if (has('ver-dep') && deplaceEmployees.length) body += page(versoTable(deplaceEmployees, 'DEPLACEMENT'));

    const sealRows: string[][] = [];
    const pushRectoSeal = (emps: PointageEmployee[]) => emps.forEach(emp => {
      sealRows.push([String(emp.id), emp.last_name + ' ' + emp.first_name, ...dayHeaders.map(h => pointage[emp.id]?.[h.key] || '')]);
    });
    const pushVersoSeal = (emps: PointageEmployee[]) => emps.forEach(emp => {
      const cnt = countCodes(emp.id);
      const hs = hsRecords[emp.id];
      sealRows.push([String(emp.id), emp.last_name + ' ' + emp.first_name, emp.position || '', String(cnt.P || 0), String(cnt.CR || 0), String(cnt.CD || 0), String(cnt.JF || 0), String(cnt.AA || 0), String(cnt.AI || 0), String(cnt.CM || 0), String(cnt.AT || 0), String(cnt.SS || 0), String(cnt.MAT || 0), String(hs ? hs.h50 : 0), String(hs ? hs.h75 : 0), String(hs ? hs.h100 : 0)]);
    });
    if (has('rec-cdi')) pushRectoSeal(regEmployees);
    if (has('rec-dep') && deplaceEmployees.length) pushRectoSeal(deplaceEmployees);
    if (has('ver-cdi')) pushVersoSeal(regEmployees);
    if (has('ver-dep') && deplaceEmployees.length) pushVersoSeal(deplaceEmployees);

    // PDF / Word full document (landscape, company header on each page, centered table)
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 8mm; }
  html, body { margin:0; padding:0; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; }
  table { width:100%; border-collapse:collapse; page-break-inside:auto; margin:0 auto; }
  tr { page-break-inside: avoid; }
  th, td { border:1px solid #333; padding:2px 4px; }
  .page { display:flex; flex-direction:column; page-break-before:always; min-height:100vh; box-sizing:border-box; padding:6px 0; }
  .page:first-child { page-break-before:auto; }
  .page-head { text-align:center; border-bottom:2px solid #14305a; padding-bottom:6px; margin-bottom:10px; }
  .page-head .co { font-size:16pt; font-weight:bold; color:#14305a; letter-spacing:1px; }
  .page-head .tt { font-size:12pt; font-weight:bold; color:#14305a; margin-top:2px; }
  .page-body { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; }
</style>
</head><body>
${body}
${sealFooterHtml(makeSeal({ title: pageTitle + ' ' + monthLabel, rows: sealRows }))}
</body></html>`;
  };

  const buildPointageWorkbook = (pages: string[]) => {
    const has = (key: string) => pages.includes(key);
    const W = (cm: number) => Math.round(cm * 5.4 * 10) / 10;
    const n = (v: number, st?: number) => ({ v, s: st ?? 0 });
    const st = (v: string, s2?: number) => ({ v, s: s2 ?? 0 });
    const nulls = (cnt: number) => Array.from({ length: cnt }, () => null as any);

    const dayHeads = dayHeaders.map(h => s(`${h.day} ${DAY_SHORT[h.dow]}`, 1));
    const rectoWidths = [W(0.71), W(3.86), ...dayHeaders.map(() => W(0.71))];
    const rectoMerges = [
      { r: 1, c: 1, r2: 1, c2: dayHeaders.length + 2 },
      { r: 2, c: 1, r2: 2, c2: dayHeaders.length + 2 },
    ];

    const rectoSheet = (emps: PointageEmployee[], startIdx: number) => {
      const rows = [
        [st(companyName || 'DRH System', 4), ...nulls(dayHeaders.length + 1)],
        [st('POINTAGE DÉTAILLÉ — ' + monthLabel.toUpperCase(), 5), ...nulls(dayHeaders.length + 1)],
        [st('N°', 1), st('NOM ET PRENOM', 1), ...dayHeads],
        ...emps.map((emp, i) => [
          n(startIdx + i + 1), st(`${emp.last_name} ${emp.first_name}`, 2),
          ...dayHeaders.map(h => st(pointage[emp.id]?.[h.key] || '')),
        ]),
      ];
      return { name: '', rows, widths: rectoWidths, merges: rectoMerges, borderZone: { r1: 3, r2: Math.min(23, rows.length), c1: 1, c2: Math.min(32, rectoWidths.length) } };
    };

    const versoWidths = [W(0.71), W(1.85), W(3.86), W(5.4), W(0.71), W(0.71), W(0.71), W(0.71), W(0.71), W(0.71), W(0.71), W(0.71), W(0.71), W(0.71), W(5.5), W(5.5), W(5.5), W(1.16), W(1.46), W(2.25)];
    const versoMerges = [
      { r: 1, c: 1, r2: 1, c2: 20 },
      { r: 2, c: 1, r2: 2, c2: 20 },
      { r: 3, c: 1, r2: 4, c2: 1 },
      { r: 3, c: 2, r2: 4, c2: 2 },
      { r: 3, c: 3, r2: 4, c2: 3 },
      { r: 3, c: 4, r2: 4, c2: 4 },
      { r: 3, c: 5, r2: 3, c2: 8 },
      { r: 3, c: 9, r2: 3, c2: 14 },
      { r: 3, c: 15, r2: 3, c2: 17 },
      { r: 3, c: 18, r2: 3, c2: 20 },
    ];

    const versoSheet = (emps: PointageEmployee[], startIdx: number, indemnityLabel: string) => {
      const rows: any[][] = [
[st(companyName || 'DRH System', 4), ...nulls(19)],
        [st('POINTAGE — VERSO — ' + monthLabel.toUpperCase(), 5), ...nulls(19)],
        [st('N°', 1), st('MATRICULE', 1), st('NOM ET PRENOM', 1), st('FONCTION', 1),
          st('PRESENCES', 1), null, null, null,
          st('ABSENCES', 1), null, null, null, null, null,
          st('H/ SUPPLEMENTAIRE', 1), null, null,
          st('INDEMNITES', 1), null, null],
        [null, null, null, null,
          st('P', 1), st('CR', 1), st('CD', 1), st('JF', 1),
          st('AA', 1), st('AI', 1), st('CM', 1), st('AT', 1), st('SS', 1), st('MAT', 1),
          st('H50%', 1), st('H75%', 1), st('H100%', 1),
          st('IFSP', 1), st('TRANSPORT', 1), st(indemnityLabel, 1)],
        ...emps.map((emp, i) => {
          const cnt = countCodes(emp.id);
          const hs = hsRecords[emp.id];
          const lastVal = indemnityLabel === 'PANIER' || indemnityLabel === 'DEPLACEMENT' ? String(cnt.P || 0) : '';
          return [
            n(startIdx + i + 1), st(emp.matricule || '-'), st(`${emp.last_name} ${emp.first_name}`, 2), st(emp.position || '-', 3),
            n(cnt.P || 0), n(cnt.CR || 0), n(cnt.CD || 0), n(cnt.JF || 0),
            n(cnt.AA || 0), n(cnt.AI || 0), n(cnt.CM || 0), n(cnt.AT || 0), n(cnt.SS || 0), n(cnt.MAT || 0),
            n(hs ? hs.h50 : 0), n(hs ? hs.h75 : 0), n(hs ? hs.h100 : 0),
            st(hasIfsp(emp.position) ? '25%' : '-'), st(emp.transport || '-'), st(lastVal),
          ];
        }),
      ];
      return { name: '', rows, widths: versoWidths, merges: versoMerges, borderZone: { r1: 3, r2: Math.min(23, rows.length), c1: 1, c2: Math.min(32, versoWidths.length) } };
    };

    const sheets: any[] = [];
    const addSheet = (name: string, sht: any) => { sht.name = name; sheets.push(sht); };
    if (has('rec-cdi')) addSheet('RECTO CDI-CDD', rectoSheet(regEmployees, 0));
    if (has('rec-dep') && deplaceEmployees.length) addSheet('RECTO DEPLACÉ', rectoSheet(deplaceEmployees, 0));
    if (has('ver-cdi')) addSheet('VERSO CDI-CDD', versoSheet(regEmployees, 0, 'PANIER'));
    if (has('ver-dep') && deplaceEmployees.length) addSheet('VERSO DEPLACÉ', versoSheet(deplaceEmployees, 0, 'DEPLACEMENT'));
    return sheets;
  };

  const openPrint = () => {
    const init: Record<string, boolean> = { 'rec-cdi': true, 'ver-cdi': true };
    if (deplaceEmployees.length) { init['rec-dep'] = true; init['ver-dep'] = true; }
    setPageSel(init);
    setPrintOpen(true);
  };

  const selPages = () => Object.entries(pageSel).filter(([, v]) => v).map(([k]) => k);

  const doPrint = async () => {
    const pages = selPages();
    setPrintOpen(false);
    if (!pages.length) return;
    showToast(String(t('pdPrintSending')));
    const res = await api.printHtml(buildExportHTML('pdf', pages), true);
    if (res && res.success) {
      showToast(String(t('pdPrintDone')));
    } else if (res && String(res.error).toLowerCase() !== 'cancelled') {
      alert(String(t('pdPrintFailed')) + ': ' + (res.error || ''));
    }
  };

  const doExport = async (format: string) => {
    const pages = selPages();
    setPrintOpen(false);
    if (!pages.length) return;
    let res: any;
    if (format === 'xlsx') {
      res = await api.exportXlsx(buildPointageWorkbook(pages), 'POINTAGE_');
    } else {
      res = await api.exportPointage(buildExportHTML(format, pages), format);
    }
    if (res && res.success) {
      showToast(String(t('pdExported')));
    } else if (res && res.error !== 'Cancelled') {
      alert(String(t('pdExportFailed')) + ': ' + (res.error || ''));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{t('pdTitle')}</h1>
            <p className="page-h1-sub">{t('pdSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 glass-card rounded-xl px-2 py-1">
            <button onClick={prevMonth} className="icon-btn hover:!text-amber-500"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-bold text-surface-700 dark:!text-slate-200 min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="icon-btn hover:!text-amber-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <EmailSendButton prefix="POINTAGE_" getHtml={() => buildExportHTML('pdf', selPages())} getSheets={() => buildPointageWorkbook(selPages())} landscape />
          <button onClick={() => openPrint()} className="tool-action tool-action-gold gold-glow"><Printer className="w-4 h-4" /> {t('pdExport')}</button>
          <button onClick={() => setVerso(!verso)} title={t('pdVerso')} className={`togg-btn ${verso ? 'active' : ''}`}>
            <GalleryVertical className="w-4 h-4" /> {t('pdVerso')}
          </button>
          <button onClick={clearMonth} className="icon-btn hover:!text-red-500 hover:!bg-red-50" title={t('pdClearMonth')}><Trash2 className="w-4 h-4" /></button>
          <button onClick={loadData} className="tool-action tool-action-refresh"><RefreshCw className="w-4 h-4" /> {t('conActualiser')}</button>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-3 text-xs">
        {CODES.map(c => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span className={`w-6 h-6 rounded-full border ${c.cls} flex items-center justify-center text-[10px] font-bold`}>{c.key}</span>
            <span className="text-surface-500">{t(`pdCode${c.key}`)}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:!border-slate-600 flex items-center justify-center text-[10px] text-surface-400">-</span>
          <span className="text-surface-500">{t('pdAbsent')}</span>
        </span>
        <span className="mx-2 w-px h-4 bg-slate-200 dark:!bg-slate-700" />
        {CODES.map(c => (
          <span key={c.key} className="text-surface-500">{t(`pdTotal${c.key}`)}: <b>{totals[c.key] || 0}</b></span>
        ))}
      </div>

      {verso ? (
        <>
          {/* Verso 1: CDI / CDD — PANIER = P count */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-sm font-bold text-surface-800 dark:!text-slate-200">CDI / CDD</h2>
              <span className="text-[11px] text-surface-400">({regEmployees.length})</span>
            </div>
            {renderVersoTable(regEmployees, t('pdNoRegular'), INDEMNITY_CDD)}
          </div>

          {/* Verso 2: DEPLACE — DEPLACEMENT = P count */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-surface-800 dark:!text-slate-200">DEPLACE</h2>
              <span className="text-[11px] text-surface-400">({deplaceEmployees.length})</span>
            </div>
            {renderVersoTable(deplaceEmployees, t('pdNoDeplace'), INDEMNITY_DEPLACE)}
          </div>
        </>
      ) : (
        <>
          {/* Table 1: CDI / CDD */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-sm font-bold text-surface-800 dark:!text-slate-200">CDI / CDD</h2>
              <span className="text-[11px] text-surface-400">({regEmployees.length})</span>
            </div>
            {renderTable(regEmployees, t('pdNoRegular'))}
          </div>

          {/* Table 2: DEPLACE */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-surface-800 dark:!text-slate-200">DEPLACE</h2>
              <span className="text-[11px] text-surface-400">({deplaceEmployees.length})</span>
            </div>
            {renderTable(deplaceEmployees, t('pdNoDeplace'))}
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="glass-card px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-emerald-600 dark:!text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {toast}
          </div>
        </div>
      )}

      {/* Print Options Modal */}
      {printOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPrintOpen(false)}>
          <div className="bg-white dark:!bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:!border-slate-700">
              <h2 className="text-lg font-bold text-surface-800 dark:!text-slate-200">{t('pdPrintOptions')}</h2>
              <button onClick={() => setPrintOpen(false)} className="p-2 hover:bg-surface-100 dark:hover:bg-slate-700 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-4 border-b border-surface-100 dark:!border-slate-700 bg-surface-50/50 dark:bg-slate-800/50">
              <p className="text-sm font-semibold text-surface-700 dark:!text-slate-300 mb-3">{t('pdPrintSelect')}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'rec-cdi', icon: CalendarDays, tile: 'linear-gradient(135deg, #20487c 0%, #14305a 100%)', glow: '0 6px 16px -6px rgba(20,48,90,0.55)', iconCls: 'text-white', label: `${t('pdPrintRecto')} — CDI/CDD`, count: regEmployees.length },
                  ...(deplaceEmployees.length ? [{ key: 'rec-dep', icon: MapPin, tile: 'linear-gradient(135deg, #f7c948 0%, #f5a623 100%)', glow: '0 6px 16px -6px rgba(245,166,35,0.6)', iconCls: 'text-[#14305a]', label: `${t('pdPrintRecto')} — DEPLACÉ`, count: deplaceEmployees.length }] : []),
                  { key: 'ver-cdi', icon: GalleryVertical, tile: 'linear-gradient(135deg, #20487c 0%, #14305a 100%)', glow: '0 6px 16px -6px rgba(20,48,90,0.55)', iconCls: 'text-white', label: `${t('pdVerso')} — CDI/CDD`, count: regEmployees.length },
                  ...(deplaceEmployees.length ? [{ key: 'ver-dep', icon: Layers, tile: 'linear-gradient(135deg, #f7c948 0%, #f5a623 100%)', glow: '0 6px 16px -6px rgba(245,166,35,0.6)', iconCls: 'text-[#14305a]', label: `${t('pdVerso')} — DEPLACÉ`, count: deplaceEmployees.length }] : []),
                ].map(({ key, icon: Icon, tile, glow, iconCls, label, count }) => {
                  const on = !!pageSel[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setPageSel(p => ({ ...p, [key]: !p[key] }))}
                      className={`relative flex items-center gap-3 p-3 pr-4 rounded-2xl border-2 text-start transition-all duration-200 min-w-[230px] ${
                        on
                          ? 'border-amber-400 bg-amber-50/70 dark:!bg-amber-500/10 shadow-[0_8px_22px_-8px_rgba(245,166,35,0.7)] -translate-y-0.5'
                          : 'border-slate-200 dark:!border-slate-600 bg-white dark:!bg-slate-800 hover:border-slate-300 dark:hover:!border-slate-500 hover:shadow-md hover:-translate-y-0.5 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/25"
                        style={{ background: tile, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), ' + glow }}
                      >
                        <Icon className={`w-5 h-5 ${iconCls}`} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-surface-800 dark:!text-slate-100 truncate">{label}</span>
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:!bg-slate-700 dark:!text-slate-300">
                          {count}
                        </span>
                      </span>
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                        on ? 'border-amber-400 bg-gradient-to-b from-[#ffe066] to-[#f5a623] text-[#14305a] shadow' : 'border-slate-300 dark:!border-slate-600 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => { const all: Record<string, boolean> = {}; ['rec-cdi', 'rec-dep', 'ver-cdi', 'ver-dep'].forEach(k => { if (!(k === 'rec-dep' || k === 'ver-dep') || deplaceEmployees.length) all[k] = true; }); setPageSel(all); }} className="text-xs font-semibold text-amber-600 dark:!text-amber-300 hover:underline">{t('pdPrintAll')}</button>
                <button onClick={() => setPageSel({})} className="text-xs font-semibold text-surface-500 hover:underline">— {t('empCancel')}</button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-slate-900">
              {(!anySel) ? (
                <div className="text-center py-16 text-surface-400 text-sm">— {t('pdPrintSelect')} —</div>
              ) : (
                <div className="mx-auto" style={{ maxWidth: 900 }}>
                  <iframe
                    srcDoc={buildExportHTML('pdf', selPages())}
                    className="w-full rounded-xl shadow-lg border border-surface-200 dark:border-slate-700"
                    style={{ height: 520 }}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-100 dark:!border-slate-700 bg-surface-50/50 dark:bg-slate-800/50">
              <button onClick={() => setPrintOpen(false)} className="btn-secondary">{t('empCancel')}</button>
              <button onClick={doPrint} disabled={!anySel} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                <Printer className="w-4 h-4" /> {t('pdPrint')}
              </button>
              <button onClick={() => doExport('pdf')} disabled={!anySel} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                <FileText className="w-4 h-4 text-red-500" /> PDF
              </button>
              <button onClick={() => doExport('xlsx')} disabled={!anySel} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> {t('pdExcel')}
              </button>
              <button onClick={() => doExport('doc')} disabled={!anySel} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                <FileType className="w-4 h-4 text-blue-600" /> {t('pdWord')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}