import React, {useEffect, useState} from 'react';
import {
  NativeModules,
  View,
  Image,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  AppState,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  request,
  requestMultiple,
  PERMISSIONS,
  RESULTS,
} from 'react-native-permissions';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {
  apptileNavigationRef,
  ApptileWrapper,
  ApptileAppRoot,
  useStartApptile,
  SentryHelper,
} from 'apptile-core';
import LogRocket from '@logrocket/react-native';

import UpdateModal from './components/UpdateModal';
import AdminPage from './components/AdminPage';
import BuildInfo from './components/BuildInfo';
const {RNApptile} = NativeModules;

const apptileConfig = require('./apptile.config.json');
export type ScreenParams = {
  NocodeRoot: undefined;
  NativeUtils: {appId: string};
  AdminPage: {appId: string};
  BuildInfo: undefined;
};

import {init as initAnalytics} from './analytics';

const Stack = createNativeStackNavigator<ScreenParams>();

// OneSignal (inside initAnalytics) requests its own location permission on
// Android, which races with our geo gate and causes a double dialog.
// Block analytics init until our permission dialog has already been shown and
// dismissed — then OneSignal sees the permission is already decided and stays quiet.
let resolveGeoPermissionDone: (() => void) | null = null;
const geoPermissionDonePromise = new Promise<void>(resolve => {
  resolveGeoPermissionDone = resolve;
});
const deferredAnalytics = async () => {
  await geoPermissionDonePromise;
  return initAnalytics();
};

// react-native-permissions owns the permission dialog.
// Geolocation must never show its own dialog.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
});

// Hardcoded in native layer — cannot be bypassed via OTA JS updates
const GOOGLE_MAPS_API_KEY =
  apptileConfig?.integrations?.googleMaps?.apiKey || '';

const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

// US states where adult-use cannabis is legal as of 2026.
// Update this list in a new native build when new states legalize.
const LEGAL_CANNABIS_STATES = [
  'Alaska',
  'Arizona',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Illinois',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Missouri',
  'Montana',
  'Nevada',
  'New Jersey',
  'New Mexico',
  'New York',
  'Ohio',
  'Oregon',
  'Rhode Island',
  'Vermont',
  'Virginia',
  'Karnataka',
];

const LEGAL_STATES_LOWER = new Set(
  LEGAL_CANNABIS_STATES.map(s => s.toLowerCase()),
);

function getCurrentPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('GPS timed out'));
    }, timeoutMs);

    Geolocation.getCurrentPosition(
      position => {
        clearTimeout(timer);
        resolve(position as unknown as GeolocationPosition);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
      // Low accuracy = faster fix (cell/wifi triangulation, not GPS chip)
      {enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000},
    );
  });
}

