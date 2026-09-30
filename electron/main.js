const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const initSqlJs = require('sql.js/dist/sql-asm.js');
const { generateLicenseKey, validateLicenseKey, saveLicense, loadLicense, isActivated, getMachineId } = require('./license');

// ===== DEMO MODE PROTECTION =====
// Channels blocked while the app is NOT activated (demo: browse only, no save/print/export).
// license:generate is dev-only (CLI) and is never exposed to the packaged renderer.
const DEMO_BLOCKED = new Set([
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
  'generate-avendant', 'fs:save-file', 'fs:import-document', 'dialog:save-file'
]);
const ALWAYS_BLOCKED = new Set(['license:generate']);
const _ipcHandle = ipcMain.handle.bind(ipcMain);

// ===== Secret encryption (OS keychain via safeStorage, AES fallback, transparent for settings) =====
const SECRET_KEYS = new Set(['smtp_pass', 'ai_api_key', 'telegram_bot_token']);
const FALLBACK_SECRET = 'DRH-2026-SETTINGS-VAULT';
function fallbackSeal(s) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(FALLBACK_SECRET).digest();
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  return 'enc1:' + iv.toString('hex') + ':' + c.update(s, 'utf8', 'hex') + c.final('hex');
}
function fallbackOpen(s) {
  const parts = String(s).split(':');
  if (parts.length !== 3) throw new Error('bad format');
  const key = crypto.createHash('sha256').update(FALLBACK_SECRET).digest();
  const d = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(parts[1], 'hex'));
  return d.update(parts[2], 'hex', 'utf8') + d.final('utf8');
}
function sealValue(v) {
  try {
    if (v === undefined || v === null || v === '') return v;
    const s = String(v);
    if (s.startsWith('enc:') || s.startsWith('enc1:')) return s;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(s).toString('base64');
    }
    return fallbackSeal(s);
  } catch (e) {
    try { return fallbackSeal(String(v)); } catch (e2) { return v; }
  }
}
function openValue(v) {
  try {
    if (typeof v === 'string' && v.startsWith('enc1:')) return fallbackOpen(v);
    if (typeof v === 'string' && v.startsWith('enc:')) {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
      }
    }
  } catch (e) {}
  return v;
}

// ===== Audit log (who did what) — written from the IPC wrapper below =====
function auditScrub(key, value) {
  if (/pass|passwd|password|api[_-]?key|secret|token/i.test(String(key))) return '***';
  return value;
}
function auditChannel(channel, args) {
  try {
    if (!db) return;
    if (channel.startsWith('db:get-') || channel.startsWith('db:search-')) return;
    if (channel === 'license:check' || channel === 'db:mark-notifications-read' || channel === 'ai:chat') return;
    let details = '';
    try { details = JSON.stringify(args || [], auditScrub).slice(0, 500); } catch (e) { details = ''; }
    runSql('INSERT INTO audit_log (actor, action, details) VALUES (?, ?, ?)', ['local', channel, details]);
  } catch (e) {}
}

ipcMain.handle = (channel, listener) => _ipcHandle(channel, async (event, ...args) => {
  try {
    if (ALWAYS_BLOCKED.has(channel)) return { success: false, error: 'NOT_ALLOWED' };
    if (DEMO_BLOCKED.has(channel) && !isActivated()) return { success: false, error: 'DEMO_MODE' };
  } catch (e) {}
  const out = await listener(event, ...args);
  try { auditChannel(channel, args); } catch (e) {}
  return out;
});

let mainWindow;
let db;
const uploadsDir = path.join(app.getPath('userData'), 'uploads');
const dbPath = path.join(app.getPath('userData'), 'drh_database.sqlite');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function saveDbDebounced() {
  clearTimeout(saveDb._timer);
  saveDb._timer = setTimeout(saveDb, 500);
}

async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      manager TEXT,
      sort_order INTEGER DEFAULT 999,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      marital_status TEXT,
      phone TEXT,
      address TEXT,
      date_of_birth TEXT,
      hire_date TEXT NOT NULL,
      department_id INTEGER,
      position TEXT,
      contract_type TEXT DEFAULT 'CDI',
      salary REAL,
      status TEXT DEFAULT 'active',
      photo_path TEXT,
      gender TEXT,
      national_id TEXT,
      social_security TEXT,
      nb_enfants INTEGER,
      bank_account TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  // Migration: add new columns if missing (for existing databases)
  const empCols = db.exec("PRAGMA table_info(employees)");
  if (empCols.length > 0) {
    const colNames = empCols[0].values.map(function(r) { return r[1]; });
    const addColIfMissing = (col, type) => {
      if (!colNames.includes(col)) {
        try { db.run(`ALTER TABLE employees ADD COLUMN ${col} ${type}`); } catch(e) {}
      }
    };
    addColIfMissing('marital_status', 'TEXT');
    addColIfMissing('social_security', 'TEXT');
    addColIfMissing('nb_enfants', 'INTEGER');
    addColIfMissing('end_date', 'TEXT');
    addColIfMissing('renewal_date', 'TEXT');
    addColIfMissing('transport', 'TEXT');
    addColIfMissing('national_id_type', 'TEXT');
    addColIfMissing('nuisance_pct', 'REAL');
    addColIfMissing('ifsp_pct', 'REAL');
    addColIfMissing('ifep_pct', 'REAL');
    addColIfMissing('technicite_pct', 'REAL');
    addColIfMissing('sujetion_pct', 'REAL');
    addColIfMissing('responsabilite_pct', 'REAL');
    addColIfMissing('zone_pct', 'REAL');
    addColIfMissing('prime_technicite', 'REAL');
    addColIfMissing('prime_sujetion', 'REAL');
    addColIfMissing('prime_responsabilite', 'REAL');
    addColIfMissing('prime_zone', 'REAL');
  }

  // Migration: departments sort_order (existing databases)
  try {
    const dptCols = db.exec("PRAGMA table_info(departments)");
    if (dptCols.length > 0) {
      const hasSortOrder = dptCols[0].values.some(function (r) { return r[1] === 'sort_order'; });
      if (!hasSortOrder) {
        try { db.run("ALTER TABLE departments ADD COLUMN sort_order INTEGER DEFAULT 999"); } catch (e) {}
      }
    }
  } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      document_name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Company document management â€” groups (Finances, Approvisionnements, Recrutement, ...)
  db.run(`
    CREATE TABLE IF NOT EXISTS document_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS company_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER,
      title TEXT NOT NULL,
      file_name TEXT,
      mime TEXT,
      is_text INTEGER DEFAULT 1,
      content TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT DEFAULT 'present',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Detailed pointage (P/CR/CA/JF per day per employee)
  db.run(`
    CREATE TABLE IF NOT EXISTS pointage_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT 'P',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, date),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Verso pointage â€” monthly indemnities (IFSP/TRANSP/PANIER/DEPLACEMENT)
  db.run(`
    CREATE TABLE IF NOT EXISTS pointage_verso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      ifsp REAL DEFAULT 0,
      transp REAL DEFAULT 0,
      panier REAL DEFAULT 0,
      deplacement REAL DEFAULT 0,
      UNIQUE(year, month, employee_id),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Heures supplÃ©mentaires â€” monthly overtime (50% / 75% / 100%)
  db.run(`
    CREATE TABLE IF NOT EXISTS heures_supplementaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      h50 REAL DEFAULT 0,
      h75 REAL DEFAULT 0,
      h100 REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month, employee_id),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      base_salary REAL,
      bonuses REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      net_salary REAL,
      status TEXT DEFAULT 'draft',
      paid_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      message TEXT NOT NULL,
      employee_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pending_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT DEFAULT 'local',
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // DEPLACE rotation tracking: 22 worked days => 8+ days rotation leave
  db.run(`
    CREATE TABLE IF NOT EXISTS deplacement_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL UNIQUE,
      cycle_start TEXT NOT NULL,
      sortie_date TEXT,
      worked_days INTEGER DEFAULT 0,
      leave_start TEXT,
      leave_end TEXT,
      leave_days INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Migration: add sortie_date if missing
  const depCols = db.exec("PRAGMA table_info(deplacement_tracking)");
  if (depCols.length > 0) {
    const depColNames = depCols[0].values.map(function(r) { return r[1]; });
    if (!depColNames.includes('sortie_date')) {
      try { db.run("ALTER TABLE deplacement_tracking ADD COLUMN sortie_date TEXT"); } catch(e) {}
    }
    if (!depColNames.includes('solde_adjust')) {
      try { db.run("ALTER TABLE deplacement_tracking ADD COLUMN solde_adjust INTEGER DEFAULT 0"); } catch(e) {}
    }
  }

  // Cumulative history of DEPLACE rotation periods (per worker) for past entitlements
  db.run(`
    CREATE TABLE IF NOT EXISTS deplacement_cumul (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      cycle_start TEXT NOT NULL,
      cycle_end TEXT,
      worked_days INTEGER DEFAULT 0,
      leave_start TEXT,
      leave_end TEXT,
      leave_days INTEGER DEFAULT 0,
      return_date TEXT,
      status TEXT DEFAULT 'closed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Default settings
  const settingsCount = db.exec("SELECT COUNT(*) as count FROM settings")[0]?.values[0]?.[0] || 0;
  if (settingsCount === 0) {
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_name', 'Ø´Ø±ÙƒØ© DRH']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_address', '']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_phone', '']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_email', '']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['ai_api_key', 'sk-11fd8d169e8c48a4ae353aab2e2586dc']);
  }

  // Default departments
  const deptCount = db.exec("SELECT COUNT(*) as count FROM departments")[0]?.values[0]?.[0] || 0;
  if (deptCount === 0) {
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ©', 'Ù‚Ø³Ù… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ©']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§', 'Ù‚Ø³Ù… ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['Ø§Ù„Ù…Ø§Ù„ÙŠØ©', 'Ù‚Ø³Ù… Ø§Ù„Ù…Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ù…Ø­Ø§Ø³Ø¨Ø©']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['Ø§Ù„ØªØ³ÙˆÙŠÙ‚', 'Ù‚Ø³Ù… Ø§Ù„ØªØ³ÙˆÙŠÙ‚ ÙˆØ§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['Ø§Ù„Ø¥Ù†ØªØ§Ø¬', 'Ù‚Ø³Ù… Ø§Ù„Ø¥Ù†ØªØ§Ø¬ ÙˆØ§Ù„ØªØµÙ†ÙŠØ¹']);
  }

  // Default document groups
  const groupCount = db.exec("SELECT COUNT(*) as count FROM document_groups")[0]?.values[0]?.[0] || 0;
  if (groupCount === 0) {
    const defaultGroups = [
      'Finances & ComptabilitÃ©',
      'Approvisionnements',
      'Recrutement',
      'RÃ©siliation',
      'Administration',
      'Autres',
    ];
    defaultGroups.forEach(function(name) {
      db.run("INSERT INTO document_groups (name) VALUES (?)", [name]);
    });
  }

  saveDb();
  syncLeaveStatuses();
  saveDb();
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.error('Query error:', e.message);
    return [];
  }
}

function queryOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (e) {
    console.error('Query error:', e.message);
    return null;
  }
}

const DAY_MS = 1000 * 60 * 60 * 24;
function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}
function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / DAY_MS);
}

