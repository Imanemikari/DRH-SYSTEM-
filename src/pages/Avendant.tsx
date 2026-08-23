import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import { useHelpers } from '../utils/helpers';
import { Employee } from '../types';
import { FileText, Download, Printer } from 'lucide-react';

interface AvendantProps {
  navigateTo: (page: string, id?: number) => void;
}

export default function Avendant({ navigateTo }: AvendantProps) {
  const { t, lang, dir } = useLang();
  const { formatDate } = useHelpers();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    numero_contrat: '', nom_prenom: '', date_naissance: '', lieu_naissance: '',
    adresse: '', fonction: '', date_recrutement: '', duree_mois: '',
    date_debut: '', date_fin: '', date_etablir: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    const emps = await api.getEmployees();
    setEmployees(emps.filter((e: Employee) => e.status === 'active'));
  };

  const selectEmployee = (empId: number) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        nom_prenom: emp.first_name + ' ' + emp.last_name,
        date_naissance: emp.date_of_birth || '',
        lieu_naissance: emp.address || '',
        adresse: emp.address || '',
        fonction: emp.position || '',
        date_recrutement: emp.hire_date || '',
      }));
    }
  };

  const handleGenerate = async () => {
    if (!formData.numero_contrat || !formData.nom_prenom || !formData.date_debut || !formData.date_fin || !formData.duree_mois) return;
    setGenerating(true);
    const result = await api.generateAvendant(formData);
    setGenerating(false);
    if (result.success) {
      alert((lang === 'ar' ? 'تم انشاء العقد بنجاح في:\n' : 'Avenant genere avec succes:\n') + result.path);
    } else if (result.error !== 'Cancelled') {
      alert('Error: ' + result.error);
    }
  };

  const handlePrintPreview = () => {
    const d = formData;
    const content = `
      <style>
        @page { margin: 5mm 5mm; size: A4; }
        * { margin: 0; padding: 0; }
        body { font-family: 'Times New Roman', serif; font-size: 10pt; line-height: 1.2; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .ml { margin-left: 20px; }
        .header { text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 2px; }
        .header .company { font-size: 14pt; font-weight: bold; color: #003366; }
        .header .arabic { font-size: 10pt; direction: rtl; font-weight: bold; }
        .header .sub { font-size: 8.5pt; color: #003366; font-weight: bold; }
        .footer { border-top: 1.5px solid #000; margin-top: 2px; padding-top: 2px; text-align: center; font-size: 7pt; color: #333; }
        .flex-between { display: flex; justify-content: space-between; }
        .sign-line { display: flex; justify-content: space-between; align-items: baseline; }
      </style>
      <div class="header">
        <p class="company">Groupe Etudes &amp; R\u00e9alisations Hydrauliques</p>
        <p class="arabic">\u0627\u0644\u0645\u0624\u0633\u0633\u0629 \u0627\u0644\u0639\u0627\u0645\u0648\u0645\u064a\u0629 \u0644\u0625\u0646\u062c\u0627\u0632 \u062d\u0641\u0631 \u0623\u0628\u0627\u0631 \u0627\u0644\u0645\u064a\u0627\u0647 \u0648\u0627\u0644\u0623\u0634\u063a\u0627\u0644 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0645\u064a\u0643\u0627\u0646\u064a\u0643\u064a\u0629</p>
        <p class="sub">ENTREPRISE PUBLIQUE DE REALISATION DE FORAGE HYDRAULIQUE ET DE TRAVAUX ELECTRO-MECANIQUE</p>
        <p class="sub">FOREMHYD \u2013 Spa</p>
      </div>

      <p class="center bold" style="font-size:11pt; text-decoration:underline">DIRECTION DE L'ADMINISTRATION</p>
      <p class="center bold" style="font-size:11pt">AVENANT DE PROROGATION/  N\u00b0 ${d.numero_contrat}</p>
      <p class="center bold" style="font-size:10pt">AU CONTRAT D'ENGAGEMENT A DUREE DETERMINEE</p>

      <p class="center bold" style="margin-top:4px">Conclu :</p>
      <p class="bold">ENTRE</p>
      <p class="ml">L'unit\u00e9 Baraki Traitement des Eaux, repr\u00e9sent\u00e9 par Monsieur HAMENA NASRI</p>
      <p class="ml">Agissant en qualit\u00e9 Directeur de Projet</p>
      <p class="center bold">D'UNE PART</p>
      <p class="bold">ET : Monsieur : ${d.nom_prenom}</p>
      <p><span class="bold">N\u00e9 le :</span> ${d.date_naissance} \u00e0 : ${d.lieu_naissance}</p>
      <p><span class="bold">Demeurant \u00e0 :</span> ${d.adresse}</p>
      <p><span class="bold">Fonction :</span> ${d.fonction}</p>
      <p class="center bold">D'AUTRE PART</p>
      <p class="center bold">IL A ETE CONVENU ET ARRETE CE QUI SUIT</p>

      <p class="bold" style="margin-top:4px">ARTICLE 01 : OBJET DE L'AVENANT</p>
      <p class="ml">Le pr\u00e9sent avenant a pour objet de proroger la dur\u00e9e de la relation de travail, conform\u00e9ment aux dispositions de l'article 02 du contrat d'engagement conclu  le ${d.date_recrutement} Entre Mr  ${d.nom_prenom} Et  \u00abL'unit\u00e9 Baraki Traitement des  Eaux\u00bb.</p>

      <p class="bold" style="margin-top:4px">ARTICLE 02 : PROROGATION DE LA DUREE</p>
      <p class="ml">La dur\u00e9e de la relation de travail fix\u00e9e \u00e0 l'article 04 du contrat d'engagement est prorogi\u00e9e   de ${d.duree_mois} mois   \u00e0 compter du ${d.date_debut} et qui  expirera  le ${d.date_fin}</p>

      <p class="bold" style="margin-top:4px">ARTICLE 03 : DISPOSITIONS DIVERSES</p>
      <p class="ml">Les autres dispositions du contrat d'engagement non modifi\u00e9es par le pr\u00e9sent avenant restent en vigueur et continuent \u00e0 r\u00e9gir les relations entre les parties.</p>

      <p class="right bold" style="margin-top:4px">Fait \u00e0 Tiaret le ${d.date_etablir}</p>
      <div class="sign-line" style="margin-top:6px">
        <span class="bold">LE CONTRACTANT</span>
        <span class="bold">Directeur de Projet</span>
      </div>

      <hr style="margin-top:10px"/>
      <p class="bold">Je soussign\u00e9 Monsieur ${d.nom_prenom}</p>
      <p>D\u00e9clare avoir pris connaissance des Clauses du pr\u00e9sent contrat et les approuves sans r\u00e9serve.</p>
      <p class="bold">Nom et Pr\u00e9nom : ${d.nom_prenom}</p>
      <p class="bold">Signature : _______________</p>

      <div class="footer">
        <p>Soci\u00e9t\u00e9 par Actions au Capital Social de 613.750.000 DA \u2013 R.C 99/B/080.2906</p>
        <p>Si\u00e8ge Social : Rue du G\u00e9nie B.P 144 Dar El Beida (W. Alger) T\u00e9l : 213 (023) 83.36.50 / 83.36.55 Fax : 213 (023) 83.30.62 / e-mail : dg@foremhyd.dz</p>
      </div>
    `;
    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) { w.document.write('<html><head><meta charset="utf-8"><title>AVENANT ' + d.numero_contrat + '</title></head><body>' + content + '</body></html>'); w.document.close(); w.print(); }
  };

  const field = (label: string, key: string, type = 'text', required = true) => (
    <div>
      <label className="label-field">{label} {required && '*'}</label>
      <input type={type} value={(formData as any)[key]} onChange={(e) => setFormData({...formData, [key]: e.target.value})} className="input-field" required={required} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">AVENANT</h1>
          <p className="text-sm text-surface-500 mt-1">{lang === 'ar' ? 'انشاء عقد اvenant للتمديد' : 'Generer un avenant de prorogation'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrintPreview} className="btn-secondary"><Printer className="w-4 h-4" /> {lang === 'ar' ? 'معاينة' : 'Apercu'}</button>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary"><Download className="w-4 h-4" /> {generating ? '...' : (lang === 'ar' ? 'تحميل Word' : 'Telecharger .docx')}</button>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6"><FileText className="w-5 h-5 icon-glow" /><h2 className="text-base font-semibold text-surface-800">{lang === 'ar' ? 'اختيار موظف (اختياري)' : 'Selectionner un employe'}</h2></div>
        <select onChange={(e) => e.target.value && selectEmployee(parseInt(e.target.value))} className="input-field" defaultValue="">
          <option value="">{lang === 'ar' ? '-- اختر موظف --' : '-- Choisir un employe --'}</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.matricule} - {emp.first_name} {emp.last_name} ({emp.position || '-'})</option>
          ))}
        </select>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6"><FileText className="w-5 h-5 icon-glow" /><h2 className="text-base font-semibold text-surface-800">{lang === 'ar' ? 'بيانات العقد' : 'Donnees du contrat'}</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {field('Numero de contrat', 'numero_contrat')}
          {field('Nom et Prenom', 'nom_prenom')}
          {field('Date de naissance', 'date_naissance', 'date')}
          {field('Lieu de naissance', 'lieu_naissance')}
          {field('Adresse', 'adresse')}
          {field('Fonction', 'fonction')}
          {field('Date de recrutement', 'date_recrutement', 'date')}
          {field('Duree (mois)', 'duree_mois', 'number')}
          {field('Date debut contrat', 'date_debut', 'date')}
          {field('Date fin contrat', 'date_fin', 'date')}
          {field('Date d\'etablissement', 'date_etablir', 'date')}
        </div>
      </div>
    </div>
  );
}
