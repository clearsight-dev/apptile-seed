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
  Icon,
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

// Only initialise analytics (and OneSignal's notification prompt) after the
// user has passed geo verification. Blocked users never see the prompt.
let resolveGeoAllowed: (() => void) | null = null;
const geoAllowedPromise = new Promise<void>(resolve => {
  resolveGeoAllowed = resolve;
});
const deferredAnalytics = async () => {
  await geoAllowedPromise;
  return initAnalytics();
};

// react-native-permissions owns the permission dialog.
// Geolocation must never show its own dialog.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
});

const GOOGLE_MAPS_API_KEY = RNApptile?.GOOGLE_MAPS_API_KEY || '';

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
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(url, {signal: controller.signal});
  } finally {
    clearTimeout(fetchTimeout);
  }
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
// Points to the currently-mounted component's setters so the async check can
// update whichever instance is alive when it finishes.
let _geoSetStatus: ((s: GeoCheckStatus) => void) | null = null;
let _geoSetDetected: ((s: string | null) => void) | null = null;
let _geoLastCheckTime: number = 0;

const GEO_RESUME_RECHECK_MS = 2 * 60 * 1000; // re-check on resume after 15 min
const GEO_ACCENT = '#4ECDC4';


function commitGeoResult(
  status: GeoCheckStatus,
  detected: string | null = null,
) {
  _geoStatus = status;
  _geoSetStatus?.(status);
  _geoSetDetected?.(detected);
  if (status === 'allowed') {
    resolveGeoAllowed?.();
  }
}

async function checkLocationAndState() {
  const t0 = Date.now();
  console.log('[GeoCheck] ⏱ START');
  try {
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
        statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
          RESULTS.GRANTED ||
        statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION] ===
          RESULTS.GRANTED;
    }

    if (!granted) {
      console.log(`[GeoCheck] permission denied +${Date.now() - t0}ms`);
      commitGeoResult('blocked-permission');
      return;
    }

    console.log(`[GeoCheck] permission granted — GPS +${Date.now() - t0}ms`);
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
    console.warn(`[GeoCheck] check failed +${Date.now() - t0}ms`, error);
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
  // Always start as pending — we re-run the check on every mount.
  // Module cache (_geoStatus) is only used to prevent a second check when
  // a React remount happens while a check is already in-flight.
  const [geoCheckStatus, setGeoCheckStatus] =
    useState<GeoCheckStatus>('pending');
  const [detectedStateName, setDetectedStateName] = useState<string | null>(
    null,
  );
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

    // Always re-run the check on mount so every app launch fetches fresh location.
    // Only skip if a check is already in-flight (React remount during async check).
    if (_geoStatus !== 'pending') {
      _geoStatus = 'pending';
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
        <ActivityIndicator size="large" color={GEO_ACCENT} />
        <Text style={styles.fetchingLabel}>FETCHING YOUR LOCATION..</Text>
      </View>
    );
  }

  if (geoCheckStatus === 'blocked-permission') {
    return (
      <View style={styles.blockedContainer}>
        <View style={[styles.iconBubble, styles.iconBubbleAccent]}>
          <Icon iconType="Octicons" name="location" style={styles.iconAccent} />
        </View>
        <Text style={styles.blockedTitle}>LOCATION ACCESS REQUIRED</Text>
        <Text style={styles.blockedMessage}>
          Your location is required to confirm that cannabis products are
          legally available in your state. We do not store your location.
        </Text>
        <TouchableOpacity
          style={styles.blockedButton}
          onPress={() => Linking.openSettings()}>
          <Text style={styles.blockedButtonText}>ENABLE LOCATION</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (geoCheckStatus === 'blocked-state') {
    const stateMsg = detectedStateName
      ? `cannabis products cannot be sold in ${detectedStateName} under current law`
      : `we were unable to verify your location`;
    return (
      <View style={styles.blockedContainer}>
        <View style={[styles.iconBubble, styles.iconBubbleGray]}>
          <Icon
            iconType="MaterialIcons"
            name="location-disabled"
            style={styles.iconGray}
          />
        </View>
        <Text style={styles.blockedTitle}>NOT AVAILABLE IN YOUR REGION</Text>
        <Text style={styles.blockedMessage}>
          {`We are sorry — ${stateMsg}. This app is only available in states where adult-use cannabis is legal.`}
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
  fetchingLabel: {
    marginTop: 20,
    fontFamily: 'Oswald',
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 35.73,
    textTransform: 'uppercase',
    color: '#282828',
  },
  iconBubble: {
    width: 84,
    height: 84,
    borderRadius: 100,
    padding: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBubbleAccent: {
    backgroundColor: 'rgba(160, 232, 241, 0.20)',
  },
  iconBubbleGray: {
    backgroundColor: 'rgba(40, 40, 40, 0.04)',
  },
  iconAccent: {
    fontSize: 36,
    color: '#A0E8F1',
  },
  iconGray: {
    fontSize: 36,
    color: '#282828',
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  blockedTitle: {
    fontFamily: 'Oswald',
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 24,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#282828',
    marginBottom: 12,
    letterSpacing: 0,
  },
  blockedMessage: {
    fontFamily: 'Questrial',
    fontWeight: 500,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: '#282828',
    marginBottom: 28,
  },
  blockedSubMessage: {
    fontSize: 13,
    color: '#282828',
    textAlign: 'center',
  },
  blockedButton: {
    backgroundColor: '#A0E8F1',
    borderRadius: 100,
    paddingVertical: 17,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedButtonText: {
    fontFamily: 'Oswald',
    fontWeight: 700,
    fontSize: 14,
    textTransform: 'uppercase',
    color: '#282828',
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
