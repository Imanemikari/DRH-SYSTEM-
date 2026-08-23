const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const initSqlJs = require('sql.js/dist/sql-asm.js');

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
  }

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

  // Default settings
  const settingsCount = db.exec("SELECT COUNT(*) as count FROM settings")[0]?.values[0]?.[0] || 0;
  if (settingsCount === 0) {
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_name', 'شركة DRH']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_address', '']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_phone', '']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['company_email', '']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['ai_api_key', 'sk-11fd8d169e8c48a4ae353aab2e2586dc']);
  }

  // Default departments
  const deptCount = db.exec("SELECT COUNT(*) as count FROM departments")[0]?.values[0]?.[0] || 0;
  if (deptCount === 0) {
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['الموارد البشرية', 'قسم إدارة الموارد البشرية']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['التكنولوجيا', 'قسم تكنولوجيا المعلومات']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['المالية', 'قسم المالية والمحاسبة']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['التسويق', 'قسم التسويق والمبيعات']);
    db.run("INSERT INTO departments (name, description) VALUES (?, ?)", ['الإنتاج', 'قسم الإنتاج والتصنيع']);
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
ipcMain.handle('db:get-departments', () => queryAll('SELECT * FROM departments ORDER BY name'));
ipcMain.handle('db:add-department', (e, d) => runSql('INSERT INTO departments (name, description, manager) VALUES (?, ?, ?)', [d.name, d.description, d.manager]));
ipcMain.handle('db:update-department', (e, d) => { runSql('UPDATE departments SET name=?, description=?, manager=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [d.name, d.description, d.manager, d.id]); return { success: true }; });
ipcMain.handle('db:delete-department', (e, id) => { runSql('DELETE FROM departments WHERE id=?', [id]); return { success: true }; });

  // Auto-revert employees whose approved leaves have all ended
function syncLeaveStatuses() {
  const today = new Date().toISOString().split('T')[0];
  // Revert on_leave employees whose leaves all ended
  const onLeaveEmps = queryAll("SELECT id FROM employees WHERE status = 'on_leave'");
  for (const emp of onLeaveEmps) {
    const activeLeave = queryOne("SELECT id FROM leaves WHERE employee_id = ? AND status = 'approved' AND end_date >= ?", [emp.id, today]);
    if (!activeLeave) {
      runSql("UPDATE employees SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [emp.id]);
    }
  }
  // Set active employees to on_leave if they have an approved active leave
  const activeEmps = queryAll("SELECT id FROM employees WHERE status = 'active'");
  for (const emp of activeEmps) {
    const activeLeave = queryOne("SELECT id FROM leaves WHERE employee_id = ? AND status = 'approved' AND end_date >= ?", [emp.id, today]);
    if (activeLeave) {
      runSql("UPDATE employees SET status = 'on_leave', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [emp.id]);
    }
  }
}

// Employees
ipcMain.handle('db:get-employees', () => { syncLeaveStatuses(); return queryAll('SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.last_name, e.first_name'); });
ipcMain.handle('db:get-employee', (e, id) => queryOne('SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [id]));
ipcMain.handle('db:add-employee', (e, emp) => runSql('INSERT INTO employees (matricule, first_name, last_name, marital_status, phone, address, date_of_birth, hire_date, end_date, department_id, position, contract_type, salary, status, photo_path, gender, national_id, social_security, nb_enfants, bank_account, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [emp.matricule, emp.first_name, emp.last_name, emp.marital_status, emp.phone, emp.address, emp.date_of_birth, emp.hire_date, emp.end_date, emp.department_id, emp.position, emp.contract_type, emp.salary, emp.status || 'active', emp.photo_path, emp.gender, emp.national_id, emp.social_security, emp.nb_enfants, emp.bank_account, emp.notes]));
ipcMain.handle('db:update-employee', (e, emp) => { runSql('UPDATE employees SET matricule=?, first_name=?, last_name=?, marital_status=?, phone=?, address=?, date_of_birth=?, hire_date=?, end_date=?, department_id=?, position=?, contract_type=?, salary=?, status=?, photo_path=?, gender=?, national_id=?, social_security=?, nb_enfants=?, bank_account=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [emp.matricule, emp.first_name, emp.last_name, emp.marital_status, emp.phone, emp.address, emp.date_of_birth, emp.hire_date, emp.end_date, emp.department_id, emp.position, emp.contract_type, emp.salary, emp.status, emp.photo_path, emp.gender, emp.national_id, emp.social_security, emp.nb_enfants, emp.bank_account, emp.notes, emp.id]); return { success: true }; });
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

// Leaves
ipcMain.handle('db:get-leaves', (e, params) => {
  if (params?.employeeId) return queryAll('SELECT l.*, e.first_name, e.last_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.employee_id=? ORDER BY l.created_at DESC', [params.employeeId]);
  return queryAll('SELECT l.*, e.first_name, e.last_name FROM leaves l JOIN employees e ON l.employee_id = e.id ORDER BY l.created_at DESC');
});
ipcMain.handle('db:add-leave', (e, l) => runSql('INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [l.employee_id, l.leave_type, l.start_date, l.end_date, l.days, l.reason, 'pending']));
ipcMain.handle('db:update-leave', (e, l) => { runSql('UPDATE leaves SET employee_id=?, leave_type=?, start_date=?, end_date=?, days=?, reason=?, status=?, approved_by=? WHERE id=?', [l.employee_id, l.leave_type, l.start_date, l.end_date, l.days, l.reason, l.status, l.approved_by, l.id]); return { success: true }; });
ipcMain.handle('db:delete-leave', (e, id) => { runSql('DELETE FROM leaves WHERE id=?', [id]); return { success: true }; });

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
  const recentEmployees = queryAll('SELECT e.id, e.first_name, e.last_name, e.hire_date, e.position, d.name as department_name, e.photo_path FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.created_at DESC LIMIT 5');
  const departmentStats = queryAll("SELECT d.name, COUNT(e.id) as count FROM departments d LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active' GROUP BY d.id, d.name");
  return { totalEmployees, activeEmployees, totalDepartments, pendingLeaves, todayAttendance, totalPayroll, recentEmployees, departmentStats };
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
  rows.forEach(r => obj[r.key] = r.value);
  return obj;
});
ipcMain.handle('db:update-settings', (e, settings) => {
  for (const [key, value] of Object.entries(settings)) {
    runSql('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, value]);
  }
  return { success: true };
});

// DeepSeek AI Chat
ipcMain.handle('ai:chat', async (e, { messages, apiKey }) => {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7,
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            resolve({ success: true, content: parsed.choices[0].message.content });
          } else if (parsed.error) {
            resolve({ success: false, error: parsed.error.message || 'API Error' });
          } else {
            resolve({ success: false, error: 'Unexpected response' });
          }
        } catch (err) {
          resolve({ success: false, error: 'Failed to parse response' });
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
