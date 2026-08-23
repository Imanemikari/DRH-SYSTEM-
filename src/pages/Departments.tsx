import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Department } from '../types';
import { useLang } from '../context/LangContext';
import { Plus, Edit2, Trash2, X, Building2, Users } from 'lucide-react';

interface DepartmentsProps { navigateTo: (page: string, id?: number) => void; }

export default function Departments({ navigateTo }: DepartmentsProps) {
  const { t } = useLang();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', manager: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [depts, st] = await Promise.all([api.getDepartments(), api.getStats()]);
    setDepartments(depts); setStats(st.departmentStats || []);
  };

  const openAdd = () => { setEditDept(null); setFormData({ name: '', description: '', manager: '' }); setShowModal(true); };
  const openEdit = (dept: Department) => { setEditDept(dept); setFormData({ name: dept.name, description: dept.description || '', manager: dept.manager || '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editDept) await api.updateDepartment({ ...formData, id: editDept.id });
    else await api.addDepartment(formData);
    setShowModal(false); loadData();
  };

  const handleDelete = async (id: number) => { await api.deleteDepartment(id); setShowDeleteConfirm(null); loadData(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-800">{t('deptTitle')}</h1><p className="text-sm text-surface-500 mt-1">{t('deptSubtitle')}</p></div>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> {t('deptAdd')}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept) => {
          const deptStats = stats.find((s: any) => s.name === dept.name);
          return (
            <div key={dept.id} className="glass-card p-5 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg"><Building2 className="w-6 h-6 text-white" /></div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(dept)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-amber-500"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setShowDeleteConfirm(dept.id)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-base font-semibold text-surface-800">{dept.name}</h3>
              <p className="text-xs text-surface-400 mt-1 line-clamp-2">{dept.description || t('deptNoDesc')}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100">
                <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-surface-400" /><span className="text-xs text-surface-500">{deptStats?.count || 0} {t('deptEmployees')}</span></div>
                {dept.manager && <span className="text-xs text-surface-400">{t('deptManager')}: {dept.manager}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content w-full max-w-md p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-surface-800">{editDept ? t('deptEditTitle') : t('deptAddTitle')}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="label-field">{t('deptName')} *</label><input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input-field" /></div>
              <div><label className="label-field">{t('deptDesc')}</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input-field h-20 resize-none" /></div>
              <div><label className="label-field">{t('deptManager')}</label><input value={formData.manager} onChange={(e) => setFormData({...formData, manager: e.target.value})} className="input-field" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('empCancel')}</button>
                <button type="submit" className="btn-primary">{editDept ? t('empUpdate') : t('deptAdd')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content w-full max-w-sm p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-800 mb-2">{t('deptDeleteConfirm')}</h3>
            <p className="text-sm text-surface-500 mb-6">{t('deptDeleteMsg')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">{t('empCancel')}</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="btn-danger">{t('empDelete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
