import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: { background:'#1f1f1f', color:'#f5f5f5', border:'1px solid #303030', borderRadius:'10px', fontSize:'13px', fontFamily:'Inter,sans-serif' },
          success: { iconTheme: { primary:'#f59e0b', secondary:'#1a1a1a' } },
          error:   { iconTheme: { primary:'#ef4444', secondary:'#1a1a1a' } },
        }}
      />
    </HashRouter>
  </React.StrictMode>
);
