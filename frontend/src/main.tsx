import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setInitData } from './api/client';
import './styles/global.css';

// Get Telegram init data from the WebApp object
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.initData) {
    setInitData(tg.initData);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
