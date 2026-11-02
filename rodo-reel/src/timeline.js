// One timeline for picture and sound, so every effect lands on its visual beat.
(function () {
  const T = {
    duration: 22,
    fps: 30,

    // Scene 1, hook
    tyreStop: 1.18,
    hookSlam: 1.27,
    screech: [0.5, 1.24],

    // Scene 2, map
    zoom1: [3.14, 3.86],
    zoom2: [4.04, 4.56],
    pins: [4.62, 4.86], // Piravom, then Mulanthuruthy
    mapText: 5.08,

    // Scene 3, brands
    brandHits: [6.22, 6.87, 7.52, 8.17],
    dealerLine: 8.85,
    warrantyLine: 9.15,

    // Scene 4, trust
    counter: [11.2, 12.1],
    counterPow: 1.6,
    yearsPop: 12.12,
    trustLines: [12.6, 13.1],
    badgePop: 13.65,

    // Scene 5, accessories (each flash shows the next item)
    flashes: [15.2, 15.56, 15.92, 16.28],

    // Scene 6, contact
    logoIn: 17.05,
    cards3: [17.75, 18.25, 18.75],
    cards2: [17.85, 18.45],
    cta: 19.45,
    ding: 19.95,
  };

  // Scene boundaries follow the brief: 0-3, 3-6, 6-11, 11-15, 15-17, 17-22.
  T.scenes = [
    { id: 'hook', start: 0, end: 3 },
    { id: 'map', start: 3, end: 6 },
    { id: 'brands', start: 6, end: 11 },
    { id: 'trust', start: 11, end: 15 },
    { id: 'accessories', start: 15, end: 17 },
    { id: 'contact', start: 17, end: 22 },
  ];

  // Every cut has a fast transition (and a whoosh on the sound track).
  T.cuts = [
    { t: 3, type: 'zoomPunch', out: 0.22, in: 0.2 },
    { t: 6, type: 'whip', out: 0.16, in: 0.18 },
    { t: 11, type: 'glitch', out: 0.2, in: 0.2 },
    { t: 15, type: 'tyreWipe', out: 0.24, in: 0.24 },
    { t: 17, type: 'zoomOut', out: 0.26, in: 0.001 },
  ];

  // Value of the year counter at time t, and the moments it ticks over.
  T.counterValue = (t, years) => {
    const u = Math.min(1, Math.max(0, (t - T.counter[0]) / (T.counter[1] - T.counter[0])));
    return years * (1 - Math.pow(1 - u, T.counterPow));
  };
  T.counterTicks = (years) => {
    const out = [];
    for (let k = 1; k <= years; k++) {
      const u = 1 - Math.pow(1 - k / years, 1 / T.counterPow);
      out.push(T.counter[0] + u * (T.counter[1] - T.counter[0]));
    }
    return out;
  };

  T.cardTimes = (n) => (n === 2 ? T.cards2 : T.cards3);

  // Camera shake on every impact: {t, a: amplitude px, d: duration s}
  T.impacts = (cardCount) => [
    { t: T.tyreStop, a: 8, d: 0.25 },
    { t: T.hookSlam, a: 26, d: 0.5 },
    { t: 3.0, a: 10, d: 0.25 },
    ...T.pins.map((t) => ({ t, a: 6, d: 0.22 })),
    { t: T.mapText, a: 12, d: 0.3 },
    ...T.brandHits.map((t) => ({ t, a: 16, d: 0.32 })),
    { t: T.dealerLine, a: 10, d: 0.25 },
    { t: T.warrantyLine, a: 6, d: 0.2 },
    { t: 11.0, a: 8, d: 0.2 },
    { t: T.yearsPop, a: 16, d: 0.35 },
    ...T.trustLines.map((t) => ({ t, a: 7, d: 0.2 })),
    { t: T.badgePop, a: 5, d: 0.2 },
    ...T.flashes.map((t) => ({ t, a: 9, d: 0.2 })),
    ...T.cardTimes(cardCount).map((t) => ({ t, a: 6, d: 0.2 })),
    { t: T.cta, a: 30, d: 0.6 },
  ];

  // Sound effect cues (no music). Types are implemented in audio.js.
  T.sfx = (cardCount, years) => [
    // Scene 1
    { type: 'rumble', t: 0.0, dur: 1.25 },
    { type: 'whoosh', t: 0.32, dur: 0.6, pan: [-0.8, 0.2], f: [250, 1800], gain: 0.45 },
    { type: 'screech', t: T.screech[0], dur: T.screech[1] - T.screech[0] },
    { type: 'thud', t: T.tyreStop, gain: 0.35 },
    { type: 'bassHit', t: T.hookSlam, gain: 1.0 },
    { type: 'impact', t: T.hookSlam, gain: 0.55, pitch: 0.8 },
    { type: 'shimmer', t: T.hookSlam + 0.25, dur: 0.5, gain: 0.14 },
    // Transitions: a whoosh on every cut, peaking on the cut.
    { type: 'whoosh', t: 3.0, dur: 0.5, pan: [0, 0], f: [300, 3200], gain: 1.1 },
    { type: 'thud', t: 3.0, gain: 0.4 },
    { type: 'whoosh', t: 6.0, dur: 0.42, pan: [0.9, -0.9], f: [400, 4000], gain: 1.15 },
    { type: 'whoosh', t: 11.0, dur: 0.45, pan: [-0.5, 0.5], f: [350, 3500], gain: 1.05 },
    { type: 'glitch', t: 10.82, dur: 0.38 },
    { type: 'whoosh', t: 15.0, dur: 0.55, pan: [-0.9, 0.9], f: [200, 2600], gain: 1.15 },
    { type: 'screech', t: 14.92, dur: 0.22, gain: 0.25 },
    { type: 'whoosh', t: 17.0, dur: 0.55, pan: [0, 0], f: [3000, 250], gain: 1.1 },
    // Scene 2
    { type: 'whoosh', t: 3.6, dur: 0.9, pan: [0, 0], f: [150, 1600], gain: 0.75 },
    { type: 'whoosh', t: 4.38, dur: 0.6, pan: [0, 0], f: [250, 2400], gain: 0.75 },
    ...T.pins.map((t, i) => ({ type: 'pop', t, f: i === 0 ? 520 : 640, gain: 0.95 })),
    { type: 'thud', t: T.mapText, gain: 0.45 },
    // Scene 3
    ...T.brandHits.map((t, i) => ({ type: 'impact', t, gain: 0.85, pitch: 1 + i * 0.06 })),
    { type: 'thud', t: T.dealerLine, gain: 0.5 },
    { type: 'ding', t: T.warrantyLine, f: 1568, gain: 0.6 },
    // Scene 4
    ...T.counterTicks(years).map((t, i) => ({ type: 'tick', t, f: 1800 + i * 60 })),
    { type: 'pop', t: T.yearsPop, f: 480, gain: 0.85 },
    { type: 'impact', t: T.yearsPop, gain: 0.5, pitch: 0.9 },
    ...T.trustLines.map((t, i) => ({ type: 'pop', t, f: 560 + i * 90, gain: 0.75 })),
    ...T.trustLines.map((t) => ({ type: 'swish', t: t + 0.05 })),
    { type: 'pop', t: T.badgePop, f: 760, gain: 0.7 },
    { type: 'shimmer', t: 9.45, dur: 0.8 },
    { type: 'shimmer', t: 14.1, dur: 0.5, gain: 0.14 },
    // Scene 5
    ...T.flashes.map((t) => ({ type: 'shutter', t })),
    // Scene 6
    ...T.cardTimes(cardCount).map((t, i) => ({ type: 'pop', t, f: 520 + i * 80, gain: 0.95 })),
    { type: 'riser', t: T.cta - 0.55, dur: 0.55 },
    { type: 'bassDrop', t: T.cta, gain: 1.0 },
    { type: 'impact', t: T.cta, gain: 0.6, pitch: 0.7 },
    { type: 'ding', t: T.ding, f: 1760, gain: 0.7 },
    { type: 'shimmer', t: 20.25, dur: 0.6, gain: 0.14 },
    { type: 'shimmer', t: 20.95, dur: 0.6, gain: 0.14 },
  ];

  window.TL = T;
})();
