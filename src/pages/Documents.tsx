import { useState, useEffect, useRef, type DragEvent } from 'react';
import { api } from '../utils/api';
import { useLang } from '../context/LangContext';
import {
  FolderOpen, FolderPlus, FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon,
  Upload, Plus, Save, Trash2, X, Search, Pencil, ExternalLink, RefreshCw, Check,
  Bold, Italic, Underline, List, ListOrdered, Undo2, Redo2, Type,
} from 'lucide-react';

interface DocumentsProps {
  navigateTo: (page: string, id?: number) => void;
}

interface DocGroup {
  id: number;
  name: string;
  count?: number;
}

interface DocMeta {
  id: number;
  group_id: number | null;
  title: string;
  file_name: string | null;
  mime: string | null;
  is_text: number;
  notes: string | null;
  size: number;
  created_at: string;
  updated_at: string;
}

interface EditorState {
  id?: number;
  title: string;
  group_id: number | null;
  notes: string;
  content: string;
  file_name: string | null;
  mime: string | null;
  is_text: number;
}

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];

const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toEditorHtml = (raw: string) => {
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return esc(raw).replace(/\r?\n/g, '<br>');
};
const formatSize = (n: number) => {
  if (!n) return '0 o';
  if (n < 1024) return n + ' o';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' Ko';
  return (n / 1024 / 1024).toFixed(2) + ' Mo';
};
const formatDate = (s: string) => {
  if (!s) return '-';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export default function Documents({ navigateTo }: DocumentsProps) {
  const { lang } = useLang();
  const [groups, setGroups] = useState<DocGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [search, setSearch] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [groupMsg, setGroupMsg] = useState('');
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [modalNewGroup, setModalNewGroup] = useState(false);
  const [modalGroupName, setModalGroupName] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => { loadDocs(); }, [selectedGroup]);
  useEffect(() => {
    if (editor && editor.is_text && editorRef.current) {
      editorRef.current.innerHTML = toEditorHtml(editor.content);
    }
  }, [editor?.id, editor?.isNew]);

  const loadGroups = async () => {
    const gs = await api.getDocumentGroups();
    setGroups(Array.isArray(gs) ? gs : []);
  };
  const loadDocs = async () => {
    const ds = await api.getCompanyDocuments(selectedGroup);
    setDocs(Array.isArray(ds) ? ds : []);
  };
  const refreshAll = async () => { await loadGroups(); await loadDocs(); };

  const handleAddGroup = async () => {
    const name = newGroup.trim();
    if (!name) { setGroupMsg(lang === 'ar' ? 'أدخل اسم المجموعة أولاً' : 'Saisissez le nom du groupe'); return; }
    setGroupMsg('');
    const res = await api.addDocumentGroup(name);
    if (res && res.success === false) { setGroupMsg('Erreur: ' + (res.error || '?')); return; }
    setNewGroup('');
    await loadGroups();
    setGroupMsg(lang === 'ar' ? 'تمت الإضافة ✔' : 'Groupe ajouté ✔');
  };

  const startRename = (g: DocGroup) => { setRenameId(g.id); setRenameVal(g.name); };
  const confirmRename = async () => {
    if (renameId == null) return;
    const name = renameVal.trim();
    if (name) {
      const res = await api.renameDocumentGroup(renameId, name);
      if (res && res.success === false) { setGroupMsg('Erreur: ' + (res.error || '?')); return; }
    }
    setRenameId(null);
    await loadGroups();
    setGroupMsg(lang === 'ar' ? 'تمت إعادة التسمية ✔' : 'Groupe renommé ✔');
  };
  const handleDeleteGroup = async (g: DocGroup) => {
    if (!window.confirm((lang === 'ar' ? 'حذف المجموعة؟ الوثائق لن تُحذف: ' : 'Supprimer le groupe ? Les documents seront conservés : ') + g.name)) return;
    const res = await api.deleteDocumentGroup(g.id);
    if (res && res.success === false) { setGroupMsg('Erreur: ' + (res.error || '?')); return; }
    if (selectedGroup === g.id) setSelectedGroup(null);
    await refreshAll();
    setGroupMsg(lang === 'ar' ? 'تم الحذف ✔' : 'Groupe supprimé ✔');
  };

  const confirmModalAddGroup = async () => {
    const name = modalGroupName.trim();
    if (!name) { setGroupMsg(lang === 'ar' ? 'أدخل اسم المجموعة أولاً' : 'Saisissez le nom du groupe'); return; }
    const res = await api.addDocumentGroup(name);
    if (res && res.success === false) { setGroupMsg('Erreur: ' + (res.error || '?')); return; }
    setModalGroupName('');
    setModalNewGroup(false);
    await loadGroups();
    const newId = res?.lastId || null;
    if (newId && editor) setEditor({ ...editor, group_id: newId });
    setGroupMsg(lang === 'ar' ? 'تم تكوين المجموعة ✔' : 'Groupe créé ✔');
  };

  const openNew = () => setEditor({
    title: '', group_id: selectedGroup, notes: '', content: '', file_name: null, mime: null, is_text: 1,
  });

  const openDoc = async (id: number) => {
    const doc = await api.getCompanyDocument(id);
    if (!doc) return;
    setEditor({
      id: doc.id, title: doc.title || '', group_id: doc.group_id || null, notes: doc.notes || '',
      content: doc.content || '', file_name: doc.file_name || null, mime: doc.mime || null,
      is_text: doc.is_text ? 1 : 0,
    });
  };

  const handleImport = async () => {
    const res = await api.openFile({
      filters: [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md', 'png', 'jpg', 'jpeg'] },
        { name: 'Tous les fichiers', extensions: ['*'] },
      ],
    });
    if (!res || res.canceled || !res.filePaths || !res.filePaths.length) return;
    await importPaths(res.filePaths);
  };

  const importPaths = async (filePaths: string[]) => {
    if (!filePaths || !filePaths.length) return;
    setImporting(true);
    setGroupMsg('');
    let ok = 0;
    const errors: string[] = [];
    for (const fp of filePaths) {
      const imported = await api.importDocument(fp);
      if (!imported || !imported.success) { errors.push(imported?.error || fp); continue; }
      const r = await api.addCompanyDocument({
        group_id: selectedGroup || null,
        title: (imported.file_name || 'Document').replace(/\.[^.]+$/, ''),
        content: imported.is_text ? (imported.text || '') : (imported.content || ''),
        notes: '',
        file_name: imported.file_name,
        mime: imported.mime,
        is_text: imported.is_text ? 1 : 0,
      });
      if (r && r.success === false) errors.push(r.error || imported.file_name); else ok++;
    }
    setImporting(false);
    await refreshAll();
    const base = lang === 'ar' ? `${ok} وثيقة/وثائق تم تحميلها` : `${ok} fichier(s) importé(s)`;
    const err = errors.length ? (lang === 'ar' ? ` — فشل ${errors.length}` : ` — ${errors.length} échec(s)`) : '';
    setGroupMsg(base + err);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    const getPath = (f: any): string | null => {
      if (f?.path) return f.path;
      try {
        const el = (window as any).require?.('electron');
        return el?.webUtils?.getPathForFile?.(f) || null;
      } catch { return null; }
    };
    const paths = files.map(getPath).filter((p): p is string => !!p);
    if (paths.length) importPaths(paths);
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaving(true);
    const isText = editor.is_text === 1;
    const content = isText ? (editorRef.current?.innerHTML ?? editor.content) : editor.content;
    const payload = {
      group_id: editor.group_id || null,
      title: editor.title.trim() || 'Sans titre',
      content,
      notes: editor.notes,
    };
    if (editor.id) {
      await api.updateCompanyDocument({ ...payload, id: editor.id });
    } else {
      await api.addCompanyDocument({
        ...payload, file_name: editor.file_name, mime: editor.mime, is_text: isText ? 1 : 0,
      });
    }
    setSaving(false);
    setEditor(null);
    await refreshAll();
  };

  const handleDelete = async () => {
    if (!editor?.id) return;
    if (!window.confirm(lang === 'ar' ? 'حذف هذه الوثيقة نهائيا؟' : 'Supprimer définitivement ce document ?')) return;
    await api.deleteCompanyDocument(editor.id);
    setEditor(null);
    await refreshAll();
  };

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const filtered = docs.filter(d =>
    !search || `${d.title} ${d.file_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const groupName = (id: number | null) => groups.find(g => g.id === id)?.name || (lang === 'ar' ? 'بدون مجموعة' : 'Sans groupe');

  const docIcon = (d: DocMeta | EditorState) => {
    const mime = d.mime || '';
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-purple-500" />;
    if (mime.includes('sheet') || mime.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (d.is_text) return <FileText className="w-5 h-5 text-blue-500" />;
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-title-bar">
          <span className="page-title-accent" />
          <div>
            <h1 className="page-h1">{lang === 'ar' ? 'وثائق الشركة' : 'Documents'}</h1>
            <p className="page-h1-sub">{lang === 'ar' ? 'تحميل وحفظ وقراءة كل وثائق الشركة' : 'Importer, consulter et enregistrer tous les documents'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openNew} className="btn-secondary"><Plus className="w-4 h-4" /> {lang === 'ar' ? 'وثيقة جديدة' : 'Nouveau document'}</button>
          <button onClick={handleImport} disabled={importing} className="btn-primary disabled:opacity-60"><Upload className="w-4 h-4" /> {importing ? (lang === 'ar' ? 'جارٍ التحميل...' : 'Import en cours...') : (lang === 'ar' ? 'تحميل ملفات' : 'Importer des fichiers')}</button>
          <button onClick={refreshAll} className="btn-secondary icon-btn" title="Actualiser"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3">{lang === 'ar' ? 'يمكنك اختيار عدة ملفات دفعة واحدة أو سحبها وإفلاتها هنا' : 'Sélectionnez plusieurs fichiers à la fois ou glissez-déposez-les ici'}</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Groups */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#14305a] to-[#20487c] flex items-center justify-center"><FolderOpen className="w-4 h-4 text-white" /></div>
              <h2 className="text-sm font-semibold text-surface-800 dark:text-slate-100">{lang === 'ar' ? 'المجموعات' : 'Groupes'}</h2>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } }}
                placeholder={lang === 'ar' ? 'مجموعة جديدة...' : 'Nouveau groupe...'}
                className="input-field !py-1.5 text-sm"
              />
              <button onClick={handleAddGroup} type="button" className="btn-primary icon-btn !px-3 flex items-center gap-1 text-xs" title="Ajouter"><FolderPlus className="w-4 h-4" /> {lang === 'ar' ? 'إضافة' : 'Ajouter'}</button>
            </div>
            {groupMsg && <p className={`text-xs mb-3 px-1 ${groupMsg.includes('Erreur') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{groupMsg}</p>}

            <div className="space-y-1">
              <button
                onClick={() => setSelectedGroup(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selectedGroup === null ? 'bg-gradient-to-r from-[#ffe066] to-[#f5a623] text-[#14305a] font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200'}`}
              >
                <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> {lang === 'ar' ? 'كل الوثائق' : 'Tous les documents'}</span>
                <span className="text-xs">{docs.length && selectedGroup === null ? docs.length : (groups.reduce((a, g) => a + (g.count || 0), 0))}</span>
              </button>
              {groups.map(g => (
                renameId === g.id ? (
                  <div key={g.id} className="flex items-center gap-1 px-2 py-1">
                    <input
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmRename(); } if (e.key === 'Escape') setRenameId(null); }}
                      autoFocus
                      className="input-field !py-1 text-sm"
                    />
                    <button onClick={confirmRename} type="button" className="icon-btn text-emerald-600" title="OK"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setRenameId(null)} type="button" className="icon-btn" title="Annuler"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                <div
                  key={g.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer ${selectedGroup === g.id ? 'bg-gradient-to-r from-[#ffe066] to-[#f5a623] text-[#14305a] font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200'}`}
                  onClick={() => setSelectedGroup(g.id)}
                >
                  <span className="flex items-center gap-2 truncate"><FolderOpen className="w-4 h-4 shrink-0" /> <span className="truncate">{g.name}</span></span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-xs mr-1">{g.count || 0}</span>
                    <button onClick={(e) => { e.stopPropagation(); startRename(g); }} type="button" className="opacity-0 group-hover:opacity-100 transition-opacity" title="Renommer"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} type="button" className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
                )
              ))}
            </div>
          </div>
        </div>

        {/* Documents list */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div
            className={`glass-card p-4 transition-colors ${dragOver ? 'ring-2 ring-[#f5a623] bg-amber-50/60 dark:bg-amber-900/10' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={handleDrop}
          >
            {dragOver && <p className="text-center text-sm font-semibold text-[#f5a623] mb-3">{lang === 'ar' ? 'أفلت الملفات هنا لتحميلها' : 'Déposez les fichiers ici pour les importer'}</p>}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث...' : 'Rechercher un document...'}
                  className="input-field !pl-9 text-sm"
                />
              </div>
              <span className="badge badge-info">{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-14 text-slate-400">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{lang === 'ar' ? 'لا توجد وثائق. حمّل ملفا أو أنشئ وثيقة جديدة.' : 'Aucun document. Importez un fichier ou créez-en un.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(d => (
                  <div
                    key={d.id}
                    onClick={() => openDoc(d.id)}
                    className="cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:shadow-premium hover:border-[#f5a623] transition-all bg-white dark:bg-slate-800"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">{docIcon(d)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-800 dark:text-slate-100 truncate">{d.title}</p>
                        <p className="text-xs text-slate-400 truncate">{d.file_name || (lang === 'ar' ? 'وثيقة نصية' : 'Document texte')}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="badge badge-info !text-[10px]">{groupName(d.group_id)}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(d.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor / Viewer modal */}
      {editor && (
        <div className="modal-overlay" onClick={() => setEditor(null)}>
          <div className="modal-content w-full max-w-5xl animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div className="flex items-center gap-2 min-w-0">
                {docIcon(editor)}
                <h3 className="text-base font-semibold text-surface-800 dark:text-slate-100 truncate">
                  {editor.id ? (lang === 'ar' ? 'تعديل وثيقة' : 'Modifier le document') : (lang === 'ar' ? 'وثيقة جديدة' : 'Nouveau document')}
                </h3>
              </div>
              <button onClick={() => setEditor(null)} className="icon-btn"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">{lang === 'ar' ? 'العنوان' : 'Titre'}</label>
                  <input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} className="input-field" placeholder="..." />
                </div>
                <div>
                  <label className="label-field">{lang === 'ar' ? 'المجموعة' : 'Groupe'}</label>
                  <div className="flex gap-2">
                    <select value={editor.group_id ?? ''} onChange={(e) => setEditor({ ...editor, group_id: e.target.value ? parseInt(e.target.value) : null })} className="input-field">
                      <option value="">{lang === 'ar' ? '-- بدون مجموعة --' : '-- Sans groupe --'}</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button
                      onClick={() => setModalNewGroup(true)}
                      type="button"
                      className="btn-secondary shrink-0 !px-3"
                      title={lang === 'ar' ? 'مجموعة جديدة' : 'Nouveau groupe'}
                    >
                      <FolderPlus className="w-4 h-4" /> <span className="hidden sm:inline">{lang === 'ar' ? 'مجموعة جديدة' : 'Nouveau groupe'}</span>
                    </button>
                  </div>
                  {modalNewGroup && (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={modalGroupName}
                        onChange={(e) => setModalGroupName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmModalAddGroup(); } if (e.key === 'Escape') setModalNewGroup(false); }}
                        autoFocus
                        placeholder={lang === 'ar' ? 'اسم المجموعة الجديدة...' : 'Nom du nouveau groupe...'}
                        className="input-field text-sm"
                      />
                      <button onClick={confirmModalAddGroup} type="button" className="btn-primary icon-btn !px-3 flex items-center gap-1 text-xs"><Check className="w-4 h-4" /> {lang === 'ar' ? 'حفظ' : 'OK'}</button>
                      <button onClick={() => setModalNewGroup(false)} type="button" className="btn-secondary icon-btn !px-3"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {editor.is_text === 1 ? (
                <div>
                  <div className="flex flex-wrap items-center gap-1 mb-2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
                    <button onClick={() => exec('bold')} className="toolbar-btn-gold" title="Gras"><Bold className="w-4 h-4" /></button>
                    <button onClick={() => exec('italic')} className="toolbar-btn-gold" title="Italique"><Italic className="w-4 h-4" /></button>
                    <button onClick={() => exec('underline')} className="toolbar-btn-gold" title="Souligné"><Underline className="w-4 h-4" /></button>
                    <span className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                    <button onClick={() => exec('insertUnorderedList')} className="toolbar-btn-gold" title="Liste"><List className="w-4 h-4" /></button>
                    <button onClick={() => exec('insertOrderedList')} className="toolbar-btn-gold" title="Liste numérotée"><ListOrdered className="w-4 h-4" /></button>
                    <span className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                    <button onClick={() => exec('formatBlock', '<h2>')} className="toolbar-btn-gold" title="Titre"><Type className="w-4 h-4" /></button>
                    <button onClick={() => exec('undo')} className="toolbar-btn-gold" title="Annuler"><Undo2 className="w-4 h-4" /></button>
                    <button onClick={() => exec('redo')} className="toolbar-btn-gold" title="Rétablir"><Redo2 className="w-4 h-4" /></button>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[340px] max-h-[55vh] overflow-y-auto p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-surface-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                  />
                </div>
              ) : editor.mime && editor.mime.startsWith('image/') ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900 text-center max-h-[55vh] overflow-auto">
                  <img src={`data:${editor.mime};base64,${editor.content}`} alt={editor.title} className="max-w-full mx-auto" />
                </div>
              ) : editor.mime === 'application/pdf' ? (
                <iframe title="pdf" src={`data:application/pdf;base64,${editor.content}`} className="w-full h-[55vh] rounded-lg border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-slate-500">
                  <FileIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{lang === 'ar' ? 'هذا النوع من الملفات يُحفظ في قاعدة البيانات. افتحه خارجيا للقراءة.' : 'Ce type de fichier est stocké dans la base. Ouvrez-le en externe pour le consulter.'}</p>
                  {editor.id && (
                    <button onClick={() => api.openStoredDocument(editor.id!)} className="btn-secondary mt-4 mx-auto"><ExternalLink className="w-4 h-4" /> {lang === 'ar' ? 'فتح خارجيا' : 'Ouvrir en externe'}</button>
                  )}
                </div>
              )}

              <div>
                <label className="label-field">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} className="input-field min-h-[70px]" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
              <div>
                {editor.file_name && <span className="text-xs text-slate-400">{editor.file_name}</span>}
              </div>
              <div className="flex items-center gap-2">
                {editor.id && (
                  <button onClick={handleDelete} className="icon-btn text-red-500" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                )}
                <button onClick={() => setEditor(null)} className="btn-secondary">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {saving ? '...' : (lang === 'ar' ? 'حفظ' : 'Enregistrer')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
