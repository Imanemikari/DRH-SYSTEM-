import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Employee, EmployeeDocument } from '../types';
import { getStatusBadgeClass } from '../utils/helpers';
import { useHelpers } from '../utils/helpers';
import { useLang } from '../context/LangContext';
import { ArrowRight, Edit2, RefreshCw, Printer, Phone, Building2, Calendar, FileText, Upload, Trash2, Eye, X, User, Shield, Briefcase, Download } from 'lucide-react';
import PrintPreviewModal, { PrintField } from '../components/PrintPreviewModal';
import EmailSendButton from '../components/EmailSendButton';
import { buildFieldTableHtml, buildFieldSheets } from '../utils/emailExport';

interface EmployeeDetailProps { employeeId: number; navigateTo: (page: string, id?: number) => void; }

const extToLabel: Record<string, string> = { pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', jpg: 'IMG', jpeg: 'IMG', png: 'IMG' };
const extToColor: Record<string, string> = { pdf: 'bg-red-500', doc: 'bg-blue-600', docx: 'bg-blue-600', xls: 'bg-green-600', xlsx: 'bg-green-600', jpg: 'bg-purple-500', jpeg: 'bg-purple-500', png: 'bg-purple-500' };

export default function EmployeeDetail({ employeeId, navigateTo }: EmployeeDetailProps) {
  const { t, lang, dir } = useLang();
  const { getStatusLabel, formatCurrency, formatDate } = useHelpers();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'documents'>('info');
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => { loadData(); }, [employeeId]);

  const loadData = async () => {
    const [emp, docs, depts] = await Promise.all([api.getEmployee(employeeId), api.getEmployeeDocuments(employeeId), api.getDepartments()]);
    setEmployee(emp); setDocuments(docs); setDepartments(depts);
    if (emp) setFormData({
      ...emp,
      department_id: emp.department_id?.toString() || '',
      salary: emp.salary?.toString() || '',
      nb_enfants: emp.nb_enfants?.toString() || '',
      bank_account: emp.bank_account || '00799999',
      bank_type: (emp.bank_account || '').startsWith('00799999') ? 'ccp' : 'banque',
      national_id_type: emp.national_id_type || 'CNI',
      nuisance_pct: emp.nuisance_pct?.toString() || '',
      ifsp_pct: emp.ifsp_pct?.toString() || '',
      ifep_pct: emp.ifep_pct?.toString() || '',
      prime_technicite: emp.prime_technicite?.toString() || '',
      prime_sujetion: emp.prime_sujetion?.toString() || '',
      prime_responsabilite: emp.prime_responsabilite?.toString() || '',
      prime_zone: emp.prime_zone?.toString() || '',
    });
  };

  const handleDocumentUpload = async () => {
    const result = await api.openFile({ filters: [{ name: 'Documents & Images', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'] }] });
    if (!result.canceled) {
      for (const filePath of result.filePaths) {
        const parts = filePath.split(/[/\\]/); const originalName = parts[parts.length - 1]; const ext = originalName.split('.').pop()?.toLowerCase() || '';
        const savedPath = await api.saveFileToUploads(filePath, `doc_${employeeId}_${Date.now()}.${ext}`);
        const mimeMap: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
        await api.addDocument({ employee_id: employeeId, document_name: originalName, document_type: ext, file_path: savedPath, file_size: 0, mime_type: mimeMap[ext] || 'application/octet-stream' });
      }
      loadData();
    }
  };

  const handleDeleteDocument = async (docId: number) => { await api.deleteDocument(docId); loadData(); };

  const handleViewDocument = async (doc: EmployeeDocument) => {
    const ext = doc.document_type?.toLowerCase() || '';
    const previewable = ['pdf', 'jpg', 'jpeg', 'png', 'gif'];
    if (previewable.includes(ext)) {
      const dataUrl = await api.readFileDataUrl(doc.file_path);
      if (dataUrl) {
        setPreviewDoc(doc);
        setPreviewDataUrl(dataUrl);
      }
    } else {
      await api.openPath(doc.file_path);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateEmployee({
      ...formData,
      department_id: formData.department_id ? parseInt(formData.department_id) : null,
      salary: formData.salary ? parseFloat(formData.salary) : null,
      nb_enfants: formData.nb_enfants ? parseInt(formData.nb_enfants) : null,
    });
    setShowEditModal(false); loadData();
  };

  const ms = employee?.marital_status === 'married' ? t('empMarried') : employee?.marital_status === 'single' ? t('empSingle') : employee?.marital_status === 'divorced' ? t('empDivorced') : '-';

  const profilePrintFields: PrintField[] = employee ? [
    { key: 'matricule', label: t('empMatricule'), getValue: () => employee.matricule, defaultVisible: true },
    { key: 'name', label: t('empName'), getValue: () => `${employee.last_name} ${employee.first_name}`, defaultVisible: true },
    { key: 'gender', label: t('empGender'), getValue: () => employee.gender === 'male' ? t('empMale') : employee.gender === 'female' ? t('empFemale') : '-' },
    { key: 'birth', label: t('empBirthDate'), getValue: () => formatDate(employee.date_of_birth) },
    { key: 'national_id', label: employee.national_id_type === 'PC' ? `${t('empNationalIdType')}: ${t('empNationalIdPc')}` : t('empNationalId'), getValue: () => employee.national_id || '-' },
    { key: 'marital', label: t('empMaritalStatus'), getValue: () => ms },
    { key: 'nb_enfants', label: t('empNbEnfants'), getValue: () => employee.nb_enfants?.toString() || '-' },
    { key: 'position', label: t('empPosition'), getValue: () => employee.position || '-', defaultVisible: true },
    { key: 'department', label: t('empDepartment'), getValue: () => employee.department_name || '-' },
    { key: 'contract', label: t('empContractType'), getValue: () => employee.contract_type || '-', defaultVisible: true },
    { key: 'hire_date', label: t('empHireDate'), getValue: () => formatDate(employee.hire_date), defaultVisible: true },
    { key: 'end_date', label: t('empEndDate'), getValue: () => formatDate(employee.end_date) },
    { key: 'salary', label: t('empBaseSalary'), getValue: () => employee.salary ? formatCurrency(employee.salary) : '-' },
    { key: 'nuisance', label: t('empNuisance'), getValue: () => employee.nuisance_pct ? `${employee.nuisance_pct}% = ${formatCurrency((employee.salary || 0) * employee.nuisance_pct / 100)}` : '-' },
    { key: 'ifsp', label: t('empIfsp'), getValue: () => employee.ifsp_pct ? `${employee.ifsp_pct}% = ${formatCurrency((employee.salary || 0) * employee.ifsp_pct / 100)}` : '-' },
    { key: 'ifep', label: t('empIfep'), getValue: () => employee.ifep_pct ? `${employee.ifep_pct}% = ${formatCurrency((employee.salary || 0) * employee.ifep_pct / 100)}` : '-' },
    { key: 'technicite', label: t('empPrimeTechnicite'), getValue: () => employee.prime_technicite ? formatCurrency(employee.prime_technicite) : '-' },
    { key: 'sujetion', label: t('empPrimeSujetion'), getValue: () => employee.prime_sujetion ? formatCurrency(employee.prime_sujetion) : '-' },
    { key: 'responsabilite', label: t('empPrimeResponsabilite'), getValue: () => employee.prime_responsabilite ? formatCurrency(employee.prime_responsabilite) : '-' },
    { key: 'zone', label: t('empPrimeZone'), getValue: () => employee.prime_zone ? formatCurrency(employee.prime_zone) : '-' },
    { key: 'phone', label: t('empPhone'), getValue: () => employee.phone || '-' },
    { key: 'address', label: t('empAddress'), getValue: () => employee.address || '-' },
    { key: 'ss', label: t('empSocialSecurity'), getValue: () => employee.social_security || '-' },
    { key: 'bank', label: t('empBankAccount'), getValue: () => employee.bank_account || '-' },
    { key: 'status', label: t('empStatus'), getValue: () => getStatusLabel(employee.status), defaultVisible: true },
  ] : [];

  const profilePrintData = employee ? [{ _dummy: true }] : [];

  const handlePrintProfile = () => { setShowPrintPreview(true); };

  const handleSocialSecurityChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 12) setFormData({ ...formData, social_security: cleaned });
  };

  const handleBankAccountChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 20) setFormData({ ...formData, bank_account: cleaned });
  };

  const getMaritalStatusLabel = (status: string) => {
    if (status === 'married') return t('empMarried');
    if (status === 'single') return t('empSingle');
    if (status === 'divorced') return t('empDivorced');
    return '-';
  };

  if (!employee) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <button onClick={() => navigateTo('employees')} className="p-2 hover:bg-surface-100 rounded-xl border border-slate-200 transition-all text-slate-500 hover:text-slate-700"><ArrowRight className="w-5 h-5" /></button>
          <div>
            <h1 className="page-h1">{employee.last_name} {employee.first_name}</h1>
            <p className="page-h1-sub">{employee.matricule} - {employee.position || '-'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="tool-action tool-action-refresh"><RefreshCw className="w-4 h-4" /> {t('conActualiser')}</button>
          <button onClick={handlePrintProfile} className="btn-secondary"><Printer className="w-4 h-4" /> {t('empPrint')}</button>
          <EmailSendButton prefix="FICHE_" getHtml={() => buildFieldTableHtml(String(t('empPrint')), String(t('empMatricule')), profilePrintFields, profilePrintData, dir)} getSheets={() => buildFieldSheets(profilePrintFields, profilePrintData)} />
          <button onClick={() => setShowEditModal(true)} className="btn-primary"><Edit2 className="w-4 h-4" /> {t('empEdit')}</button>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden shadow-lg shadow-primary-500/20">
            {employee.photo_path ? <img src={employee.photo_path} alt="" className="w-full h-full object-cover" /> : `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-surface-400" /><div><p className="text-[11px] text-surface-400">{t('empDepartment')}</p><p className="text-[13px] font-medium text-surface-700">{employee.position || employee.department_name || '-'}</p></div></div>
            <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-surface-400" /><div><p className="text-[11px] text-surface-400">{t('empPhone')}</p><p className="text-[13px] font-medium text-surface-700">{employee.phone || '-'}</p></div></div>
            <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-surface-400" /><div><p className="text-[11px] text-surface-400">{t('empHireDate')}</p><p className="text-[13px] font-medium text-surface-700">{formatDate(employee.hire_date)}</p></div></div>
            <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-surface-400" /><div><p className="text-[11px] text-surface-400">{t('empSocialSecurity')}</p><p className="text-[13px] font-medium text-surface-700 font-mono">{employee.social_security || '-'}</p></div></div>
          </div>
          <span className={`badge ${getStatusBadgeClass(employee.status)}`}>{getStatusLabel(employee.status)}</span>
        </div>
      </div>

      <div className="flex gap-1 bg-white dark:!bg-slate-800 rounded-xl p-1 border border-slate-200 dark:!border-slate-600 shadow-sm w-fit">
        {[{ id: 'info', label: t('empDetInfo'), icon: User }, { id: 'documents', label: `${t('empDetDocuments')} (${documents.length})`, icon: FileText }].map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-gradient-to-r from-[#14305a] to-[#20487c] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:!text-slate-400 dark:hover:!bg-slate-700'}`}><Icon className="w-4 h-4" />{tab.label}</button>;
        })}
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><User className="w-3.5 h-3.5 text-white" /></span> {t('empDetInfo')}</h3>
            <div className="space-y-3">
              {[
                [t('empMatricule'), employee.matricule],
                [t('empFirstName'), employee.first_name],
                [t('empLastName'), employee.last_name],
                [t('empGender'), employee.gender === 'male' ? t('empMale') : employee.gender === 'female' ? t('empFemale') : '-'],
                [t('empBirthDate'), formatDate(employee.date_of_birth)],
                [employee.national_id_type === 'PC' ? t('empNationalIdPc') : t('empNationalId'), employee.national_id],
                [t('empMaritalStatus'), getMaritalStatusLabel(employee.marital_status)],
                [t('empNbEnfants'), employee.nb_enfants ? employee.nb_enfants.toString() : '-'],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between py-2 border-b border-surface-50"><span className="text-sm text-surface-500">{label}</span><span className="text-sm font-medium text-surface-700">{value || '-'}</span></div>
              ))}
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><Briefcase className="w-3.5 h-3.5 text-white" /></span> {t('empDetProfessional')}</h3>
            <div className="space-y-3">
              {[
                [t('empDepartment'), employee.position || employee.department_name],
                [t('empContractType'), employee.contract_type],
                [t('empHireDate'), formatDate(employee.hire_date)],
                [t('empEndDate'), formatDate(employee.end_date)],
                [t('empBaseSalary'), employee.salary ? formatCurrency(employee.salary) : '-'],
                [t('empNuisance'), employee.nuisance_pct ? `${employee.nuisance_pct}% = ${formatCurrency((employee.salary || 0) * employee.nuisance_pct / 100)}` : '-'],
                [t('empIfsp'), employee.ifsp_pct ? `${employee.ifsp_pct}% = ${formatCurrency((employee.salary || 0) * employee.ifsp_pct / 100)}` : '-'],
                [t('empIfep'), employee.ifep_pct ? `${employee.ifep_pct}% = ${formatCurrency((employee.salary || 0) * employee.ifep_pct / 100)}` : '-'],
                [t('empPrimeTechnicite'), employee.prime_technicite ? formatCurrency(employee.prime_technicite) : '-'],
                [t('empPrimeSujetion'), employee.prime_sujetion ? formatCurrency(employee.prime_sujetion) : '-'],
                [t('empPrimeResponsabilite'), employee.prime_responsabilite ? formatCurrency(employee.prime_responsabilite) : '-'],
                [t('empPrimeZone'), employee.prime_zone ? formatCurrency(employee.prime_zone) : '-'],
                [t('empStatus'), getStatusLabel(employee.status)],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between py-2 border-b border-surface-50"><span className="text-sm text-surface-500">{label}</span><span className="text-sm font-medium text-surface-700">{value || '-'}</span></div>
              ))}
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><Phone className="w-3.5 h-3.5 text-white" /></span> {t('empDetContact')}</h3>
            <div className="space-y-3">
              {[
                [t('empPhone'), employee.phone],
                [t('empAddress'), employee.address],
                [t('empSocialSecurity'), employee.social_security],
                [t('empBankAccount'), employee.bank_account],
                [t('empNotes'), employee.notes],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between py-2 border-b border-surface-50"><span className="text-sm text-surface-500">{label}</span><span className="text-sm font-medium text-surface-700 font-mono">{value || '-'}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-surface-700">{t('empDetDocuments')}</h3>
            <button onClick={handleDocumentUpload} className="btn-primary"><Upload className="w-4 h-4" /> {t('empDetUploadDoc')}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const ext = doc.document_type?.toLowerCase() || 'file';
              return (
                <div key={doc.id} className="glass-card p-4 hover:shadow-card-hover transition-all cursor-pointer" onClick={() => handleViewDocument(doc)}>
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${extToColor[ext] || 'bg-surface-400'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{extToLabel[ext] || ext.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{doc.document_name}</p>
                      <p className="text-xs text-surface-400 mt-1">{extToLabel[ext] || ext} - {formatDate(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
                    <button onClick={() => handleViewDocument(doc)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-surface-500 hover:text-[#14305a] hover:bg-[#f3f6fc] rounded-lg transition-all dark:hover:!text-amber-300 dark:hover:!bg-slate-700"><Eye className="w-3.5 h-3.5" /> {t('empDetView')}</button>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-surface-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /> {t('empDetDocDelete')}</button>
                  </div>
                </div>
              );
            })}
            {documents.length === 0 && (
              <div className="col-span-3 glass-card p-12 text-center">
                <FileText className="w-12 h-12 text-surface-200 mx-auto mb-3" />
                <p className="text-sm text-surface-400">{t('empDetNoDocs')}</p>
                <button onClick={handleDocumentUpload} className="btn-primary mt-4 mx-auto"><Upload className="w-4 h-4" /> {t('empDetDocUpload')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content w-full max-w-4xl p-6 animate-scaleIn max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-surface-800">{t('empEditTitle')}</h2><button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empPersonalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="label-field">{t('empMatricule')}</label><input value={formData.matricule || ''} onChange={(e) => setFormData({...formData, matricule: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empFirstName')}</label><input value={formData.first_name || ''} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empLastName')}</label><input value={formData.last_name || ''} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empGender')}</label><select value={formData.gender || ''} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="input-field"><option value="">-</option><option value="male">{t('empMale')}</option><option value="female">{t('empFemale')}</option></select></div>
                  <div><label className="label-field">{t('empBirthDate')}</label><input type="date" value={formData.date_of_birth || ''} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} className="input-field" /></div>
                  <div>
                    <label className="label-field">{t('empNationalIdType')}</label>
                    <select value={formData.national_id_type || 'CNI'} onChange={(e) => setFormData({...formData, national_id_type: e.target.value})} className="input-field mb-2">
                      <option value="CNI">{t('empNationalIdCni')}</option>
                      <option value="PC">{t('empNationalIdPc')}</option>
                    </select>
                    <label className="label-field">{t('empNationalId')}</label>
                    <input value={formData.national_id || ''} onChange={(e) => setFormData({...formData, national_id: e.target.value})} className="input-field" placeholder={formData.national_id_type === 'PC' ? 'Permis de conduire...' : 'CNI...'} />
                  </div>
                  <div><label className="label-field">{t('empMaritalStatus')}</label><select value={formData.marital_status || ''} onChange={(e) => setFormData({...formData, marital_status: e.target.value})} className="input-field"><option value="">-</option><option value="married">{t('empMarried')}</option><option value="single">{t('empSingle')}</option><option value="divorced">{t('empDivorced')}</option></select></div>
                  <div><label className="label-field">{t('empNbEnfants')}</label><select value={formData.nb_enfants || ''} onChange={(e) => setFormData({...formData, nb_enfants: e.target.value})} className="input-field"><option value="">-</option>{[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empContactInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="label-field">{t('empPhone')}</label><input value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empAddress')}</label><input value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} className="input-field" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empProInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="label-field">{t('empPosition')}</label><input value={formData.position || ''} onChange={(e) => setFormData({...formData, position: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empDepartment')}</label><select value={formData.department_id || ''} onChange={(e) => setFormData({...formData, department_id: e.target.value})} className="input-field"><option value="">{t('empDepartment')}</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className="label-field">{t('empContractType')}</label><select value={formData.contract_type || 'CDI'} onChange={(e) => setFormData({...formData, contract_type: e.target.value})} className="input-field"><option value="CDI">{t('empContractCDI')}</option><option value="CDD">{t('empContractCDD')}</option><option value="DEPLACE">{t('empContractDeplace')}</option></select></div>
                  <div><label className="label-field">{formData.contract_type === 'DEPLACE' ? t('empAffectationDate') : t('empHireDate')}</label><input type="date" value={formData.hire_date || ''} onChange={(e) => setFormData({...formData, hire_date: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{formData.contract_type === 'DEPLACE' ? t('empReintegrationDate') : t('empEndDate')}</label><input type="date" value={formData.end_date || ''} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empBaseSalary')}</label><input type="number" step="0.001" value={formData.salary || ''} onChange={(e) => setFormData({...formData, salary: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empTransport')}</label><input type="number" step="0.001" min="0" value={formData.transport || ''} onChange={(e) => setFormData({...formData, transport: e.target.value})} className="input-field" /></div>
                  <div><label className="label-field">{t('empStatus')}</label><select value={formData.status || 'active'} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input-field"><option value="active">{t('empActive')}</option><option value="inactive">{t('empInactive')}</option><option value="on_leave">{t('empOnLeave')}</option><option value="terminated">{t('empTerminated')}</option></select></div>
                  <div>
                    <label className="label-field">{t('empNuisance')}</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.nuisance_pct || ''} onChange={(e) => setFormData({...formData, nuisance_pct: e.target.value})} className="input-field" placeholder="0" />
                    {formData.nuisance_pct && formData.salary && <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold mt-1">= {(parseFloat(formData.salary) * parseFloat(formData.nuisance_pct) / 100).toFixed(2)} DA</p>}
                  </div>
                  <div>
                    <label className="label-field">{t('empIfsp')}</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.ifsp_pct || ''} onChange={(e) => setFormData({...formData, ifsp_pct: e.target.value})} className="input-field" placeholder="0" />
                    {formData.ifsp_pct && formData.salary && <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold mt-1">= {(parseFloat(formData.salary) * parseFloat(formData.ifsp_pct) / 100).toFixed(2)} DA</p>}
                  </div>
                  <div>
                    <label className="label-field">{t('empIfep')}</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.ifep_pct || ''} onChange={(e) => setFormData({...formData, ifep_pct: e.target.value})} className="input-field" placeholder="0" />
                    {formData.ifep_pct && formData.salary && <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold mt-1">= {(parseFloat(formData.salary) * parseFloat(formData.ifep_pct) / 100).toFixed(2)} DA</p>}
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeTechnicite')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_technicite || ''} onChange={(e) => setFormData({...formData, prime_technicite: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeSujetion')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_sujetion || ''} onChange={(e) => setFormData({...formData, prime_sujetion: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeResponsabilite')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_responsabilite || ''} onChange={(e) => setFormData({...formData, prime_responsabilite: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label-field">{t('empPrimeZone')}</label>
                    <input type="number" step="0.01" min="0" value={formData.prime_zone || ''} onChange={(e) => setFormData({...formData, prime_zone: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-700 mb-3 pb-2 border-b border-surface-100">{t('empAdditionalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">{t('empSocialSecurity')}</label>
                    <input value={formData.social_security || ''} onChange={(e) => handleSocialSecurityChange(e.target.value)} className="input-field font-mono" placeholder="12 chiffres" maxLength={12} />
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
                    <input value={formData.bank_account || ''} onChange={(e) => handleBankAccountChange(e.target.value)} className="input-field font-mono" placeholder={formData.bank_type === 'ccp' ? '00799999...' : 'Numéro de compte'} maxLength={20} />
                  </div>
                  <div className="md:col-span-2"><label className="label-field">{t('empNotes')}</label><input value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="input-field" /></div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">{t('empCancel')}</button>
                <button type="submit" className="btn-primary">{t('empUpdate')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setPreviewDoc(null); setPreviewDataUrl(null); }}>
          <div className="bg-white dark:!bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100 dark:!border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${extToColor[previewDoc.document_type] || 'bg-surface-400'} flex items-center justify-center text-white text-xs font-bold`}>{extToLabel[previewDoc.document_type] || previewDoc.document_type?.toUpperCase()}</div>
                <div>
                  <p className="text-sm font-semibold text-surface-800">{previewDoc.document_name}</p>
                  <p className="text-xs text-surface-400">{extToLabel[previewDoc.document_type] || previewDoc.document_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => api.openPath(previewDoc.file_path)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14305a] hover:bg-[#f3f6fc] rounded-lg transition-all dark:!text-amber-300 dark:!hover:bg-slate-700"><Download className="w-3.5 h-3.5" /> {lang === 'ar' ? 'فتح في التطبيق' : 'Ouvrir'}</button>
                <button onClick={() => { setPreviewDoc(null); setPreviewDataUrl(null); }} className="p-1.5 hover:bg-surface-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 bg-surface-50 rounded-b-2xl" style={{ minHeight: '400px' }}>
              {previewDoc.document_type === 'pdf' && previewDataUrl && (
                <iframe src={previewDataUrl} className="w-full h-full border-0 rounded-lg" style={{ minHeight: '500px' }} title={previewDoc.document_name} />
              )}
              {['jpg', 'jpeg', 'png', 'gif'].includes(previewDoc.document_type) && previewDataUrl && (
                <img src={previewDataUrl} alt={previewDoc.document_name} className="max-w-full max-h-full mx-auto rounded-lg" style={{ maxHeight: '70vh' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && (
        <PrintPreviewModal
          title={t('printProfile')}
          fields={profilePrintFields}
          data={profilePrintData}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
