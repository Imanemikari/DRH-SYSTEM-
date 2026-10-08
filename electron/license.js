const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LICENSE_DIR = path.join(process.env.APPDATA || process.env.HOME, '.drh');
const LICENSE_FILE = path.join(LICENSE_DIR, 'license.key');
const SECRET = 'DRH-2027-VAULT-X9';

function getMachineId() {
    try {
        const winSerial = execSync('wmic bios get serialnumber', { encoding: 'utf8' })
            .split('\n')[1]?.trim() || '';
        const winUUID = execSync('wmic csproduct get uuid', { encoding: 'utf8' })
            .split('\n')[1]?.trim() || '';
        return `${winSerial}-${winUUID}`;
    } catch {
        return 'UNKNOWN';
    }
}

function groupSerial(s) {
    const clean = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const groups = [];
    for (let i = 0; i < clean.length; i += 5) groups.push(clean.slice(i, i + 5));
    return groups.join('-');
}

function generateLicenseKey(clientName, expiryDate, plan) {
    const payload = JSON.stringify({
        client: clientName,
        plan: plan || 'PME',
        expiry: expiryDate,
        issued: new Date().toISOString()
    });
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc',
        crypto.createHash('sha256').update(SECRET).digest(), iv);
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const raw = 'DRH' + iv.toString('hex') + encrypted;
    return groupSerial(raw);
}

const MASTER_KEY = 'DRH-TOUMI-OWNER-2027';

function validateLicenseKey(key) {
    try {
        if (!key) return { valid: false, error: 'مفتاح غير صالح' };

        const norm = String(key).trim().toUpperCase();

        if (norm === MASTER_KEY) {
            return {
                valid: true,
                client: 'TOUMI.B',
                plan: 'PRO',
                expiry: '2099-12-31',
                issued: '2026-01-01',
                owner: true
            };
        }

        // Normalize: strip all dashes/spaces -> DRH + iv(32 hex) + ciphertext(hex)
        const flat = norm.replace(/[^A-Z0-9]/g, '');
        if (!flat.startsWith('DRH') || flat.length < 3 + 32 + 32) {
            return { valid: false, error: 'صيغة المفتاح خاطئة' };
        }

        const ivHex = flat.substring(3, 35);
        const encrypted = flat.substring(35).toLowerCase();
        if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-f]+$/.test(encrypted)) {
            return { valid: false, error: 'مفتاح غير صالح' };
        }

        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc',
            crypto.createHash('sha256').update(SECRET).digest(), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const data = JSON.parse(decrypted);

        if (new Date(data.expiry) < new Date()) {
            return { valid: false, error: 'المفتاح منتهي الصلاحية', expired: true };
        }

        return {
            valid: true,
            client: data.client,
            plan: data.plan,
            expiry: data.expiry,
            issued: data.issued
        };
    } catch (e) {
        return { valid: false, error: 'مفتاح غير صالح' };
    }
}

function saveLicense(key, machineId) {
    if (!fs.existsSync(LICENSE_DIR)) fs.mkdirSync(LICENSE_DIR, { recursive: true });
    const data = {
        key: key,
        machineId: machineId || getMachineId(),
        activatedAt: new Date().toISOString()
    };
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data), 'utf8');
}

function loadLicense() {
    if (fs.existsSync(LICENSE_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
            return raw;
        } catch {
            const key = fs.readFileSync(LICENSE_FILE, 'utf8').trim();
            if (/^DRH/i.test(key.replace(/[^A-Za-z0-9]/g, ''))) {
                return { key: key, machineId: null, activatedAt: null };
            }
            return null;
        }
    }
    return null;
}

function isActivated() {
    const data = loadLicense();
    if (!data || !data.key) return false;
    const result = validateLicenseKey(data.key);
    return result.valid;
}

module.exports = { generateLicenseKey, validateLicenseKey, saveLicense, loadLicense, isActivated, getMachineId };

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args[0] === 'generate') {
        const name = args[1] || 'Client';
        const expiry = args[2] || '2027-12-31';
        const plan = args[3] || 'PME';
        const key = generateLicenseKey(name, expiry, plan);
        console.log('');
        console.log('=== DRH License Key ===');
        console.log('المفتاح:', key);
        console.log('العميل:', name);
        console.log('الباقة:', plan);
        console.log('الصلاحية:', expiry);
        console.log('');
    } else if (args[0] === 'validate') {
        const key = args[1];
        if (!key) {
            console.log('الاستخدام: node license.js validate "DRH-XXX"');
            return;
        }
        const result = validateLicenseKey(key);
        console.log(JSON.stringify(result, null, 2));
    } else if (args[0] === 'machine') {
        console.log('Machine ID:', getMachineId());
    } else if (args[0] === 'check') {
        const data = loadLicense();
        if (!data) {
            console.log('لا يوجد مفتاح محفوظ');
        } else {
            console.log('المفتاح المحفوظ:', data.key);
            const result = validateLicenseKey(data.key);
            console.log('الحالة:', result.valid ? 'صالح ✓' : 'غير صالح ✗');
            if (result.valid) {
                console.log('العميل:', result.client);
                console.log('الباقة:', result.plan);
                console.log('الصلاحية:', result.expiry);
            }
        }
    } else {
        console.log('');
        console.log('DRH License Tool');
        console.log('================');
        console.log('');
        console.log('إنشاء مفتاح:');
        console.log('  node license.js generate "اسم العميل" "2027-12-31" "PME"');
        console.log('');
        console.log('التحقق من مفتاح:');
        console.log('  node license.js validate "DRH-XXXX"');
        console.log('');
        console.log('رقم الجهاز:');
        console.log('  node license.js machine');
        console.log('');
        console.log('فحص المفتاح المحفوظ:');
        console.log('  node license.js check');
        console.log('');
        console.log('الباقة: Start | PME | Pro');
        console.log('');
    }
}
