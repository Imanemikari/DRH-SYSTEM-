import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Leave, Employee } from '../types';
import { getStatusBadgeClass } from '../utils/helpers';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { CalendarOff, Plus, Check, X, Clock, Printer, Edit2, Trash2 } from 'lucide-react';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';

interface LeavesProps { navigateTo: (page: string, id?: number) => void; }

export default function Leaves({ navigateTo }: LeavesProps) {
  const { t, dir } = useLang();
  const { getStatusLabel, formatDate } = useHelpers();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editLeave, setEditLeave] = useState<Leave | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [formData, setFormData] = useState({ employee_id: '', leave_type: t('leaveTypeAnnual'), start_date: '', end_date: '', reason: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [lvs, emps] = await Promise.all([api.getLeaves(), api.getEmployees()]);
    setLeaves(lvs); setEmployees(emps.filter((e: any) => e.status === 'active' || e.status === 'on_leave'));
  };

  const filteredLeaves = leaves.filter(l => !filterStatus || l.status === filterStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(formData.start_date); const end = new Date(formData.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    await api.addLeave({ ...formData, employee_id: parseInt(formData.employee_id), days: days > 0 ? days : 1 });
    setShowModal(false); loadData();
  };

  const handleApprove = async (id: number) => {
    await api.updateLeave({ id, status: 'approved', approved_by: 'Manager' });
    const leave = leaves.find(l => l.id === id);
    if (leave) {
      const today = new Date().toISOString().split('T')[0];
      if (leave.end_date >= today) {
        await api.updateEmployeeStatus(leave.employee_id, 'on_leave');
      }
    }
    loadData();
  };

  const handleReject = async (id: number) => {
    const leave = leaves.find(l => l.id === id);
    await api.updateLeave({ id, status: 'rejected', approved_by: 'Manager' });
    if (leave) {
      const otherApproved = leaves.filter(l => l.employee_id === leave.employee_id && l.status === 'approved' && l.id !== id);
      const today = new Date().toISOString().split('T')[0];
      const hasActive = otherApproved.some(l => l.end_date >= today);
      if (!hasActive) {
        await api.updateEmployeeStatus(leave.employee_id, 'active');
      }
    }
    loadData();
  };

  const openEditModal = (leave: Leave) => {
    setEditLeave(leave);
    setFormData({
      employee_id: leave.employee_id.toString(),
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason || '',
    });
    setShowModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeave) return;
    const start = new Date(formData.start_date); const end = new Date(formData.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const today = new Date().toISOString().split('T')[0];
    const newStatus = editLeave.status === 'approved' && formData.end_date < today ? 'completed' : editLeave.status;
    await api.updateLeave({
      id: editLeave.id, employee_id: parseInt(formData.employee_id), leave_type: formData.leave_type,
      start_date: formData.start_date, end_date: formData.end_date, days: days > 0 ? days : 1,
      reason: formData.reason, status: newStatus, approved_by: editLeave.approved_by || '',
    });
    if (newStatus !== editLeave.status) {
      const otherApproved = leaves.filter(l => l.employee_id === editLeave.employee_id && l.status === 'approved' && l.id !== editLeave.id);
      const hasActive = otherApproved.some(l => l.end_date >= today);
      if (!hasActive) await api.updateEmployeeStatus(editLeave.employee_id, 'active');
    }
    setShowModal(false); setEditLeave(null); loadData();
  };

  const handleDelete = async (id: number) => {
    const leave = leaves.find(l => l.id === id);
    await api.deleteLeave(id);
    if (leave) {
      const today = new Date().toISOString().split('T')[0];
      if (leave.status === 'approved' && leave.end_date >= today) {
        const otherApproved = leaves.filter(l => l.employee_id === leave.employee_id && l.status === 'approved' && l.id !== id);
        const hasActive = otherApproved.some(l => l.end_date >= today);
        if (!hasActive) await api.updateEmployeeStatus(leave.employee_id, 'active');
      }
    }
    setShowDeleteConfirm(null); loadData();
  };

  const printFields: PrintField[] = [
    { key: 'name', label: t('empName'), getValue: (l) => `${l.first_name} ${l.last_name}`, defaultVisible: true },
    { key: 'leave_type', label: t('leaveType'), getValue: (l) => l.leave_type, defaultVisible: true },
    { key: 'start_date', label: t('leaveFrom'), getValue: (l) => formatDate(l.start_date), defaultVisible: true },
    { key: 'end_date', label: t('leaveTo'), getValue: (l) => formatDate(l.end_date), defaultVisible: true },
    { key: 'days', label: t('leaveDays'), getValue: (l) => l.days?.toString() || '-', defaultVisible: true },
    { key: 'reason', label: t('leaveReason'), getValue: (l) => l.reason || '-' },
    { key: 'status', label: t('attStatus'), getValue: (l) => getStatusLabel(l.status), defaultVisible: true },
  ];

  const handlePrint = () => { setShowPrintPreview(true); };

  const pending = leaves.filter(l => l.status === 'pending').length;
  const approved = leaves.filter(l => l.status === 'approved').length;

  const leaveTypes = [t('leaveTypeAnnual'), t('leaveTypeSick'), t('leaveTypeEmergency'), t('leaveTypeMaternity'), t('leaveTypePaternity'), t('leaveTypeUnpaid'), t('leaveTypeStudy'), t('leaveTypeOther')];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-800">{t('leaveTitle')}</h1><p className="text-sm text-surface-500 mt-1">{t('leaveSubtitle')}</p></div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary"><Printer className="w-4 h-4" /> {t('leavePrint')}</button>
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> {t('leaveRequest')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><Clock className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('leavePending')}</p><p className="text-lg font-bold text-surface-800">{pending}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center"><Check className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('leaveApproved')}</p><p className="text-lg font-bold text-surface-800">{approved}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center"><X className="w-5 h-5 text-white" /></div><div><p className="text-xs text-surface-400">{t('leaveRejected')}</p><p className="text-lg font-bold text-surface-800">{leaves.filter(l => l.status === 'rejected').length}</p></div></div></div>
      </div>

      <div className="flex gap-2">
        {[{ s: '', l: t('empAllStatus') }, { s: 'pending', l: t('leavePending') }, { s: 'approved', l: t('leaveApproved') }, { s: 'rejected', l: t('leaveRejected') }].map(item => (
          <button key={item.s} onClick={() => setFilterStatus(item.s)} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${filterStatus === item.s ? 'bg-primary-500 text-white' : 'bg-white text-surface-500 border border-surface-200 hover:bg-surface-50'}`}>{item.l}</button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-header">
            <th className="px-4 py-3 text-right text-xs">{t('empName')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('leaveType')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('leaveFrom')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('leaveTo')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('leaveDays')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('leaveReason')}</th>
            <th className="px-4 py-3 text-right text-xs">{t('attStatus')}</th>
            <th className="px-4 py-3 text-center text-xs">{t('empActions')}</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {filteredLeaves.map((l) => (
              <tr key={l.id} className="hover:bg-surface-50/50">
                <td className="px-4 py-3 text-sm font-medium text-surface-800">{l.first_name} {l.last_name}</td>
                <td className="px-4 py-3 text-sm text-surface-600">{l.leave_type}</td>
                <td className="px-4 py-3 text-sm text-surface-600">{formatDate(l.start_date)}</td>
                <td className="px-4 py-3 text-sm text-surface-600">{formatDate(l.end_date)}</td>
                <td className="px-4 py-3 text-sm text-surface-600 font-medium">{l.days}</td>
                <td className="px-4 py-3 text-sm text-surface-500 max-w-[150px] truncate">{l.reason || '-'}</td>
                <td className="px-4 py-3"><span className={`badge ${getStatusBadgeClass(l.status)}`}>{getStatusLabel(l.status)}</span></td>
                <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {l.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(l.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition-all" title={t('leaveApprove')}><Check className="w-4 h-4" /></button>
                          <button onClick={() => handleReject(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-all" title={t('leaveReject')}><X className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => openEditModal(l)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-amber-500 transition-all" title={t('empEdit')}><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setShowDeleteConfirm(l.id)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-red-500 transition-all" title={t('empDelete')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
              </tr>
            ))}
            {filteredLeaves.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-surface-400 text-sm">{t('leaveNoRequests')}</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditLeave(null); }}>
          <div className="modal-content w-full max-w-md p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-surface-800">{editLeave ? t('empEditTitle') : t('leaveNewTitle')}</h2>
              <button onClick={() => { setShowModal(false); setEditLeave(null); }} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={editLeave ? handleEditSubmit : handleSubmit} className="space-y-4">
              <div><label className="label-field">{t('leaveSelectEmp')} *</label><select required value={formData.employee_id} onChange={(e) => setFormData({...formData, employee_id: e.target.value})} className="input-field"><option value="">{t('leaveSelectEmp')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
              <div><label className="label-field">{t('leaveType')}</label><select value={formData.leave_type} onChange={(e) => setFormData({...formData, leave_type: e.target.value})} className="input-field">{leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">{t('leaveFrom')} *</label><input type="date" required value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="input-field" /></div>
                <div><label className="label-field">{t('leaveTo')} *</label><input type="date" required value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="label-field">{t('leaveReason')}</label><textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="input-field h-20 resize-none" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => { setShowModal(false); setEditLeave(null); }} className="btn-secondary">{t('empCancel')}</button>
                <button type="submit" className="btn-primary">{editLeave ? t('empUpdate') : t('leaveSubmit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content w-full max-w-sm p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-800 mb-2">{t('empDeleteConfirm')}</h3>
            <p className="text-sm text-surface-500 mb-6">{t('empDeleteMsg')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">{t('empCancel')}</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="btn-danger">{t('empDelete')}</button>
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && (
        <PrintPreviewModal
          title={t('printLeaves')}
          fields={printFields}
          data={filteredLeaves}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
