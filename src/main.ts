import './app.css'
// Import the font CSS directly to be processed by Vite during build
import 'bpg-square-banner-2013/css/bpg-square-banner-2013.min.css'
// Import maplibre CSS explicitly — svelte-maplibre's internal import
// is not bundled by Vite in production
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './app.svelte'

const app = new App({
  target: document.getElementById('app')!,
})

export default app
