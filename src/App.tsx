import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import IdeaPage from './pages/IdeaPage';
import StoryboardPage from './pages/StoryboardPage';
import GeneratePage from './pages/GeneratePage';
import TimelinePage from './pages/TimelinePage';
import CastPage from './pages/CastPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PaymentPage from './pages/PaymentPage';
import TemplateBlueprintPage from './pages/TemplateBlueprintPage';
import NotFoundPage from './pages/NotFoundPage';
import ToastContainer from './components/ToastContainer';
import SceneCardSample from './components/SceneCardSample';
import MainLayout from './components/MainLayout';
import { useProject } from './hooks/useProject';

/** Supabase ↔ Store 자동 동기화 (게스트 모드에서는 비활성) */
const ProjectSync: React.FC = () => {
  useProject();
  return null;
};

/** 047: MainLayout 사용 라우트에서는 NavBar 숨기기 */
const ConditionalNavBar: React.FC = () => {
  const { pathname } = useLocation();
  // MainLayout을 사용하는 라우트 목록
  const layoutRoutes = ['/sample'];
  const hideNavBar = layoutRoutes.some(r => pathname.startsWith(r));
  if (hideNavBar) return null;
  return <NavBar />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ProjectSync />
        <ConditionalNavBar />
        <ToastContainer />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cast" element={<CastPage />} />
            <Route path="/project/idea" element={<IdeaPage />} />
            <Route path="/project/storyboard" element={<StoryboardPage />} />
            <Route path="/project/generate" element={<GeneratePage />} />
            <Route path="/project/timeline" element={<TimelinePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/templates/blueprint" element={<TemplateBlueprintPage />} />
            <Route path="/templates/blueprint/:id" element={<TemplateBlueprintPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/sample" element={
              <MainLayout>
                <SceneCardSample />
              </MainLayout>
            } />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
