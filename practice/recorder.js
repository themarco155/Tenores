export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
    typeof AudioWorkletNode !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
}

// Llamar dentro del gesto del usuario: el AudioContext se crea antes del primer await.
export async function createRecorder() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const context = new Ctx();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    await context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
  } catch (err) {
    if (stream) stream.getTracks().forEach(t => t.stop());
    context.close();
    throw err;
  }

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'capture-processor');
  const sink = context.createGain();
  sink.gain.value = 0; // mantiene el nodo activo sin devolver el micrófono a los altavoces
  source.connect(node);
  node.connect(sink);
  sink.connect(context.destination);

  let chunks = [], recording = false, level = 0;
  node.port.onmessage = e => {
    const data = e.data;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    level = Math.sqrt(sum / data.length);
    if (recording) chunks.push(data);
  };

  return {
    context,
    get sampleRate() { return context.sampleRate; },
    get level() { return level; },
    start() { chunks = []; recording = true; },
    stop() {
      recording = false;
      const samples = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
      let off = 0;
      for (const c of chunks) { samples.set(c, off); off += c.length; }
      chunks = [];
      return { samples, sampleRate: context.sampleRate };
    },
    dispose() {
      recording = false;
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      sink.disconnect();
      stream.getTracks().forEach(t => t.stop());
      context.close();
    },
  };
}
