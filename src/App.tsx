import { LangProvider } from './context/LangContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import LicenseScreen from './components/LicenseScreen';
import AccessLock from './components/AccessLock';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Departments from './pages/Departments';
import Contracts from './pages/Contracts';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Settings from './pages/Settings';
import Avendant from './pages/Avendant';
import Documents from './pages/Documents';
import Rotation from './pages/Rotation';
import Reports from './pages/Reports';
import PointageDetail from './pages/PointageDetail';
import HeuresSupp from './pages/HeuresSupp';
import AIAssistant from './components/AIAssistant';
import { useState, useEffect } from 'react';
import { api } from './utils/api';
import { isDemo } from './utils/demoGuard';
import { useLang } from './context/LangContext';

type Page = 'dashboard' | 'employees' | 'employee-detail' | 'departments' | 'attendance' | 'leaves' | 'contracts' | 'settings' | 'avendant' | 'documents' | 'rotation' | 'pointage' | 'heures-supp' | 'reports';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [demo, setDemo] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [demoToast, setDemoToast] = useState(false);
  const { theme } = useTheme();
  const { t, lang } = useLang();

  useEffect(() => {
    checkLicense();
  }, []);

  // Demo-mode enforcement: block popup printing, direct printing and Ctrl+P.
  useEffect(() => {
    if (!demo) return;
    (window as any).__DRH_DEMO__ = true;
    const origOpen = window.open.bind(window);
    const origPrint = window.print.bind(window);
    const blockPrint = () => {
      setDemoToast(true);
      window.setTimeout(() => setDemoToast(false), 2600);
    };
    (window as any).open = (...args: any[]) => { blockPrint(); return null; };
    (window as any).print = () => { blockPrint(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); blockPrint(); }
    };
    const onBlocked = () => blockPrint();
    window.addEventListener('keydown', onKey);
    window.addEventListener('demo-blocked', onBlocked);
    return () => {
      (window as any).__DRH_DEMO__ = false;
      (window as any).open = origOpen;
      (window as any).print = origPrint;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('demo-blocked', onBlocked);
    };
  }, [demo]);

  const checkLicense = async () => {
    try {
      const result = await Promise.race([
        api.checkLicense(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
      ]);
      setLicensed(result ? !!result.valid : false);
    } catch {
      setLicensed(false);
    }
  };

  if (!unlocked) {
    return <AccessLock onUnlock={() => setUnlocked(true)} />;
  }

  if (licensed === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
        <div className="text-white text-xl">جاري التحقق...</div>
      </div>
    );
  }

  if (!licensed && !demo) {
    return <LicenseScreen onActivated={() => setLicensed(true)} onDemo={() => setDemo(true)} />;
  }

  const navigateTo = (page: string, employeeId?: number) => {
    if (employeeId) {
      setSelectedEmployeeId(employeeId);
      setCurrentPage('employee-detail');
    } else {
      setSelectedEmployeeId(null);
      setCurrentPage(page as Page);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard navigateTo={navigateTo} onAI={() => setShowAI(true)} />;
      case 'employees':
        return <Employees navigateTo={navigateTo} />;
      case 'employee-detail':
        return <EmployeeDetail employeeId={selectedEmployeeId!} navigateTo={navigateTo} />;
      case 'departments':
        return <Departments navigateTo={navigateTo} />;
      case 'attendance':
        return <Attendance navigateTo={navigateTo} />;
      case 'leaves':
        return <Leaves navigateTo={navigateTo} />;
      case 'contracts':
        return <Contracts navigateTo={navigateTo} />;
      case 'settings':
        return <Settings navigateTo={navigateTo} />;
      case 'avendant':
        return <Avendant navigateTo={navigateTo} />;
      case 'documents':
        return <Documents navigateTo={navigateTo} />;
      case 'reports':
        return <Reports navigateTo={navigateTo} />;
      case 'rotation':
        return <Rotation navigateTo={navigateTo} />;
      case 'pointage':
        return <PointageDetail navigateTo={navigateTo} />;
      case 'heures-supp':
        return <HeuresSupp navigateTo={navigateTo} />;
      default:
        return <Dashboard navigateTo={navigateTo} onAI={() => setShowAI(true)} />;
    }
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden relative ${theme === 'dark' ? 'bg-slate-900' : ''}`}>
      <div className="bg-app" />
      <TitleBar />
      {demo && !licensed && (
        <div className="relative z-20 flex items-center justify-center gap-3 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#7c2d12] via-[#b45309] to-[#7c2d12] border-b border-amber-400/40">
          <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse shrink-0" />
          <span className="tracking-wide">{String(t('demoBanner', lang))}</span>
          <button onClick={() => setShowActivate(true)} className="px-3 py-1 rounded-lg bg-gradient-to-b from-[#ffe066] to-[#f5a623] text-[#14305a] text-xs font-bold shadow hover:brightness-105 active:scale-95 transition-all">
            {String(t('demoActivate', lang))}
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar
          currentPage={currentPage}
          navigateTo={navigateTo}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onAI={() => setShowAI(true)}
        />
        <main className={`flex-1 overflow-y-auto p-6 ${theme === 'dark' ? 'bg-slate-900/80' : ''}`}>
          <div className="animate-fadeIn">
            {renderPage()}
          </div>
        </main>
      </div>
      <div className="watermark-fixed no-print">TOUMI.B</div>
      <AIAssistant open={showAI} onClose={() => setShowAI(false)} />
      {demoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl bg-slate-900/95 border border-amber-400/50 text-amber-200 text-sm font-semibold shadow-2xl animate-scaleIn max-w-[90vw] text-center">
          {String(t('demoBlocked', lang))}
        </div>
      )}
      {showActivate && (
        <LicenseScreen onActivated={() => { setShowActivate(false); setLicensed(true); setDemo(false); }} />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AppContent />
      </LangProvider>
    </ThemeProvider>
  );
}

export default App;
