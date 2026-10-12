let worker = null;
let nextId = 1;
const pending = new Map();

function createWorker() {
  const w = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
  w.addEventListener('message', e => {
    const p = pending.get(e.data && e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error));
  });
  w.addEventListener('error', e => {
    w.terminate();
    if (worker === w) worker = null;
    const all = [...pending.values()];
    pending.clear();
    for (const p of all) p.reject(new Error((e && e.message) || 'Error del analizador'));
  });
  return w;
}

export function runAnalysis(input) {
  if (!worker) worker = createWorker();
  const w = worker;
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      w.postMessage({ id, input }, [input.samples.buffer]);
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}
