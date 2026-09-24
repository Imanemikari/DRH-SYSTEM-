import { useState } from 'react';
import { Mail } from 'lucide-react';
import EmailModal from './EmailModal';
import { useLang } from '../context/LangContext';
import { t } from '../utils/translations';
import { isDemo, notifyDemoBlocked } from '../utils/demoGuard';

interface Props {
  prefix: string;
  getHtml: () => string;
  getSheets: () => any[];
  landscape?: boolean;
  onSent?: () => void;
  label?: string;
  className?: string;
}

export default function EmailSendButton({ prefix, getHtml, getSheets, landscape, onSent, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const { lang } = useLang();
  const l = label || t('emailSend', lang);
  return (
    <>
      <button
        onClick={() => { if (isDemo()) { notifyDemoBlocked(); return; } setOpen(true); }}
        className={className || 'tool-action tool-action-mail'}
        title={t('repEmailSend', lang) || l}
      >
        <Mail className="w-4 h-4" /> <span>{l}</span>
      </button>
      {open && (
        <EmailModal
          prefix={prefix}
          getHtml={getHtml}
          getSheets={getSheets}
          landscape={!!landscape}
          onClose={() => setOpen(false)}
          onSent={() => { setOpen(false); onSent?.(); }}
        />
      )}
    </>
  );
}
