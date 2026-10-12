import { analyze } from './analyze.js';

self.onmessage = e => {
  try {
    self.postMessage({ ok: true, result: analyze(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
