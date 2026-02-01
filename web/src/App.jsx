import './App.css';
import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { reaction } from 'mobx';
import ProjectList from './pages/ProjectList';
import ProjectsQueue from './pages/ProjectsQueue';
import ProjectStats from './pages/ProjectStats';
import Account from './pages/Account';
import MainLayout from './layouts/MainLayout';
import MotivationScreen from './components/MotivationScreen';
import { projectStore } from './stores/ProjectStore';

export default function App() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const checkMotivation = () => {
      const { motivationStart, timerState } = projectStore;
      const isActive = !timerState.paused && timerState.startTime;

      if (isActive) {
        // Timer is running, so user is active. Update the timestamp.
        const now = Date.now();
        // To avoid excessive localStorage writes, only update every few seconds.
        if (!projectStore.motivationStart || now - projectStore.motivationStart > 4000) {
          projectStore.motivationStart = now;
          localStorage.setItem('motivationStart', JSON.stringify(now));
        }
        if (showSplash) {
          setShowSplash(false);
        }
      } else {
        // Timer is not running, check for inactivity.
        if (motivationStart === null) {
          // First time ever.
          setShowSplash(true);
        } else {
          // Check if idle time has passed.
          const IDLE_TIME_LIMIT = 30 * 60 * 1000; // 30 minutes
          if (Date.now() - motivationStart > IDLE_TIME_LIMIT) {
            setShowSplash(true);
          }
        }
      }
    };

    // Run the check immediately on load and then periodically.
    checkMotivation();
    const interval = setInterval(checkMotivation, 5000); // Check every 5 seconds

    let unlisten;
    try {
      unlisten = listen('server-log', (event) => {
        console.log('Server Log:', event.payload);
      });
    } catch (error) {
      console.warn('Tauri listen not available:', error);
    }

    // Cleanup
    return () => {
      clearInterval(interval);
      if (unlisten) {
        unlisten.then(f => f());
      }
    };
  }, [showSplash]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout>
              <ProjectList />
            </MainLayout>
          }
        />
        <Route
          path="/queue"
          element={
            <MainLayout>
              <ProjectsQueue />
            </MainLayout>
          }
        />

        <Route
          path="/archive"
          element={
            <MainLayout>
              <ProjectList isArchive={true} />
            </MainLayout>
          }
        />

        <Route
          path="/stats"
          element={
            <MainLayout>
              <ProjectStats />
            </MainLayout>
          }
        />

        <Route
          path="/account"
          element={
            <MainLayout>
              <Account />
            </MainLayout>
          }
        />
      </Routes>
      {showSplash && <MotivationScreen onClose={() => {
        setShowSplash(false);
        projectStore.motivationStart = Date.now();
        localStorage.setItem('motivationStart', JSON.stringify(Date.now()));
      }} />}
    </Router>
  );
}


/*
export default function App() {
  const [view, setView] = useState('projects');
  const [projects, setProjects] = useState([]);

  const fetchProjects = async () => {
    const res = await fetch(`${apiUrl}/api/projects`);
    const data = await res.json();
    setProjects(data);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar onSelect={setView} />

      <Box sx={{ flexGrow: 1 }}>
        <Box component="main" sx={{ p: 3 }}>
          {view === 'projects' && (
            <ProjectList projects={projects} updateProjects={fetchProjects} />
          )}

          {view === 'tasks' && (
            <ProjectsQueue projects={projects} updateProjects={fetchProjects} />
          )}

          {view === 'archive' && (
            <Typography>Arquivo (coming soon...)</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
*/