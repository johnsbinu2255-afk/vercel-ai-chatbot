// Everything the video says. Edit here, then re-render (see README.md).
window.REEL_CONFIG = {
  hook: { top: 'RODO', bottom: 'TYRES' },

  // Optional: put the real logo at logos/rodo.png and it replaces the wordmark on the end card.
  logo: { word: 'RODO', tagline: 'TYRES & ACCESSORIES', image: 'logos/rodo.png' },

  map: {
    headline: '3 SHOPS',
    subline: 'IN ERNAKULAM',
    pins: [
      { place: 'mulanthuruthy', label: 'MULANTHURUTHY', note: 'TYRES', side: 'left' },
      { place: 'piravom', label: 'PIRAVOM', note: 'TYRES + ACCESSORIES', side: 'right' },
    ],
  },

  // Drop the official logo files into logos/ to replace the name plates.
  brands: [
    { name: 'APOLLO', image: 'logos/apollo.png' },
    { name: 'BRIDGESTONE', image: 'logos/bridgestone.png' },
    { name: 'YOKOHAMA', image: 'logos/yokohama.png' },
    { name: 'JK TYRE', image: 'logos/jk-tyre.png' },
  ],
  brandLines: ['DIRECT DEALER', 'DIRECT WARRANTY'],

  trust: {
    years: 15,
    yearsLabel: 'YEARS',
    lines: ['EXPERIENCED STAFF', 'BEST PRICE'],
    badgeTop: 'BAJAJ FINANCE',
    badge: 'EMI AVAILABLE',
  },

  accessories: {
    title: 'CAR ACCESSORIES',
    subtitle: '& AUDIO UPGRADES',
    items: ['ANDROID SCREENS', 'SUBWOOFERS', 'LED HEADLIGHTS', 'SPEAKERS'],
  },

  // Two layouts for the end card. Pick one with ?contacts=three or ?contacts=merged
  // (render.cjs --contacts=...). "three" is the layout from the brief.
  contacts: {
    three: [
      { icon: 'tyre', label: 'PIRAVOM TYRE SHOP', phone: '9747691237' },
      { icon: 'tyre', label: 'MULANTHURUTHY TYRE SHOP', phone: '9747691237' },
      { icon: 'speaker', label: 'PIRAVOM CAR ACCESSORIES', phone: '6235356776' },
    ],
    merged: [
      { icon: 'tyre', label: 'TYRES · PIRAVOM & MULANTHURUTHY', phone: '9747691237' },
      { icon: 'speaker', label: 'CAR ACCESSORIES · PIRAVOM', phone: '6235356776' },
    ],
  },
  cta: 'VISIT TODAY!',
};
