import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Department } from '../types';
import { useLang } from '../context/LangContext';
import { Plus, Edit2, Trash2, X, Users, LayoutGrid, List, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

interface DepartmentsProps { navigateTo: (page: string, id?: number) => void; }

export default function Departments({ navigateTo }: DepartmentsProps) {
  const { t } = useLang();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', manager: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [depts, st] = await Promise.all([api.getDepartments(), api.getStats()]);
    setDepartments(depts); setStats(st.departmentStats || []);
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= departments.length || from === to) return;
    const arr = [...departments];
    const [it] = arr.splice(from, 1);
    arr.splice(to, 0, it);
    setDepartments(arr);
    api.reorderDepartments(arr.map((d) => d.id));
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

  const renderCard = (dept: any, i: number) => {
    const deptStats = stats.find((s: any) => s.name === dept.name);
    const isFirst = i === 0;
    const isLast = i === departments.length - 1;
    return (
      <div
        key={dept.id}
        draggable
        onDragStart={(e) => { setDragIndex(i); e.dataTransfer.setData('text/plain', String(i)); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) moveItem(dragIndex, i); setDragIndex(null); }}
        onDragEnd={() => setDragIndex(null)}
        className={`glass-card p-5 hover:shadow-premium-hover transition-all cursor-grab active:cursor-grabbing ${dragIndex === i ? 'opacity-60 ring-2 ring-amber-400/70' : ''} ${layout === 'list' ? 'flex flex-wrap items-center gap-4' : ''}`}
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center shadow-lg shadow-[#14305a]/20 shrink-0">
          <span className="text-white font-bold text-sm">{dept.name?.[0]?.toUpperCase() || 'F'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-surface-800 dark:!text-slate-100">{dept.name}</h3>
          <p className="text-xs text-surface-400 mt-1 line-clamp-2 dark:!text-slate-400">{dept.description || t('deptNoDesc')}</p>
        </div>
        {layout === 'list' && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs text-surface-500 dark:!text-slate-300">{deptStats?.count || 0} {t('deptEmployees')}</span></div>
            {dept.manager && <span className="text-xs text-slate-400 dark:!text-slate-400">{t('deptManager')}: {dept.manager}</span>}
          </div>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => moveItem(i, i - 1)} disabled={isFirst} title={t('deptMoveUp')} className={`icon-btn hover:!text-amber-500 ${isFirst ? 'opacity-30 pointer-events-none' : ''}`}><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => moveItem(i, i + 1)} disabled={isLast} title={t('deptMoveDown')} className={`icon-btn hover:!text-amber-500 ${isLast ? 'opacity-30 pointer-events-none' : ''}`}><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={() => openEdit(dept)} className="icon-btn hover:!text-amber-500"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => setShowDeleteConfirm(dept.id)} className="icon-btn hover:!text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
        {layout === 'grid' && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100 dark:!border-slate-600/50">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="text-xs text-surface-500 dark:!text-slate-300">{deptStats?.count || 0} {t('deptEmployees')}</span></div>
            {dept.manager && <span className="text-xs text-slate-400 dark:!text-slate-400">{t('deptManager')}: {dept.manager}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <p className="page-eyebrow">{t('pgDeptKicker')}</p>
            <h1 className="page-h1">{t('deptTitle')}</h1>
            <p className="page-h1-sub">{t('deptSubtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass-card rounded-xl px-1.5 py-1 flex items-center gap-1" title={t('deptReorder')}>
            <button onClick={() => setLayout('grid')} title={t('deptLayoutGrid')} className={`togg-btn !px-3 !py-2 ${layout === 'grid' ? 'active' : ''}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setLayout('list')} title={t('deptLayoutList')} className={`togg-btn !px-3 !py-2 ${layout === 'list' ? 'active' : ''}`}><List className="w-4 h-4" /></button>
          </div>
          <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> {t('deptAdd')}</button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-400 dark:!text-slate-500">{t('deptLayout')}: {layout === 'grid' ? t('deptLayoutGrid') : t('deptLayoutList')}</span>
        <span className="text-xs text-surface-400 dark:!text-slate-500 flex items-center gap-1"><GripVertical className="w-3.5 h-3.5" /> {t('deptReorder')}</span>
      </div>

      {layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept, i) => renderCard(dept, i))}
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept, i) => renderCard(dept, i))}
        </div>
      )}

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
