type RecoveryLinkListener = (url: string) => void;

let pendingRecoveryUrl: string | null = null;
const listeners = new Set<RecoveryLinkListener>();

export function isPasswordRecoveryLink(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.toLowerCase() === 'reset-password') return true;
    const routePath = parsedUrl.pathname.replace(/^\/--(?=\/)/u, '');
    return routePath === '/reset-password';
  } catch {
    return false;
  }
}

export function publishPasswordRecoveryLink(url: string) {
  pendingRecoveryUrl = url;
  listeners.forEach((listener) => listener(url));
}

export function takePendingPasswordRecoveryLink() {
  const url = pendingRecoveryUrl;
  pendingRecoveryUrl = null;
  return url;
}

export function acknowledgePasswordRecoveryLink(url: string) {
  if (pendingRecoveryUrl === url) pendingRecoveryUrl = null;
}

export function subscribeToPasswordRecoveryLinks(listener: RecoveryLinkListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
