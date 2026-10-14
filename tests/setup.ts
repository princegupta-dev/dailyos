import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement <dialog> modality.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};

/*
 * jsdom replaces the global AbortController/AbortSignal but leaves Node's own Request, and
 * from Node 24 that Request rejects any signal that isn't Node's (React Router builds every
 * navigation as `new Request(url, { signal })`). Build the Request without the foreign signal,
 * then expose that same signal on it, so aborting a navigation still works as in a browser.
 */
const NativeRequest = globalThis.Request;

function nodeAccepts(signal: AbortSignal): boolean {
  try {
    new NativeRequest('http://localhost/', { signal });
    return true;
  } catch {
    return false;
  }
}

class JsdomRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init: RequestInit = {}) {
    const { signal, ...withoutSignal } = init;
    if (!signal || nodeAccepts(signal)) {
      super(input, init);
      return;
    }
    super(input, withoutSignal);
    Object.defineProperty(this, 'signal', { value: signal });
  }
}
globalThis.Request = JsdomRequest;

/*
 * Newer Node versions define their own global localStorage, which shadows jsdom's and is
 * unusable without a backing file. Give tests a plain in-memory Storage instead.
 */
const existing = (globalThis as { localStorage?: Partial<Storage> }).localStorage;
if (typeof existing?.clear !== 'function') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
