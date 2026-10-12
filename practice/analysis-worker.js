import { analyze } from './analyze.js';

self.onmessage = e => {
  const { id, input } = e.data;
  try {
    self.postMessage({ id, ok: true, result: analyze(input) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