async function fetchStateFromCoords(
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<string | null> {
  const url = `${GEOCODING_API_BASE}?latlng=${latitude},${longitude}&result_type=administrative_area_level_1&key=${apiKey}`;
  console.log('[GeoCheck] Geocoding API URL:', url);
  const response = await fetch(url);
  const data = await response.json();
  console.log(
    '[GeoCheck] Geocoding API status:',
    data.status,
    '| results:',
    data.results?.length,
  );
  if (data.status !== 'OK' || !data.results?.length) return null;
  const components: any[] = data.results[0].address_components || [];
  const stateComponent = components.find(c =>
    c.types.includes('administrative_area_level_1'),
  );
  console.log('[GeoCheck] State component:', stateComponent);
  return stateComponent?.long_name ?? null;
}

type GeoCheckStatus =
  | 'pending'
  | 'allowed'
  | 'blocked-permission'
  | 'blocked-state';

// ── Module-level geo state ────────────────────────────────────────────────────
// Survives component remounts caused by useStartApptile finishing analytics.
// 'pending' here means "check is running" (not "not started") — it is set
// synchronously at the top of checkLocationAndState so any remount that happens
// while the async check is in-flight sees a non-null value and skips restarting.
let _geoStatus: GeoCheckStatus | null = null;     // null = not started yet
let _geoDetectedState: string | null = null;
// Points to the currently-mounted component's setters so the async check can
// update whichever instance is alive when it finishes.
let _geoSetStatus: ((s: GeoCheckStatus) => void) | null = null;
let _geoSetDetected: ((s: string | null) => void) | null = null;
let _geoLastCheckTime: number = 0;
let _geoVerifiedAt: string = '';
let _geoSetVerifiedAt: ((s: string) => void) | null = null;

const GEO_RESUME_RECHECK_MS = 2 * 60 * 1000; // re-check on resume after 15 min


function commitGeoResult(
  status: GeoCheckStatus,
  detected: string | null = null,
) {
  _geoStatus = status;
  _geoDetectedState = detected;
  _geoSetStatus?.(status);
  _geoSetDetected?.(detected);
  if (status === 'allowed') {
    const t = new Date();
    const label =
      `${t.getHours().toString().padStart(2, '0')}:` +
      `${t.getMinutes().toString().padStart(2, '0')}:` +
      `${t.getSeconds().toString().padStart(2, '0')}`;
    _geoVerifiedAt = label;
    _geoSetVerifiedAt?.(label);
  }
}

async function checkLocationAndState() {
  const t0 = Date.now();
  console.log('[GeoCheck] ⏱ START');

  let granted = false;
  if (Platform.OS === 'ios') {
    const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log(`[GeoCheck] permission +${Date.now() - t0}ms —`, result);
    granted = result === RESULTS.GRANTED;
  } else {
    const statuses = await requestMultiple([
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
    ]);
    console.log(`[GeoCheck] permission +${Date.now() - t0}ms —`, statuses);
    granted =
      statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED ||
      statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION] === RESULTS.GRANTED;
  }

  resolveGeoPermissionDone?.();

  if (!granted) {
    console.log(`[GeoCheck] permission denied +${Date.now() - t0}ms`);
    commitGeoResult('blocked-permission');
    return;
  }

  console.log(`[GeoCheck] permission granted — GPS +${Date.now() - t0}ms`);
  try {
    const position = await getCurrentPosition(6000);
    const {latitude, longitude} = position.coords;
    console.log(
      `[GeoCheck] GPS fix +${Date.now() - t0}ms —`,
      latitude,
      longitude,
    );

    const state = await fetchStateFromCoords(
      latitude,
      longitude,
      GOOGLE_MAPS_API_KEY,
    );
    console.log(
      `[GeoCheck] geocoding done +${Date.now() - t0}ms — state:`,
      state,
    );

    const isVerified = !!(state && LEGAL_STATES_LOWER.has(state.toLowerCase()));

    if (isVerified) {
      console.log(`[GeoCheck] ALLOWED +${Date.now() - t0}ms`);
      commitGeoResult('allowed');
    } else {
      console.log(`[GeoCheck] BLOCKED +${Date.now() - t0}ms`);
      commitGeoResult('blocked-state', state);
    }
  } catch (error: any) {
    console.warn(
      `[GeoCheck] GPS/geocoding failed +${Date.now() - t0}ms`,
      error,
    );
    commitGeoResult('blocked-state');
  }
  _geoLastCheckTime = Date.now();
}
// ─────────────────────────────────────────────────────────────────────────────

