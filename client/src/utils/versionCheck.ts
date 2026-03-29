const CURRENT_VERSION: string = __APP_VERSION__;
const POLL_INTERVAL = 15_000;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startVersionCheck(onNewVersion: () => void): void {
  if (intervalId) return;

  intervalId = setInterval(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== CURRENT_VERSION) {
        onNewVersion();
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    } catch {
      // ignore fetch errors
    }
  }, POLL_INTERVAL);
}

export function getClientVersion(): string {
  return CURRENT_VERSION;
}
