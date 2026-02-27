import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import IdeaPage from './pages/IdeaPage';
import StoryboardPage from './pages/StoryboardPage';
import TimelinePage from './pages/TimelinePage';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NavBar />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/project/new" element={<IdeaPage />} />
            <Route path="/project/idea" element={<IdeaPage />} />
            <Route path="/project/script" element={<IdeaPage />} />
            <Route path="/project/style" element={<IdeaPage />} />
            <Route path="/project/storyboard" element={<StoryboardPage />} />
            <Route path="/project/timeline" element={<TimelinePage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
