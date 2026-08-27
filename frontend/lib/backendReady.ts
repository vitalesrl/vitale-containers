const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

const FAST_CHECK_TIMEOUT_MS = 1200;
const POLL_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 60000;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function healthCheck(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(`${API_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

type WaitForBackendOptions = {
  onWaking?: () => void;
  maxWaitMs?: number;
};

export async function waitForBackendReady(
  options: WaitForBackendOptions = {}
): Promise<boolean> {
  const immediatelyReady = await healthCheck(
    FAST_CHECK_TIMEOUT_MS
  );

  if (immediatelyReady) return true;

  options.onWaking?.();

  const deadline =
    Date.now() + (options.maxWaitMs ?? MAX_WAIT_MS);

  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);

    const ready = await healthCheck(POLL_TIMEOUT_MS);
    if (ready) return true;
  }

  return false;
}
