import { LangProvider } from './context/LangContext';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Departments from './pages/Departments';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import Settings from './pages/Settings';
import Avendant from './pages/Avendant';
import AIAssistant from './components/AIAssistant';
import { useState } from 'react';

type Page = 'dashboard' | 'employees' | 'employee-detail' | 'departments' | 'attendance' | 'leaves' | 'payroll' | 'settings' | 'avendant';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAI, setShowAI] = useState(false);

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
      case 'payroll':
        return <Payroll navigateTo={navigateTo} />;
      case 'settings':
        return <Settings navigateTo={navigateTo} />;
      case 'avendant':
        return <Avendant navigateTo={navigateTo} />;
      default:
        return <Dashboard navigateTo={navigateTo} onAI={() => setShowAI(true)} />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <div className="bg-app" />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar
          currentPage={currentPage}
          navigateTo={navigateTo}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onAI={() => setShowAI(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-fadeIn">
            {renderPage()}
          </div>
        </main>
      </div>
      <div className="watermark-fixed no-print">TOUMI.B</div>
      <AIAssistant open={showAI} onClose={() => setShowAI(false)} />
    </div>
  );
}

function App() {
  return (
    <LangProvider>
      <AppContent />
    </LangProvider>
  );
}

export default App;
