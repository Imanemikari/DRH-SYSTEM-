declare global {
  interface Window {
    require: (module: string) => any;
  }
}

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron?.ipcRenderer || null;

import { demoInvokeBlocked } from './demoGuard';

// Demo-mode interception: swallow save/print/export IPCs (toast is fired by the guard).
const rawInvoke = ipcRenderer ? ipcRenderer.invoke.bind(ipcRenderer) : null;
if (ipcRenderer && rawInvoke) {
  ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
    if (demoInvokeBlocked(channel)) return { success: false, error: 'Cancelled' };
    return rawInvoke(channel, ...args);
  };
}

export const api = {
  // Window controls
  minimize: () => ipcRenderer?.send('window-minimize'),
  maximize: () => ipcRenderer?.send('window-maximize'),
  close: () => ipcRenderer?.send('window-close'),

  // Departments
  getDepartments: () => ipcRenderer?.invoke('db:get-departments') || [],
  addDepartment: (dept: any) => ipcRenderer?.invoke('db:add-department', dept),
  updateDepartment: (dept: any) => ipcRenderer?.invoke('db:update-department', dept),
  deleteDepartment: (id: number) => ipcRenderer?.invoke('db:delete-department', id),
  reorderDepartments: (ids: number[]) => ipcRenderer?.invoke('db:reorder-departments', ids),

  // Employees
  getEmployees: () => ipcRenderer?.invoke('db:get-employees') || [],
  getEmployee: (id: number) => ipcRenderer?.invoke('db:get-employee', id),
  addEmployee: (emp: any) => ipcRenderer?.invoke('db:add-employee', emp),
  updateEmployee: (emp: any) => ipcRenderer?.invoke('db:update-employee', emp),
  deleteEmployee: (id: number) => ipcRenderer?.invoke('db:delete-employee', id),
  updateEmployeeStatus: (id: number, status: string) => ipcRenderer?.invoke('db:update-employee-status', id, status),
  searchEmployees: (query: string) => ipcRenderer?.invoke('db:search-employees', query) || [],

  // Documents
  getEmployeeDocuments: (employeeId: number) => ipcRenderer?.invoke('db:get-employee-documents', employeeId) || [],
  addDocument: (doc: any) => ipcRenderer?.invoke('db:add-document', doc),
  deleteDocument: (id: number) => ipcRenderer?.invoke('db:delete-document', id),
  openFile: (options?: any) => ipcRenderer?.invoke('dialog:open-file', options),
  saveFile: (options?: any) => ipcRenderer?.invoke('dialog:save-file', options),
  saveFileToUploads: (source: string, name: string) => ipcRenderer?.invoke('fs:save-file', source, name),
  readFile: (path: string) => ipcRenderer?.invoke('fs:read-file', path),
  readFileDataUrl: (path: string) => ipcRenderer?.invoke('fs:read-file-data-url', path),
  openPath: (path: string) => ipcRenderer?.invoke('shell:open-path', path),

  // Company documents (tab Documents)
  getDocumentGroups: () => ipcRenderer?.invoke('db:get-document-groups') || [],
  addDocumentGroup: (name: string) => ipcRenderer?.invoke('db:add-document-group', name),
  renameDocumentGroup: (id: number, name: string) => ipcRenderer?.invoke('db:rename-document-group', { id, name }),
  deleteDocumentGroup: (id: number) => ipcRenderer?.invoke('db:delete-document-group', id),
  getCompanyDocuments: (groupId?: number | null) => ipcRenderer?.invoke('db:get-company-documents', groupId || null) || [],
  getCompanyDocument: (id: number) => ipcRenderer?.invoke('db:get-company-document', id),
  addCompanyDocument: (doc: any) => ipcRenderer?.invoke('db:add-company-document', doc),
  updateCompanyDocument: (doc: any) => ipcRenderer?.invoke('db:update-company-document', doc),
  deleteCompanyDocument: (id: number) => ipcRenderer?.invoke('db:delete-company-document', id),
  importDocument: (filePath: string) => ipcRenderer?.invoke('fs:import-document', filePath),
  openStoredDocument: (id: number) => ipcRenderer?.invoke('db:open-stored-document', id),

  // Attendance
  getAttendance: (params?: any) => ipcRenderer?.invoke('db:get-attendance', params) || [],
  addAttendance: (att: any) => ipcRenderer?.invoke('db:add-attendance', att),
  updateAttendance: (att: any) => ipcRenderer?.invoke('db:update-attendance', att),

  // Leaves
  getLeaves: (params?: any) => ipcRenderer?.invoke('db:get-leaves', params) || [],
  addLeave: (leave: any) => ipcRenderer?.invoke('db:add-leave', leave),
  updateLeave: (leave: any) => ipcRenderer?.invoke('db:update-leave', leave),
  deleteLeave: (id: number) => ipcRenderer?.invoke('db:delete-leave', id),

  // Detailed Pointage P/CR/CA/JF
  getPointageDetail: (year: number, month: number) => ipcRenderer?.invoke('db:get-pointage-detail', { year, month }),
  setPointageCell: (employee_id: number, date: string, code: string) => ipcRenderer?.invoke('db:set-pointage-cell', { employee_id, date, code }),
  clearPointageMonth: (year: number, month: number) => ipcRenderer?.invoke('db:clear-pointage-month', { year, month }),

  // Verso Pointage — monthly indemnities IFSP/TRANSP/PANIER/DEPLACEMENT
  getPointageVerso: (year: number, month: number) => ipcRenderer?.invoke('db:get-pointage-verso', { year, month }) || {},
  setPointageVersoField: (employee_id: number, year: number, month: number, field: string, value: number) => ipcRenderer?.invoke('db:set-pointage-verso-field', { employee_id, year, month, field, value }),

  // Export pointage tables (pdf / xls / doc)
  exportPointage: (html: string, format: string, prefix?: string) => ipcRenderer?.invoke('db:export-pointage', { html, format, prefix }),

  // Print directly to the physical printer (system dialog)
  printHtml: (html: string, landscape?: boolean) => ipcRenderer?.invoke('db:print-html', { html, landscape }),

  // Export modern .xlsx workbook (OOXML) — sheets: [{name, widths, rows, merges}]
  exportXlsx: (sheets: any[], prefix: string) => ipcRenderer?.invoke('db:export-xlsx', { sheets, prefix }),

  // Heures supplémentaires
  exportHeuresSupp: (html: string, format: string) => ipcRenderer?.invoke('db:export-pointage', { html, format, prefix: 'HEURES_SUPP_' }),

  // Heures supplémentaires (overtime 50% / 75% / 100%)
  getHeuresSupp: (year: number, month: number) => ipcRenderer?.invoke('db:get-heures-supp', { year, month }) || { employees: [], records: {} },
  setHeuresSupp: (employee_id: number, year: number, month: number, h50: number, h75: number, h100: number) => ipcRenderer?.invoke('db:set-heures-supp', { employee_id, year, month, h50, h75, h100 }),

  // Notifications
  getNotifications: () => ipcRenderer?.invoke('db:get-notifications') || [],
  markNotificationsRead: () => ipcRenderer?.invoke('db:mark-notifications-read'),
  addNotification: (type: string, message: string) => ipcRenderer?.invoke('db:add-notification', { type, message }),
  sendTelegram: (text: string) => ipcRenderer?.invoke('db:send-telegram', { text }),
  queueAlert: (kind: string, payload: any) => ipcRenderer?.invoke('db:queue-alert', { kind, payload }),
  backupNow: () => ipcRenderer?.invoke('db:backup-now'),
  listBackups: () => ipcRenderer?.invoke('db:list-backups') || [],
  restoreBackup: (name: string) => ipcRenderer?.invoke('db:restore-backup', { name }),

  // Rotation DEPLACE
  getDeplacement: () => ipcRenderer?.invoke('db:get-deplacement') || [],
  updateDeplacementDates: (employee_id: number, cycle_start: string, sortie_date?: string) => ipcRenderer?.invoke('db:update-deplacement-dates', { employee_id, cycle_start, sortie_date }),
  grantRotationLeave: (employee_id: number, days: number) => ipcRenderer?.invoke('db:grant-rotation-leave', { employee_id, days }),
  resolveRotationLeave: (employee_id: number, decision: string, new_leave_end?: string, new_entry_date?: string, return_date?: string) => ipcRenderer?.invoke('db:resolve-rotation-leave', { employee_id, decision, new_leave_end, new_entry_date, return_date }),
  getDeplacementCumul: () => ipcRenderer?.invoke('db:get-deplacement-cumul') || [],
  updateCumulDays: (period_id: number, worked_days: number, leave_days: number, return_date?: string, cycle_end?: string) => ipcRenderer?.invoke('db:update-cumul-days', { period_id, worked_days, leave_days, return_date, cycle_end }),
  updateDeplacementSolde: (employee_id: number, solde_adjust: number) => ipcRenderer?.invoke('db:update-deplacement-solde', { employee_id, solde_adjust }),
  restartRotationCycle: (employee_id: number) => ipcRenderer?.invoke('db:restart-rotation-cycle', employee_id),

  // Contracts Expiring
  getContractsExpiring: () => ipcRenderer?.invoke('db:get-contracts-expiring') || [],

  // Stats & Settings
  getStats: () => ipcRenderer?.invoke('db:get-stats') || {},
  getReports: (params?: any) => ipcRenderer?.invoke('db:get-reports', params) || {},
  getSettings: () => ipcRenderer?.invoke('db:get-settings') || {},
  updateSettings: (settings: any) => ipcRenderer?.invoke('db:update-settings', settings),

  // AI Chat
  chatAI: (messages: any[], apiKey: string, provider?: string, model?: string, withTools?: boolean) => ipcRenderer?.invoke('ai:chat', { messages, apiKey, provider, model, tools: withTools }),

  // Email / rapport par courriel (Gmail SMTP via electron/email.js spawner)
  sendReportEmail: (payload: any) => ipcRenderer?.invoke('db:send-report-email', payload),
  getSmtpSettings: async () => {
    const s = (await ipcRenderer?.invoke('db:get-settings')) || {};
    return {
      host: s.smtp_host || 'smtp.gmail.com',
      port: parseInt(s.smtp_port || 587, 10),
      secure: s.smtp_secure === '1',
      user: s.smtp_user || '',
      pass: s.smtp_pass || '',
      from: s.smtp_from || '',
    };
  },
  saveSmtpSettings: (c: any) => ipcRenderer?.invoke('db:update-settings', {
    smtp_host: c.host, smtp_port: String(c.port), smtp_secure: c.secure ? '1' : '0',
    smtp_user: c.user, smtp_pass: c.pass, smtp_from: c.from,
  }),

  // AVENANT
  generateAvendant: (data: any) => ipcRenderer?.invoke('generate-avendant', data),

  // License
  checkLicense: () => ipcRenderer?.invoke('license:check'),
  activateLicense: (key: string) => ipcRenderer?.invoke('license:activate', key),
  generateLicense: (clientName: string, expiryDate: string, plan?: string) => ipcRenderer?.invoke('license:generate', { clientName, expiryDate, plan }),
};
