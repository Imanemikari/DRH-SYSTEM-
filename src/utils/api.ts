declare global {
  interface Window {
    require: (module: string) => any;
  }
}

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron?.ipcRenderer || null;

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

  // Attendance
  getAttendance: (params?: any) => ipcRenderer?.invoke('db:get-attendance', params) || [],
  addAttendance: (att: any) => ipcRenderer?.invoke('db:add-attendance', att),
  updateAttendance: (att: any) => ipcRenderer?.invoke('db:update-attendance', att),

  // Leaves
  getLeaves: (params?: any) => ipcRenderer?.invoke('db:get-leaves', params) || [],
  addLeave: (leave: any) => ipcRenderer?.invoke('db:add-leave', leave),
  updateLeave: (leave: any) => ipcRenderer?.invoke('db:update-leave', leave),
  deleteLeave: (id: number) => ipcRenderer?.invoke('db:delete-leave', id),

  // Payroll
  getPayroll: (params?: any) => ipcRenderer?.invoke('db:get-payroll', params) || [],
  addPayroll: (payroll: any) => ipcRenderer?.invoke('db:add-payroll', payroll),
  generatePayroll: (params: any) => ipcRenderer?.invoke('db:generate-payroll', params),
  paySalary: (id: number) => ipcRenderer?.invoke('db:pay-salary', id),

  // Stats & Settings
  getStats: () => ipcRenderer?.invoke('db:get-stats') || {},
  getSettings: () => ipcRenderer?.invoke('db:get-settings') || {},
  updateSettings: (settings: any) => ipcRenderer?.invoke('db:update-settings', settings),

  // AI Chat
  chatAI: (messages: any[], apiKey: string) => ipcRenderer?.invoke('ai:chat', { messages, apiKey }),

  // AVENANT
  generateAvendant: (data: any) => ipcRenderer?.invoke('generate-avendant', data),
};
