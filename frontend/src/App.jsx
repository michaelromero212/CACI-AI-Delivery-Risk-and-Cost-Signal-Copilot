import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './index.css';

// Pages
import Dashboard from './pages/Dashboard';
import ProgramDetail from './pages/ProgramDetail';
import NewProgram from './pages/NewProgram';
import CostsDashboard from './pages/CostsDashboard';

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to ||
    (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link to={to} className={isActive ? 'active' : ''}>
      {children}
    </Link>
  );
}

function Header() {
  return (
    <header className="app-header">
      {/* Classification Banner */}
      <div className="header-top">
        UNCLASSIFIED // FOR OFFICIAL USE ONLY
      </div>

      <div className="header-main">
        <div className="header-content">
          <div>
            <div className="header-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              AI Delivery Risk & Cost Signal Copilot
            </div>
            <div className="header-subtitle">Enterprise Solutions Factory Accelerator</div>
          </div>
          <nav className="header-nav">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/costs">Cost Transparency</NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="app-footer">
      CACI International Inc. • ESF AI Accelerator • For Authorized Use Only
    </footer>
  );
}

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/programs/new" element={<NewProgram />} />
            <Route path="/programs/:id" element={<ProgramDetail />} />
            <Route path="/costs" element={<CostsDashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
