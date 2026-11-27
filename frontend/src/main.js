import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
const rootEl = document.getElementById('root');
if (!rootEl) {
    document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Root element not found.</p>';
}
else {
    createRoot(rootEl).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
}
