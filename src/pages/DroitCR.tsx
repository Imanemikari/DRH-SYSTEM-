import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';
import EmailSendButton from '../components/EmailSendButton';
import { buildFieldTableHtml, buildFieldSheets } from '../utils/emailExport';
import { moveInTable, focusCell } from '../utils/gridNav';
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, MapPin, Printer } from 'lucide-react';

interface DroitCRProps {
  navigateTo: (page: string, id?: number) => void;
}

interface DCREmployee {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  status: string;
  contract_type: string;
  matricule: string;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const dayInput = (empId: number, ri: number, m: number, get: (id: number, mo: number) => number, update: (id: number, mo: number, v: number, saved: boolean) => void) => (
  <input
    type="number"
    min={0}
    step="0.5"
    data-r={ri}
    data-c={m - 1}
    value={get(empId, m) ?? 0}
    onChange={(e) => update(empId, m, parseFloat(e.target.value) || 0, false)}
    onBlur={() => update(empId, m, get(empId, m), true)}
    onKeyDown={(e) => {
      if (moveInTable(e, ri, m - 1)) return;
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
        const t = (e.target as HTMLElement).closest?.('table');
        focusCell(t, ri + 1, m - 1);
      }
    }}
    className="input-field !w-20 !py-1.5 !text-xs font-bold text-center"
  />
);

export default function DroitCR({ navigateTo }: DroitCRProps) {
  const { t, lang, dir } = useLang();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState<DCREmployee[]>([]);
  const [records, setRecords] = useState<Record<number, Record<number, number>>>({});
  const [live, setLive] = useState<Record<number, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => { loadData(); }, [year]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadData = async () => {
    setLoading(true);
    const res = await api.getDroitCr(year);
    if (res) {
      setEmployees(((res.employees || []) as any[]).slice().sort((a: any, b: any) => a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr')));
      setRecords(res.records || {});
      setLive({});
    }
    setLoading(false);
  };

  const monthNames = MONTHS.map(m =>
    new Date(year, m - 1, 1).toLocaleDateString(lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-US' : 'fr-FR', { month: 'short' })
  );

  const regEmployees = employees.filter(e => e.contract_type !== 'DEPLACE');
  const deplaceEmployees = employees.filter(e => e.contract_type === 'DEPLACE');

  const getDays = (empId: number, m: number): number => live[empId]?.[m] ?? records[empId]?.[m] ?? 0;

  const setDay = (empId: number, m: number, value: number, saved: boolean) => {
    const cur = { ...(live[empId] || {}), [m]: value };
    setLive(prev => ({ ...prev, [empId]: cur }));
    if (saved) {
      api.setDroitCr(empId, year, m, value || 0).then(() => {
        setRecords(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), [m]: value || 0 } }));
        setLive(prev => {
          const n = { ...prev };
          if (n[empId]) {
            const c = { ...n[empId] };
            delete c[m];
            if (Object.keys(c).length === 0) delete n[empId];
            else n[empId] = c;
          }
          return n;
        });
        showToast(String(t('drcSaved')));
      });
    }
  };

  const totalYear = (empId: number): number => MONTHS.reduce((s, m) => s + (getDays(empId, m) || 0), 0);

  const renderTable = (emps: DCREmployee[], emptyLabel: string) => {
    if (emps.length === 0) {
      return <div className="glass-card rounded-2xl p-10 text-center text-surface-400">{emptyLabel}</div>;
    }
    return (
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="table-header">
                <th className="sticky left-0 z-10 bg-white dark:!bg-slate-800 px-3 py-2 text-right text-[11px] min-w-[170px]">{t('empName')}</th>
                <th className="px-3 py-2 text-right text-[11px] min-w-[130px]">{t('empPosition')}</th>
                {monthNames.map((n, i) => (
                  <th key={i} className="px-1 py-2 text-center text-[11px] font-bold min-w-[76px]">{n}</th>
                ))}
                <th className="px-3 py-2 text-center text-[11px] font-bold text-amber-600 dark:!text-amber-300 min-w-[80px]">{t('drcTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {emps.map((emp, ri) => (
                <tr key={emp.id} className="table-row-hover transition-colors">
                  <td
                    className="sticky left-0 z-10 bg-white dark:!bg-slate-800 px-3 py-1.5 text-[12px] font-medium text-surface-800 dark:!text-slate-100 whitespace-nowrap cursor-pointer"
                    onClick={() => navigateTo('employees', emp.id)}
                  >
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-surface-600 dark:!text-slate-300 whitespace-nowrap">{emp.position || '-'}</td>
                  {MONTHS.map(m => (
                    <td key={m} className="px-1 py-1 text-center">{dayInput(emp.id, ri, m, getDays, setDay)}</td>
                  ))}
                  <td className="px-3 py-1.5 text-center text-sm font-bold text-amber-600 dark:!text-amber-300 bg-amber-50/50 dark:!bg-amber-500/10 whitespace-nowrap">{totalYear(emp.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const printRows = (emps: DCREmployee[]) => emps.map(e => {
    const o: any = { name: `${e.last_name} ${e.first_name}`, position: e.position || '-' };
    MONTHS.forEach(m => { o['m' + m] = getDays(e.id, m) || 0; });
    o.total = totalYear(e.id);
    return o;
  });

  const printFields: PrintField[] = [
    { key: 'name', label: String(t('empName')), getValue: (r) => r.name, defaultVisible: true, align: 'left' },
    { key: 'position', label: String(t('empPosition')), getValue: (r) => r.position, defaultVisible: true, align: 'center' },
    ...MONTHS.map(m => ({ key: 'm' + m, label: monthNames[m - 1].toUpperCase(), getValue: (r: any) => String(r['m' + m]), defaultVisible: true, align: 'center' as const })),
    { key: 'total', label: String(t('drcTotal')), getValue: (r) => String(r.total), defaultVisible: true, align: 'center' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{t('drcTitle')}</h1>
            <p className="page-h1-sub">{t('drcSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 glass-card rounded-xl px-2 py-1">
            <button onClick={() => setYear(y => y - 1)} className="icon-btn hover:!text-amber-500"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-bold text-surface-700 dark:!text-slate-200 min-w-[70px] text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="icon-btn hover:!text-amber-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={loadData} className="tool-action tool-action-refresh"><RefreshCw className="w-4 h-4" /> {t('conActualiser')}</button>
          <EmailSendButton prefix="DROIT_CR_" getHtml={() => buildFieldTableHtml(String(t('drcTitle')) + ' ' + year, String(year), printFields, printRows(employees), dir)} getSheets={() => buildFieldSheets(printFields, printRows(employees))} />
          <button onClick={() => setShowPrintPreview(true)} className="btn-secondary"><Printer className="w-4 h-4" /> {t('empPrint')}</button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 text-center text-surface-400">...</div>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-sm font-bold text-surface-800 dark:!text-slate-200">CDI / CDD</h2>
              <span className="text-[11px] text-surface-400">({regEmployees.length})</span>
            </div>
            {renderTable(regEmployees, String(t('empNoResults')))}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-surface-800 dark:!text-slate-200">DEPLACE</h2>
              <span className="text-[11px] text-surface-400">({deplaceEmployees.length})</span>
            </div>
            {renderTable(deplaceEmployees, String(t('empNoResults')))}
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

      {showPrintPreview && (
        <PrintPreviewModal
          title={String(t('drcTitle')) + ' ' + year}
          fields={printFields}
          data={printRows(employees)}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
