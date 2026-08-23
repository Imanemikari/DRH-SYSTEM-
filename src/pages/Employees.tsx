import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Employee, Department } from '../types';
import { getStatusBadgeClass, generateMatricule } from '../utils/helpers';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { Plus, Search, Edit2, Trash2, Eye, UserPlus, Printer, X, Upload } from 'lucide-react';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';

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
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    matricule: '', first_name: '', last_name: '', marital_status: '', phone: '', address: '',
    date_of_birth: '', hire_date: '', end_date: '', department_id: '', position: '', contract_type: 'CDI',
    salary: '', status: 'active', gender: '', national_id: '', social_security: '',
    nb_enfants: '', bank_account: '00799999', notes: '', photo_path: ''
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
    return matchSearch && matchDept && matchStatus;
  });

  const openAddModal = () => {
    setEditEmployee(null);
    setFormData({
      matricule: generateMatricule(), first_name: '', last_name: '', marital_status: '', phone: '',
      address: '', date_of_birth: '', hire_date: new Date().toISOString().split('T')[0],
      end_date: '', department_id: '', position: '', contract_type: 'CDI', salary: '', status: 'active',
      gender: '', national_id: '', social_security: '', nb_enfants: '',
      bank_account: '00799999', notes: '', photo_path: ''
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
      national_id: emp.national_id || '', social_security: emp.social_security || '',
      nb_enfants: emp.nb_enfants?.toString() || '',
      bank_account: emp.bank_account || '00799999',
      notes: emp.notes || '', photo_path: emp.photo_path || ''
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
    { key: 'matricule', label: t('empMatricule'), getValue: (e) => e.matricule, defaultVisible: true },
    { key: 'name', label: t('empName'), getValue: (e) => `${e.first_name} ${e.last_name}`, defaultVisible: true },
    { key: 'position', label: t('empPosition'), getValue: (e) => e.position || '-', defaultVisible: true },
    { key: 'phone', label: t('empPhone'), getValue: (e) => e.phone || '-' },
    { key: 'department', label: t('empDepartment'), getValue: (e) => e.department_name || '-' },
    { key: 'hire_date', label: t('empHireDate'), getValue: (e) => formatDate(e.hire_date), defaultVisible: true },
    { key: 'end_date', label: t('empEndDate'), getValue: (e) => formatDate(e.end_date), defaultVisible: true },
    { key: 'contract_type', label: t('empContractType'), getValue: (e) => e.contract_type || '-' },
    { key: 'salary', label: t('empBaseSalary'), getValue: (e) => e.salary ? formatCurrency(e.salary) : '-' },
    { key: 'status', label: t('empStatus'), getValue: (e) => getStatusLabel(e.status), defaultVisible: true },
    { key: 'social_security', label: t('empSocialSecurity'), getValue: (e) => e.social_security || '-' },
    { key: 'gender', label: t('empGender'), getValue: (e) => e.gender === 'male' ? t('empMale') : e.gender === 'female' ? t('empFemale') : '-' },
    { key: 'nb_enfants', label: t('empNbEnfants'), getValue: (e) => e.nb_enfants ? e.nb_enfants.toString() : '-' },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">{t('empTitle')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('empSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrintList} className="btn-secondary"><Printer className="w-4 h-4" /> {t('empPrint')}</button>
          <button onClick={openAddModal} className="btn-primary"><UserPlus className="w-4 h-4" /> {t('empAdd')}</button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
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
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-right text-xs">{t('empMatricule')}</th>
                <th className="px-4 py-3 text-right text-xs">{t('empName')}</th>
                <th className="px-4 py-3 text-right text-xs">{t('empPosition')}</th>
                <th className="px-4 py-3 text-right text-xs">{t('empHireDate')}</th>
                <th className="px-4 py-3 text-right text-xs">{t('empEndDate')}</th>
                <th className="px-4 py-3 text-right text-xs">{t('empStatus')}</th>
                <th className="px-4 py-3 text-center text-xs">{t('empActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-surface-600">{emp.matricule}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {emp.photo_path ? <img src={emp.photo_path} alt="" className="w-full h-full rounded-full object-cover" /> : `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-800">{emp.first_name} {emp.last_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600">{emp.position || '-'}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{formatDate(emp.hire_date)}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{formatDate(emp.end_date)}</td>
                  <td className="px-4 py-3"><span className={`badge ${getStatusBadgeClass(emp.status)}`}>{getStatusLabel(emp.status)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => navigateTo('employees', emp.id)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-primary-500 transition-all" title={t('empView')}><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEditModal(emp)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-amber-500 transition-all" title={t('empEdit')}><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setShowDeleteConfirm(emp.id)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-red-500 transition-all" title={t('empDelete')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400 text-sm">{t('empNoResults')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-surface-100 bg-surface-50/50">
          <p className="text-xs text-surface-500">{t('empCount')}: {filteredEmployees.length} {t('empOf')} {employees.length}</p>
        </div>
      </div>

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
                  <div><label className="label-field">{t('empNationalId')}</label><input value={formData.national_id} onChange={(e) => setFormData({...formData, national_id: e.target.value})} className="input-field" /></div>
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
                  <div><label className="label-field">{t('empHireDate')} *</label><input type="date" required value={formData.hire_date} onChange={(e) => setFormData({...formData, hire_date: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empEndDate')}</label><input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empDepartment')}</label><select value={formData.department_id} onChange={(e) => setFormData({...formData, department_id: e.target.value})} className="input-field"><option value="">{t('empDepartment')}</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className="label-field">{t('empContractType')}</label><select value={formData.contract_type} onChange={(e) => setFormData({...formData, contract_type: e.target.value})} className="input-field"><option value="CDI">{t('empContractCDI')}</option><option value="CDD">{t('empContractCDD')}</option><option value="Stage">{t('empContractStage')}</option><option value="ayette">{t('empContractAyette')}</option><option value="Contractuel">{t('empContractOther')}</option></select></div>
                  <div><label className="label-field">{t('empBaseSalary')}</label><input type="number" step="0.001" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empStatus')}</label><select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input-field"><option value="active">{t('empActive')}</option><option value="inactive">{t('empInactive')}</option><option value="on_leave">{t('empOnLeave')}</option><option value="terminated">{t('empTerminated')}</option></select></div>
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
                    <label className="label-field">{t('empBankAccount')}</label>
                    <input value={formData.bank_account} onChange={(e) => handleBankAccountChange(e.target.value)} className="input-field font-mono" placeholder="00799999..." maxLength={20} />
                    <p className="text-xs text-surface-400 mt-1">{t('empBankAccountHint')} — 20 chiffres</p>
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
          data={filteredEmployees}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
