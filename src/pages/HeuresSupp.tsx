import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import EmailSendButton from '../components/EmailSendButton';
import { makeSeal, sealFooterHtml } from '../utils/docSeal';
import { ChevronLeft, ChevronRight, RefreshCw, Timer, CheckCircle2, MapPin, Printer, FileText, FileSpreadsheet, FileType } from 'lucide-react';

interface HeuresSuppProps {
  navigateTo: (page: string, id?: number) => void;
}

interface HSEmployee {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  status: string;
  contract_type: string;
  matricule: string;
}

interface HoursRecord {
  h50: number;
  h75: number;
  h100: number;
}

const nInput = (empId: number, field: 'h50' | 'h75' | 'h100', getRec: (id: number) => HoursRecord, update: (id: number, f: 'h50' | 'h75' | 'h100', v: number, saved: boolean) => void, accent: string) => (
  <input
    type="number"
    min={0}
    step="0.5"
    value={getRec(empId)[field] ?? 0}
    onChange={(e) => update(empId, field, parseFloat(e.target.value) || 0, false)}
    onBlur={() => update(empId, field, getRec(empId)[field], true)}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    className={`input-field !w-24 !py-1.5 !text-xs font-bold text-center ${accent}`}
  />
);

export default function HeuresSupp({ navigateTo }: HeuresSuppProps) {
  const { t } = useLang();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<HSEmployee[]>([]);
  const [records, setRecords] = useState<Record<number, HoursRecord>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [live, setLive] = useState<Record<number, HoursRecord>>({});
  const [companyName, setCompanyName] = useState('DRH System');
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => { loadData(); }, [year, month]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadData = async () => {
    setLoading(true);
    const [res, settings] = await Promise.all([api.getHeuresSupp(year, month), api.getSettings()]);
    if (res) {
      setEmployees((res.employees || []).slice().sort((a: any, b: any) => a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr')));
      setRecords(res.records || {});
    }
    if (settings && settings.company_name) setCompanyName(settings.company_name);
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

  const regEmployees = employees.filter(e => e.contract_type !== 'DEPLACE');
  const deplaceEmployees = employees.filter(e => e.contract_type === 'DEPLACE');

  const getRecord = (empId: number): HoursRecord => live[empId] || records[empId] || { h50: 0, h75: 0, h100: 0 };

  const setField = (empId: number, field: 'h50' | 'h75' | 'h100', value: number, saved: boolean) => {
    const cur = getRecord(empId);
    setLive({ ...live, [empId]: { ...cur, [field]: value } });
    if (saved) {
      const r = { ...getRecord(empId), [field]: value };
      api.setHeuresSupp(empId, year, month, r.h50 || 0, r.h75 || 0, r.h100 || 0).then(() => {
        setRecords(prev => ({ ...prev, [empId]: { h50: r.h50 || 0, h75: r.h75 || 0, h100: r.h100 || 0 } }));
        setLive(l => { const n = { ...l }; delete n[empId]; return n; });
        showToast(String(t('hsSaved')));
      });
    }
  };

  const total = (r: HoursRecord) => (r.h50 || 0) + (r.h75 || 0) + (r.h100 || 0);

  const renderTable = (emps: HSEmployee[], emptyLabel: string) => {
    if (emps.length === 0) {
      return <div className="glass-card rounded-2xl p-10 text-center text-surface-400">{emptyLabel}</div>;
    }
    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12.5px]">
            <thead>
              <tr className="bg-gradient-to-r from-[#14305a] to-[#20487c] text-white">
                <th className="px-3 py-3 text-left font-semibold">{t('hsColNo')}</th>
                <th className="px-3 py-3 text-left font-semibold">{t('hsColName')}</th>
                <th className="px-3 py-3 text-left font-semibold">{t('hsColFonction')}</th>
                <th className="px-3 py-3 text-center font-semibold" style={{ background: 'rgba(255,255,255,0.08)' }}>{t('hs50')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('hs75')}</th>
                <th className="px-3 py-3 text-center font-semibold">{t('hs100')}</th>
                <th className="px-3 py-3 text-center font-semibold" style={{ background: 'rgba(245,166,35,0.35)' }}>{t('hsTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {emps.map((emp, i) => {
                const r = getRecord(emp.id);
                return (
                  <tr key={emp.id} className="table-row-hover">
                    <td className="px-3 py-2 text-surface-500 dark:!text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-surface-800 dark:!text-slate-100 whitespace-nowrap cursor-pointer hover:!text-amber-500" onClick={() => navigateTo('employee-detail', emp.id)}>
                      {emp.last_name} {emp.first_name}
                    </td>
                    <td className="px-3 py-2 text-surface-600 dark:!text-slate-300">{emp.position || '-'}</td>
                    <td className="px-3 py-2 text-center">{nInput(emp.id, 'h50', getRecord, setField, 'dark:!text-blue-300 text-blue-700')}</td>
                    <td className="px-3 py-2 text-center">{nInput(emp.id, 'h75', getRecord, setField, 'dark:!text-amber-300 text-amber-600')}</td>
                    <td className="px-3 py-2 text-center">{nInput(emp.id, 'h100', getRecord, setField, 'dark:!text-violet-300 text-violet-700')}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 font-extrabold text-sm text-[#14305a] dark:!text-amber-300">
                        <Timer className="w-4 h-4" /> {total(r)}
                        {total(r) > 0 && !live[emp.id] && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const buildExportHTML = (format: string) => {
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const monthLabelUp = monthLabel.toUpperCase();

    const head = () => [
      `<th style="font-size:8pt;background:#14305a;color:#fff;">${esc(t('hsColNo'))}</th>`,
      `<th style="font-size:8pt;background:#14305a;color:#fff;">${esc(t('hsColName'))}</th>`,
      `<th style="font-size:8pt;background:#14305a;color:#fff;">${esc(t('hsColFonction'))}</th>`,
      `<th style="font-size:8pt;background:#5b8def;color:#fff;">${esc(t('hs50'))}</th>`,
      `<th style="font-size:8pt;background:#f5a623;color:#fff;">${esc(t('hs75'))}</th>`,
      `<th style="font-size:8pt;background:#8b5cf6;color:#fff;">${esc(t('hs100'))}</th>`,
      `<th style="font-size:8pt;background:#14305a;color:#fff;">${esc(t('hsTotal'))}</th>`,
    ].join('');

    const tableHtml = (emps: HSEmployee[]) => {
      const rows = emps.map((emp, i) => {
        const r = getRecord(emp.id);
        const cells = [
          `<td style="font-size:8pt;text-align:center;">${i + 1}</td>`,
          `<td style="font-size:8pt;font-weight:bold;text-align:left;white-space:nowrap;">${esc(emp.last_name)} ${esc(emp.first_name)}</td>`,
          `<td style="font-size:8pt;text-align:left;white-space:nowrap;">${esc(emp.position || '-')}</td>`,
          `<td style="font-size:8pt;text-align:center;">${r.h50 || 0}</td>`,
          `<td style="font-size:8pt;text-align:center;">${r.h75 || 0}</td>`,
          `<td style="font-size:8pt;text-align:center;">${r.h100 || 0}</td>`,
          `<td style="font-size:8pt;text-align:center;font-weight:bold;">${total(r)}</td>`,
        ].join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table><thead><tr>${head()}</tr></thead><tbody>${rows}</tbody></table>`;
    };

    const headHtml =
      `<div class="co">${esc(companyName || 'DRH System')}</div>` +
      `<div class="tt">HEURES SUPPLEMENTAIRES — ${esc(monthLabelUp)}</div>` +
      `<div class="ln"></div>`;

    const page = (tableHtml2: string) =>
      `<div class="page"><div class="page-head">${headHtml}</div><div class="page-body">${tableHtml2}</div></div>`;

    let body = page(tableHtml(regEmployees));
    if (deplaceEmployees.length) body += page(tableHtml(deplaceEmployees));

    const sealRows: string[][] = [];
    [...regEmployees, ...deplaceEmployees].forEach(emp => {
      const r = getRecord(emp.id);
      sealRows.push([String(emp.id), emp.last_name + ' ' + emp.first_name, emp.position || '-', String(r.h50 || 0), String(r.h75 || 0), String(r.h100 || 0), String(total(r))]);
    });

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
${sealFooterHtml(makeSeal({ title: 'HEURES SUPPLEMENTAIRES ' + monthLabelUp, rows: sealRows }))}
</body></html>`;
  };

  const buildHeuresWorkbook = () => {
    const W = (cm: number) => Math.round(cm * 5.4 * 10) / 10;
    const n = (v: number, s?: number) => ({ v, s: s ?? 0 });
    const st = (v: string, s2?: number) => ({ v, s: s2 ?? 0 });
    const nulls = (cnt: number) => Array.from({ length: cnt }, () => null as any);
    const LC = (key: string) => String(t(key as any));
    const monthLabelUp = monthLabel.toUpperCase();

    const widths = [W(0.71), W(3.86), W(5.4), W(5.5), W(5.5), W(5.5), W(2.8)];
    const merges = [
      { r: 1, c: 1, r2: 1, c2: 7 },
      { r: 2, c: 1, r2: 2, c2: 7 },
    ];
    const headRow = st(LC('hsColNo') as string, 1), nameRow = st(LC('hsColName') as string, 1),
      fnRow = st(LC('hsColFonction') as string, 1), h50Row = st(LC('hs50') as string, 1),
      h75Row = st(LC('hs75') as string, 1), h100Row = st(LC('hs100') as string, 1),
      totalRow = st(LC('hsTotal') as string, 1);

    const hsSheet = (emps: HSEmployee[]) => {
      const rows: any[][] = [
        [st(companyName || 'DRH System', 4), ...nulls(6)],
        [st('HEURES SUPPLEMENTAIRES — ' + monthLabelUp, 5), ...nulls(6)],
        [headRow, nameRow, fnRow, h50Row, h75Row, h100Row, totalRow],
        ...emps.map((emp, i) => {
          const r = getRecord(emp.id);
          return [n(i + 1), st(`${emp.last_name} ${emp.first_name}`, 2), st(emp.position || '-', 3),
            n(r.h50 || 0), n(r.h75 || 0), n(r.h100 || 0), n(total(r))];
        }),
      ];
      return { name: '', rows, widths, merges, borderZone: { r1: 3, r2: Math.min(23, rows.length), c1: 1, c2: 7 } };
    };

    const sheets: any = [];
    const add = (name: string, sht: any) => { sht.name = name; sheets.push(sht); };
    add('HEURES CDI-CDD', hsSheet(regEmployees));
    add('HEURES DEPLACÉ', hsSheet(deplaceEmployees));
    return sheets;
  };

  const doExport = async (format: string) => {
    setExportOpen(false);
    let res: any;
    if (format === 'xlsx') {
      res = await api.exportXlsx(buildHeuresWorkbook(), 'HEURES_SUPP_');
    } else {
      res = await api.exportPointage(buildExportHTML(format), format);
    }
    if (res && res.success) {
      showToast(String(t('hsExported')));
    } else if (res && res.error !== 'Cancelled') {
      alert(String(t('hsExportFailed')) + ': ' + (res.error || ''));
    }
  };

  const doPrint = async () => {
    setExportOpen(false);
    showToast(String(t('pdPrintSending')));
    const res = await api.printHtml(buildExportHTML('pdf'), true);
    if (res && res.success) {
      showToast(String(t('pdPrintDone')));
    } else if (res && String(res.error).toLowerCase() !== 'cancelled') {
      alert(String(t('pdPrintFailed')) + ': ' + (res.error || ''));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{t('hsTitle')}</h1>
            <p className="page-h1-sub">{t('hsSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 glass-card rounded-xl px-2 py-1">
            <button onClick={prevMonth} className="icon-btn hover:!text-amber-500"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-bold text-surface-700 dark:!text-slate-200 min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="icon-btn hover:!text-amber-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={loadData} className="tool-action tool-action-refresh w-9 h-9 !p-0 justify-center" title={t('conActualiser')}><RefreshCw className="w-4 h-4" /></button>
          <EmailSendButton prefix="HEURES_SUPP_" getHtml={() => buildExportHTML('pdf')} getSheets={() => buildHeuresWorkbook()} landscape />
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)} className="tool-action tool-action-gold gold-glow"><Printer className="w-4 h-4" /> {t('hsExport')}</button>
            {exportOpen && (
              <div className="absolute end-0 mt-2 w-44 glass-card rounded-xl shadow-lg z-50 overflow-hidden" onMouseLeave={() => setExportOpen(false)}>
                <button onClick={doPrint} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-slate-50 dark:hover:!bg-slate-700 transition-colors"><Printer className="w-4 h-4 text-amber-600" /> {t('pdPrint')}</button>
                <div className="h-px bg-slate-100 dark:!bg-slate-700" />
                <button onClick={() => doExport('pdf')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-slate-50 dark:hover:!bg-slate-700 transition-colors"><FileText className="w-4 h-4 text-red-500" /> {t('hsPdf')}</button>
                <button onClick={() => doExport('xlsx')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-slate-50 dark:hover:!bg-slate-700 transition-colors"><FileSpreadsheet className="w-4 h-4 text-green-600" /> {t('hsExcel')}</button>
                <button onClick={() => doExport('doc')} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-surface-700 dark:!text-slate-200 hover:bg-slate-50 dark:hover:!bg-slate-700 transition-colors"><FileType className="w-4 h-4 text-blue-600" /> {t('hsWord')}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
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
            {renderTable(regEmployees, t('hsNoEmployees'))}
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
            {renderTable(deplaceEmployees, t('hsNoEmployees'))}
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
    </div>
  );
}