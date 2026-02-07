interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  ready: () => void;
  expand: () => void;
  close: () => void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
