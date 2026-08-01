/**
 * lib/admob.ts
 * ------------------------------------------------------------------
 * Google AdMob Rewarded Ads helper.
 *
 * On the web (v0 preview / browser) there is no native AdMob SDK, so
 * `showRewardedAd()` resolves immediately and the app falls back to the
 * in-app *simulated* video ad (see components/ad-modal.tsx).
 *
 * When you wrap this React app in a WebView and build an Android APK
 * (e.g. with Capacitor + the `@capacitor-community/admob` plugin, or a
 * Cordova AdMob plugin), the plugin injects a global bridge. This helper
 * detects that bridge and shows a REAL rewarded ad instead.
 *
 * ------------------------------------------------------------------
 * Setup for the Android APK build (Capacitor example):
 *
 *   1. npm i @capacitor-community/admob
 *   2. npx cap sync android
 *   3. Add your AdMob App ID to android/app/src/main/AndroidManifest.xml:
 *        <meta-data
 *          android:name="com.google.android.gms.ads.APPLICATION_ID"
 *          android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
 *   4. Replace TEST_REWARDED_AD_UNIT_ID below with your real Ad Unit ID.
 *   5. Initialize once at app start:  await initializeAdMob()
 * ------------------------------------------------------------------
 */

// Google's official TEST rewarded ad unit ID — always safe to use while
// developing. Swap for your production Ad Unit ID before release.
export const TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917'

// Set this to your real production rewarded Ad Unit ID for the APK build.
export const PROD_REWARDED_AD_UNIT_ID = 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ'

export type RewardedAdResult = {
  /** true when the user watched the ad long enough to earn the reward */
  rewarded: boolean
  /** 'admob' for a real native ad, 'simulated' for the web fallback */
  source: 'admob' | 'simulated'
}

type CapacitorAdMobBridge = {
  prepareRewardVideoAd: (opts: { adId: string; isTesting?: boolean }) => Promise<unknown>
  showRewardVideoAd: () => Promise<unknown>
  addListener?: (event: string, cb: (info?: unknown) => void) => { remove: () => void }
}

function getNativeBridge(): CapacitorAdMobBridge | null {
  if (typeof window === 'undefined') return null
  // Capacitor community AdMob plugin registers itself here.
  const cap = (window as any).Capacitor
  const admob = cap?.Plugins?.AdMob ?? (window as any).AdMob
  if (admob && typeof admob.showRewardVideoAd === 'function') {
    return admob as CapacitorAdMobBridge
  }
  return null
}

/** True when running inside the native Android/iOS shell with AdMob available. */
export function isNativeAdMobAvailable(): boolean {
  return getNativeBridge() !== null
}

let initialized = false

/** Call once at app startup. No-op on the web. */
export async function initializeAdMob(useProduction = false): Promise<void> {
  const bridge = getNativeBridge()
  if (!bridge || initialized) return
  try {
    const cap = (window as any).Capacitor
    const AdMob = cap?.Plugins?.AdMob
    if (AdMob?.initialize) {
      await AdMob.initialize({ initializeForTesting: !useProduction })
    }
    initialized = true
  } catch (err) {
    console.log('[v0] AdMob initialize failed, falling back to simulated ads:', err)
  }
}

/**
 * Show a rewarded ad and resolve with the result.
 *
 * On native: loads + shows a real AdMob rewarded ad and resolves once the
 *   SDK fires the reward event (or the ad is dismissed).
 * On web: resolves `{ rewarded: false, source: 'simulated' }` immediately so
 *   the caller knows to render the in-app simulated video ad instead.
 */
export async function showRewardedAd(useProduction = false): Promise<RewardedAdResult> {
  const bridge = getNativeBridge()
  if (!bridge) {
    return { rewarded: false, source: 'simulated' }
  }

  const adId = useProduction ? PROD_REWARDED_AD_UNIT_ID : TEST_REWARDED_AD_UNIT_ID

  return new Promise<RewardedAdResult>(async (resolve) => {
    let earned = false
    let rewardSub: { remove: () => void } | undefined
    let dismissSub: { remove: () => void } | undefined

    const cleanup = () => {
      rewardSub?.remove()
      dismissSub?.remove()
    }

    try {
      rewardSub = bridge.addListener?.('onRewardedVideoAdReward', () => {
        earned = true
      })
      dismissSub = bridge.addListener?.('onRewardedVideoAdClosed', () => {
        cleanup()
        resolve({ rewarded: earned, source: 'admob' })
      })

      await bridge.prepareRewardVideoAd({ adId, isTesting: !useProduction })
      await bridge.showRewardVideoAd()

      // Safety fallback if the dismiss listener never fires.
      setTimeout(() => {
        cleanup()
        resolve({ rewarded: earned, source: 'admob' })
      }, 60_000)
    } catch (err) {
      console.log('[v0] AdMob rewarded ad error, using simulated fallback:', err)
      cleanup()
      resolve({ rewarded: false, source: 'simulated' })
    }
  })
}
