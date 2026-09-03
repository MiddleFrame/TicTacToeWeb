export type GoogleIdentity = {
  initialize(options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: { type: string; theme: string; size: string; text: string }): void;
};

export function googleIdentity(): GoogleIdentity | undefined {
  return (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
}

let scriptPromise: Promise<void> | null = null;

export function loadGoogle(): Promise<void> {
  if (googleIdentity()) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("google-load-timeout"));
    }, 15_000);
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); reject(new Error("google-load-failed")); };
    document.head.appendChild(script);
  }).catch((error) => { scriptPromise = null; throw error; });
  return scriptPromise;
}
