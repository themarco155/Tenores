// Único lugar con umbrales y pesos. Calibrar aquí con grabaciones reales.
export const SCORING = {
  // El ritmo (timing de las entradas) se calcula y se muestra, pero no cuenta en la nota (peso 0).
  weights: { pitch: 0.5, rhythm: 0, stability: 0.2 },
  pitchCents: [20, 100],     // lin(|desviación|): 100 pts → 0 pts
  rhythmMs: [80, 400],
  stabilityCents: [15, 60],
  octaveCents: 600,
  coreStartFrames: 5,        // 50 ms de ataque excluidos
  coreEndFrames: 3,          // 30 ms finales excluidos
  longNoteFrames: 40,        // núcleo ≥ 400 ms para estabilidad
  voicedRatio: 0.5,          // nota "cantada"
  minCoverage: 0.5,          // por debajo, intento no válido
  fullCoverage: 0.9,         // por debajo, el total se reduce en proporción
  guideLatencyMs: 150,       // latencia máxima compensada en modo guía
  guideBandFrames: 100,      // ±1 s
  testBandRatio: 0.15,       // ±15 % de la longitud
  testBandMinFrames: 100,
  tips: { max: 3, biasCents: 25, entryMs: 150, driftCents: 20, driftNotes: 2, missedCoverage: 0.6, praiseTotal: 90 },
};

export function bandFor(mode, refFrames) {
  return mode === 'guide'
    ? SCORING.guideBandFrames
    : Math.max(SCORING.testBandMinFrames, Math.round(refFrames * SCORING.testBandRatio));
}
