import type { MetadataRoute } from 'next'

// Lets staff "Add to Home Screen" and open the shop like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Car Shop',
    short_name: 'Car Shop',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f8fb',
    theme_color: '#1f5eff',
    icons: [{ src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
}
