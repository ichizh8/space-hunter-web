# iOS build (Capacitor 8)

The iOS app is the same codebase: the Next.js static export (`out/`) is bundled
into the app binary via Capacitor. There is no separate iOS game code.

## Layout

- `capacitor.config.ts` -- appId `com.ichizh.spacehunter`, webDir `out`
- `ios/` -- generated Xcode project (Swift Package Manager, no CocoaPods)
- `.github/workflows/testflight.yml` -- manual CI upload to TestFlight (needs secrets, see file header)

## Local build on a Mac

```bash
npm ci
npm run build          # static export to out/ (no PAGES=1 -- that's only for GitHub Pages)
npx cap sync ios       # copies out/ into ios/App/App/public
npx cap open ios       # opens Xcode
```

In Xcode: select your team under Signing & Capabilities, pick a device or
simulator, Run. For TestFlight: Product -> Archive -> Distribute App.

One-time prerequisites:
- Apple Developer Program membership ($99/yr)
- App record in App Store Connect with bundle id `com.ichizh.spacehunter`

## TestFlight options

1. **Xcode Cloud (recommended for solo dev):** App Store Connect -> Xcode Cloud,
   connect the GitHub repo, build on every push to main. Free 25 h/month,
   no secrets stored in GitHub. Works with a private repo.
2. **GitHub Actions:** run the `TestFlight` workflow manually (Actions tab).
   Requires the three `ASC_*` secrets described in the workflow header.
3. **Manual:** archive from Xcode as above.

Internal testers (up to 100) get builds without Apple review. External testers
require a one-time review of the first build.

## Known constraints (WKWebView), planned for the polish phase

- 60 fps cap (no 120 Hz in webview) -- target a locked 60
- Pin PixiJS to `preference: 'webgl'` (WebGPU is not enabled in WKWebView)
- SFX through a native audio plugin later (Web Audio latency is 500-1000 ms in webview)
- Mirror saves to native storage (`@capacitor/preferences`): iOS can evict
  webview localStorage under disk pressure. Save key: see `src/store/saveStore.ts`
- Add `@capacitor/haptics` + Game Center (`@openforge/capacitor-game-connect`)
  before App Store submission (guideline 4.2 "native polish")
