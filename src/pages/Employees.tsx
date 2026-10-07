import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Employee, Department } from '../types';
import { getStatusBadgeClass, generateMatricule } from '../utils/helpers';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { Plus, Search, Edit2, Trash2, Eye, UserPlus, Printer, RefreshCw, X, Upload, Briefcase, MapPin, ArrowDownAZ } from 'lucide-react';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';
import EmailSendButton from '../components/EmailSendButton';
import { buildFieldTableHtml, buildFieldSheets } from '../utils/emailExport';

interface EmployeesProps {
  navigateTo: (page: string, id?: number) => void;
}

export default function Employees({ navigateTo }: EmployeesProps) {
  const { t, lang, dir } = useLang();
  const { getStatusLabel, formatCurrency, formatDate } = useHelpers();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPositions, setFilterPositions] = useState<string[]>([]);
  const [sortAZ, setSortAZ] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [printPositions, setPrintPositions] = useState<string[]>([]);
  const [printPosOpen, setPrintPosOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    matricule: '', first_name: '', last_name: '', marital_status: '', phone: '', address: '',
    date_of_birth: '', hire_date: '', end_date: '', department_id: '', position: '', contract_type: 'CDI',
    salary: '', status: 'active', gender: '', national_id: '', social_security: '',
    nb_enfants: '', bank_account: '00799999', bank_type: 'ccp', national_id_type: 'CNI', notes: '', photo_path: '', transport: '', nuisance_pct: '', ifsp_pct: '', ifep_pct: '', prime_technicite: '', prime_sujetion: '', prime_responsabilite: '', prime_zone: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [emps, depts] = await Promise.all([api.getEmployees(), api.getDepartments()]);
    setEmployees(emps);
    setDepartments(depts);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchSearch = !searchQuery || `${emp.first_name} ${emp.last_name} ${emp.matricule} ${emp.phone}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = !filterDept || emp.department_id?.toString() === filterDept;
    const matchStatus = !filterStatus || emp.status === filterStatus;
    const matchPositions = filterPositions.length === 0 || (emp.position && filterPositions.includes(emp.position));
    return matchSearch && matchDept && matchStatus && matchPositions;
  }).sort((a, b) => sortAZ ? a.last_name.localeCompare(b.last_name, 'fr') : 0);

  const allPositions = [...new Set(employees.map(e => e.position).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));

  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  // Print/email use the ticked names when any are ticked, otherwise the whole filtered list,
// then narrowed to the print professions when any are chosen
  const printBase = selectedIds.length > 0 ? filteredEmployees.filter(e => selectedIds.includes(e.id)) : filteredEmployees;
  const printData = printPositions.length > 0 ? printBase.filter(e => e.position && printPositions.includes(e.position)) : printBase;

  const openAddModal = () => {
    setEditEmployee(null);
    setFormData({
      matricule: generateMatricule(), first_name: '', last_name: '', marital_status: '', phone: '',
      address: '', date_of_birth: '', hire_date: new Date().toISOString().split('T')[0],
      end_date: '', department_id: '', position: '', contract_type: 'CDI', salary: '', status: 'active',
      gender: '', national_id: '', national_id_type: 'CNI', social_security: '', nb_enfants: '',
      bank_account: '00799999', bank_type: 'ccp', notes: '', photo_path: '', transport: '', nuisance_pct: '', ifsp_pct: '', ifep_pct: '', prime_technicite: '', prime_sujetion: '', prime_responsabilite: '', prime_zone: ''
    });
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditEmployee(emp);
    setFormData({
      matricule: emp.matricule, first_name: emp.first_name, last_name: emp.last_name,
      marital_status: emp.marital_status || '', phone: emp.phone || '', address: emp.address || '',
      date_of_birth: emp.date_of_birth || '', hire_date: emp.hire_date, end_date: emp.end_date || '',
      department_id: emp.department_id?.toString() || '', position: emp.position || '',
      contract_type: emp.contract_type || 'CDI', salary: emp.salary?.toString() || '',
      status: emp.status || 'active', gender: emp.gender || '',
      national_id: emp.national_id || '', national_id_type: emp.national_id_type || 'CNI', social_security: emp.social_security || '',
      nb_enfants: emp.nb_enfants?.toString() || '',
      bank_account: emp.bank_account || '00799999',
      bank_type: (emp.bank_account || '').startsWith('00799999') ? 'ccp' : 'banque',
      notes: emp.notes || '', photo_path: emp.photo_path || '',
      transport: emp.transport || '', nuisance_pct: emp.nuisance_pct?.toString() || '', ifsp_pct: emp.ifsp_pct?.toString() || '', ifep_pct: emp.ifep_pct?.toString() || '', prime_technicite: emp.prime_technicite?.toString() || '', prime_sujetion: emp.prime_sujetion?.toString() || '', prime_responsabilite: emp.prime_responsabilite?.toString() || '', prime_zone: emp.prime_zone?.toString() || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      department_id: formData.department_id ? parseInt(formData.department_id) : null,
      salary: formData.salary ? parseFloat(formData.salary) : null,
      nb_enfants: formData.nb_enfants ? parseInt(formData.nb_enfants) : null,
    };
    if (editEmployee) { await api.updateEmployee({ ...data, id: editEmployee.id }); }
    else { await api.addEmployee(data); }
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: number) => { await api.deleteEmployee(id); setShowDeleteConfirm(null); loadData(); };

  const handlePhotoUpload = async () => {
    const result = await api.openFile({ filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }] });
    if (!result.canceled && result.filePaths[0]) {
      const ext = result.filePaths[0].split('.').pop();
      const savedPath = await api.saveFileToUploads(result.filePaths[0], `photo_${Date.now()}.${ext}`);
      setFormData({ ...formData, photo_path: savedPath });
    }
  };

  const handleBankAccountChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 20) {
      setFormData({ ...formData, bank_account: cleaned });
    }
  };

  const handleSocialSecurityChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 12) {
      setFormData({ ...formData, social_security: cleaned });
    }
  };

  const printFields: PrintField[] = [
    { key: 'matricule', label: t('empMatricule'), getValue: (e) => e.matricule, defaultVisible: true, align: 'center' },
    { key: 'name', label: t('empName'), getValue: (e) => `${e.last_name} ${e.first_name}`, defaultVisible: true, align: 'left' },
    { key: 'position', label: t('empPosition'), getValue: (e) => e.position || '-', defaultVisible: true, align: 'center' },
    { key: 'birth', label: t('empBirthDate'), getValue: (e) => formatDate(e.date_of_birth), defaultVisible: false, align: 'center' },
    { key: 'doctype', label: t('empNationalIdType'), getValue: (e) => e.national_id || '-', defaultVisible: false, align: 'center' },
    { key: 'phone', label: t('empPhone'), getValue: (e) => e.phone || '-', align: 'center' },
    { key: 'hire_date', label: t('empHireDate'), getValue: (e) => formatDate(e.hire_date), defaultVisible: true, align: 'center' },
    { key: 'end_date', label: t('empEndDate'), getValue: (e) => formatDate(e.end_date), defaultVisible: true, align: 'center' },
    { key: 'contract_type', label: t('empContractType'), getValue: (e) => e.contract_type || '-', align: 'center' },
    { key: 'salary', label: t('empBaseSalary'), getValue: (e) => e.salary ? formatCurrency(e.salary) : '-', align: 'center' },
    { key: 'status', label: t('empStatus'), getValue: (e) => getStatusLabel(e.status), defaultVisible: true, align: 'center' },
    { key: 'social_security', label: t('empSocialSecurity'), getValue: (e) => e.social_security || '-', align: 'center' },
    { key: 'gender', label: t('empGender'), getValue: (e) => e.gender === 'male' ? t('empMale') : e.gender === 'female' ? t('empFemale') : '-', align: 'center' },
    { key: 'nb_enfants', label: t('empNbEnfants'), getValue: (e) => e.nb_enfants ? e.nb_enfants.toString() : '-', align: 'center' },
  ];

  const handlePrintList = () => { setShowPrintPreview(true); };

  const statusOpts = [
    { value: '', label: t('empAllStatus') },
    { value: 'active', label: t('empActive') },
    { value: 'inactive', label: t('empInactive') },
    { value: 'on_leave', label: t('empOnLeave') },
    { value: 'terminated', label: t('empTerminated') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <p className="page-eyebrow">{t('pgEmpKicker')}</p>
            <h1 className="page-h1">{t('empTitle')}</h1>
            <p className="page-h1-sub">{t('empSubtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSortAZ(v => !v)} title={t('empSortAZ')} className={`togg-btn ${sortAZ ? 'active' : ''}`}><ArrowDownAZ className="w-4 h-4" /> {t('empSortAZ')}</button>
          <button onClick={loadData} className="tool-action tool-action-refresh"><RefreshCw className="w-4 h-4" /> {t('conActualiser')}</button>
          <button onClick={handlePrintList} className="btn-secondary"><Printer className="w-4 h-4" /> {t('empPrint')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</button>
          {selectedIds.length > 0 && (
            <button onClick={() => setSelectedIds([])} className="btn-secondary !px-3" title={t('empClearSelection')}><X className="w-4 h-4" /></button>
          )}
          <div className="relative">
            <button onClick={() => setPrintPosOpen(o => !o)} className="btn-secondary !px-3" title={t('empPrintPositions')}>
              <Briefcase className="w-4 h-4" />
              {printPositions.length > 0 && <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-b from-[#ffe066] to-[#f5a623] text-[#14305a] text-[10px] font-bold flex items-center justify-center">{printPositions.length}</span>}
            </button>
            {printPosOpen && (
              <div className="absolute end-0 mt-2 w-64 glass-card rounded-xl shadow-lg z-50 p-3 animate-scaleIn" onMouseLeave={() => setPrintPosOpen(false)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-surface-700 dark:!text-slate-200">{t('empPrintPositions')}</span>
                  {printPositions.length > 0 && <button onClick={() => setPrintPositions([])} className="text-[11px] text-red-500 hover:underline">{t('empClearSelection')}</button>}
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {allPositions.map(pos => {
                    const checked = printPositions.includes(pos);
                    return (
                      <label key={pos} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-slate-50 dark:hover:!bg-slate-700 text-surface-700 dark:!text-slate-200">
                        <input type="checkbox" checked={checked} onChange={() => setPrintPositions(prev => checked ? prev.filter(p => p !== pos) : [...prev, pos])} className="w-3.5 h-3.5 rounded accent-[#f5a623]" />
                        <span className="flex-1">{pos}</span>
                        {checked && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <EmailSendButton prefix="EMPLOYES_" getHtml={() => buildFieldTableHtml(String(t('empPrint')), String(t('empHireDate')), printFields, printData, dir)} getSheets={() => buildFieldSheets(printFields, printData)} />
          <button onClick={openAddModal} className="btn-primary"><UserPlus className="w-4 h-4" /> {t('empAdd')}</button>
        </div>
      </div>

      {printPositions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          {printPositions.map(pos => (
            <span key={pos} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-400 text-amber-700 dark:!bg-amber-500/15 dark:!border-amber-500/40 dark:!text-amber-300">
              {pos}
              <button onClick={() => setPrintPositions(prev => prev.filter(p => p !== pos))} className="w-4 h-4 rounded-full hover:bg-amber-200 dark:hover:!bg-amber-500/30 flex items-center justify-center"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
            <input type="text" placeholder={t('empSearch')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`input-field ${dir === 'rtl' ? 'pr-10' : 'pl-10'}`} />
          </div>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="input-field w-auto min-w-[150px]">
            <option value="">{t('empAllDepts')}</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-auto min-w-[150px]">
            {statusOpts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {allPositions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-100 dark:!border-slate-600">
            <p className="text-xs font-semibold text-surface-500 mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> {t('empFilterProfessions')}
            </p>
            <div className="flex flex-wrap gap-2">
              {allPositions.map(pos => {
                const checked = filterPositions.includes(pos);
                return (
                  <label key={pos} className={`prof-check ${checked ? 'checked' : 'unchecked'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setFilterPositions(prev => checked ? prev.filter(p => p !== pos) : [...prev, pos])} />
                    {pos}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {(() => {
        const cddCdiEmps = filteredEmployees.filter((e) => e.contract_type !== 'DEPLACE');
        const deplaceEmps = filteredEmployees.filter((e) => e.contract_type === 'DEPLACE');
        const renderTable = (emps: Employee[], emptyLabel: string, hireLabel: string, endLabel: string, showNo: boolean, showSalary: boolean) => (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-2 py-2 text-center w-8">
                      <input
                        type="checkbox"
                        title={t('empPrint')}
                        checked={emps.length > 0 && emps.every(e => selectedIds.includes(e.id))}
                        onChange={() => {
                          const all = emps.length > 0 && emps.every(e => selectedIds.includes(e.id));
                          if (all) setSelectedIds(prev => prev.filter(id => !emps.some(e => e.id === id)));
                          else setSelectedIds(prev => [...prev, ...emps.filter(e => !prev.includes(e.id)).map(e => e.id)]);
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#f5a623]"
                      />
                    </th>
                    {showNo && <th className="px-3 py-2 text-right text-[11px]">{t('empNo')}</th>}
                    <th className="px-3 py-2 text-right text-[11px]">{t('empMatricule')}</th>
                    <th className="px-3 py-2 text-right text-[11px]">{t('empName')}</th>
                    <th className="px-3 py-2 text-right text-[11px]">{t('empPosition')}</th>
                    <th className="px-3 py-2 text-right text-[11px]">{hireLabel}</th>
                    <th className="px-3 py-2 text-right text-[11px]">{endLabel}</th>
                    {showSalary && <th className="px-3 py-2 text-right text-[11px]">{t('empBaseSalary')}</th>}
                    <th className="px-3 py-2 text-right text-[11px]">{t('empStatus')}</th>
                    <th className="px-3 py-2 text-center text-[11px]">{t('empActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {emps.map((emp, idx) => (
                    <tr key={emp.id} className="table-row-hover transition-colors">
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggleSelect(emp.id)} className="w-3.5 h-3.5 rounded accent-[#f5a623]" />
                      </td>
                      {showNo && <td className="px-3 py-2 text-xs font-mono text-surface-500">{idx + 1}</td>}
                      <td className="px-3 py-2 text-xs font-mono text-surface-600">{emp.matricule}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {emp.photo_path ? <img src={emp.photo_path} alt="" className="w-full h-full rounded-full object-cover" /> : `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-surface-800">{emp.last_name} {emp.first_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-surface-600">{emp.position || '-'}</td>
                      <td className="px-3 py-2 text-xs text-surface-600">{formatDate(emp.hire_date)}</td>
                      <td className="px-3 py-2 text-xs text-surface-600">{formatDate(emp.end_date)}</td>
                      {showSalary && <td className="px-3 py-2 text-xs text-surface-600">{emp.salary ? formatCurrency(emp.salary) : '-'}</td>}
                      <td className="px-3 py-2"><span className={`badge ${getStatusBadgeClass(emp.status)}`}>{getStatusLabel(emp.status)}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => navigateTo('employees', emp.id)} className="icon-btn hover:!text-blue-500" title={t('empView')}><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEditModal(emp)} className="icon-btn hover:!text-amber-500" title={t('empEdit')}><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setShowDeleteConfirm(emp.id)} className="icon-btn hover:!text-red-500" title={t('empDelete')}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {emps.length === 0 && <tr><td colSpan={showNo ? (showSalary ? 10 : 9) : 8} className="px-4 py-12 text-center text-surface-400 text-sm">{emptyLabel}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-surface-100 bg-surface-50/50">
              <p className="text-xs text-surface-500">{t('empCount')}: {emps.length}</p>
            </div>
          </div>
        );
        return (
          <>
            <div className="glass-card p-4 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-white" />
                </span>
                <h3 className="text-sm font-bold text-surface-800">{t('empContractCDI')} / {t('empContractCDD')}</h3>
              </div>
              <span className="badge badge-info">{cddCdiEmps.length}</span>
            </div>
            {renderTable(cddCdiEmps, t('empNoResults'), t('empHireDate'), t('empEndDate'), false, false)}

            <div className="glass-card p-4 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </span>
                <h3 className="text-sm font-bold text-surface-800">{t('empContractDeplace')}</h3>
              </div>
              <span className="badge badge-warning">{deplaceEmps.length}</span>
            </div>
            {renderTable(deplaceEmps, t('empNoResults'), t('empAffectationDate'), t('empReintegrationDate'), true, true)}
          </>
        );
      })()}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content w-full max-w-4xl p-6 animate-scaleIn max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-surface-800">{editEmployee ? t('empEditTitle') : t('empAddTitle')}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-4">
                <div onClick={handlePhotoUpload} className="w-20 h-20 rounded-2xl border-2 border-dashed border-surface-200 hover:border-primary-300 flex items-center justify-center cursor-pointer transition-all overflow-hidden">
                  {formData.photo_path ? <img src={formData.photo_path} alt="" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6 text-surface-300" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-700">{t('empPhoto')}</p>
                  <p className="text-xs text-surface-400">{t('empPhotoHint')}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empPersonalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="label-field">{t('empMatricule')} *</label><input required value={formData.matricule} onChange={(e) => setFormData({...formData, matricule: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empFirstName')} *</label><input required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empLastName')} *</label><input required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empGender')}</label><select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="input-field"><option value="">-</option><option value="male">{t('empMale')}</option><option value="female">{t('empFemale')}</option></select></div>
                  <div><label className="label-field">{t('empBirthDate')}</label><input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} className="input-field" /></div>
                  <div>
                    <label className="label-field">{t('empNationalIdType')}</label>
                    <select value={formData.national_id_type} onChange={(e) => setFormData({...formData, national_id_type: e.target.value})} className="input-field mb-2">
                      <option value="CNI">{t('empNationalIdCni')}</option>
                      <option value="PC">{t('empNationalIdPc')}</option>
                    </select>
                    <label className="label-field">{t('empNationalId')}</label>
                    <input value={formData.national_id} onChange={(e) => setFormData({...formData, national_id: e.target.value})} className="input-field" placeholder={formData.national_id_type === 'PC' ? 'Permis de conduire...' : 'CNI...'} />
                  </div>
                  <div><label className="label-field">{t('empMaritalStatus')}</label><select value={formData.marital_status} onChange={(e) => setFormData({...formData, marital_status: e.target.value})} className="input-field"><option value="">-</option><option value="married">{t('empMarried')}</option><option value="single">{t('empSingle')}</option><option value="divorced">{t('empDivorced')}</option></select></div>
                  <div><label className="label-field">{t('empNbEnfants')}</label><select value={formData.nb_enfants} onChange={(e) => setFormData({...formData, nb_enfants: e.target.value})} className="input-field"><option value="">-</option>{[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empContactInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="label-field">{t('empPhone')}</label><input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empAddress')}</label><input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="input-field" /></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empProInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="label-field">{t('empPosition')} *</label><input required value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{formData.contract_type === 'DEPLACE' ? t('empAffectationDate') : t('empHireDate')} *</label><input type="date" required value={formData.hire_date} onChange={(e) => setFormData({...formData, hire_date: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{formData.contract_type === 'DEPLACE' ? t('empReintegrationDate') : t('empEndDate')}</label><input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empDepartment')}</label><select value={formData.department_id} onChange={(e) => setFormData({...formData, department_id: e.target.value})} className="input-field"><option value="">{t('empDepartment')}</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className="label-field">{t('empContractType')}</label><select value={formData.contract_type} onChange={(e) => setFormData({...formData, contract_type: e.target.value})} className="input-field"><option value="CDI">{t('empContractCDI')}</option><option value="CDD">{t('empContractCDD')}</option><option value="DEPLACE">{t('empContractDeplace')}</option></select></div>
                  <div><label className="label-field">{t('empBaseSalary')}</label><input type="number" step="0.001" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empTransport')}</label><input type="number" step="0.001" min="0" value={formData.transport} onChange={(e) => setFormData({...formData, transport: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empStatus')}</label><select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input-field"><option value="active">{t('empActive')}</option><option value="inactive">{t('empInactive')}</option><option value="on_leave">{t('empOnLeave')}</option><option value="terminated">{t('empTerminated')}</option></select></div>
                  <div>
                    <label className="label-field">{t('empNuisance')}</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.nuisance_pct} onChange={(e) => setFormData({...formData, nuisance_pct: e.target.value})} className="input-field" placeholder="0" />
                    {formData.nuisance_pct && formData.salary && <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold mt-1">= {(parseFloat(formData.salary) * parseFloat(formData.nuisance_pct) / 100).toFixed(2)} DA</p>}
                  </div>
                  <div>
                    <label className="label-field">{t('empIfsp')}</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.ifsp_pct} onChange={(e) => setFormData({...formData, ifsp_pct: e.target.value})} className="input-field" placeholder="0" />
                    {formData.ifsp_pct && formData.salary && <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold mt-1">= {(parseFloat(formData.salary) * parseFloat(formData.ifsp_pct) / 100).toFixed(2)} DA</p>}
                  </div>
                  <div>
                    <label className="label-field">{t('empIfep')}</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.ifep_pct} onChange={(e) => setFormData({...formData, ifep_pct: e.target.value})} className="input-field" placeholder="0" />
                    {formData.ifep_pct && formData.salary && <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold mt-1">= {(parseFloat(formData.salary) * parseFloat(formData.ifep_pct) / 100).toFixed(2)} DA</p>}
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeTechnicite')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_technicite} onChange={(e) => setFormData({...formData, prime_technicite: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeSujetion')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_sujetion} onChange={(e) => setFormData({...formData, prime_sujetion: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeResponsabilite')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_responsabilite} onChange={(e) => setFormData({...formData, prime_responsabilite: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeZone')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_zone} onChange={(e) => setFormData({...formData, prime_zone: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empAdditionalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">{t('empSocialSecurity')} *</label>
                    <input value={formData.social_security} onChange={(e) => handleSocialSecurityChange(e.target.value)} className="input-field" placeholder="12 chiffres" maxLength={12} />
                    <p className="text-xs text-surface-400 mt-1">12 chiffres</p>
                  </div>
                  <div>
                    <label className="label-field">{t('empBankType')}</label>
                    <select value={formData.bank_type} onChange={(e) => {
                      const bt = e.target.value;
                      const acc = bt === 'ccp' ? '00799999' : '';
                      setFormData({ ...formData, bank_type: bt, bank_account: acc });
                    }} className="input-field mb-2">
                      <option value="ccp">{t('empBankTypeCcp')}</option>
                      <option value="banque">{t('empBankTypeBanque')}</option>
                    </select>
                    <label className="label-field">{t('empBankAccount')}</label>
                    <input value={formData.bank_account} onChange={(e) => handleBankAccountChange(e.target.value)} className="input-field font-mono" placeholder={formData.bank_type === 'ccp' ? '00799999...' : 'Numéro de compte'} maxLength={20} />
                    <p className="text-xs text-surface-400 mt-1">{formData.bank_type === 'ccp' ? `${t('empBankAccountHint')} — 20 chiffres` : '20 chiffres'}</p>
                  </div>
                  <div className="md:col-span-2"><label className="label-field">{t('empNotes')}</label><input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="input-field" /></div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('empCancel')}</button>
                <button type="submit" className="btn-primary">{editEmployee ? t('empUpdate') : t('empSave')}</button>
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
          title={t('printEmployeeList')}
          fields={printFields}
          data={printData}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
