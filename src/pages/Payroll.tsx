import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Payroll as PayrollType } from '../types';
import { getStatusBadgeClass } from '../utils/helpers';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { Wallet, Printer, Calculator, Check, X } from 'lucide-react';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';

interface PayrollProps { navigateTo: (page: string, id?: number) => void; }

export default function Payroll({ navigateTo }: PayrollProps) {
  const { t, lang, dir, tArray } = useLang();
  const { getStatusLabel, formatCurrency } = useHelpers();
  const [payroll, setPayroll] = useState<PayrollType[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const printFields: PrintField[] = [
    { key: 'name', label: t('empName'), getValue: (p) => `${p.first_name} ${p.last_name}`, defaultVisible: true },
    { key: 'department', label: t('empDepartment'), getValue: (p) => p.department_name || '-', defaultVisible: true },
    { key: 'position', label: t('empPosition'), getValue: (p) => p.position || '-' },
    { key: 'base_salary', label: t('payBaseSalary'), getValue: (p) => formatCurrency(p.base_salary), defaultVisible: true },
    { key: 'bonuses', label: t('payBonuses'), getValue: (p) => formatCurrency(p.bonuses), defaultVisible: true },
    { key: 'deductions', label: t('payDeductions'), getValue: (p) => formatCurrency(p.deductions), defaultVisible: true },
    { key: 'net_salary', label: t('payNetSalary'), getValue: (p) => formatCurrency(p.net_salary), defaultVisible: true },
    { key: 'status', label: t('attStatus'), getValue: (p) => getStatusLabel(p.status), defaultVisible: true },
  ];
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  useEffect(() => { loadData(); }, [selectedMonth, selectedYear]);

  const loadData = async () => { const data = await api.getPayroll({ month: selectedMonth, year: selectedYear }); setPayroll(data); };

  const handleGenerate = async () => { await api.generatePayroll({ month: selectedMonth, year: selectedYear }); setShowGenerateModal(false); loadData(); };
  const handlePay = async (id: number) => { await api.paySalary(id); loadData(); };

  const months = tArray('payMonths');
  const years = [2024, 2025, 2026, 2027];

  const handlePrint = () => { setShowPrintPreview(true); };

  const totalBase = payroll.reduce((s, p) => s + (p.base_salary || 0), 0);
  const totalBonuses = payroll.reduce((s, p) => s + (p.bonuses || 0), 0);
  const totalDeductions = payroll.reduce((s, p) => s + (p.deductions || 0), 0);
  const totalNet = payroll.reduce((s, p) => s + (p.net_salary || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-800">{t('payTitle')}</h1><p className="text-sm text-surface-500 mt-1">{t('paySubtitle')}</p></div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary"><Printer className="w-4 h-4" /> {t('payPrint')}</button>
          <button onClick={() => setShowGenerateModal(true)} className="btn-primary"><Calculator className="w-4 h-4" /> {t('payGenerate')}</button>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap items-center gap-4">
        <div><label className="label-field">{t('payMonth')}</label><select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="input-field w-auto">{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
        <div><label className="label-field">{t('payYear')}</label><select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="input-field w-auto">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-surface-400">{t('payBaseSalary')}</p><p className="text-lg font-bold text-surface-800 mt-1">{formatCurrency(totalBase)}</p></div>
        <div className="stat-card"><p className="text-xs text-surface-400">{t('payBonuses')}</p><p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(totalBonuses)}</p></div>
        <div className="stat-card"><p className="text-xs text-surface-400">{t('payDeductions')}</p><p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(totalDeductions)}</p></div>
        <div className="stat-card"><p className="text-xs text-surface-400">{t('payNetSalary')}</p><p className="text-lg font-bold text-primary-600 mt-1">{formatCurrency(totalNet)}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-header">
            <th className="px-4 py-3 text-right text-xs">{t('empName')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('empDepartment')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('payBaseSalary')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('payBonuses')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('payDeductions')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('payNetSalary')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('attStatus')}</th>
            <th className="px-4 py-3 text-center text-xs">{t('empActions')}</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {payroll.map((p) => (
              <tr key={p.id} className="hover:bg-surface-50/50">
                <td className="px-4 py-3 text-sm font-medium text-surface-800">{p.first_name} {p.last_name}</td>
                <td className="px-4 py-3 text-sm text-surface-600">{p.department_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-surface-600">{formatCurrency(p.base_salary)}</td>
                <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(p.bonuses)}</td>
                <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(p.deductions)}</td>
                <td className="px-4 py-3 text-sm font-bold text-surface-800">{formatCurrency(p.net_salary)}</td>
                <td className="px-4 py-3"><span className={`badge ${getStatusBadgeClass(p.status)}`}>{getStatusLabel(p.status)}</span></td>
                <td className="px-4 py-3 text-center">
                  {p.status === 'draft' && <button onClick={() => handlePay(p.id)} className="btn-primary text-xs py-1 px-3"><Check className="w-3.5 h-3.5" /> {t('payPay')}</button>}
                </td>
              </tr>
            ))}
            {payroll.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-surface-400 text-sm">{t('payNoData')}</td></tr>}
          </tbody>
        </table>
      </div>

      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="modal-content w-full max-w-sm p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-800 mb-2">{t('payGenerateTitle')}</h3>
            <p className="text-sm text-surface-500 mb-6">{t('payGenerateMsg')} <strong>{months[selectedMonth - 1]} {selectedYear}</strong></p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowGenerateModal(false)} className="btn-secondary">{t('empCancel')}</button>
              <button onClick={handleGenerate} className="btn-primary"><Calculator className="w-4 h-4" /> {t('payGenerateBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && (
        <PrintPreviewModal
          title={`${t('printPayroll')} - ${months[selectedMonth - 1]} ${selectedYear}`}
          fields={printFields}
          data={payroll}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
