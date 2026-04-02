import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MusicProvider } from './context/MusicContext'
import { ToastProvider } from './context/ToastContext'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <MusicProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </MusicProvider>,
)


