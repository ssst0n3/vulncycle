const DEBUG_STORAGE_KEY = 'vci_debug_logs';

function isDevEnvironment(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function isDebugFlagEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function shouldLogDebug(): boolean {
  return isDevEnvironment() || isDebugFlagEnabled();
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (!shouldLogDebug()) {
      return;
    }
    console.debug('[VCI]', ...args);
  },
  info: (...args: unknown[]): void => {
    console.info('[VCI]', ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn('[VCI]', ...args);
  },
  error: (...args: unknown[]): void => {
    console.error('[VCI]', ...args);
  },
  enableDebugLogging: (): void => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(DEBUG_STORAGE_KEY, 'true');
    } catch {
      // noop
    }
  },
  disableDebugLogging: (): void => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(DEBUG_STORAGE_KEY);
    } catch {
      // noop
    }
  },
  isDebugLoggingEnabled: (): boolean => {
    return shouldLogDebug();
  },
};
