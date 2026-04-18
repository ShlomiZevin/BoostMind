import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Apply saved theme
const savedTheme = localStorage.getItem('workout-theme') || 'dark';
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark');
  document.body.classList.remove('bg-slate-950', 'text-slate-100');
  document.body.classList.add('bg-slate-50', 'text-slate-900');
} else {
  document.documentElement.classList.add('dark');
  document.body.classList.add('bg-slate-950', 'text-slate-100');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/workout-app/sw.js').catch(() => {});
  });
}
