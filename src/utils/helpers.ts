import { useLang } from '../context/LangContext';

const statusLabelsFr: Record<string, string> = {
  active: 'Actif', inactive: 'Inactif', on_leave: 'En congé', terminated: 'Terminé',
  present: 'Présent', absent: 'Absent', late: 'En retard', leave: 'En congé', holiday: 'Férié',
  pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté', draft: 'Brouillon', paid: 'Payé',
};

const statusLabelsAr: Record<string, string> = {
  active: 'نشط', inactive: 'غير نشط', on_leave: 'في إجازة', terminated: 'منتهي',
  present: 'حاضر', absent: 'غائب', late: 'متأخر', leave: 'في إجازة', holiday: 'عطلة',
  pending: 'قيد الانتظار', approved: 'مقبول', rejected: 'مرفوض', draft: 'مسودة', paid: 'مدفوع',
};

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    active: 'badge-success', present: 'badge-success', approved: 'badge-success', paid: 'badge-success',
    inactive: 'badge-danger', absent: 'badge-danger', terminated: 'badge-danger', rejected: 'badge-danger',
    on_leave: 'badge-warning', late: 'badge-warning', leave: 'badge-warning', pending: 'badge-warning',
    draft: 'badge-info', holiday: 'badge-info',
  };
  return classes[status] || 'badge-info';
}

export function generateMatricule(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `EMP-${year}-${random}`;
}

export function useHelpers() {
  const { lang } = useLang();

  const getStatusLabel = (status: string): string => {
    const labels = lang === 'ar' ? statusLabelsAr : statusLabelsFr;
    return labels[status] || status;
  };

  const formatCurrency = (amount: number): string => {
    const locale = lang === 'ar' ? 'ar-TN' : 'fr-TN';
    return new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 2 }).format(amount) + ' DA';
  };

  const formatDate = (date: string): string => {
    if (!date) return '-';
    const locale = lang === 'ar' ? 'ar-TN' : 'fr-TN';
    return new Date(date).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatDateTime = (date: string): string => {
    if (!date) return '-';
    const locale = lang === 'ar' ? 'ar-TN' : 'fr-TN';
    return new Date(date).toLocaleString(locale);
  };

  return { getStatusLabel, formatCurrency, formatDate, formatDateTime };
}
