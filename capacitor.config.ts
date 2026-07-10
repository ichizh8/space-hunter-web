import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ichizh.spacehunter',
  appName: 'Space Hunter',
  // Next.js static export (no basePath in the default build -- PAGES=1 is only for GitHub Pages)
  webDir: 'out',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0a0a14',
    // Game renders its own UI; never show webview scroll artifacts
    scrollEnabled: false,
  },
};

export default config;
