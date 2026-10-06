/*
 * DRH — أداة البيع: توليد مفتاح ترخيص لزبون + رسالة التسليم
 * الاستخدام من مجلد المشروع:
 *   node tools/new-sale.js "اسم العميل / الشركة" PME 12
 *   node tools/new-sale.js "Client" START 12
 *   node tools/new-sale.js "Client" PRO 12
 *   node tools/new-sale.js "Client" TRIAL 1
 * الباقات: START | PME | PRO | ENTREPRISE | TRIAL
 * الرقم الأخير = مدة الصلاحية بالأشهر (الافتراضي 12، TRIAL = 1)
 * المفتاح مرتبط بجهاز واحد (يُربط عند أول تفعيل).
 */
const fs = require('fs');
const path = require('path');
const { generateLicenseKey, validateLicenseKey } = require('../electron/license');

const PLANS = ['START', 'PME', 'PRO', 'ENTREPRISE', 'TRIAL'];

function parseArgs() {
  const a = process.argv.slice(2);
  if (a.length < 1 || ['-h', '--help', 'help'].includes(a[0])) return null;
  let client = a[0] || 'Client';
  let plan = (a[1] || 'PME').toUpperCase();
  if (!PLANS.includes(plan)) {
    console.log('!! plan غير معروف: ' + a[1] + ' — الباقات: ' + PLANS.join(' | '));
    plan = 'PME';
  }
  let months = parseInt(a[2], 10);
  if (isNaN(months)) months = plan === 'TRIAL' ? 1 : 12;
  return { client, plan, months };
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function main() {
  const args = parseArgs();
  if (!args) {
    console.log('');
    console.log('DRH new-sale — توليد مفتاح ترخيص لزبون');
    console.log('  node tools/new-sale.js "اسم العميل" PME 12');
    console.log('  الباقات: START | PME | PRO | ENTREPRISE | TRIAL');
    console.log('');
    return;
  }
  const { client, plan, months } = args;
  const expiry = fmt(addMonths(new Date(), months));
  const key = generateLicenseKey(client, expiry, plan);

  // تحقق ذاتي قبل التسليم
  const check = validateLicenseKey(key);
  if (!check.valid) {
    console.log('!! خطأ: المفتاح المولّد غير صالح — لا ترسله. أعد المحاولة.');
    process.exit(1);
  }

  // سجل المبيعات
  const logPath = path.join(__dirname, 'sales-log.csv');
  const row = [new Date().toISOString().slice(0, 10), client, plan, expiry, months + 'm'].join(';') + '\n';
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, 'date;client;plan;expiry;duration\n', 'utf8');
  fs.appendFileSync(logPath, row, 'utf8');

  console.log('');
  console.log('=== DRH — مفتاح جديد ===');
  console.log('العميل : ' + client);
  console.log('الباقة : ' + plan);
  console.log('الصلاحية إلى: ' + expiry + ' (' + months + ' شهر)');
  console.log('المفتاح: ' + key);
  console.log('سُجّل في tools/sales-log.csv');
  console.log('');
  console.log('--- رسالة التسليم (عربية — انسخ وأرسل) ---');
  console.log('مبروك ' + client + '! تم تفعيل اشتراكك في برنامج DRH (' + plan + ').');
  console.log('مفتاح التفعيل الخاص بك:');
  console.log(key);
  console.log('صالح إلى: ' + expiry + ' — يعمل على جهاز واحد.');
  console.log('طريقة التفعيل: شغّل البرنامج ← الصق المفتاح في شاشة الترخيص ← اضغط تفعيل.');
  console.log('');
  console.log('--- Message de livraison (FR — copier/envoyer) ---');
  console.log('Félicitations ' + client + ' ! Votre licence DRH (' + plan + ') est activée.');
  console.log('Votre clé d\u2019activation :');
  console.log(key);
  console.log('Valide jusqu\u2019au : ' + expiry + ' — 1 clé = 1 PC.');
  console.log('Activation : lancez le logiciel ← collez la clé ← cliquez Activer.');
  console.log('');
}

main();
