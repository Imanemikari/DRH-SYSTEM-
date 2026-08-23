import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { useLang } from '../context/LangContext';

export interface PrintField {
  key: string;
  label: string;
  getValue: (item: any) => string;
  defaultVisible?: boolean;
}

interface PrintPreviewModalProps {
  title: string;
  fields: PrintField[];
  data: any[];
  onClose: () => void;
}

export default function PrintPreviewModal({ title, fields, data, onClose }: PrintPreviewModalProps) {
  const { t, lang, dir } = useLang();
  const [selectedFields, setSelectedFields] = useState<string[]>(
    fields.filter(f => f.defaultVisible !== false).map(f => f.key)
  );

  const toggleField = (key: string) => {
    setSelectedFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const selectAll = () => setSelectedFields(fields.map(f => f.key));
  const selectNone = () => setSelectedFields([]);

  const visibleFields = fields.filter(f => selectedFields.includes(f.key));

  const handlePrint = () => {
    const headers = visibleFields.map(f => `<th style="background:#1e40af;color:white;padding:8px;text-align:right;border:1px solid #ccc;font-size:12px">${f.label}</th>`).join('');
    const rows = data.map(item => {
      const cells = visibleFields.map(f => `<td style="padding:8px;border:1px solid #ccc;text-align:right;font-size:12px">${f.getValue(item) || '-'}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const content = `
      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1e40af;padding-bottom:15px">
        <div style="font-size:20px;font-weight:bold;color:#1e40af">${title}</div>
        <div style="color:#666;font-size:12px">${t('printDate')}: ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-TN')}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:10px 0">
        <tr>${headers}</tr>
        ${rows}
      </table>
      <p style="margin-top:10px;font-size:12px;color:#666">${t('empCount')}: ${data.length}</p>
    `;
    const w = window.open('', '_blank', 'width=1100,height=700');
    if (w) { w.document.write(`<html dir="${dir}"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;padding:20px">${content}</body></html>`); w.document.close(); w.print(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scaleIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-lg font-bold text-surface-800">{t('printPreview')} — {title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-surface-700">{t('printSelectFields')}</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-primary-500 hover:text-primary-600 font-medium">{t('printSelectAll')}</button>
              <span className="text-surface-300">|</span>
              <button onClick={selectNone} className="text-xs text-surface-500 hover:text-surface-600 font-medium">{t('printSelectNone')}</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {fields.map(field => (
              <label key={field.key} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${selectedFields.includes(field.key) ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-surface-200 text-surface-500 hover:bg-surface-50'}`}>
                <input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => toggleField(field.key)} className="w-3.5 h-3.5 rounded border-surface-300 text-primary-500 focus:ring-primary-500" />
                {field.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <p className="text-xs text-surface-400 mb-3">{t('printVisibleColumns')}: {visibleFields.length} | {t('empCount')}: {data.length}</p>
          {visibleFields.length === 0 ? (
            <div className="text-center py-12 text-surface-400 text-sm">{t('printNoFields')}</div>
          ) : (
            <div className="overflow-x-auto border border-surface-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary-500 text-white">
                    {visibleFields.map(f => (
                      <th key={f.key} className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {data.map((item, i) => (
                    <tr key={i} className="hover:bg-surface-50/50">
                      {visibleFields.map(f => (
                        <td key={f.key} className="px-3 py-2 text-right text-xs text-surface-600 whitespace-nowrap">{f.getValue(item) || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-100 bg-surface-50/50">
          <button onClick={onClose} className="btn-secondary">{t('empCancel')}</button>
          <button onClick={handlePrint} disabled={visibleFields.length === 0} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <Printer className="w-4 h-4" /> {t('empPrint')}
          </button>
        </div>
      </div>
    </div>
  );
}