function runSql(sql, params = []) {
  try {
    db.run(sql, params);
    saveDbDebounced();
    return { success: true, lastId: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
  } catch (e) {
    console.error('Run error:', e.message);
    return { success: false, error: e.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#f8fafc',
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
  flushAlertQueue();
  backupIfNeeded();
});

app.on('window-all-closed', () => {
  saveDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => { saveDb(); });

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// Departments
ipcMain.handle('db:get-departments', () => queryAll('SELECT * FROM departments ORDER BY COALESCE(sort_order, 999), name'));
ipcMain.handle('db:add-department', (e, d) => runSql('INSERT INTO departments (name, description, manager) VALUES (?, ?, ?)', [d.name, d.description, d.manager]));
ipcMain.handle('db:update-department', (e, d) => { runSql('UPDATE departments SET name=?, description=?, manager=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [d.name, d.description, d.manager, d.id]); return { success: true }; });
ipcMain.handle('db:delete-department', (e, id) => { runSql('DELETE FROM departments WHERE id=?', [id]); return { success: true }; });
ipcMain.handle('db:reorder-departments', (e, ids) => { (ids || []).forEach((id, i) => runSql('UPDATE departments SET sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [i + 1, id])); return { success: true }; });

  // Auto-revert employees whose approved leaves have all ended
function addNotification(type, message, employeeId = null) {
  runSql('INSERT INTO notifications (type, message, employee_id) VALUES (?, ?, ?)', [type, message, employeeId]);
}

function syncLeaveStatuses() {
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date(today);

  // --- 0. Rotation DEPLACE: flag ended rotation leaves needing manager decision ---
  rotateHandleOverdue();

  // --- 1. Auto-reactivate employees whose approved leaves have ended ---
  const onLeaveEmps = queryAll("SELECT id, first_name, last_name FROM employees WHERE status = 'on_leave'");
  for (const emp of onLeaveEmps) {
    const activeLeave = queryOne("SELECT id FROM leaves WHERE employee_id = ? AND status = 'approved' AND end_date >= ?", [emp.id, today]);
    if (!activeLeave) {
      const alreadyNotified = queryOne("SELECT id FROM notifications WHERE employee_id = ? AND type = 'leave-end' AND date(created_at) = ?", [emp.id, today]);
      runSql("UPDATE employees SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [emp.id]);
      if (!alreadyNotified) {
        addNotification('leave-end', `${emp.first_name} ${emp.last_name} terminÃ© son congÃ© et est maintenant actif`, emp.id);
      }
    }
  }

  // --- 2. Set active employees to on_leave if they have an approved active leave ---
  const activeEmps = queryAll("SELECT id FROM employees WHERE status = 'active'");
  for (const emp of activeEmps) {
    const activeLeave = queryOne("SELECT id FROM leaves WHERE employee_id = ? AND status = 'approved' AND end_date >= ?", [emp.id, today]);
    if (activeLeave) {
      runSql("UPDATE employees SET status = 'on_leave', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [emp.id]);
    }
  }

  // --- 3. Generate contract expiry notifications (within 15 days) ---
  const in15Days = new Date(todayDate);
  in15Days.setDate(in15Days.getDate() + 15);
  const in15DaysStr = in15Days.toISOString().split('T')[0];

  const expiringEmps = queryAll("SELECT id, first_name, last_name, end_date FROM employees WHERE end_date IS NOT NULL AND end_date != '' AND end_date <= ? AND end_date >= ? AND status = 'active'", [in15DaysStr, today]);
  for (const emp of expiringEmps) {
    const endDate = new Date(emp.end_date);
    const diffDays = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    const alreadyNotified = queryOne("SELECT id FROM notifications WHERE employee_id = ? AND type = 'contract-expiring' AND date(created_at) = ?", [emp.id, today]);
    if (!alreadyNotified) {
      const msg = diffDays <= 0
        ? `âš ï¸ Contrat de ${emp.first_name} ${emp.last_name} expirÃ© aujourd'hui !`
        : `â° Contrat de ${emp.first_name} ${emp.last_name} expire dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      addNotification('contract-expiring', msg, emp.id);
    }
  }

  // --- 4. Auto-expire employees whose contract end_date has passed ---
  const expiredEmps = queryAll("SELECT id, first_name, last_name FROM employees WHERE end_date IS NOT NULL AND end_date != '' AND end_date < ? AND status = 'active'", [today]);
  for (const emp of expiredEmps) {
    const alreadyNotified = queryOne("SELECT id FROM notifications WHERE employee_id = ? AND type = 'contract-expired' AND date(created_at) = ?", [emp.id, today]);
    runSql("UPDATE employees SET status = 'terminated', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [emp.id]);
    if (!alreadyNotified) {
      addNotification('contract-expired', `âŒ Contrat de ${emp.first_name} ${emp.last_name} terminÃ© â€” statut mis Ã  "terminÃ©"`, emp.id);
    }
  }

  // --- 5. Reactivate renewed contracts: terminate -> active when end_date is in the future ---
  const renewedEmps = queryAll("SELECT id, first_name, last_name, end_date FROM employees WHERE end_date IS NOT NULL AND end_date != '' AND end_date >= ? AND status = 'terminated'", [today]);
  for (const emp of renewedEmps) {
    const alreadyNotified = queryOne("SELECT id FROM notifications WHERE employee_id = ? AND type = 'contract-renewed' AND date(created_at) = ?", [emp.id, today]);
    runSql("UPDATE employees SET status = 'active', renewal_date = COALESCE(renewal_date, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?", [today, emp.id]);
    if (!alreadyNotified) {
      addNotification('contract-renewed', `âœ… Contrat de ${emp.first_name} ${emp.last_name} renouvelÃ© â€” statut rÃ©activÃ© (active)`, emp.id);
    }
  }
}

// Employees
ipcMain.handle('db:get-employees', () => { syncLeaveStatuses(); return queryAll('SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.last_name, e.first_name'); });
ipcMain.handle('db:get-employee', (e, id) => queryOne('SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [id]));
ipcMain.handle('db:add-employee', (e, emp) => runSql('INSERT INTO employees (matricule, first_name, last_name, marital_status, phone, address, date_of_birth, hire_date, end_date, department_id, position, contract_type, salary, status, photo_path, gender, national_id, social_security, nb_enfants, bank_account, notes, transport, national_id_type, nuisance_pct, ifsp_pct, ifep_pct, prime_technicite, prime_sujetion, prime_responsabilite, prime_zone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [emp.matricule, emp.first_name, emp.last_name, emp.marital_status, emp.phone, emp.address, emp.date_of_birth, emp.hire_date, emp.end_date, emp.department_id, emp.position, emp.contract_type, emp.salary, emp.status || 'active', emp.photo_path, emp.gender, emp.national_id, emp.social_security, emp.nb_enfants, emp.bank_account, emp.notes, emp.transport, emp.national_id_type || 'CNI', emp.nuisance_pct || null, emp.ifsp_pct || null, emp.ifep_pct || null, emp.prime_technicite || null, emp.prime_sujetion || null, emp.prime_responsabilite || null, emp.prime_zone || null]));
ipcMain.handle('db:update-employee', (e, emp) => {
  const today = new Date().toISOString().split('T')[0];
  const current = queryOne('SELECT status, end_date FROM employees WHERE id=?', [emp.id]);
  let finalStatus = emp.status;
  let renewalDate = null;
  if (current && emp.end_date) {
    const wasExpired = current.status === 'terminated' || (current.end_date && current.end_date < today);
    const newIsFuture = emp.end_date >= today;
    if (wasExpired && newIsFuture) {
      finalStatus = 'active';
      renewalDate = today;
      addNotification('contract-renewed', `âœ… Contrat de ${emp.first_name} ${emp.last_name} renouvelÃ© jusqu'au ${emp.end_date} â€” statut rÃ©activÃ© (active)`, emp.id);
    }
  }
  runSql('UPDATE employees SET matricule=?, first_name=?, last_name=?, marital_status=?, phone=?, address=?, date_of_birth=?, hire_date=?, end_date=?, department_id=?, position=?, contract_type=?, salary=?, status=?, photo_path=?, gender=?, national_id=?, social_security=?, nb_enfants=?, bank_account=?, notes=?, transport=?, national_id_type=?, nuisance_pct=?, ifsp_pct=?, ifep_pct=?, prime_technicite=?, prime_sujetion=?, prime_responsabilite=?, prime_zone=?, renewal_date=COALESCE(?, renewal_date), updated_at=CURRENT_TIMESTAMP WHERE id=?', [emp.matricule, emp.first_name, emp.last_name, emp.marital_status, emp.phone, emp.address, emp.date_of_birth, emp.hire_date, emp.end_date, emp.department_id, emp.position, emp.contract_type, emp.salary, finalStatus, emp.photo_path, emp.gender, emp.national_id, emp.social_security, emp.nb_enfants, emp.bank_account, emp.notes, emp.transport, emp.national_id_type || 'CNI', emp.nuisance_pct || null, emp.ifsp_pct || null, emp.ifep_pct || null, emp.prime_technicite || null, emp.prime_sujetion || null, emp.prime_responsabilite || null, emp.prime_zone || null, renewalDate, emp.id]); return { success: true }; });
ipcMain.handle('db:delete-employee', (e, id) => { runSql('DELETE FROM employees WHERE id=?', [id]); return { success: true }; });
ipcMain.handle('db:update-employee-status', (e, id, status) => { runSql('UPDATE employees SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, id]); return { success: true }; });
ipcMain.handle('db:search-employees', (e, q) => queryAll('SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.first_name LIKE ? OR e.last_name LIKE ? OR e.matricule LIKE ? OR e.phone LIKE ?', [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]));

// Documents
ipcMain.handle('db:get-employee-documents', (e, empId) => queryAll('SELECT * FROM employee_documents WHERE employee_id=? ORDER BY uploaded_at DESC', [empId]));
ipcMain.handle('db:add-document', (e, doc) => runSql('INSERT INTO employee_documents (employee_id, document_name, document_type, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?)', [doc.employee_id, doc.document_name, doc.document_type, doc.file_path, doc.file_size, doc.mime_type]));
ipcMain.handle('db:delete-document', (e, id) => {
  const doc = queryOne('SELECT file_path FROM employee_documents WHERE id=?', [id]);
  if (doc && fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
  runSql('DELETE FROM employee_documents WHERE id=?', [id]);
  return { success: true };
});

// ===== Company documents (tab "Documents") =====
const DOC_MIME = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
  html: 'text/html', htm: 'text/html', xml: 'application/xml', log: 'text/plain',
};
const DOC_TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml', 'log', 'ini', 'sql'];

ipcMain.handle('db:get-document-groups', () => queryAll(
  'SELECT g.*, (SELECT COUNT(*) FROM company_documents d WHERE d.group_id = g.id) as count FROM document_groups g ORDER BY g.id'
));
ipcMain.handle('db:add-document-group', (e, name) => runSql('INSERT INTO document_groups (name) VALUES (?)', [name]));
ipcMain.handle('db:rename-document-group', (e, { id, name }) => runSql('UPDATE document_groups SET name=? WHERE id=?', [name, id]));
ipcMain.handle('db:delete-document-group', (e, id) => {
  db.run('UPDATE company_documents SET group_id=NULL WHERE group_id=?', [id]);
  return runSql('DELETE FROM document_groups WHERE id=?', [id]);
});
ipcMain.handle('db:get-company-documents', (e, groupId) => {
  const base = 'SELECT id, group_id, title, file_name, mime, is_text, notes, length(content) as size, created_at, updated_at FROM company_documents';
  return groupId ? queryAll(base + ' WHERE group_id=? ORDER BY updated_at DESC', [groupId]) : queryAll(base + ' ORDER BY updated_at DESC');
});
ipcMain.handle('db:get-company-document', (e, id) => queryOne('SELECT * FROM company_documents WHERE id=?', [id]));
ipcMain.handle('db:add-company-document', (e, doc) => runSql(
  'INSERT INTO company_documents (group_id, title, file_name, mime, is_text, content, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [doc.group_id || null, doc.title, doc.file_name || null, doc.mime || null, doc.is_text ? 1 : 0, doc.content || '', doc.notes || null]
));
ipcMain.handle('db:update-company-document', (e, doc) => runSql(
  'UPDATE company_documents SET group_id=?, title=?, content=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
  [doc.group_id || null, doc.title, doc.content || '', doc.notes || null, doc.id]
));
ipcMain.handle('db:delete-company-document', (e, id) => runSql('DELETE FROM company_documents WHERE id=?', [id]));
ipcMain.handle('fs:import-document', (e, fp) => {
  try {
    if (!fp || !fs.existsSync(fp)) return { success: false, error: 'File not found' };
    const buf = fs.readFileSync(fp);
    const ext = path.extname(fp).toLowerCase().replace('.', '');
    const isText = DOC_TEXT_EXTS.includes(ext);
    return {
      success: true,
      file_name: path.basename(fp),
      ext,
      mime: DOC_MIME[ext] || 'application/octet-stream',
      is_text: isText,
      size: buf.length,
      text: isText ? buf.toString('utf8') : null,
      content: isText ? null : buf.toString('base64'),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('db:open-stored-document', (e, id) => {
  try {
    const doc = queryOne('SELECT * FROM company_documents WHERE id=?', [id]);
    if (!doc) return { success: false, error: 'Not found' };
    const tmpDir = path.join(app.getPath('temp'), 'drh_documents');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const name = doc.file_name || `${doc.title}${doc.is_text ? '.html' : '.bin'}`;
    const dest = path.join(tmpDir, name);
    const data = doc.is_text ? (doc.content || '') : Buffer.from(doc.content || '', 'base64');
    fs.writeFileSync(dest, data);
    require('electron').shell.openPath(dest);
    return { success: true, path: dest };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Dialogs
ipcMain.handle('dialog:open-file', async (e, options) => dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }] }));
ipcMain.handle('dialog:save-file', async (e, options) => dialog.showSaveDialog(mainWindow, options));
ipcMain.handle('fs:save-file', (e, src, name) => { const dest = path.join(uploadsDir, name); fs.copyFileSync(src, dest); return dest; });
ipcMain.handle('fs:read-file', (e, fp) => fs.existsSync(fp) ? fs.readFileSync(fp) : null);
ipcMain.handle('fs:read-file-data-url', (e, fp) => {
  if (!fs.existsSync(fp)) return null;
  const buf = fs.readFileSync(fp);
  const ext = path.extname(fp).toLowerCase().toLowerCase();
  const mimeMap = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const mime = mimeMap[ext] || 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
});
ipcMain.handle('shell:open-path', (e, fp) => { const { shell } = require('electron'); shell.openPath(fp); return true; });

// Attendance
ipcMain.handle('db:get-attendance', (e, params) => {
  if (params?.employeeId) return queryAll('SELECT a.*, e.first_name, e.last_name FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.employee_id=? ORDER BY a.date DESC', [params.employeeId]);
  if (params?.date) return queryAll('SELECT a.*, e.first_name, e.last_name FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.date=? ORDER BY e.last_name', [params.date]);
  return queryAll('SELECT a.*, e.first_name, e.last_name FROM attendance a JOIN employees e ON a.employee_id = e.id ORDER BY a.date DESC LIMIT 100');
});
ipcMain.handle('db:add-attendance', (e, a) => runSql('INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?)', [a.employee_id, a.date, a.check_in, a.check_out, a.status, a.notes]));
ipcMain.handle('db:update-attendance', (e, a) => { runSql('UPDATE attendance SET check_in=?, check_out=?, status=?, notes=? WHERE id=?', [a.check_in, a.check_out, a.status, a.notes, a.id]); return { success: true }; });

// Detailed pointage P/CR/CA/JF
ipcMain.handle('db:get-pointage-detail', (e, { year, month }) => {
  const employees = queryAll("SELECT id, first_name, last_name, position, status, contract_type, matricule, transport FROM employees WHERE status != 'terminated' ORDER BY last_name, first_name");
  const daysInMonth = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`;
  const rows = queryAll("SELECT employee_id, date, code FROM pointage_detail WHERE date >= ? AND date <= ?", [startDate, endDate]);
  const pointage = {};
  rows.forEach(function(r) {
    if (!pointage[r.employee_id]) pointage[r.employee_id] = {};
    pointage[r.employee_id][r.date] = r.code;
  });
  return { employees, year, month, days: daysInMonth, pointage };
});

ipcMain.handle('db:set-pointage-cell', (e, { employee_id, date, code }) => {
  if (!code) {
    runSql("DELETE FROM pointage_detail WHERE employee_id = ? AND date = ?", [employee_id, date]);
  } else {
    runSql("INSERT INTO pointage_detail (employee_id, date, code) VALUES (?, ?, ?) ON CONFLICT(employee_id, date) DO UPDATE SET code = excluded.code, updated_at = CURRENT_TIMESTAMP", [employee_id, date, code]);
  }
  saveDb();
  return { success: true };
});

ipcMain.handle('db:clear-pointage-month', (e, { year, month }) => {
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  runSql("DELETE FROM pointage_detail WHERE date >= ? AND date <= ?", [startDate, endDate]);
  saveDb();
  return { success: true };
});

// Heures supplÃ©mentaires (overtime 50% / 75% / 100%)
ipcMain.handle('db:get-heures-supp', (e, { year, month }) => {
  const employees = queryAll("SELECT id, first_name, last_name, position, status, contract_type, matricule FROM employees WHERE status != 'terminated' ORDER BY last_name, first_name");
  const rows = queryAll("SELECT employee_id, h50, h75, h100 FROM heures_supplementaires WHERE year = ? AND month = ?", [year, month]);
  const records = {};
  rows.forEach(function(r) {
    records[r.employee_id] = { h50: r.h50 || 0, h75: r.h75 || 0, h100: r.h100 || 0 };
  });
  return { year, month, employees, records };
});

ipcMain.handle('db:set-heures-supp', (e, { employee_id, year, month, h50, h75, h100 }) => {
  const vals = [h50 || 0, h75 || 0, h100 || 0];
  const row = queryOne("SELECT id FROM heures_supplementaires WHERE year = ? AND month = ? AND employee_id = ?", [year, month, employee_id]);
  if (row) {
    runSql("UPDATE heures_supplementaires SET h50 = ?, h75 = ?, h100 = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [vals[0], vals[1], vals[2], row.id]);
  } else {
    runSql("INSERT INTO heures_supplementaires (employee_id, year, month, h50, h75, h100) VALUES (?, ?, ?, ?, ?, ?)", [employee_id, year, month, vals[0], vals[1], vals[2]]);
  }
  saveDb();
  return { success: true };
});

// Export tables to PDF / Excel / Word (pointage, heures supp, ...)
ipcMain.handle('db:export-pointage', async (e, { html, format, prefix, portrait }) => {
  try {
    const isPdf = format === 'pdf';
    const ext = isPdf ? 'pdf' : (format === 'xls' ? 'xls' : 'doc');
    const fname = format === 'xls' ? 'Excel Document' : (format === 'doc' ? 'Word Document' : 'PDF Document');
    const filePrefix = prefix || 'POINTAGE_';
    const defaultPath = path.join(app.getPath('desktop'), filePrefix + new Date().toISOString().slice(0, 10) + '.' + ext);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter',
      defaultPath: defaultPath,
      filters: [{ name: fname, extensions: [ext] }],
    });
    if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };

    if (!isPdf) {
      // html is a full document (Excel MSO workbook doc for .xls, regular html for .doc)
      // UTF-8 BOM is required so Excel reliably detects the XML Spreadsheet 2003 format
      const content = format === 'xls' ? '\uFEFF' + html : html;
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    }

    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const buffer = await win.webContents.printToPDF({ pageSize: 'A4', landscape: portrait ? false : true, printBackground: true });
    fs.writeFileSync(result.filePath, buffer);
    win.destroy();
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Export tables to modern .xlsx (full OOXML, opens in Excel 2016+)
ipcMain.handle('db:export-xlsx', async (e, { sheets, prefix }) => {
  try {
    const filePrefix = prefix || 'EXPORT_';
    const defaultPath = path.join(app.getPath('desktop'), filePrefix + new Date().toISOString().slice(0, 10) + '.xlsx');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter en Excel',
      defaultPath: defaultPath,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };

    const { buildXlsx } = require('./xlsx');
    const buffer = buildXlsx(sheets);
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Print tables directly to the physical printer (system print dialog + landscape A4)
ipcMain.handle('db:print-html', async (e, { html, landscape }) => {
  try {
    if (!html) return { success: false, error: 'Empty document' };
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: false, sandbox: false },
    });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise((resolve) => setTimeout(resolve, 400));
    const result = await new Promise((resolve) => {
      win.webContents.print(
        {
          printBackground: true,
          landscape: landscape !== false,
          pageSize: 'A4',
          silent: false,
        },
        (success, failureReason) => {
          if (success) resolve({ success: true });
          else resolve({ success: false, error: failureReason || 'Print failed' });
        }
      );
    });
    win.destroy();
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// Send a rendered report/export by email (Gmail SMTP). Builds temp file per format then sends.
ipcMain.handle('db:send-report-email', async (e, payload) => {  try {
    const { smtp, to, subject, prefix, format, html, sheets, landscape } = payload || {};
    if (!smtp || !to) return { success: false, error: 'Paramètres SMTP/destinataire manquants' };
    const tmpDir = path.join(app.getPath('temp'), 'drh_mail');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = (prefix || 'RAPPORT_') + stamp;
    const files = [];
    if (format === 'xlsx') {
      const { buildXlsx } = require('./xlsx');
      const buffer = buildXlsx(sheets || []);
      const f = path.join(tmpDir, base + '.xlsx');
      fs.writeFileSync(f, buffer);
      files.push(f);
    } else if (format === 'pdf') {
      const f = path.join(tmpDir, base + '.pdf');
      const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const buf = await win.webContents.printToPDF({ pageSize: 'A4', landscape: landscape === true, printBackground: true });
      fs.writeFileSync(f, buf);
      win.destroy();
      files.push(f);
    } else {
      const f = path.join(tmpDir, base + '.doc');
      fs.writeFileSync(f, '\uFEFF' + html, 'utf8');
      files.push(f);
    }
    const { sendEmail } = require('./email');
    const htmlB64 = Buffer.from(html || 'This is a DRH document').toString('base64');
    const res = await sendEmail({
      host: smtp.host, port: parseInt(smtp.port || 587, 10), secure: !!smtp.secure,
      user: smtp.user, pass: smtp.pass,
      to, from: smtp.from || smtp.user,
      subject: subject || 'Rapport DRH',
      html: '<div style="font-family:Arial;color:#14305a">' + (html || '') + '</div>',
      files
    });
    return res;
  } catch (err) {
    return { success: false, error: String((err && err.message) || err) };
  }
});
// Verso pointage â€” monthly indemnities IFSP/TRANSP/PANIER/DEPLACEMENT
ipcMain.handle('db:get-pointage-verso', (e, { year, month }) => {
  const rows = queryAll("SELECT employee_id, ifsp, transp, panier, deplacement FROM pointage_verso WHERE year = ? AND month = ?", [year, month]);
  const map = {};
  rows.forEach(function(r) {
    map[r.employee_id] = { ifsp: r.ifsp || 0, transp: r.transp || 0, panier: r.panier || 0, deplacement: r.deplacement || 0 };
  });
  return map;
});

ipcMain.handle('db:set-pointage-verso-field', (e, { employee_id, year, month, field, value }) => {
  const allowed = ['ifsp', 'transp', 'panier', 'deplacement'];
  if (!allowed.includes(field)) return { success: false };
  const row = queryOne("SELECT id FROM pointage_verso WHERE year = ? AND month = ? AND employee_id = ?", [year, month, employee_id]);
  if (row) {
    runSql(`UPDATE pointage_verso SET ${field} = ? WHERE id = ?`, [value, row.id]);
  } else {
    runSql(`INSERT INTO pointage_verso (employee_id, year, month, ${field}) VALUES (?, ?, ?, ?)`, [employee_id, year, month, value]);
  }
  saveDb();
  return { success: true };
});

// Leaves
ipcMain.handle('db:get-leaves', (e, params) => {
  if (params?.employeeId) return queryAll('SELECT l.*, e.first_name, e.last_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.employee_id=? ORDER BY l.created_at DESC', [params.employeeId]);
  return queryAll('SELECT l.*, e.first_name, e.last_name FROM leaves l JOIN employees e ON l.employee_id = e.id ORDER BY l.created_at DESC');
});
ipcMain.handle('db:add-leave', (e, l) => runSql('INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [l.employee_id, l.leave_type, l.start_date, l.end_date, l.days, l.reason, 'pending']));
ipcMain.handle('db:update-leave', (e, l) => { runSql('UPDATE leaves SET employee_id=?, leave_type=?, start_date=?, end_date=?, days=?, reason=?, status=?, approved_by=? WHERE id=?', [l.employee_id, l.leave_type, l.start_date, l.end_date, l.days, l.reason, l.status, l.approved_by, l.id]); return { success: true }; });
ipcMain.handle('db:delete-leave', (e, id) => { runSql('DELETE FROM leaves WHERE id=?', [id]); return { success: true }; });

// Notifications
ipcMain.handle('db:get-notifications', () => { syncLeaveStatuses(); return queryAll('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT 50'); });
ipcMain.handle('db:mark-notifications-read', () => { runSql("UPDATE notifications SET is_read = 1 WHERE is_read = 0"); return { success: true }; });
ipcMain.handle('db:add-notification', (e, { type, message, employee_id }) => runSql('INSERT INTO notifications (type, message, employee_id) VALUES (?, ?, ?)', [type || 'security', message || '', employee_id || null]));

// Telegram alerts (intrusion + tests) — HTTPS POST to api.telegram.org, no SMTP needed
function sendTelegram(botToken, chatId, text) {
  return new Promise((resolve) => {
    try {
      const body = JSON.stringify({ chat_id: chatId, text: String(text || '').slice(0, 3500) });
      const req = https.request({ hostname: 'api.telegram.org', port: 443, path: '/bot' + botToken + '/sendMessage', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j && j.ok) resolve({ success: true });
            else resolve({ success: false, error: (j && j.description) || ('HTTP ' + res.statusCode) });
          } catch (e) { resolve({ success: false, error: 'Bad response' }); }
        });
      });
      req.on('error', (e) => resolve({ success: false, error: String((e && e.message) || e) }));
      req.setTimeout(30000, () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
      req.write(body);
      req.end();
    } catch (e) { resolve({ success: false, error: String((e && e.message) || e) }); }
  });
}
// ===== Offline alert outbox: failed alerts are stored and retried when back online =====
let lastOnlineCheck = 0;
let lastOnline = false;
function isOnlineFast() {
  const now = Date.now();
  if (now - lastOnlineCheck < 30000) return Promise.resolve(lastOnline);
  lastOnlineCheck = now;
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; lastOnline = v; resolve(v); } };
    try {
      const s = net.connect(53, '8.8.8.8');
      s.on('connect', () => { try { s.destroy(); } catch (e) {} fin(true); });
      s.on('error', () => fin(false));
      setTimeout(() => fin(false), 4000);
    } catch (e) { fin(false); }
  });
}
async function flushAlertQueue() {
  try {
    if (!db) return;
    const rows = queryAll('SELECT * FROM pending_alerts ORDER BY id ASC LIMIT 20');
    if (!rows.length) return;
    if (!(await isOnlineFast())) return;
    const { sendEmail } = require('./email');
    for (const r of rows) {
      let ok = false;
      try {
        const p = JSON.parse(r.payload || '{}');
        if (r.kind === 'telegram') {
          const srows = queryAll("SELECT key, value FROM settings WHERE key IN ('telegram_bot_token','telegram_chat_id')");
          const m = {};
          srows.forEach((x) => { m[x.key] = x.value; });
          const t = await sendTelegram(m.telegram_bot_token || '', p.to || m.telegram_chat_id || '', p.text || '');
          ok = !!(t && t.success);
        } else if (r.kind === 'email') {
          const srows = queryAll("SELECT key, value FROM settings WHERE key LIKE 'smtp%'");
          const m = {};
          srows.forEach((x) => { m[x.key] = x.value; });
          if (m.smtp_user && m.smtp_pass) {
            const t = await sendEmail({ host: m.smtp_host || 'smtp-relay.brevo.com', port: parseInt(m.smtp_port || 587, 10), secure: m.smtp_secure === '1', user: m.smtp_user, pass: m.smtp_pass, to: p.to, from: m.smtp_from || m.smtp_user, subject: p.subject || 'DRH Alert', html: p.html || '', files: [] });
            ok = !!(t && t.success);
          }
        } else { ok = true; }
      } catch (e) {}
      if (ok) runSql('DELETE FROM pending_alerts WHERE id = ?', [r.id]);
      else runSql('UPDATE pending_alerts SET attempts = attempts + 1 WHERE id = ?', [r.id]);
    }
    runSql('DELETE FROM pending_alerts WHERE attempts >= 720');
  } catch (e) {}
}
ipcMain.handle('db:queue-alert', (e, { kind, payload }) => {
  runSql('INSERT INTO pending_alerts (kind, payload) VALUES (?, ?)', [kind || '', JSON.stringify(payload || {})]);
  flushAlertQueue();
  return { success: true };
});
setInterval(flushAlertQueue, 60000);

ipcMain.handle('db:send-telegram', async (e, { text, to }) => {  try {
    const rows = queryAll("SELECT key, value FROM settings WHERE key IN ('telegram_bot_token','telegram_chat_id')");
    const map = {};
    rows.forEach((r) => { map[r.key] = r.value; });
    const token = map.telegram_bot_token || '';
    const chat = to || map.telegram_chat_id || '';
    if (!token || !chat) return { success: false, error: 'Telegram not configured' };
    return await sendTelegram(token, chat, text);
  } catch (err) { return { success: false, error: String((err && err.message) || err) }; }
});

// Rotation DEPLACE â€” MANAGER-controlled dates, 22 jours => congÃ© 8+ jours
const ROTATION_THRESHOLD = 22;
const ROTATION_ALERT = 4;

function ensureDeplacementTracking() {
  const today = new Date().toISOString().split('T')[0];
  const emps = queryAll("SELECT id, hire_date FROM employees WHERE contract_type = 'DEPLACE'");
  for (const emp of emps) {
    const row = queryOne('SELECT id FROM deplacement_tracking WHERE employee_id = ?', [emp.id]);
    if (!row) {
      runSql('INSERT INTO deplacement_tracking (employee_id, cycle_start, worked_days, status) VALUES (?, ?, 0, ?)', [emp.id, emp.hire_date || today, 'active']);
    }
  }
}

function computeWorkedDays(cycleStart, sortieDate, today) {
  if (!cycleStart) return 0;
  if (sortieDate) {
    return Math.max(0, daysBetween(cycleStart, sortieDate));
  }
  return Math.max(0, daysBetween(cycleStart, today));
}

function rotateHandleOverdue() {
  const today = new Date().toISOString().split('T')[0];
  const overdue = queryAll("SELECT t.*, e.first_name, e.last_name FROM deplacement_tracking t JOIN employees e ON e.id = t.employee_id WHERE t.status = 'on_leave' AND t.leave_end IS NOT NULL AND t.leave_end < ?", [today]);
  for (const row of overdue) {
    const alreadyNotified = queryOne("SELECT id FROM notifications WHERE employee_id = ? AND type = 'rotation-decision-needed' AND date(created_at) = ?", [row.employee_id, today]);
    if (!alreadyNotified) {
      addNotification('rotation-decision-needed', `âš ï¸ CongÃ© de ${row.first_name} ${row.last_name} terminÃ© le ${row.leave_end} â€” dÃ©cision requise (retour ou prolongation)`, row.employee_id);
    }
  }
}

function computeRotationData() {
  ensureDeplacementTracking();
  rotateHandleOverdue();
  const today = new Date().toISOString().split('T')[0];
  const emps = queryAll("SELECT e.*, d.name as department_name, t.id as t_id, t.cycle_start, t.sortie_date, t.worked_days as stored_worked, t.leave_start, t.leave_end, t.leave_days, t.solde_adjust, t.status as rotation_status FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN deplacement_tracking t ON t.employee_id = e.id WHERE e.contract_type = 'DEPLACE' ORDER BY e.last_name, e.first_name");

  return emps.map(emp => {
    let rotationStatus = emp.rotation_status || 'active';
    let worked;
    if (rotationStatus === 'on_leave') {
      worked = emp.stored_worked || ROTATION_THRESHOLD;
    } else {
      worked = computeWorkedDays(emp.cycle_start || emp.hire_date || today, emp.sortie_date, today);
    }
    const remaining = Math.max(0, ROTATION_THRESHOLD - worked);
    const eligible = worked >= ROTATION_THRESHOLD && rotationStatus === 'active';
    const nearAlert = rotationStatus === 'active' && !eligible && remaining <= ROTATION_ALERT && remaining > 0;
    const leaveFinished = rotationStatus === 'on_leave' && emp.leave_end && emp.leave_end < today;
    if (rotationStatus === 'active') {
      updateDeplacementWorked(emp.id, worked);
    }
    if (eligible) {
      const alreadyNotified = queryOne("SELECT id FROM notifications WHERE employee_id = ? AND type = 'rotation-eligible' AND date(created_at) = ?", [emp.id, today]);
      if (!alreadyNotified) {
        addNotification('rotation-eligible', `âœ… ${emp.first_name} ${emp.last_name} a atteint ${worked} jours â€” Ã©ligible au congÃ© de rotation`, emp.id);
      }
    }
    return {
      ...emp,
      t_id: emp.t_id,
      cycle_start: emp.cycle_start || emp.hire_date || today,
      sortie_date: emp.sortie_date || null,
      solde_adjust: emp.solde_adjust || 0,
      worked_days: worked,
      remaining: remaining,
      eligible: eligible,
      near_alert: nearAlert,
      leave_finished: leaveFinished,
      rotation_status: rotationStatus,
      leave_start: emp.leave_start,
      leave_end: emp.leave_end,
      leave_days: emp.leave_days,
    };
  });
}

function updateDeplacementWorked(employeeId, worked) {
  runSql('UPDATE deplacement_tracking SET worked_days = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?', [worked, employeeId]);
}

ipcMain.handle('db:get-deplacement', () => computeRotationData());

ipcMain.handle('db:update-deplacement-dates', (e, { employee_id, cycle_start, sortie_date }) => {
  const today = new Date().toISOString().split('T')[0];
  let row = queryOne('SELECT id FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  if (!row) {
    ensureDeplacementTracking();
    row = queryOne('SELECT id FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  }
  const newWorked = computeWorkedDays(cycle_start || today, sortie_date, today);
  runSql("UPDATE deplacement_tracking SET cycle_start = ?, sortie_date = ?, worked_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [cycle_start || today, sortie_date || null, newWorked, row.id]);
  return { success: true, worked_days: newWorked };
});

ipcMain.handle('db:grant-rotation-leave', (e, { employee_id, days }) => {
  const today = new Date().toISOString().split('T')[0];
  const emp = queryOne("SELECT e.id, e.first_name, e.last_name FROM employees e WHERE e.id = ? AND e.contract_type = 'DEPLACE'", [employee_id]);
  if (!emp) return { success: false, error: 'EmployÃ© introuvable ou non DEPLACE' };

  let row = queryOne('SELECT id, cycle_start, sortie_date, worked_days, status FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  if (!row) {
    ensureDeplacementTracking();
    row = queryOne('SELECT id, cycle_start, sortie_date, worked_days, status FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  }
  if (row.status === 'on_leave') return { success: false, error: 'DÃ©jÃ  en congÃ© de rotation' };

  const worked = computeWorkedDays(row.cycle_start, row.sortie_date, today);
  if (worked < ROTATION_THRESHOLD) return { success: false, error: `Il faut ${ROTATION_THRESHOLD} jours minimum (${worked} actuellement)` };
  if (!days || days < 8) return { success: false, error: 'Le congÃ© doit Ãªtre de 8 jours minimum' };

  // The leave ALWAYS starts on the day the manager presses the validation button (today)
  const leaveStart = today;
  const leaveEnd = addDays(leaveStart, days - 1);

  runSql("UPDATE deplacement_tracking SET status = 'on_leave', worked_days = ?, sortie_date = COALESCE(sortie_date, ?), leave_start = ?, leave_end = ?, leave_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [worked, today, leaveStart, leaveEnd, days, row.id]);
  runSql("UPDATE employees SET status = 'on_leave', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [employee_id]);
  runSql("INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason, status, approved_by) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)", [employee_id, 'ROTATION', leaveStart, leaveEnd, days, 'CongÃ© de rotation aprÃ¨s 22 jours travaillÃ©s', 'Rotation']);
  addNotification('rotation-leave', `ðŸ–ï¸ ${emp.first_name} ${emp.last_name} en congÃ© de rotation : ${days} jours (du ${leaveStart} au ${leaveEnd})`, employee_id);
  saveDb();
  return { success: true, leave_start: leaveStart, leave_end: leaveEnd, days: days };
});

ipcMain.handle('db:resolve-rotation-leave', (e, { employee_id, decision, new_leave_end, new_entry_date, return_date }) => {
  const today = new Date().toISOString().split('T')[0];
  const emp = queryOne("SELECT e.id, e.first_name, e.last_name FROM employees e WHERE e.id = ?", [employee_id]);
  if (!emp) return { success: false, error: 'EmployÃ© introuvable' };

  let row = queryOne('SELECT id, cycle_start, sortie_date, worked_days, leave_start, leave_end, leave_days, status FROM deplacement_tracking WHERE employee_id = ? AND status = ?', [employee_id, 'on_leave']);
  if (!row) return { success: false, error: 'Aucun congÃ© actif' };

  if (decision === 'returned') {
    const entry = new_entry_date || today;
    const retDate = return_date || today;
    const newWorked = computeWorkedDays(entry, null, today);
    // Archive the closed period into the cumulative history (past entitlements ledger)
    const periodEnd = row.sortie_date || row.leave_start || today;
    const actualLeaveDays = row.leave_start ? (daysBetween(row.leave_start, retDate) + 1) : (row.leave_days || 0);
    const leaveEndUsed = row.leave_end || today;
    const lateDays = (row.leave_start && retDate > leaveEndUsed) ? (daysBetween(leaveEndUsed, retDate)) : 0;
    const closed = queryOne("SELECT id FROM deplacement_cumul WHERE employee_id = ? AND cycle_start = ? AND status = 'closed' AND leave_start = ?", [employee_id, row.cycle_start, row.leave_start]);
    if (closed) {
      runSql("UPDATE deplacement_cumul SET cycle_end = ?, worked_days = ?, leave_days = ?, return_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [periodEnd, row.worked_days, actualLeaveDays, retDate, lateDays > 0 ? `Retour en retard de ${lateDays} jour(s)` : (actualLeaveDays < 8 ? `Retour avant la fin du repos (${actualLeaveDays} j sur 8 min)` : 'Retour conforme'), closed.id]);
      if (lateDays > 0) addNotification('rotation-late-return', `âŒ› ${emp.first_name} ${emp.last_name} a retardÃ© son retour de ${lateDays} jour(s) (rejointe le ${retDate})`, employee_id);
    } else {
      runSql("INSERT INTO deplacement_cumul (employee_id, cycle_start, cycle_end, worked_days, leave_start, leave_end, leave_days, return_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?)", [employee_id, row.cycle_start, periodEnd, row.worked_days, row.leave_start, leaveEndUsed, actualLeaveDays, retDate, lateDays > 0 ? `Retour en retard de ${lateDays} jour(s)` : (actualLeaveDays < 8 ? `Retour avant la fin du repos (${actualLeaveDays} j sur 8 min)` : 'Retour conforme')]);
      if (lateDays > 0) addNotification('rotation-late-return', `âŒ› ${emp.first_name} ${emp.last_name} a retardÃ© son retour de ${lateDays} jour(s) (rejointe le ${retDate})`, employee_id);
    }
    runSql("UPDATE deplacement_tracking SET status = 'active', cycle_start = ?, sortie_date = NULL, worked_days = ?, leave_start = NULL, leave_end = NULL, leave_days = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [entry, newWorked, row.id]);
    runSql("UPDATE employees SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [employee_id]);
    addNotification('rotation-return', `ðŸ”„ ${emp.first_name} ${emp.last_name} est revenu â€” nouveau cycle dÃ©marrÃ© (${entry})`, employee_id);
  } else if (decision === 'extended') {
    if (!new_leave_end || new_leave_end <= today) return { success: false, error: 'La nouvelle date de fin doit Ãªtre future' };
    const newDays = daysBetween(today, new_leave_end) + 1;
    runSql("UPDATE deplacement_tracking SET leave_end = ?, leave_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [new_leave_end, newDays, row.id]);
    const existingLeave = queryOne("SELECT id FROM leaves WHERE employee_id = ? AND leave_type = 'ROTATION' AND status = 'approved' ORDER BY id DESC LIMIT 1", [employee_id]);
    if (existingLeave) {
      runSql("UPDATE leaves SET end_date = ?, days = ? WHERE id = ?", [new_leave_end, newDays, existingLeave.id]);
    }
    addNotification('rotation-extended', `ðŸ“… CongÃ© de ${emp.first_name} ${emp.last_name} prolongÃ© jusqu'au ${new_leave_end} (${newDays} jours)`, employee_id);
    saveDb();
    return { success: true };
  } else {
    return { success: false, error: 'DÃ©cision inconnue: returned ou extended' };
  }
  saveDb();
  return { success: true };
});

// Cumulative entitlements ledger: past closed periods per worker + current tracking
ipcMain.handle('db:get-deplacement-cumul', () => {
  const today = new Date().toISOString().split('T')[0];
  const data = computeRotationData();
  const currentById = {};
  data.forEach(function(d) { currentById[d.id] = d; });

  const periods = queryAll("SELECT c.*, e.first_name, e.last_name, e.position, d.name as department_name FROM deplacement_cumul c JOIN employees e ON e.id = c.employee_id LEFT JOIN departments d ON d.id = e.department_id ORDER BY e.last_name, e.first_name, c.cycle_start DESC");
  const byEmployee = {};
  periods.forEach(function(p) {
    if (!byEmployee[p.employee_id]) {
      byEmployee[p.employee_id] = { employee_id: p.employee_id, first_name: p.first_name, last_name: p.last_name, position: p.position, department_name: p.department_name, periods: [] };
    }
    byEmployee[p.employee_id].periods.push({
      id: p.id,
      cycle_start: p.cycle_start,
      cycle_end: p.cycle_end,
      worked_days: p.worked_days || 0,
      leave_start: p.leave_start,
      leave_end: p.leave_end,
      leave_days: p.leave_days || 0,
      return_date: p.return_date,
      notes: p.notes || ''
    });
  });

  const employees = [];
  (data).forEach(function(cur) {
    const hist = byEmployee[cur.id];
    const totalWorked = (hist ? hist.periods.reduce(function(s, p) { return s + p.worked_days; }, 0) : 0) + (cur.rotation_status === 'on_leave' ? 0 : cur.worked_days);
    const totalLeaveTaken = hist ? hist.periods.reduce(function(s, p) { return s + p.leave_days; }, 0) : 0;
    const entitlement = Math.floor(totalWorked / ROTATION_THRESHOLD) * 8;
    const soldeAdjust = cur.solde_adjust || 0;
    const remainingBalance = entitlement - totalLeaveTaken + soldeAdjust;
    employees.push({
      id: cur.id,
      first_name: cur.first_name,
      last_name: cur.last_name,
      position: cur.position,
      department_name: cur.department_name,
      current_status: cur.rotation_status,
      current_cycle_start: cur.cycle_start,
      current_worked: cur.worked_days,
      current_eligible: cur.eligible,
      leave_start: cur.leave_start,
      leave_end: cur.leave_end,
      leave_days: cur.leave_days,
      periods: hist ? hist.periods : [],
      total_worked: totalWorked,
      total_leave_taken: totalLeaveTaken,
      entitlement_days: entitlement,
      solde_adjust: soldeAdjust,
      remaining_balance: remainingBalance,
      owed_days: Math.max(0, remainingBalance)
    });
  });
  return employees;
});

ipcMain.handle('db:update-cumul-days', (e, { period_id, worked_days, leave_days, return_date, cycle_end }) => {
  const row = queryOne('SELECT id FROM deplacement_cumul WHERE id = ?', [period_id]);
  if (!row) return { success: false, error: 'PÃ©riode introuvable' };
  runSql("UPDATE deplacement_cumul SET worked_days = ?, leave_days = ?, return_date = ?, cycle_end = COALESCE(?, cycle_end), updated_at = CURRENT_TIMESTAMP WHERE id = ?", [worked_days || 0, leave_days || 0, return_date || null, cycle_end || null, period_id]);
  saveDb();
  return { success: true, period_id: period_id, worked_days: worked_days || 0, leave_days: leave_days || 0 };
});

// Manual adjustment of the remaining balance (SOLDE RESTANT) in days
ipcMain.handle('db:update-deplacement-solde', (e, { employee_id, solde_adjust }) => {
  let row = queryOne('SELECT id FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  if (!row) {
    ensureDeplacementTracking();
    row = queryOne('SELECT id FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  }
  const val = parseInt(solde_adjust) || 0;
  runSql("UPDATE deplacement_tracking SET solde_adjust = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [val, row.id]);
  saveDb();
  return { success: true, solde_adjust: val };
});

ipcMain.handle('db:restart-rotation-cycle', (e, employee_id) => {
  const today = new Date().toISOString().split('T')[0];
  let row = queryOne('SELECT id FROM deplacement_tracking WHERE employee_id = ?', [employee_id]);
  if (row) {
    runSql("UPDATE deplacement_tracking SET status = 'active', cycle_start = ?, sortie_date = NULL, worked_days = 0, leave_start = NULL, leave_end = NULL, leave_days = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [today, row.id]);
  } else {
    runSql('INSERT INTO deplacement_tracking (employee_id, cycle_start, worked_days, status) VALUES (?, ?, 0, ?)', [employee_id, today, 'active']);
  }
  return { success: true };
});

// Contracts Expiring
ipcMain.handle('db:get-contracts-expiring', () => {
  syncLeaveStatuses();
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date(today);
  const in15Days = new Date(todayDate);
  in15Days.setDate(in15Days.getDate() + 15);
  const in15DaysStr = in15Days.toISOString().split('T')[0];

  const expiring = queryAll("SELECT e.id, e.first_name, e.last_name, e.end_date, e.position, e.contract_type, e.status, e.renewal_date, d.name as department_name, e.salary FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.end_date IS NOT NULL AND e.end_date != '' AND e.end_date <= ? AND e.end_date >= ?", [in15DaysStr, today]);

  return expiring.map(emp => {
    const endDate = new Date(emp.end_date);
    const diffDays = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return { ...emp, days_remaining: diffDays };
  }).sort((a, b) => a.days_remaining - b.days_remaining);
});

// Payroll
ipcMain.handle('db:get-payroll', (e, params) => {
  if (params?.employeeId) return queryAll('SELECT p.*, e.first_name, e.last_name FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.employee_id=? ORDER BY p.year DESC, p.month DESC', [params.employeeId]);
  if (params?.month && params?.year) return queryAll('SELECT p.*, e.first_name, e.last_name, e.position, d.name as department_name FROM payroll p JOIN employees e ON p.employee_id = e.id LEFT JOIN departments d ON e.department_id = d.id WHERE p.month=? AND p.year=? ORDER BY e.last_name', [params.month, params.year]);
  return queryAll('SELECT p.*, e.first_name, e.last_name FROM payroll p JOIN employees e ON p.employee_id = e.id ORDER BY p.year DESC, p.month DESC LIMIT 100');
});
ipcMain.handle('db:add-payroll', (e, p) => runSql('INSERT INTO payroll (employee_id, month, year, base_salary, bonuses, deductions, net_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [p.employee_id, p.month, p.year, p.base_salary, p.bonuses, p.deductions, p.net_salary, 'draft']));
ipcMain.handle('db:generate-payroll', (e, params) => {
  const emps = queryAll("SELECT * FROM employees WHERE status = 'active'");
  let count = 0;
  for (const emp of emps) {
    const existing = queryOne('SELECT id FROM payroll WHERE employee_id=? AND month=? AND year=?', [emp.id, params.month, params.year]);
    if (!existing) {
      runSql('INSERT INTO payroll (employee_id, month, year, base_salary, bonuses, deductions, net_salary, status) VALUES (?, ?, ?, ?, 0, 0, ?, ?)', [emp.id, params.month, params.year, emp.salary, emp.salary, 'draft']);
      count++;
    }
  }
  return { count };
});
ipcMain.handle('db:pay-salary', (e, id) => { runSql("UPDATE payroll SET status='paid', paid_date=? WHERE id=?", [new Date().toISOString().split('T')[0], id]); return { success: true }; });

// Stats
ipcMain.handle('db:get-stats', () => {
  const totalEmployees = queryOne('SELECT COUNT(*) as count FROM employees')?.count || 0;
  const activeEmployees = queryOne("SELECT COUNT(*) as count FROM employees WHERE status = 'active'")?.count || 0;
  const totalDepartments = queryOne('SELECT COUNT(*) as count FROM departments')?.count || 0;
  const pendingLeaves = queryOne("SELECT COUNT(*) as count FROM leaves WHERE status = 'pending'")?.count || 0;
  const todayDate = new Date().toISOString().split('T')[0];
  const todayAttendance = queryOne("SELECT COUNT(*) as count FROM attendance WHERE date = ?", [todayDate])?.count || 0;
  const totalPayroll = queryOne("SELECT COALESCE(SUM(net_salary), 0) as total FROM payroll WHERE status = 'draft'")?.total || 0;
  const today = new Date(todayDate);
  const in15Days = new Date(today);
  in15Days.setDate(in15Days.getDate() + 15);
  const in15DaysStr = in15Days.toISOString().split('T')[0];
  const expiringContracts = queryOne("SELECT COUNT(*) as count FROM employees WHERE end_date IS NOT NULL AND end_date != '' AND end_date <= ? AND end_date >= ? AND status = 'active'", [in15DaysStr, todayDate])?.count || 0;
  const recentEmployees = queryAll('SELECT e.id, e.first_name, e.last_name, e.hire_date, e.position, d.name as department_name, e.photo_path FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.created_at DESC LIMIT 5');
  const departmentStats = queryAll("SELECT d.name, COUNT(e.id) as count FROM departments d LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active' GROUP BY d.id, d.name");
  return { totalEmployees, activeEmployees, totalDepartments, pendingLeaves, todayAttendance, totalPayroll, recentEmployees, departmentStats, expiringContracts };
});

// Reports & analytics aggregation
ipcMain.handle('db:get-reports', (e, params) => {
  const year = params?.year || new Date().getFullYear();
  const month = params?.month || (new Date().getMonth() + 1);
  const yPrefix = String(year) + '-';
  const mm = String(month).padStart(2, '0');
  const mPrefix = String(year) + '-' + mm + '-';

  const summary = {
    total: queryOne('SELECT COUNT(*) as c FROM employees')?.c || 0,
    active: queryOne("SELECT COUNT(*) as c FROM employees WHERE status='active'")?.c || 0,
    on_leave: queryOne("SELECT COUNT(*) as c FROM employees WHERE status='on_leave'")?.c || 0,
    terminated: queryOne("SELECT COUNT(*) as c FROM employees WHERE status='terminated'")?.c || 0,
    departments: queryOne('SELECT COUNT(*) as c FROM departments')?.c || 0,
    hires_year: queryOne('SELECT COUNT(*) as c FROM employees WHERE hire_date LIKE ?', [yPrefix + '%'])?.c || 0,
    documents: queryOne('SELECT COUNT(*) as c FROM company_documents')?.c || 0,
  };

  const byStatus = queryAll("SELECT COALESCE(status,'-') as name, COUNT(*) as count FROM employees GROUP BY status ORDER BY count DESC");
  const byContractType = queryAll("SELECT COALESCE(contract_type,'-') as name, COUNT(*) as count FROM employees GROUP BY contract_type ORDER BY count DESC");
  const byDepartment = queryAll("SELECT COALESCE(d.name,'-') as name, COUNT(e.id) as count FROM departments d LEFT JOIN employees e ON e.department_id=d.id AND e.status!='terminated' GROUP BY d.id, d.name ORDER BY count DESC");
  const byPosition = queryAll("SELECT COALESCE(position,'-') as name, COUNT(*) as count FROM employees WHERE status!='terminated' AND position IS NOT NULL AND position!='' GROUP BY position ORDER BY count DESC LIMIT 12");
  const byGender = queryAll("SELECT COALESCE(gender,'-') as name, COUNT(*) as count FROM employees GROUP BY gender");

  const hiresByMonth = [];
  for (let m = 1; m <= 12; m++) {
    const p = yPrefix + String(m).padStart(2, '0') + '%';
    hiresByMonth.push({ month: m, count: queryOne('SELECT COUNT(*) as c FROM employees WHERE hire_date LIKE ?', [p])?.c || 0 });
  }

  const leavesByType = queryAll("SELECT leave_type as name, COUNT(*) as count, COALESCE(SUM(days),0) as days FROM leaves WHERE start_date LIKE ? OR end_date LIKE ? GROUP BY leave_type ORDER BY count DESC", [yPrefix + '%', yPrefix + '%']);
  const leavesByStatus = queryAll("SELECT COALESCE(status,'-') as name, COUNT(*) as count FROM leaves WHERE start_date LIKE ? OR end_date LIKE ? GROUP BY status ORDER BY count DESC", [yPrefix + '%', yPrefix + '%']);

  const attendanceRows = queryAll('SELECT code, COUNT(*) as count FROM pointage_detail WHERE date LIKE ? GROUP BY code', [mPrefix + '%']);
  const attendance = { P: 0, CR: 0, CA: 0, JF: 0, CM: 0, CD: 0, AA: 0, AI: 0, AT: 0 };
  attendanceRows.forEach(r => { if (r.code in attendance) attendance[r.code] = r.count; });

  const ot = queryAll('SELECT h50, h75, h100 FROM heures_supplementaires WHERE year=? AND month=?', [year, month]);
  const overtime = { h50: 0, h75: 0, h100: 0, total: 0 };
  ot.forEach(r => { overtime.h50 += r.h50 || 0; overtime.h75 += r.h75 || 0; overtime.h100 += r.h100 || 0; });
  overtime.total = overtime.h50 + overtime.h75 + overtime.h100;
  const overtimeTop = queryAll("SELECT e.first_name, e.last_name, h.h50, h.h75, h.h100, (h.h50+h.h75+h.h100) as total FROM heures_supplementaires h JOIN employees e ON e.id=h.employee_id WHERE h.year=? AND h.month=? ORDER BY total DESC LIMIT 10", [year, month]);

  const docsByGroup = queryAll("SELECT COALESCE(g.name,'Sans groupe') as name, COUNT(d.id) as count FROM document_groups g LEFT JOIN company_documents d ON d.group_id=g.id GROUP BY g.id, g.name ORDER BY count DESC");
  if (queryOne("SELECT COUNT(*) as c FROM company_documents WHERE group_id IS NULL")?.c) {
    docsByGroup.push({ name: 'Sans groupe', count: queryOne("SELECT COUNT(*) as c FROM company_documents WHERE group_id IS NULL")?.c });
  }

  const salaryMass = {
    total: queryOne("SELECT COALESCE(SUM(salary),0) as v FROM employees WHERE status!='terminated'")?.v || 0,
    average: queryOne("SELECT COALESCE(AVG(salary),0) as v FROM employees WHERE status!='terminated' AND salary>0")?.v || 0,
    max: queryOne("SELECT COALESCE(MAX(salary),0) as v FROM employees WHERE salary>0")?.v || 0,
    min: queryOne("SELECT COALESCE(MIN(salary),0) as v FROM employees WHERE salary>0 AND status!='terminated'")?.v || 0,
  };

  const rotation = {
    total: queryOne("SELECT COUNT(*) as c FROM employees WHERE contract_type='DEPLACE' AND status!='terminated'")?.c || 0,
    on_leave: queryOne("SELECT COUNT(*) as c FROM deplacement_tracking WHERE status='on_leave'")?.c || 0,
    eligible: queryOne("SELECT COUNT(*) as c FROM deplacement_tracking WHERE status='active' AND worked_days>=22")?.c || 0,
  };

  const ageRows = queryAll("SELECT date_of_birth FROM employees WHERE date_of_birth IS NOT NULL AND date_of_birth!=''");
  const ageGroups = [ { name: '<25', count: 0 }, { name: '25-34', count: 0 }, { name: '35-44', count: 0 }, { name: '45-54', count: 0 }, { name: '55+', count: 0 } ];
  ageRows.forEach(r => {
    const b = new Date(r.date_of_birth);
    if (isNaN(b.getTime())) return;
    let a = year - b.getFullYear();
    const m = month - (b.getMonth() + 1);
    if (m < 0 || (m === 0 && new Date().getDate() < b.getDate())) a--;
    if (a < 25) ageGroups[0].count++; else if (a < 35) ageGroups[1].count++; else if (a < 45) ageGroups[2].count++; else if (a < 55) ageGroups[3].count++; else ageGroups[4].count++;
  });

  return {
    year, month, summary, byStatus, byContractType, byDepartment, byPosition, byGender,
    hiresByMonth, leavesByType, leavesByStatus, attendance, overtime, overtimeTop,
    docsByGroup, salaryMass, rotation, ageGroups,
  };
});

// Generate AVENANT contract by filling the original .docx template
ipcMain.handle('generate-avendant', async (e, data) => {
  try {
    const JSZip = require('jszip');
    const templatePath = path.join(__dirname, '..', 'public', 'AVENANT_TEMPLATE.docx');
    const templateBuf = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuf);

    const replacements = {
      '[NUMERO_DE_CONTRAT]': data.numero_contrat || '',
      '[NOM_PRENOM]': data.nom_prenom || '',
      '[DATE_NAISSANCE]': data.date_naissance || '',
      '[LIEU_DE_NAISSANCE]': data.lieu_naissance || '',
      '[ ADRESSE ]': data.adresse || '',
      '[FONCTION]': data.fonction || '',
      '[DATE_DE_RECRUTEMENT]': data.date_recrutement || '',
      '[DUREE_EN_MOIS]': data.duree_mois || '',
      '[DATE_DE_DEBUT_DE_CONTRAT]': data.date_debut || '',
      '[DETE_DE_FIN_DE_CONTRAT]': data.date_fin || '',
'[DATE_DE_ETABLIR ]': data.date_etablir || '',
        '[NOM_PRENOM_POUR_LA_SIGNATURE]': data.nom_prenom || '',
        '[SEAL_CODE]': data.seal_code || '',
    };

    const filesToProcess = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];
    for (const filePath of filesToProcess) {
      const file = zip.file(filePath);
      if (file) {
        let content = await file.async('string');
        for (const [placeholder, value] of Object.entries(replacements)) {
          content = content.split(placeholder).join(value);
        }
        zip.file(filePath, content);
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const defaultPath = path.join(app.getPath('desktop'), 'AVENANT_' + (data.numero_contrat || 'CONTRAT') + '.docx');

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer l\'avenant',
      defaultPath: defaultPath,
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, path: result.filePath };
    }
    return { success: false, error: 'Cancelled' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('db:get-settings', () => {
  const rows = queryAll('SELECT * FROM settings');
  const obj = {};
  rows.forEach(r => { obj[r.key] = SECRET_KEYS.has(r.key) ? openValue(r.value) : r.value; });
  // migrate legacy plain-text secrets to encrypted form
  try {
    rows.forEach(r => {
      if (SECRET_KEYS.has(r.key) && typeof r.value === 'string' && r.value !== '' && !r.value.startsWith('enc:') && !r.value.startsWith('enc1:')) {
        runSql('UPDATE settings SET value = ? WHERE key = ?', [sealValue(r.value), r.key]);
      }
    });
  } catch (e) {}
  return obj;
});
ipcMain.handle('db:update-settings', (e, settings) => {
  for (const [key, value] of Object.entries(settings)) {
    const v = SECRET_KEYS.has(key) ? sealValue(value) : value;
    runSql('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, v]);
  }
  return { success: true };
});
ipcMain.handle('db:get-audit-log', () => queryAll('SELECT id, created_at, actor, action, details FROM audit_log ORDER BY id DESC LIMIT 100'));

// ===== AI AGENT: local tools the assistant can call to perform duties =====
const AGENT_TOOLS = [
  { name: 'get_stats', description: 'Get company numbers: employees, departments, pending leaves, expiring contracts.', parameters: { type: 'object', properties: {}, required: [] } },
  { name: 'list_employees', description: 'List employees, optional filters.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'active, inactive, on_leave or terminated' }, department: { type: 'string', description: 'department name' }, limit: { type: 'number', description: 'max rows, default 30' } }, required: [] } },
  { name: 'find_employee', description: 'Find employees by name, matricule or phone.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'add_employee', description: 'Hire a new employee. Returns id and matricule.', parameters: { type: 'object', properties: { first_name: { type: 'string' }, last_name: { type: 'string' }, position: { type: 'string' }, phone: { type: 'string' }, hire_date: { type: 'string', description: 'YYYY-MM-DD, default today' }, contract_type: { type: 'string', description: 'CDI, CDD or DEPLACE, default CDI' }, department: { type: 'string', description: 'department name' }, salary: { type: 'number' } }, required: ['first_name', 'last_name'] } },
  { name: 'update_employee', description: 'Modify an employee (position, phone, salary, status, contract_type, end_date, department).', parameters: { type: 'object', properties: { id: { type: 'number' }, position: { type: 'string' }, phone: { type: 'string' }, salary: { type: 'number' }, status: { type: 'string' }, contract_type: { type: 'string' }, end_date: { type: 'string' }, department: { type: 'string' } }, required: ['id'] } },
  { name: 'record_attendance', description: 'Record daily attendance for an employee (id, matricule or name).', parameters: { type: 'object', properties: { employee: { type: 'string', description: 'id, matricule or name' }, date: { type: 'string', description: 'YYYY-MM-DD, default today' }, status: { type: 'string', description: 'present, absent, late or leave. Default present.' } }, required: ['employee'] } },
  { name: 'request_leave', description: 'File a leave request (status pending).', parameters: { type: 'object', properties: { employee: { type: 'string', description: 'id, matricule or name' }, start_date: { type: 'string' }, end_date: { type: 'string' }, leave_type: { type: 'string', description: 'default annuel' }, reason: { type: 'string' } }, required: ['employee', 'start_date', 'end_date'] } },
  { name: 'decide_leave', description: 'Approve or reject a pending leave request.', parameters: { type: 'object', properties: { leave_id: { type: 'number' }, decision: { type: 'string', description: 'approved or rejected' } }, required: ['leave_id', 'decision'] } },
  { name: 'add_department', description: 'Create a new fonction/department.', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name'] } },
];
const agentAnthropicTools = () => AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));

function agentCap(o) {
  const s = typeof o === 'string' ? o : JSON.stringify(o);
  return s.length > 2500 ? s.slice(0, 2500) + '...[truncated]' : s;
}
function agentResolveEmployee(ref) {
  if (ref === undefined || ref === null || ref === '') return { error: 'missing employee reference' };
  if (/^\d+$/.test(String(ref))) {
    const emp = queryOne('SELECT * FROM employees WHERE id = ?', [Number(ref)]);
    if (emp) return { emp };
  }
  const byMat = queryOne('SELECT * FROM employees WHERE matricule = ?', [String(ref)]);
  if (byMat) return { emp: byMat };
  const like = '%' + String(ref) + '%';
  const rows = queryAll('SELECT id, matricule, first_name, last_name, position, status FROM employees WHERE first_name LIKE ? OR last_name LIKE ? OR matricule LIKE ? LIMIT 6', [like, like, like]);
  if (rows.length === 1) return { emp: queryOne('SELECT * FROM employees WHERE id = ?', [rows[0].id]) };
  if (rows.length > 1) return { error: 'multiple matches, be more specific: ' + rows.map((r) => r.id + ':' + r.last_name + ' ' + r.first_name + ' (' + r.matricule + ')').join(', ') };
  return { error: 'employee not found: ' + ref };
}
function agentDeptId(name) {
  if (name === undefined || name === null || name === '') return null;
  if (/^\d+$/.test(String(name))) return Number(name);
  const d = queryOne('SELECT id FROM departments WHERE name LIKE ?', ['%' + String(name) + '%']);
  return d ? d.id : null;
}
function agentExecuteTool(name, args) {
  try {
    const a = args || {};
    if (name === 'get_stats') {
      const total = queryOne('SELECT COUNT(*) as c FROM employees')?.c || 0;
      const active = queryOne("SELECT COUNT(*) as c FROM employees WHERE status='active'")?.c || 0;
      const depts = queryOne('SELECT COUNT(*) as c FROM departments')?.c || 0;
      const pend = queryOne("SELECT COUNT(*) as c FROM leaves WHERE status='pending'")?.c || 0;
      return { ok: true, text: JSON.stringify({ total_employees: total, active, departments: depts, pending_leaves: pend }) };
    }
    if (name === 'list_employees') {
      const lim = Math.min(Number(a.limit) || 30, 100);
      let sql = 'SELECT e.id, e.matricule, e.first_name, e.last_name, e.position, d.name as department, e.contract_type, e.status FROM employees e LEFT JOIN departments d ON d.id = e.department_id';
      const conds = [], prm = [];
      if (a.status) { conds.push('e.status = ?'); prm.push(a.status); }
      if (a.department) { conds.push('d.name LIKE ?'); prm.push('%' + a.department + '%'); }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
      sql += ' ORDER BY e.last_name LIMIT ' + lim;
      return { ok: true, text: agentCap(queryAll(sql, prm)) };
    }
    if (name === 'find_employee') {
      if (!a.query) return { ok: false, text: 'missing query' };
      const like = '%' + a.query + '%';
      const rows = queryAll('SELECT e.id, e.matricule, e.first_name, e.last_name, e.position, d.name as department, e.status FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.first_name LIKE ? OR e.last_name LIKE ? OR e.matricule LIKE ? OR e.phone LIKE ? LIMIT 10', [like, like, like, like]);
      return { ok: true, text: agentCap(rows) };
    }
    if (name === 'add_employee') {
      if (!a.first_name || !a.last_name) return { ok: false, text: 'first_name and last_name are required' };
      const year = new Date().getFullYear();
      let mat = '';
      for (let i = 0; i < 10; i++) {
        const cand = 'EMP-' + year + '-' + String(Math.floor(Math.random() * 9999)).padStart(4, '0');
        if (!queryOne('SELECT id FROM employees WHERE matricule = ?', [cand])) { mat = cand; break; }
      }
      if (!mat) return { ok: false, text: 'could not generate matricule, retry' };
      const ct = ['CDI', 'CDD', 'DEPLACE'].includes(a.contract_type) ? a.contract_type : 'CDI';
      const r = runSql('INSERT INTO employees (matricule, first_name, last_name, hire_date, position, phone, contract_type, salary, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [mat, a.first_name, a.last_name, a.hire_date || new Date().toISOString().slice(0, 10), a.position || '', a.phone || '', ct, a.salary || null, agentDeptId(a.department), 'active']);
      if (!r.success) return { ok: false, text: r.error || 'insert failed' };
      return { ok: true, text: 'employee created: id=' + r.lastId + ', matricule=' + mat };
    }
    if (name === 'update_employee') {
      if (!a.id) return { ok: false, text: 'missing id' };
      const sets = [], prm = [];
      const allow = ['position', 'phone', 'salary', 'status', 'contract_type', 'end_date'];
      allow.forEach((k) => { if (a[k] !== undefined && a[k] !== null && a[k] !== '') { sets.push(k + ' = ?'); prm.push(a[k]); } });
      if (a.department !== undefined && a.department !== null && a.department !== '') { sets.push('department_id = ?'); prm.push(agentDeptId(a.department)); }
      if (!sets.length) return { ok: false, text: 'nothing to update' };
      sets.push('updated_at = CURRENT_TIMESTAMP');
      prm.push(Number(a.id));
      const r = runSql('UPDATE employees SET ' + sets.join(', ') + ' WHERE id = ?', prm);
      if (!r.success) return { ok: false, text: r.error || 'update failed' };
      return { ok: true, text: 'employee ' + a.id + ' updated' };
    }
    if (name === 'record_attendance') {
      const ref = agentResolveEmployee(a.employee);
      if (ref.error) return { ok: false, text: ref.error };
      const st = ['present', 'absent', 'late', 'leave'].includes(a.status) ? a.status : 'present';
      const dt = a.date || new Date().toISOString().slice(0, 10);
      runSql('DELETE FROM attendance WHERE employee_id = ? AND date = ?', [ref.emp.id, dt]);
      const r = runSql('INSERT INTO attendance (employee_id, date, status) VALUES (?, ?, ?)', [ref.emp.id, dt, st]);
      if (!r.success) return { ok: false, text: r.error || 'insert failed' };
      return { ok: true, text: 'attendance recorded: ' + ref.emp.last_name + ' ' + ref.emp.first_name + ' = ' + st + ' on ' + dt };
    }
    if (name === 'request_leave') {
      const ref = agentResolveEmployee(a.employee);
      if (ref.error) return { ok: false, text: ref.error };
      if (!a.start_date || !a.end_date) return { ok: false, text: 'start_date and end_date required (YYYY-MM-DD)' };
      const days = Math.round((new Date(a.end_date).getTime() - new Date(a.start_date).getTime()) / 86400000) + 1;
      if (!(days >= 1)) return { ok: false, text: 'end_date must be on/after start_date' };
      const r = runSql('INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ref.emp.id, a.leave_type || 'annuel', a.start_date, a.end_date, days, a.reason || '', 'pending']);
      if (!r.success) return { ok: false, text: r.error || 'insert failed' };
      return { ok: true, text: 'leave request filed: id=' + r.lastId + ', ' + ref.emp.last_name + ' ' + ref.emp.first_name + ', ' + days + ' day(s), pending' };
    }
    if (name === 'decide_leave') {
      if (!a.leave_id) return { ok: false, text: 'missing leave_id' };
      const dec = String(a.decision || '').toLowerCase();
      if (dec !== 'approved' && dec !== 'rejected') return { ok: false, text: 'decision must be approved or rejected' };
      const lv = queryOne('SELECT * FROM leaves WHERE id = ?', [Number(a.leave_id)]);
      if (!lv) return { ok: false, text: 'leave not found' };
      const r = runSql("UPDATE leaves SET status = ?, approved_by = 'IA' WHERE id = ?", [dec, Number(a.leave_id)]);
      if (!r.success) return { ok: false, text: r.error || 'update failed' };
      return { ok: true, text: 'leave ' + a.leave_id + ' ' + dec };
    }
    if (name === 'add_department') {
      if (!a.name) return { ok: false, text: 'missing name' };
      if (queryOne('SELECT id FROM departments WHERE name = ?', [a.name])) return { ok: false, text: 'department already exists' };
      const r = runSql('INSERT INTO departments (name, description) VALUES (?, ?)', [a.name, a.description || '']);
      if (!r.success) return { ok: false, text: r.error || 'insert failed' };
      return { ok: true, text: 'department created: id=' + r.lastId };
    }
    return { ok: false, text: 'unknown tool: ' + name };
  } catch (e) {
    return { ok: false, text: 'tool error: ' + String((e && e.message) || e) };
  }
}

function aiPostJson(p, apiKey, body) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (p.kind === 'anthropic') { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; }
    else if (p.auth !== 'none') { headers['Authorization'] = 'Bearer ' + (apiKey || ''); }
    const req = https.request({ hostname: p.hostname, port: 443, path: p.path, method: 'POST', headers }, (res) => {
      const status = res.statusCode || 0;
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status, parsed, raw: data });
      });
    });
    req.on('error', (err) => resolve({ status: 0, parsed: null, raw: '', error: err.message }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, parsed: null, raw: '', error: 'Request timeout' }); });
    req.write(JSON.stringify(body));
    req.end();
  });
}
function aiExtractText(p, parsed) {
  if (!parsed) return null;
  if (p.kind === 'anthropic') {
    const t = (parsed.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return t || null;
  }
  const m = parsed.choices && parsed.choices[0] && parsed.choices[0].message;
  return m ? (m.content || '') : null;
}
function aiExtractError(parsed) {
  if (!parsed) return null;
  if (parsed.error) return parsed.error.message || 'API Error';
  return null;
}
function aiNormToolName(n) {
  const s = String(n || '').split('<|')[0].trim().toLowerCase().replace(/[^a-z_]/g, '');
  const hit = AGENT_TOOLS.find((t) => t.name === s);
  return hit ? hit.name : s;
}
function aiExtractCalls(p, parsed) {
  if (!parsed) return [];
  try {
    if (p.kind === 'anthropic') {
      return (parsed.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: aiNormToolName(b.name), args: b.input || {} }));
    }
    const m = parsed.choices && parsed.choices[0] && parsed.choices[0].message;
    if (m && m.tool_calls) return m.tool_calls.map((tc) => ({ id: tc.id, name: aiNormToolName(tc.function.name), args: JSON.parse(tc.function.arguments || '{}') }));
  } catch (e) {}
  return [];
}
async function aiAgentRun(p, useModel, apiKey, messages) {
  const trace = [];
  let convo = (messages || []).map((m) => ({ role: m.role, content: m.content }));
  let toolsOn = true;
  for (let i = 0; i < 6; i++) {
    let body;
    if (p.kind === 'anthropic') {
      const sys = convo.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
      const rest = convo.filter((m) => m.role !== 'system');
      body = { model: useModel, max_tokens: 2048, temperature: 0.3, system: sys || undefined, messages: rest.length ? rest : [{ role: 'user', content: 'Hello' }] };
      if (toolsOn) body.tools = agentAnthropicTools();
    } else {
      body = { model: useModel, messages: convo, max_tokens: 2048, temperature: 0.3 };
      if (toolsOn) { body.tools = AGENT_TOOLS.map((t) => ({ type: 'function', function: t })); body.tool_choice = 'auto'; }
    }
    const r = await aiPostJson(p, apiKey, body);
    if (r.error && i === 0 && !r.parsed) return { content: '', actions: trace, error: r.error };
    if (!r.parsed) {
      if (toolsOn && /tool/i.test(r.raw || '')) { toolsOn = false; continue; }
      return { content: '', actions: trace, error: 'HTTP ' + r.status + ': Failed to parse response' };
    }
    const perr = aiExtractError(r.parsed) || (r.raw ? r.raw.slice(0, 200) : 'API Error');
    const calls = toolsOn ? aiExtractCalls(p, r.parsed) : [];
    const text = aiExtractText(p, r.parsed);
    if (perr && !calls.length && (text === null || text === '')) {
      if (toolsOn && /tool/i.test(perr)) { toolsOn = false; continue; }
      return { content: '', actions: trace, error: 'HTTP ' + r.status + ': ' + perr };
    }
    if (!calls.length) return { content: text || '', actions: trace };
    if (p.kind === 'anthropic') convo.push({ role: 'assistant', content: r.parsed.content });
    else convo.push(r.parsed.choices[0].message);
    for (const c of calls) {
      const out = agentExecuteTool(c.name, c.args || {});
      trace.push({ tool: c.name, ok: !!out.ok });
      const resultText = out.ok ? out.text : ('ERROR: ' + out.text);
      if (p.kind === 'anthropic') convo.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: c.id, content: resultText }] });
      else convo.push({ role: 'tool', tool_call_id: c.id, content: resultText });
    }
  }
  return { content: '', actions: trace, error: 'Too many steps, please simplify the request' };
}

// AI Chat — multi-provider (deepseek / openai / anthropic / gemini / free pollinations)
const AI_PROVIDERS = {
  pollinations: { hostname: 'text.pollinations.ai', path: '/openai', model: 'openai', kind: 'openai', auth: 'none' },
  deepseek: { hostname: 'api.deepseek.com', path: '/chat/completions', model: 'deepseek-chat', kind: 'openai', auth: 'bearer' },
  openai: { hostname: 'api.openai.com', path: '/v1/chat/completions', model: 'gpt-4o-mini', kind: 'openai', auth: 'bearer' },
  gemini: { hostname: 'generativelanguage.googleapis.com', path: '/v1beta/openai/chat/completions', model: 'gemini-2.0-flash', kind: 'openai', auth: 'bearer' },
  anthropic: { hostname: 'api.anthropic.com', path: '/v1/messages', model: 'claude-3-5-haiku-20241022', kind: 'anthropic', auth: 'apikey' },
};
ipcMain.handle('ai:chat', async (e, { messages, apiKey, provider, model, tools }) => {
  const p = AI_PROVIDERS[provider] || AI_PROVIDERS.pollinations;
  const useModel = model || p.model;
  if (tools) {
    const r = await aiAgentRun(p, useModel, apiKey, messages || []);
    if (r.error && !r.content) return { success: false, error: r.error, actions: r.actions || [] };
    return { success: true, content: r.content, actions: r.actions || [] };
  }
  let body, options;
  if (p.kind === 'anthropic') {
    const sys = (messages || []).filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const convo = (messages || []).filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));
    body = JSON.stringify({ model: useModel, max_tokens: 2048, temperature: 0.7, system: sys || undefined, messages: convo.length ? convo : [{ role: 'user', content: 'Hello' }] });
    options = {
      hostname: p.hostname,
      port: 443,
      path: p.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };
  } else {
    body = JSON.stringify({
      model: useModel,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7,
    });

    options = {
      hostname: p.hostname,
      port: 443,
      path: p.path,
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        p.auth === 'bearer' ? { 'Authorization': 'Bearer ' + (apiKey || '') } : {}
      ),
    };
  }

  return new Promise((resolve) => {

    const req = https.request(options, (res) => {
      const status = res.statusCode || 0;
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (p.kind === 'anthropic') {
            if (parsed.content && parsed.content[0] && parsed.content[0].text) {
              resolve({ success: true, content: parsed.content[0].text });
            } else if (parsed.error) {
              resolve({ success: false, error: 'HTTP ' + status + ': ' + (parsed.error.message || 'API Error') });
            } else {
              resolve({ success: false, error: 'HTTP ' + status + ': Unexpected response' });
            }
          } else if (parsed.choices && parsed.choices[0]) {
            resolve({ success: true, content: parsed.choices[0].message.content });
          } else if (parsed.error) {
            resolve({ success: false, error: 'HTTP ' + status + ': ' + (parsed.error.message || 'API Error') });
          } else {
            resolve({ success: false, error: 'HTTP ' + status + ': Unexpected response' });
          }
        } catch (err) {
          resolve({ success: false, error: 'HTTP ' + status + ': Failed to parse response' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(body);
    req.end();
  });
});

// License System
let cachedMachineId = null;
function currentMachineId() {
  if (!cachedMachineId) {
    try { cachedMachineId = getMachineId(); } catch (e) { cachedMachineId = 'UNKNOWN'; }
  }
  return cachedMachineId;
}
ipcMain.handle('license:check', () => {
  const data = loadLicense();
  if (!data || !data.key) return { valid: false, error: 'NO_KEY' };
  const result = validateLicenseKey(data.key);
  if (!result.valid) return result;
  if (result.owner) return result; // owner master key works on any machine
  try {
    const mid = currentMachineId();
    if (!data.machineId) { saveLicense(data.key, mid); return result; } // first run: bind now
    if (data.machineId !== mid && data.machineId !== 'UNKNOWN' && mid !== 'UNKNOWN') {
      return { valid: false, error: 'BOUND_PC', bound: true };
    }
  } catch (e) {}
  return result;
});

ipcMain.handle('license:activate', (e, key) => {
  const result = validateLicenseKey(key);
  if (result.valid) {
    saveLicense(key);
  }
  return result;
});

ipcMain.handle('license:generate', (e, { clientName, expiryDate, plan }) => {
  return generateLicenseKey(clientName, expiryDate, plan);
});

// ===== Automatic backups (daily, dated, retention) =====
const backupDir = path.join(app.getPath('userData'), 'backups');
const BACKUP_KEEP = 30;
function backupFileName(d) {
  const p = (n) => String(n).padStart(2, '0');
  return 'drh_backup_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes()) + '.sqlite';
}
function pruneBackups() {
  try {
    if (!fs.existsSync(backupDir)) return;
    const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('drh_backup_') && f.endsWith('.sqlite')).sort().reverse();
    files.slice(BACKUP_KEEP).forEach((f) => { try { fs.unlinkSync(path.join(backupDir, f)); } catch (e) {} });
  } catch (e) {}
}
function doBackup() {
  try {
    if (!db) return { success: false, error: 'DB not ready' };
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    saveDb();
    const name = backupFileName(new Date());
    const dest = path.join(backupDir, name);
    fs.copyFileSync(dbPath, dest);
    pruneBackups();
    return { success: true, path: dest, name };
  } catch (e) { return { success: false, error: String((e && e.message) || e) }; }
}
function backupIfNeeded() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const files = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
    if (!files.some((f) => f.includes(today))) doBackup();
    else pruneBackups();
  } catch (e) {}
}
ipcMain.handle('db:backup-now', () => doBackup());
ipcMain.handle('db:list-backups', () => {
  try {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('drh_backup_') && f.endsWith('.sqlite'))
      .sort().reverse().slice(0, 30)
      .map((f) => {
        const st = fs.statSync(path.join(backupDir, f));
        return { name: f, size: st.size, mtime: st.mtimeMs };
      });
  } catch (e) { return []; }
});
ipcMain.handle('db:restore-backup', (e, { name }) => {
  try {
    const safe = path.basename(String(name || ''));
    const src = path.join(backupDir, safe);
    if (!safe.startsWith('drh_backup_') || !fs.existsSync(src)) return { success: false, error: 'NOT_FOUND' };
    saveDb();
    const pre = path.join(backupDir, 'drh_backup_pre-restore_' + backupFileName(new Date()));
    try { fs.copyFileSync(dbPath, pre); } catch (e) {}
    fs.copyFileSync(src, dbPath);
    setTimeout(() => { app.relaunch(); app.exit(0); }, 300);
    return { success: true };
  } catch (e) { return { success: false, error: String((e && e.message) || e) }; }
});
