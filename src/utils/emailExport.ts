import type { PrintField } from '../components/PrintPreviewModal';
import { makeSeal, sealFooterHtml } from './docSeal';

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const buildFieldTableHtml = (title: string, dateLabel: string, fields: PrintField[], data: any[], dir: string, landscape?: boolean, subject?: string) => {
  const alignOf = (f: PrintField) => (f as any).align || 'right';
  const htmlHeaders = fields.map(f => `<th style="background:#14305a;color:white;padding:8px;border:1px solid #ccc;font-size:12px;text-align:${alignOf(f)}">${esc(f.label)}</th>`).join('');
  const htmlRows = data.map(item => {
    const cells = fields.map(f => `<td style="padding:8px;border:1px solid #ccc;text-align:${alignOf(f)};font-size:12px">${esc(f.getValue(item)) || '-'}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const date = new Date().toLocaleDateString(dir === 'rtl' ? 'ar-TN' : 'fr-TN');
  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><style>@page{size:${landscape ? 'A4 landscape' : 'A4 portrait'};margin:12mm}body{font-family:Arial,sans-serif;color:#111}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ccc;padding:8px;font-size:12px;text-align:right}</style></head><body>
    <div style="text-align:center;border-bottom:2px solid #14305a;padding-bottom:12px;margin-bottom:14px">
      <div style="font-size:18px;font-weight:bold;color:#14305a">${esc(title)}</div>
      <div style="color:#666;font-size:12px">${esc(dateLabel)}: ${date}</div>
    </div>
    <table><thead><tr>${htmlHeaders}</tr></thead><tbody>${htmlRows}</tbody></table>
    ${sealFooterHtml(makeSeal({ title, rows: [fields.map(f => f.label), ...data.map(item => fields.map(f => String(f.getValue(item) ?? '')))] }))}
    <p style="margin-top:10px;font-size:11px;color:#666">${esc(subject || '')}</p>
  </body></html>`;
};

export const buildFieldSheets = (fields: PrintField[], data: any[]): any[] => {
  const rows: any[][] = [[...fields.map(f => ({ v: f.label, s: 1 }))]];
  data.forEach(item => { rows.push(fields.map(f => ({ v: String(f.getValue(item) ?? ''), s: 0 }))); });
  return [{ name: '', rows, widths: fields.map(() => 18) }];
};
