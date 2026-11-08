import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/app.css';
import { AppProvider } from './state/AppContext';
import { App } from './App';
import { wakeBackend } from './lib/api';

// Start waking a sleeping backend (Render free tier) before the user picks a file.
wakeBackend();

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <App />
  </AppProvider>,
);
