// Demo-mode guard: while the app is NOT activated, save/print/export actions
// are blocked (browse only). Main process enforces the same list (defense in depth).

export const DEMO_BLOCKED = new Set<string>([
  'db:add-attendance', 'db:add-company-document', 'db:add-department', 'db:add-document',
  'db:add-document-group', 'db:add-employee', 'db:add-leave', 'db:add-payroll',
  'db:clear-pointage-month', 'db:delete-company-document', 'db:delete-department',
  'db:delete-document', 'db:delete-document-group', 'db:delete-employee', 'db:delete-leave',
  'db:generate-payroll', 'db:pay-salary', 'db:grant-rotation-leave', 'db:reorder-departments',
  'db:resolve-rotation-leave', 'db:restart-rotation-cycle', 'db:rename-document-group',
  'db:set-heures-supp', 'db:set-pointage-cell', 'db:set-pointage-verso-field',
  'db:update-attendance', 'db:update-company-document', 'db:update-cumul-days',
  'db:update-department', 'db:update-deplacement-dates', 'db:update-deplacement-solde',
  'db:update-employee', 'db:update-employee-status', 'db:update-leave', 'db:update-settings',
  'db:export-pointage', 'db:export-xlsx', 'db:print-html', 'db:send-report-email',
  'generate-avendant', 'fs:save-file', 'fs:import-document', 'dialog:save-file',
  'license:generate',
]);

export const isDemo = (): boolean => {
  try {
    return !!((window as any).__DRH_DEMO__);
  } catch {
    return false;
  }
};

export function notifyDemoBlocked(): void {
  try {
    window.dispatchEvent(new CustomEvent('demo-blocked'));
  } catch {
    /* noop */
  }
}

// Returns true when the IPC call must be swallowed (demo mode + blocked channel).
export function demoInvokeBlocked(channel: string): boolean {
  if (isDemo() && DEMO_BLOCKED.has(channel)) {
    notifyDemoBlocked();
    return true;
  }
  return false;
}