function App(): React.JSX.Element {
  const status = useStartApptile(deferredAnalytics, true);

  const splashPath = apptileConfig?.ios?.splash_path;
  const isGifSplash =
    Platform.OS === 'ios' && splashPath?.toLowerCase().endsWith('.gif');

  const [showSplash, setShowSplash] = useState(isGifSplash);
  // Initialise from module cache so a remount mid-check shows loader,
  // and a remount after completion shows the correct result immediately.
  const [geoCheckStatus, setGeoCheckStatus] = useState<GeoCheckStatus>(
    _geoStatus ?? 'pending',
  );
  const [detectedStateName, setDetectedStateName] = useState<string | null>(
    _geoDetectedState,
  );
const [verifiedAt, setVerifiedAt] = useState(_geoVerifiedAt);

  const gifSplashDuration =
    apptileConfig?.feature_flags?.GIF_SPLASH_DURATION ?? 1;
  const splashDuration =
    typeof gifSplashDuration === 'number' && gifSplashDuration > 0
      ? gifSplashDuration * 1000
      : 1000;

  const getSplashSource = () => {
    try {
      return require('./assets/splash.gif');
    } catch (e) {
      console.warn('splash.gif not found');
      return null;
    }
  };

  const splashSource = getSplashSource();

  useEffect(() => {
    // Register this instance's setters — async check will call these when done.
    _geoSetStatus = setGeoCheckStatus;
    _geoSetDetected = setDetectedStateName;
    _geoSetVerifiedAt = setVerifiedAt;

    // If check already finished while we were unmounted, apply result now.
    if (_geoStatus !== null && _geoStatus !== 'pending') {
      setGeoCheckStatus(_geoStatus);
      setDetectedStateName(_geoDetectedState);
    }

    // Start the check only if it hasn't been kicked off yet.
    if (_geoStatus === null) {
      _geoStatus = 'pending'; // mark immediately — prevents re-entry on remount
      checkLocationAndState();
    }

    return () => {
      _geoSetStatus = null;
      _geoSetDetected = null;
    };
  }, []);

  useEffect(() => {
    SentryHelper.init();
    if (apptileConfig?.feature_flags?.ENABLE_LOGROCKET) {
      LogRocket.init(
        apptileConfig?.integrations?.logrocket?.id ||
          '97heiy/mobile-apps-ur1xt',
        {
          network: {
            requestSanitizer: (req: any) => {
              if (req?.headers['x-auth-token']) {
                req.headers['x-auth-token'] = '';
              }
              return req;
            },
          },
          console: {
            isEnabled: {
              warn: false,
            },
            shouldAggregateConsoleErrors: true,
          },
          redactionTags: ['RedactionString'],
        },
      );
    }
  }, []);

  useEffect(() => {
    RNApptile.notifyJSReady();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        const elapsed = Date.now() - _geoLastCheckTime;
        if (elapsed > GEO_RESUME_RECHECK_MS && _geoStatus !== 'pending') {
          console.log(
            `[GeoCheck] resumed after ${Math.round(
              elapsed / 60000,
            )}min — re-checking`,
          );
          _geoStatus = 'pending';
          _geoSetStatus?.('pending');
          checkLocationAndState();
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isGifSplash) {
      return;
    }
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, splashDuration);

    return () => clearTimeout(timer);
  }, [splashDuration, isGifSplash]);

  // ── Blocking screens ───────────────────────────────────────────────────────

  if (geoCheckStatus === 'pending') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  if (geoCheckStatus === 'blocked-permission') {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedTitle}>Location Access Required</Text>
        <Text style={styles.blockedMessage}>
          Your location is required to confirm that cannabis products are
          legally available in your state. We do not store your location.
        </Text>
        <TouchableOpacity
          style={styles.blockedButton}
          onPress={() => Linking.openSettings()}>
          <Text style={styles.blockedButtonText}>
            Enable Location in Settings
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (geoCheckStatus === 'blocked-state') {
    const stateMessage = detectedStateName
      ? `cannabis products cannot be sold in ${detectedStateName} under current law`
      : `we were unable to verify your location`;
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedTitle}>Not Available in Your Region</Text>
        <Text style={styles.blockedMessage}>
          {`We're sorry — ${stateMessage}. This app is only available in states where adult-use cannabis is legal.`}
        </Text>
        <Text style={styles.blockedSubMessage}>
          If you believe this is an error, please contact support.
        </Text>
      </View>
    );
  }

  // ── geoCheckStatus === 'allowed' → render app ──────────────────────────────

  const body = (
    <NavigationContainer
      ref={apptileNavigationRef}
      theme={{
        ...DefaultTheme,
        colors: status.theme,
      }}
      linking={status.linking}
      onReady={() => {
        RNApptile.notifyJSReady();
      }}>
      <Stack.Navigator
        screenOptions={{
          animation: 'none',
        }}>
        <Stack.Screen
          name="NocodeRoot"
          component={ApptileAppRoot}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="NativeUtils"
          component={UpdateModal}
          options={{headerShown: true}}
          initialParams={{appId: status.appId}}
        />
        <Stack.Screen
          name="AdminPage"
          component={AdminPage}
          options={{headerShown: true}}
          initialParams={{appId: status.appId}}
        />
        <Stack.Screen
          name="BuildInfo"
          component={BuildInfo}
          options={{headerShown: true}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );

  return (
    <ApptileWrapper
      noNavigatePaths={['NativeUtils', 'AdminPage', 'BuildInfo']}
      onNavigationEvent={(ev: any) => {
        console.log('handle navigation event', ev);
        apptileNavigationRef.current.navigate(ev.screenName, {
          appId: status.appId,
        });
      }}>
      {body}
      {verifiedAt ? (
        <View style={styles.verifiedBadge} pointerEvents="none">
          <Text style={styles.verifiedBadgeText}>✓ verified {verifiedAt}</Text>
        </View>
      ) : null}
      {showSplash && splashSource && (
        <View style={styles.splashContainer}>
          <Image
            source={splashSource}
            style={styles.splashImage}
            resizeMode="cover"
          />
        </View>
      )}
    </ApptileWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  blockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  blockedMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  blockedSubMessage: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  blockedButton: {
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  blockedButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 9998,
  },
  verifiedBadgeText: {
    color: '#fff',
    fontSize: 11,
  },
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 9999,
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
});

export default App;
