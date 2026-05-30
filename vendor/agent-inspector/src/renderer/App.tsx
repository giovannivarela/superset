import React, { useEffect } from 'react';

import { ConfirmDialog } from './components/common/ConfirmDialog';
import { ContextSwitchOverlay } from './components/common/ContextSwitchOverlay';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TabbedLayout } from './components/layout/TabbedLayout';
import { useTheme } from './hooks/useTheme';
import { api } from './api';
import { initializeNotificationListeners, useStore } from './store';

export const App = (): React.JSX.Element => {
  // Initialize theme on app load
  useTheme();

  // Dismiss splash screen once React is ready
  useEffect(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 300);
    }
  }, []);

  // Initialize context system (before notification listeners)
  useEffect(() => {
    void useStore.getState().initializeContextSystem();
  }, []);

  // Refresh available contexts when SSH connection state changes
  useEffect(() => {
    if (!api.ssh?.onStatus) return;
    const cleanup = api.ssh.onStatus(() => {
      void useStore.getState().fetchAvailableContexts();
    });
    return cleanup;
  }, []);

  // Initialize IPC event listeners (notifications, file changes)
  useEffect(() => {
    const cleanup = initializeNotificationListeners();
    return cleanup;
  }, []);

  // Deep-link: when embedded with ?cwd=<projectPath> (Superset Agent Inspector
  // pane), auto-select the matching project so we skip the project picker.
  useEffect(() => {
    const cwd = new URLSearchParams(window.location.search).get('cwd');
    if (!cwd) return;
    let cancelled = false;
    void (async () => {
      const store = useStore.getState();
      if (store.projects.length === 0) await store.fetchProjects();
      if (cancelled) return;
      const match = useStore.getState().projects.find((p) => p.path === cwd);
      if (match) useStore.getState().selectProject(match.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ErrorBoundary>
      <ContextSwitchOverlay />
      <TabbedLayout />
      <ConfirmDialog />
    </ErrorBoundary>
  );
};
