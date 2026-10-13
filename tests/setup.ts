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

afterEach(() => {
  cleanup();
});
