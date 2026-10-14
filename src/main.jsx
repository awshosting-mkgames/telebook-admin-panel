import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// Bootstrap for CSS only — its JavaScript is deliberately not loaded.
//
//  Modals and the off-canvas sidebar are written in React. Bootstrap's JS
//  mutates the DOM on its own and so does React; with both on the same node
//  they fight, and the modal stops closing. So: styling from Bootstrap only.
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles.css';

import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ToastProvider } from './ui/Toast.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* HashRouter on purpose: the panel can be served from any folder with
        no server-side rewrite rule. */}
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
);
