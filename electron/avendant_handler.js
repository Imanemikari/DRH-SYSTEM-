const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

module.exports = {};
