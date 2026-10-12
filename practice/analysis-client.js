let worker = null;

export function runAnalysis(input) {
  if (!worker) worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    const cleanup = () => { w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); };
    const onMessage = e => { cleanup(); e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)); };
    const onError = e => { cleanup(); w.terminate(); if (worker === w) worker = null; reject(new Error(e.message || 'Error del analizador')); };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage(input, [input.samples.buffer]);
  });
}
