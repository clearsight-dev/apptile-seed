import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image, AppState, PermissionsAndroid, Platform } from 'react-native';
import { useApptileWindowDims, Icon, navigateToScreen, goBack } from 'apptile-core';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapView, Camera, PointAnnotation, Callout } from 'mappls-map-react-native';
import Geolocation from '@react-native-community/geolocation';
import { SvgXml } from 'react-native-svg';
import { styles } from './styles';

// Tile SVG logo
const tileSvg = `<svg width="68" height="26" viewBox="0 0 68 26" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="18.1951" height="18.1951" rx="3.9206" transform="matrix(0.866023 -0.500004 0.866023 0.500004 0.0375977 16.022)" fill="#34363E"/>
<foreignObject x="0.159154" y="-0.681178" width="31.1963" height="19.5577"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(0.91px);clip-path:url(#bgblur_0_199_271_clip_path);height:100%;width:100%"></div></foreignObject><rect data-figma-bg-blur-radius="1.82962" width="18.1951" height="18.1951" rx="3.9206" transform="matrix(0.866023 -0.500004 0.866023 0.500004 0 9.09766)" fill="#1060E0"/>
<path d="M15.4333 6.48852L12.9696 11.5089C12.911 11.6284 13.1465 11.7233 13.3205 11.6504L16.8431 10.1749C16.8976 10.1521 16.9667 10.1445 17.0319 10.154L21.6836 10.8355C21.8969 10.8667 22.0543 10.7218 21.9128 10.6246L15.8247 6.44006C15.7078 6.35971 15.4828 6.38756 15.4333 6.48852Z" fill="black"/>
<path d="M13.9931 4.2318L11.1647 10.9357C11.1135 11.0571 11.3579 11.1468 11.5266 11.0686L16.2839 8.86294C16.3334 8.84 16.3973 8.8301 16.46 8.83564L22.5895 9.37689C22.8043 9.39586 22.9377 9.24623 22.786 9.15635L14.3754 4.1715C14.2512 4.09788 14.0352 4.13194 13.9931 4.2318Z" fill="white"/>
<path d="M39.6551 18.6489C38.7317 18.6489 38.0406 18.3779 37.5819 17.8357C37.1291 17.2876 36.9027 16.4536 36.9027 15.3335V10.4185L37.5998 11.0977H35.4461V9.66786H37.6355L36.9027 10.3649L37.2155 7.19248H38.6453V10.3649L37.9394 9.66786H41.3263V11.0977H37.9394L38.6453 10.4185V15.3157C38.6453 16.0127 38.7466 16.4982 38.9492 16.7723C39.1517 17.0404 39.5092 17.1744 40.0215 17.1744C40.2062 17.1744 40.4207 17.1536 40.665 17.1119C40.9152 17.0702 41.1326 17.0195 41.3173 16.96L41.5139 18.363C41.222 18.4464 40.9122 18.5149 40.5845 18.5685C40.2628 18.6221 39.953 18.6489 39.6551 18.6489ZM43.5639 18.5596V17.1566H45.3423V11.0709H43.6265V9.66786H47.0849V17.1566H48.8543V18.5596H43.5639ZM46.1912 8.26484C45.8695 8.26484 45.5955 8.15165 45.3691 7.92526C45.1427 7.69887 45.0295 7.42482 45.0295 7.10311C45.0295 6.78736 45.1427 6.51629 45.3691 6.2899C45.5955 6.06351 45.8695 5.95032 46.1912 5.95032C46.5129 5.95032 46.784 6.06351 47.0044 6.2899C47.2308 6.51629 47.344 6.78736 47.344 7.10311C47.344 7.42482 47.2308 7.69887 47.0044 7.92526C46.784 8.15165 46.5129 8.26484 46.1912 8.26484ZM50.8417 18.5596V17.1566H52.7988V7.82696H50.9043V6.42395H54.5414V17.1566H56.4895V18.5596H50.8417ZM62.409 18.6668C61.1579 18.6668 60.1928 18.2974 59.5136 17.5587C58.8404 16.814 58.5038 15.6612 58.5038 14.1003C58.5038 13.2841 58.6021 12.5871 58.7987 12.0092C58.9953 11.4313 59.2664 10.9607 59.6119 10.5972C59.9634 10.2279 60.3685 9.95978 60.8273 9.79297C61.2919 9.6202 61.7894 9.53381 62.3196 9.53381C63.0107 9.53381 63.6094 9.68275 64.1158 9.98063C64.6282 10.2726 65.0244 10.6955 65.3044 11.2496C65.5844 11.8037 65.7244 12.4679 65.7244 13.2424C65.7244 13.3794 65.7184 13.5731 65.7065 13.8233C65.7006 14.0735 65.6827 14.3297 65.6529 14.5918H59.6387L60.2553 14.0467C60.2315 14.8986 60.3149 15.5569 60.5055 16.0216C60.7021 16.4804 60.9732 16.7991 61.3188 16.9778C61.6643 17.1566 62.0545 17.2459 62.4894 17.2459C62.9601 17.2459 63.389 17.1923 63.7763 17.0851C64.1635 16.9719 64.5686 16.817 64.9916 16.6204L65.5635 17.8804C65.1227 18.1306 64.6222 18.3242 64.0622 18.4613C63.5082 18.5983 62.9571 18.6668 62.409 18.6668ZM64.0712 14.1897V13.4926C64.1248 12.6764 63.9967 12.036 63.6869 11.5713C63.3831 11.1007 62.9184 10.8653 62.2928 10.8653C61.5779 10.8653 61.0417 11.1334 60.6843 11.6696C60.3328 12.2058 60.1898 12.9594 60.2553 13.9305L59.6387 13.448H64.6073L64.0712 14.1897Z" fill="#1A1D20"/>
<defs>
<clipPath id="bgblur_0_199_271_clip_path" transform="translate(-0.159154 0.681178)"><rect width="18.1951" height="18.1951" rx="3.9206" transform="matrix(0.866023 -0.500004 0.866023 0.500004 0 9.09766)"/>
</clipPath></defs>
</svg>`;

