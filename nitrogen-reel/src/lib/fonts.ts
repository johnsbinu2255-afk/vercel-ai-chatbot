import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

const faces = [
  { family: 'Bebas Neue', file: 'fonts/BebasNeue-Regular.woff2', weight: '400' },
  { family: 'Montserrat', file: 'fonts/Montserrat-600.woff2', weight: '600' },
  { family: 'Montserrat', file: 'fonts/Montserrat-700.woff2', weight: '700' },
  { family: 'Montserrat', file: 'fonts/Montserrat-800.woff2', weight: '800' },
  { family: 'Montserrat', file: 'fonts/Montserrat-900.woff2', weight: '900' },
];

for (const f of faces) {
  loadFont({ family: f.family, url: staticFile(f.file), weight: f.weight });
}
