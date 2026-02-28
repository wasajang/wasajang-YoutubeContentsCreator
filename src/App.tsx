import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import IdeaPage from './pages/IdeaPage';
import StoryboardPage from './pages/StoryboardPage';
import TimelinePage from './pages/TimelinePage';
import CastPage from './pages/CastPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PaymentPage from './pages/PaymentPage';
import NotFoundPage from './pages/NotFoundPage';
import ToastContainer from './components/ToastContainer';
import { useProject } from './hooks/useProject';

/** Supabase ↔ Store 자동 동기화 (게스트 모드에서는 비활성) */
const ProjectSync: React.FC = () => {
  useProject();
  return null;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ProjectSync />
        <NavBar />
        <ToastContainer />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cast" element={<CastPage />} />
            <Route path="/project/idea" element={<IdeaPage />} />
            <Route path="/project/storyboard" element={<StoryboardPage />} />
            <Route path="/project/timeline" element={<TimelinePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
