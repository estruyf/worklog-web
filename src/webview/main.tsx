import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorklogApp } from './WorklogApp';
import { TaskWindow } from './TaskWindow';
import type { WebviewInit } from './protocol';
import './styles.css';

// The host injects boot config (see views/webviewHtml.ts): the dashboard renders
// the full app; a popped-out task tab renders just that task's detail.
const init = (window as unknown as { __WORKLOG_INIT__?: WebviewInit }).__WORKLOG_INIT__;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      {init?.mode === 'task' && init.taskId ? <TaskWindow taskId={init.taskId} /> : <WorklogApp />}
    </React.StrictMode>,
  );
}
