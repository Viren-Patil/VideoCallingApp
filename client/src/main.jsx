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

// --app-height tracks the actual visible viewport height, excluding all browser
// chrome (Android Chrome toolbar, iOS Safari address bar, etc.).
// window.visualViewport.height updates dynamically as toolbars show/hide,
// unlike 100vh/100dvh which can lag or be inaccurate on some browsers.
function updateAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}
updateAppHeight();
window.visualViewport?.addEventListener('resize', updateAppHeight);
window.addEventListener('resize', updateAppHeight);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