const SUPABASE_URL = 'https://diaasjjzbtgogqlnondp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYWFzamp6YnRnb2dxbG5vbmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTk4MjMsImV4cCI6MjA3NjE5NTgyM30.Ehb4bUtkteo_7If7znjoURGlVO8EjBozB7Kh2UMIzCI';

export function ReactComponent({ model }) {
  const id = model.get('id');
  const dispatch = useDispatch();
  const { width: windowWidth, height: windowHeight } = useApptileWindowDims();
  const cameraRef = useRef(null);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [dynamicPotholes, setDynamicPotholes] = useState([]);
  const [loadingPotholes, setLoadingPotholes] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 12.9716, lng: 77.5946 }); // Default to Bangalore
  const [gettingLocation, setGettingLocation] = useState(true);
  const [showPointsPopup, setShowPointsPopup] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [mapKey, setMapKey] = useState(0); // Key to force map remount on refresh

  const appState = useSelector(
    state => state.appModel.values.getIn(['appState', 'value']),
    shallowEqual
  );

  const theme = appState?.theme || 'light';
  const currentUser = appState?.currentUser;

  const fetchPotholes = async () => {
    try {
      setLoadingPotholes(true);
      console.log('[MAPVIEW] Fetching potholes from Supabase...');
      console.log('[MAPVIEW] URL:', `${SUPABASE_URL}/rest/v1/potholes?select=*`);

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/potholes?select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );

      console.log('[MAPVIEW] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MAPVIEW] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('[MAPVIEW] Fetched potholes count:', data.length);
      console.log('[MAPVIEW] Raw data:', JSON.stringify(data, null, 2));

      // Transform database records to match your pothole format
      const transformedPotholes = data.map((pothole) => ({
        id: pothole.id,
        lat: pothole.latitude,
        lng: pothole.longitude,
        severity: pothole.severity || 'The Spine Rattler',
        description: pothole.description || pothole.address || 'Pothole reported',
        address: pothole.address || 'Unknown location',
        imageUrl: pothole.image_url,
        status: pothole.status || 'pending',
        createdAt: pothole.created_at,
      }));

      console.log('[MAPVIEW] Transformed potholes:', JSON.stringify(transformedPotholes, null, 2));
      setDynamicPotholes(transformedPotholes);
      setLoadingPotholes(false);
    } catch (error) {
      console.error('[MAPVIEW] Error fetching potholes:', error);
      console.error('[MAPVIEW] Error details:', error.message);
      setLoadingPotholes(false);
    }
  };

  useEffect(() => {
    console.log('[MAPVIEW] Clearing image cache...');
    if (Image.clearMemoryCache) {
      Image.clearMemoryCache();
      console.log('[MAPVIEW] ✅ Memory cache cleared');
    }

    fetchPotholes();

    return () => {
      //clearInterval(interval);
      // Clear cache on unmount
      if (Image.clearMemoryCache) {
        Image.clearMemoryCache();
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[MAPVIEW] App became active, refetching potholes...');

        // Check if user just submitted a pothole
        const lastReportedId = await AsyncStorage.getItem('lastReportedPotholeId');
        const lastReportedSeverity = await AsyncStorage.getItem('lastReportedSeverity');

        await fetchPotholes();

        // Show points popup if there's a new pothole
        if (lastReportedId && lastReportedSeverity) {
          const points = lastReportedSeverity === 'Insurance Claimer' ? 10 :
                        lastReportedSeverity === 'The Spine Rattler' ? 20 : 30;
          setEarnedPoints(points);
          setShowPointsPopup(true);

          // Clear the flags
          await AsyncStorage.removeItem('lastReportedPotholeId');
          await AsyncStorage.removeItem('lastReportedSeverity');
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Also refetch when capturedPhoto changes (indicates user came back from report submission)
  const capturedPhoto = appState?.capturedPhoto;
  const prevCapturedPhotoRef = useRef(capturedPhoto);

  useEffect(() => {
    // If capturedPhoto was cleared (user submitted or cancelled), refetch once
    if (prevCapturedPhotoRef.current && !capturedPhoto) {
      console.log('[MAPVIEW] User returned from report screen, refetching...');

      // Check if user just submitted a pothole and show popup
      const checkForPopup = async () => {
        const lastReportedId = await AsyncStorage.getItem('lastReportedPotholeId');
        const lastReportedSeverity = await AsyncStorage.getItem('lastReportedSeverity');

        await fetchPotholes();

        // Show points popup if there's a new pothole
        if (lastReportedId && lastReportedSeverity) {
          console.log('[MAPVIEW] 🎉 Showing points popup for:', lastReportedSeverity);
          const points = lastReportedSeverity === 'Insurance Claimer' ? 10 :
                        lastReportedSeverity === 'The Spine Rattler' ? 20 : 30;
          setEarnedPoints(points);
          setShowPointsPopup(true);

          // Clear the flags
          await AsyncStorage.removeItem('lastReportedPotholeId');
          await AsyncStorage.removeItem('lastReportedSeverity');
        }
      };

      checkForPopup();
    }
    prevCapturedPhotoRef.current = capturedPhoto;
  }, [capturedPhoto]);

  // Fetch user's actual location
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          console.log('[MAPVIEW] Requesting location permission...');

          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'PotFix needs access to your location to show nearby potholes.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          console.log('[MAPVIEW] Permission result:', granted);

          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('[MAPVIEW] Location permission denied, using default location');
            setGettingLocation(false);
            return;
          }
        }

        // Permission granted, get location
        console.log('[MAPVIEW] Getting current position...');

        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            setGettingLocation(false);
            console.log('[MAPVIEW] Location obtained:', latitude, longitude);
          },
          (error) => {
            console.error('[MAPVIEW] Location error:', JSON.stringify(error));
            console.log('[MAPVIEW] Using default Bangalore location');
            setGettingLocation(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      } catch (error) {
        console.error('[MAPVIEW] Permission error:', error);
        setGettingLocation(false);
      }
    };

    requestLocationPermission();
  }, []);

  // Use only dynamic potholes from database
  const potholes = dynamicPotholes;

  // Debug: Log potholes
  console.log('[MAPVIEW] Total potholes from database:', potholes.length);
  console.log('[MAPVIEW] User location:', userLocation);

  const initialZoomLevel = 12;
  const zoomLevelRef = useRef(initialZoomLevel);
  
  // Theme colors
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#231c0f' : '#f8f7f5';
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const cardBg = isDark ? '#3a3020' : '#ffffff';
  const primaryColor = '#501F16';
  const secondaryColor = '#2E8B57';

  // Get marker image based on severity
  const getMarkerImage = (severity) => {
    switch(severity) {
      case 'Stairway to Heaven':
        return require('../../../assets/heaven.png');
      case 'The Spine Rattler':
        return require('../../../assets/spinerattler.png');
      case 'Insurance Claimer':
        return require('../../../assets/insuranceclaimer.png');
      default:
        return require('../../../assets/heaven.png');
    }
  };

  // Get emoji based on severity
  const getSeverityEmoji = (severity) => {
    switch(severity) {
      case 'Stairway to Heaven':
        return '😰';
      case 'The Spine Rattler':
        return '😑';
      case 'Insurance Claimer':
        return '😠';
      default:
        return '😱';
    }
  };



  const handleZoomIn = () => {
    console.log('[APPTILE_AGENT] Zoom in button pressed');
    console.log('[APPTILE_AGENT] Camera ref exists:', !!cameraRef.current);
    console.log('[APPTILE_AGENT] Current zoom level:', zoomLevelRef.current);

    const newZoom = Math.min(zoomLevelRef.current + 1, 18);
    zoomLevelRef.current = newZoom;

    if (cameraRef.current) {
      cameraRef.current.zoomTo(newZoom, 300);
      console.log('[APPTILE_AGENT] Zooming to:', newZoom);
    } else {
      console.log('[APPTILE_AGENT] ERROR: Camera ref is null!');
    }
  };

  const handleZoomOut = () => {
    console.log('[APPTILE_AGENT] Zoom out button pressed');
    console.log('[APPTILE_AGENT] Camera ref exists:', !!cameraRef.current);
    console.log('[APPTILE_AGENT] Current zoom level:', zoomLevelRef.current);

    const newZoom = Math.max(zoomLevelRef.current - 1, 4);
    zoomLevelRef.current = newZoom;

    if (cameraRef.current) {
      cameraRef.current.zoomTo(newZoom, 300);
      console.log('[APPTILE_AGENT] Zooming to:', newZoom);
    } else {
      console.log('[APPTILE_AGENT] ERROR: Camera ref is null!');
    }
  };

  const handleMyLocation = () => {
    // Convert lat/lng to [lng, lat] format for Mappls
    cameraRef.current?.flyTo([userLocation.lng, userLocation.lat], 1000);
  };
  
  const handleReportPothole = () => {
    dispatch(navigateToScreen('Camera', {}));
  };
  
  const handleLeaderboardPress = () => {
    dispatch(navigateToScreen('Leaderboard', {}));
  };

  const handleUserReportsPress = () => {
    dispatch(navigateToScreen('UserReports', {}));
  };

  const handleRefresh = async () => {
    setLoadingPotholes(true);

    // Clear all states to reset the map
    setSelectedPothole(null);
    setDynamicPotholes([]);

    // Clear image cache before fetching
    if (Image.clearMemoryCache) {
      Image.clearMemoryCache();
      console.log('[MAPVIEW] ✅ Cache cleared before refresh');
    }

    // Force map remount by changing key
    setMapKey(prevKey => prevKey + 1);


    // Small delay to ensure clean state reset
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fetch potholes
    await fetchPotholes();

    // Refetch user data to update points
    if (currentUser?.device_id) {
      try {
        console.log('[MAPVIEW] Refetching user data...');
        const userResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/users?device_id=eq.${currentUser.device_id}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        );

        if (userResponse.ok) {
          const users = await userResponse.json();
          if (users.length > 0) {
            const updatedUser = users[0];

            // Update AsyncStorage
            await AsyncStorage.setItem('pothole_user', JSON.stringify(updatedUser));

            // Update Redux state with new user data
            dispatch({
              type: 'PLUGIN_MODEL_UPDATE',
              payload: {
                changesets: [{
                  selector: ['appState', 'value'],
                  newValue: {
                    ...appState,
                    currentUser: updatedUser,
                  }
                }],
                runOnUpdate: true
              },
            });

            console.log('[MAPVIEW] ✅ User points updated:', updatedUser.total_points);
          }
        }
      } catch (error) {
        console.error('[MAPVIEW] Failed to update user points:', error);
      }
    }

    // Reset camera to user location
    if (cameraRef.current) {
      setTimeout(() => {
        cameraRef.current?.flyTo([userLocation.lng, userLocation.lat], 1000);
        console.log('[MAPVIEW] ✅ Camera reset to user location');
      }, 300);
    }

    console.log('[MAPVIEW] ✅ Full refresh complete');
  };
  
  return (
    <View
      nativeID={'rootElement-' + id}
      style={[styles.container, { 
        width: windowWidth, 
        height: windowHeight,
        backgroundColor: bgColor
      }]}
    >
      {/* Mappls Map */}
      <MapView
        key={`mapview-${mapKey}`}
        nativeID={'mapview-MapView-Main'}
        onMapError={error => console.log('[APPTILE_AGENT] Map Error:', error.code, error.message)}
        style={styles.mapBackground}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [userLocation.lng, userLocation.lat],
            zoomLevel: initialZoomLevel
          }}
        />

        {/* Pothole Markers */}
        {potholes.map((pothole) => {
          console.log('[MAPVIEW] Rendering marker:', pothole.id, 'at', [pothole.lng, pothole.lat]);
          console.log('[MAPVIEW] Image URL:', pothole.imageUrl);
          return (
            <PointAnnotation
              key={pothole.id}
              id={`marker-${pothole.id}`}
              nativeID={`mapview-PointAnnotation-${pothole.id}`}
              coordinate={[pothole.lng, pothole.lat]}
              title={pothole.description}
              snippet={`Severity: ${pothole.severity}`}
              anchor={{ x: 0.5, y: 0.5 }}
              selected={selectedPothole === pothole.id}
              onSelected={() => {
                console.log('[APPTILE_AGENT] Marker selected:', pothole.id);
                setSelectedPothole(pothole.id);
              }}
              onDeselected={() => {
                console.log('[APPTILE_AGENT] Marker deselected:', pothole.id);
                setSelectedPothole(null);
              }}
            >
              <View
                style={{
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <Image
                  source={getMarkerImage(pothole.severity)}
                  style={{
                    width: 40,
                    height: 40,
                  }}
                  resizeMode="contain"
                />
              </View>

              {/* Custom Callout */}
              <Callout
                style={{
                  backgroundColor: 'transparent',
                }}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: 8,
                  padding: 0,
                  width: 360,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <View style={{ width: 360 }}>
                  {/* Pothole Image */}
                  <View style={{ position: 'relative' }}>
                    {pothole.imageUrl ? (
                      <Image
                        key={`${pothole.id}-img`}
                        source={{ uri: pothole.imageUrl }}
                        style={{
                          width: 360,
                          height: 220,
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          backgroundColor: '#e5e7eb',
                        }}
                        resizeMode="cover"
                        progressiveRenderingEnabled={true}
                        fadeDuration={200}
                        onLoadStart={() => {
                          console.log('[MAPVIEW] 🔄 Loading image:', pothole.imageUrl);
                        }}
                        onLoad={() => {
                          console.log('[MAPVIEW] ✅ Image loaded successfully');
                        }}
                        onError={(error) => {
                          console.error('[MAPVIEW] ❌ Image load error:', error.nativeEvent?.error);
                          console.error('[MAPVIEW] Failed URL:', pothole.imageUrl);
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 360,
                          height: 220,
                          backgroundColor: '#e5e7eb',
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>
                          📷 No Image
                        </Text>
                      </View>
                    )}

                    {/* Severity Badge Overlay on Image */}
                    <View
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{getSeverityEmoji(pothole.severity)}</Text>
                      <Text style={{ color: '#1f2937', fontSize: 13, fontWeight: '600' }}>
                        {pothole.severity || 'Unknown'}
                      </Text>
                    </View>
                    {/* Coordinates Badge Overlay on Image */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        right: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#374151', fontWeight: '600', textAlign: 'center' }}>
                        Latitude: {pothole.lat.toFixed(4)}° N, Longitude: {pothole.lng.toFixed(4)}° E
                      </Text>
                    </View>
                  </View>

                  {/* Address Section */}
                  <View style={{ padding: 16, backgroundColor: '#ffffff', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>
                      Address:
                    </Text>
                    <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>
                      {pothole.address || pothole.description || 'No address provided'}
                    </Text>
                  </View>
                </View>
              </Callout>
            </PointAnnotation>
          );
        })}

        {/* User Location Marker */}
        <PointAnnotation
          id="user-location"
          nativeID={'mapview-PointAnnotation-UserLocation'}
          coordinate={[userLocation.lng, userLocation.lat]}
          title="Your Location"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#3b82f6',
              borderWidth: 3,
              borderColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#3b82f6',
                opacity: 0.2,
                position: 'absolute',
                marginLeft: -13,
                marginTop: -13,
              }}
            />
          </View>
        </PointAnnotation>
      </MapView>
      
      {/* Top App Bar */}
      <View 
        nativeID={'mapview-View-AppBar'}
        style={[styles.appBar, { backgroundColor: isDark ? '#3a3020dd' : '#ffffffdd' }]}
      >
        <View style={styles.appBarLeft}>
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
          />
          <Text 
            nativeID={'mapview-Text-AppTitle'}
            style={[styles.appTitle, { color: primaryColor }]}
          >
            PotFix
          </Text>
        </View>
        <Pressable
          nativeID={'mapview-Pressable-PointsButton'}
          style={[styles.pointsButton, { backgroundColor: isDark ? '#4a4030' : '#f3f4f6' }]}
          onPress={handleLeaderboardPress}
        >
          <Image
            source={require('../../../assets/coins.png')}
            style={styles.coinsImage}
            resizeMode="contain"
          />
          <Text style={[styles.pointsText, { color: secondaryColor }]}>
            {currentUser?.total_points || 0} pts
          </Text>
        </Pressable>
      </View>
      
      {/* Map Controls */}
      <View
        nativeID={'mapview-View-MapControls'}
        style={styles.mapControls}
      >
        <Pressable
          nativeID={'mapview-Pressable-ZoomIn'}
          style={[styles.controlButton, { backgroundColor: cardBg }]}
          onPress={handleZoomIn}
        >
          <Icon
            nativeID={'mapview-Icon-ZoomIn'}
            iconType="Ionicons"
            name="add"
            size={20}
            color={textColor}
          />
        </Pressable>

        <Pressable
          nativeID={'mapview-Pressable-ZoomOut'}
          style={[styles.controlButton, { backgroundColor: cardBg }]}
          onPress={handleZoomOut}
        >
          <Icon
            nativeID={'mapview-Icon-ZoomOut'}
            iconType="Ionicons"
            name="remove"
            size={20}
            color={textColor}
          />
        </Pressable>

        <Pressable
          nativeID={'mapview-Pressable-MyLocation'}
          style={[styles.controlButton, { backgroundColor: cardBg }]}
          onPress={handleMyLocation}
        >
          <Icon
            nativeID={'mapview-Icon-MyLocation'}
            iconType="Ionicons"
            name="locate"
            size={20}
            color={primaryColor}
          />
        </Pressable>

        <Pressable
          nativeID={'mapview-Pressable-Refresh'}
          style={[styles.controlButton, { backgroundColor: cardBg }]}
          onPress={handleRefresh}
          disabled={loadingPotholes}
        >
          {loadingPotholes ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Icon
              nativeID={'mapview-Icon-Refresh'}
              iconType="Ionicons"
              name="refresh"
              size={20}
              color={primaryColor}
            />
          )}
        </Pressable>
      </View>
      
      {/* Menu Button - Bottom Right */}
      <Pressable
        nativeID={'mapview-Pressable-MenuButton'}
        style={[styles.menuButton, { backgroundColor: cardBg }]}
        onPress={handleUserReportsPress}
      >
        <Icon
          nativeID={'mapview-Icon-Menu'}
          iconType="Ionicons"
          name="list-outline"
          size={20}
          color={textColor}
        />
      </Pressable>

      {/* Powered by Tile Logo - Bottom Left */}
      <View
        nativeID={'mapview-View-PoweredByTile'}
        style={{
          position: 'absolute',
          bottom: 100,
          left: 16,
          backgroundColor: '#ffffff',
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderRadius: 6,
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            color: '#6b7280',
            fontWeight: '500',
          }}
        >
          Powered by
        </Text>
        <SvgXml
          xml={tileSvg}
          width={40}
          height={16}
        />
      </View>

      {/* FAB Button */}
      <View
        nativeID={'mapview-View-FABContainer'}
        style={styles.fabContainer}
      >
        <Pressable
          nativeID={'mapview-Pressable-ReportButton'}
          style={[styles.fab, { backgroundColor: primaryColor }]}
          onPress={handleReportPothole}
        >
          <Icon
            nativeID={'mapview-Icon-Camera'}
            iconType="Ionicons"
            name="camera-outline"
            size={24}
            color="#ffffff"
          />
          <Text
            nativeID={'mapview-Text-ReportButtonText'}
            style={styles.fabText}
          >
            Report a Pothole
          </Text>
        </Pressable>
      </View>

      {/* Points Celebration Popup */}
      {showPointsPopup && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          nativeID="mapview-View-PopupOverlay"
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              padding: 24,
              width: 300,
              alignItems: 'center',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            nativeID="mapview-View-PopupContainer"
          >
            {/* Close Button */}
            <Pressable
              onPress={() => setShowPointsPopup(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#f3f4f6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              nativeID="mapview-Pressable-ClosePopup"
            >
              <Icon iconType="MaterialIcons" name="close" size={20} color="#6b7280" />
            </Pressable>

            {/* Coins Image */}
            <Image
              source={require('../../../assets/coins.png')}
              style={{ width: 80, height: 80, marginBottom: 16 }}
              resizeMode="contain"
            />

            {/* Points Text */}
            <Text
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: '#059669',
                marginBottom: 16,
              }}
            >
              +{earnedPoints} Points
            </Text>

            {/* Message */}
            <Text
              style={{
                fontSize: 16,
                color: '#374151',
                textAlign: 'center',
                marginBottom: 24,
                lineHeight: 22,
              }}
            >
              You have added a new pothole on the map!
            </Text>

            {/* Donate Button */}
            {/* <Pressable
              style={{
                backgroundColor: '#501F16',
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 8,
                width: '100%',
                alignItems: 'center',
                marginBottom: 8,
              }}
              nativeID="mapview-Pressable-Donate"
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                Donate
              </Text>
            </Pressable> */}

            {/* Donate Info */}
            {/* <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon iconType="MaterialIcons" name="info-outline" size={14} color="#6b7280" />
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                Donate to amplify community voices
              </Text>
            </View> */}
          </View>
        </View>
      )}
    </View>
  );
}

export const WidgetConfig = {
  primaryColor: '',
  appTitle: '',
};

export const WidgetEditors = {
  basic: [
    {
      targets: ['mapview-Text-AppTitle'],
      type: 'codeInput',
      name: 'appTitle',
      props: {
        label: 'App Title'
      }
    },
    {
      targets: ['mapview-Pressable-ReportButton'],
      type: 'colorInput',
      name: 'primaryColor',
      props: {
        label: 'Primary Color'
      }
    },
  ],
};

export const PropertySettings = {};
