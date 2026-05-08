import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// iOS Safari ignores user-scalable=no — block pinch-to-zoom via JS instead.
// Multi-touch during an active video stream causes a GPU memory spike that
// crashes the tab, so we prevent it unconditionally on this app.
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
