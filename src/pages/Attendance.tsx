import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Attendance as AttType, Employee } from '../types';
import { getStatusBadgeClass } from '../utils/helpers';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Printer, X } from 'lucide-react';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';

interface AttendanceProps { navigateTo: (page: string, id?: number) => void; }

export default function Attendance({ navigateTo }: AttendanceProps) {
  const { t, dir } = useLang();
  const { getStatusLabel } = useHelpers();
  const [records, setRecords] = useState<AttType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ employee_id: '', date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', notes: '' });

  useEffect(() => { loadData(); }, [selectedDate]);

  const loadData = async () => {
    const [recs, emps] = await Promise.all([api.getAttendance({ date: selectedDate }), api.getEmployees()]);
    setRecords(recs); setEmployees(emps.filter((e: any) => e.status === 'active'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.addAttendance({ ...formData, employee_id: parseInt(formData.employee_id) });
    setShowModal(false);
    setFormData({ employee_id: '', date: selectedDate, check_in: '', check_out: '', status: 'present', notes: '' });
    loadData();
  };

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const printFields: PrintField[] = [
    { key: 'name', label: t('empName'), getValue: (r) => `${r.first_name} ${r.last_name}`, defaultVisible: true },
    { key: 'check_in', label: t('attCheckIn'), getValue: (r) => r.check_in || '-', defaultVisible: true },
    { key: 'check_out', label: t('attCheckOut'), getValue: (r) => r.check_out || '-', defaultVisible: true },
    { key: 'status', label: t('attStatus'), getValue: (r) => getStatusLabel(r.status), defaultVisible: true },
    { key: 'notes', label: t('attNotes'), getValue: (r) => r.notes || '-' },
  ];

  const handlePrint = () => { setShowPrintPreview(true); };

  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-800">{t('attTitle')}</h1><p className="text-sm text-surface-500 mt-1">{t('attSubtitle')}</p></div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary"><Printer className="w-4 h-4" /> {t('attPrint')}</button>
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> {t('attRecord')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Calendar className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('attDate')}</p><p className="text-sm font-bold text-surface-800">{selectedDate}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('attPresent')}</p><p className="text-sm font-bold text-surface-800">{present}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center"><XCircle className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('attAbsent')}</p><p className="text-sm font-bold text-surface-800">{absent}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('attLate')}</p><p className="text-sm font-bold text-surface-800">{late}</p></div></div></div>
      </div>

      <div className="glass-card p-4 flex items-center gap-4">
        <label className="text-sm font-medium text-surface-600">{t('attDate')}:</label>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input-field w-auto" />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-header">
            <th className="px-4 py-3 text-right text-xs">{t('empName')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('attCheckIn')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('attCheckOut')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('attStatus')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('attNotes')}</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-surface-50/50">
                <td className="px-4 py-3 text-sm font-medium text-surface-800">{r.first_name} {r.last_name}</td>
                <td className="px-4 py-3 text-sm text-surface-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-surface-400" /> {r.check_in || '-'}</td>
                <td className="px-4 py-3 text-sm text-surface-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-surface-400" /> {r.check_out || '-'}</td>
                <td className="px-4 py-3"><span className={`badge ${getStatusBadgeClass(r.status)}`}>{getStatusLabel(r.status)}</span></td>
                <td className="px-4 py-3 text-sm text-surface-500">{r.notes || '-'}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-surface-400 text-sm">{t('attNoRecords')}</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content w-full max-w-md p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-surface-800">{t('attRecordTitle')}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="label-field">{t('attSelectEmployee')} *</label><select required value={formData.employee_id} onChange={(e) => setFormData({...formData, employee_id: e.target.value})} className="input-field"><option value="">{t('attSelectEmployee')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">{t('attDate')}</label><input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="input-field" /></div>
                <div><label className="label-field">{t('attStatus')}</label><select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input-field"><option value="present">{t('attPresentShort')}</option><option value="absent">{t('attAbsentShort')}</option><option value="late">{t('attLateShort')}</option><option value="leave">{t('attLeaveShort')}</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">{t('attCheckIn')}</label><input type="time" value={formData.check_in} onChange={(e) => setFormData({...formData, check_in: e.target.value})} className="input-field" /></div>
                <div><label className="label-field">{t('attCheckOut')}</label><input type="time" value={formData.check_out} onChange={(e) => setFormData({...formData, check_out: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="label-field">{t('attNotes')}</label><input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="input-field" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('empCancel')}</button>
                <button type="submit" className="btn-primary">{t('attSubmit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrintPreview && (
        <PrintPreviewModal
          title={t('printAttendance')}
          fields={printFields}
          data={records}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
