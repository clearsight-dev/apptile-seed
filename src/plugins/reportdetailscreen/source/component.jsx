import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Alert, ActivityIndicator, PermissionsAndroid, Platform } from 'react-native';
import { useApptileWindowDims, Icon, navigateToScreen, goBack } from 'apptile-core';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapView, Camera, PointAnnotation } from 'mappls-map-react-native';
import { styles } from './styles';

const SUPABASE_URL = 'https://diaasjjzbtgogqlnondp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYWFzamp6YnRnb2dxbG5vbmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTk4MjMsImV4cCI6MjA3NjE5NTgyM30.Ehb4bUtkteo_7If7znjoURGlVO8EjBozB7Kh2UMIzCI';

export function ReactComponent({ model }) {
  const id = model.get('id');
  const dispatch = useDispatch();
  const { width, height } = useApptileWindowDims();

  // Get photo URI from navigation params or global state
  const appState = useSelector(
    state => state.appModel.values.getIn(['appState', 'value']),
    shallowEqual
  );

  const photoUri = appState?.capturedPhoto || null;
  const currentUser = appState?.currentUser;
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [editingLocation, setEditingLocation] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [detectedSeverity, setDetectedSeverity] = useState(null);
  const [detectingSeverity, setDetectingSeverity] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Clear image cache on mount and when photo changes
  useEffect(() => {
    console.log('[REPORT_DETAIL] Clearing image cache...');

    // Clear all cached images to free memory
    if (Image.clearMemoryCache) {
      Image.clearMemoryCache();
      console.log('[REPORT_DETAIL] ✅ Memory cache cleared');
    }

    if (Image.clearDiskCache) {
      Image.clearDiskCache();
      console.log('[REPORT_DETAIL] ✅ Disk cache cleared');
    }

    console.log('[REPORT_DETAIL] Photo URI:', photoUri);
    console.log('[REPORT_DETAIL] Photo URI type:', typeof photoUri);
    console.log('[REPORT_DETAIL] Photo URI length:', photoUri?.length);
  }, [photoUri]);

  useEffect(() => {
    return () => {
      console.log('[REPORT_DETAIL] Component unmounting, clearing cache...');
      if (Image.clearMemoryCache) {
        Image.clearMemoryCache();
      }
    };
  }, []);

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          console.log('[REPORT_DETAIL] Requesting location permission...');

          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'Pothole Patrol needs access to your location to mark the pothole position.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          console.log('[REPORT_DETAIL] Permission result:', granted);

          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('[REPORT_DETAIL] Location permission denied');
            Alert.alert(
              'Permission Required',
              'Location permission is required to mark pothole location. Please enable it in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                  // You can add Linking.openSettings() here if needed
                }}
              ]
            );
            // Fallback to Bangalore center
            setLocation({ lat: 12.9716, lng: 77.5946 });
            setGettingLocation(false);
            return;
          }
        } else if (Platform.OS === 'ios') {
          console.log('[REPORT_DETAIL] Requesting iOS location permission...');
          // Request iOS location permission
          Geolocation.requestAuthorization('whenInUse');
        }

        // Permission granted, get location
        console.log('[REPORT_DETAIL] Getting current position...');

        Geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ lat: latitude, lng: longitude });
            setGettingLocation(false);
            console.log('[REPORT_DETAIL] Location obtained:', latitude, longitude);

            await reverseGeocodeLocation(latitude, longitude);
          },
          (error) => {
            console.error('[REPORT_DETAIL] Location error:', JSON.stringify(error));

            let errorMessage = 'Could not get your location. ';
            if (error.code === 3) {
              errorMessage += 'Location request timed out. Make sure GPS is enabled and you are outdoors or near a window.';
            } else if (error.code === 1) {
              errorMessage += 'Location permission denied.';
            } else if (error.code === 2) {
              errorMessage += 'Location unavailable. Make sure GPS is enabled.';
            }

            Alert.alert('Location Error', errorMessage);

            // Fallback to Bangalore center
            setLocation({ lat: 12.9716, lng: 77.5946 });
            setGettingLocation(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 30000, // Increased to 30 seconds
            maximumAge: 10000,
            distanceFilter: 10
          }
        );
      } catch (error) {
        console.error('[REPORT_DETAIL] Permission error:', error);
        setLocation({ lat: 12.9716, lng: 77.5946 });
        setGettingLocation(false);
      }
    };

    requestLocationPermission();
  }, []);

  // Reverse geocode coordinates to address using Geoapify API
  const reverseGeocodeLocation = async (latitude, longitude) => {
    setFetchingAddress(true);

    try {
      console.log('[REPORT_DETAIL] 🔍 Reverse geocoding with Geoapify:', latitude, longitude);

      const apiKey = '4ff0a878fb3e474c95a99efaae911879';
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      console.log('[REPORT_DETAIL] Geoapify response:', JSON.stringify(data));

      if (data.features && data.features.length > 0) {
        const place = data.features[0].properties;

        // Build formatted address from components
        const addressParts = [
          place.housenumber,
          place.street,
          place.suburb,
          place.city,
          place.state,
          place.postcode,
          place.country
        ].filter(Boolean); // Remove null/undefined values

        const formattedAddress = place.formatted || addressParts.join(', ');

        console.log('[REPORT_DETAIL] ✅ Address found:', formattedAddress);
        console.log('[REPORT_DETAIL] 📍 Street:', place.street);
        console.log('[REPORT_DETAIL] 🏘️ Suburb:', place.suburb);
        console.log('[REPORT_DETAIL] 🏙️ City:', place.city);
        console.log('[REPORT_DETAIL] 📮 Postcode:', place.postcode);

        // Auto-fill the address field only if user is not editing
        if (!isEditingAddress) {
          setAddress(formattedAddress);
        }

        // Optionally set description with nearby POI or building name
        if (place.name && place.name !== place.street) {
          setDescription(`Near ${place.name}`);
        }

      } else {
        console.log('[REPORT_DETAIL] ⚠️ No address found for coordinates');
        if (!isEditingAddress) {
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      }

    } catch (error) {
      console.error('[REPORT_DETAIL] ❌ Reverse geocode error:', error);
      // Fallback to coordinates
      if (!isEditingAddress) {
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } finally {
      setFetchingAddress(false);
    }
  };

  // Get marker image based on severity
  const getMarkerImage = (severity) => {
    if (!severity) return require('../../../assets/sta.png');

    switch(severity) {
      case 'Stairway to Heaven':
        return require('../../../assets/sth.png');
      case 'The Spine Rattler':
        return require('../../../assets/sta.png');
      case 'Insurance Claimer':
        return require('../../../assets/ic.png');
      default:
        return require('../../../assets/sta.png');
    }
  };

  // Automatically detect severity when photo is available
  useEffect(() => {
    const detectSeverity = async () => {
      if (!photoUri || detectingSeverity || detectedSeverity) {
        return;
      }

      try {
        setDetectingSeverity(true);
        console.log('[REPORT_DETAIL] Auto-detecting severity...');

        const response = await fetch(photoUri);
        const blob = await response.blob();

        const base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        console.log('[REPORT_DETAIL] Image converted to base64, calling Edge Function...');

        const edgeResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/dynamic-handler`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              image: base64Image,
            }),
          }
        );

        if (!edgeResponse.ok) {
          const errorText = await edgeResponse.text();
          console.error('[REPORT_DETAIL] Edge Function error:', errorText);
          throw new Error('Failed to detect severity');
        }

        const result = await edgeResponse.json();
        const severity = result.severity;

        console.log('[REPORT_DETAIL] Detected severity:', severity);
        setDetectedSeverity(severity);
        setDetectingSeverity(false);
      } catch (error) {
        console.error('[REPORT_DETAIL] Severity detection error:', error);
        setDetectingSeverity(false);
        setDetectedSeverity('The Spine Rattler');
      }
    };

    detectSeverity();
  }, [photoUri]);

  const handleSubmit = async () => {
    if (!photoUri) {
      Alert.alert('Error', 'No photo captured');
      return;
    }

    if (!detectedSeverity) {
      Alert.alert('Error', 'Severity detection in progress. Please wait.');
      return;
    }

    if (detectedSeverity === 'No Pothole Detected') {
      Alert.alert('Cannot Submit', 'No pothole was detected in the image. Please retake the photo with a clear view of the pothole.');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    setLoading(true);

    try {
      // Upload to Supabase
      const result = await uploadPotholeReport({
        photoUri,
        latitude: location.lat,
        longitude: location.lng,
        address: address.trim(),
        description: description.trim(),
        userId: currentUser?.id || null,
        deviceId: currentUser?.device_id || null,
        severity: detectedSeverity,
      });

      console.log('[REPORT_DETAIL] Upload result:', result);

      // Store pothole info for points popup
      await AsyncStorage.setItem('lastReportedPotholeId', result.id || 'new');
      await AsyncStorage.setItem('lastReportedSeverity', detectedSeverity);
      await AsyncStorage.setItem('lastReportedAddress', address.trim());

      // Refetch user data to update points
      try {
        const userResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/users?device_id=eq.${currentUser.device_id}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (userResponse.ok) {
          const users = await userResponse.json();
          if (users.length > 0) {
            const updatedUser = users[0];

            // Update AsyncStorage
            await AsyncStorage.setItem('pothole_user', JSON.stringify(updatedUser));

            console.log('[REPORT_DETAIL] User points updated:', updatedUser.total_points);

            // Update Redux state with new user data
            dispatch({
              type: 'PLUGIN_MODEL_UPDATE',
              payload: {
                changesets: [{
                  selector: ['appState', 'value'],
                  newValue: {
                    ...appState,
                    currentUser: updatedUser,
                    capturedPhoto: null,
                  }
                }],
                runOnUpdate: true
              },
            });
          }
        }
      } catch (error) {
        console.error('[REPORT_DETAIL] Failed to update user points:', error);
      }

      // Navigate back to map
      dispatch(navigateToScreen('Home', {}));
    } catch (error) {
      console.error('[REPORT_DETAIL] Submit error:', error);
      Alert.alert('Error', 'Failed to submit report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Clear captured photo from state when going back
    dispatch({
      type: 'PLUGIN_MODEL_UPDATE',
      payload: {
        changesets: [{
          selector: ['appState', 'value'],
          newValue: {
            ...appState,
            capturedPhoto: null,
          }
        }],
        runOnUpdate: true
      },
    });
    dispatch(goBack());
  };

  const handleBack2 = () => {
    goBack();
  }

  const handleEditLocation = () => {
    if (editingLocation) {
      // Cancel editing mode
      setEditingLocation(false);
    } else {
      // Enable editing mode
      setEditingLocation(true);
      Alert.alert(
        'Edit Location',
        'Tap anywhere on the map to set the pothole location.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMapPress = async (event) => {
    if (!editingLocation) return;

    // Get coordinates from map press event
    const { geometry } = event;
    if (geometry && geometry.coordinates) {
      const [lng, lat] = geometry.coordinates;
      setLocation({ lat, lng });
      setEditingLocation(false);
      console.log('[REPORT_DETAIL] Location set to:', lat, lng);

      // Auto-fetch address for new location
      await reverseGeocodeLocation(lat, lng);
    }
  };

  const theme = appState?.theme || 'light';
  const isDark = theme === 'dark';
  const backgroundColor = isDark ? '#231c0f' : '#f8f7f5';
  const cardBackground = isDark ? '#3a3020' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#231c0f';
  const secondaryTextColor = isDark ? '#d0c9b9' : '#6b6456';
  const primaryColor = '#501F16';

  if (gettingLocation) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.container, { width, height, backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: textColor }]}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View nativeID={'rootElement-' + id} style={[styles.container, { width, height, backgroundColor, paddingBottom: 0 }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={[styles.headerTitle, { color: textColor, fontSize: 18, fontWeight: '600' }]}>Report a Pothole</Text>
        <TouchableOpacity onPress={handleBack2} style={{ position: 'center', right: 16}} nativeID="reportdetail-TouchableOpacity-BackButton">
          <Icon iconType="MaterialIcons" name="close" size={25} color={textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {/* Map with Location */}
        {location && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={handleEditLocation}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
                nativeID="reportdetail-TouchableOpacity-EditLocation"
              >
                <Icon
                  iconType="MaterialIcons"
                  name="edit-location"
                  size={18}
                  color="#000000"
                />
                <Text style={{ marginLeft: 4, fontSize: 14, fontWeight: '500', color: '#000000' }}>
                  Edit location
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ borderRadius: 12, overflow: 'hidden', height: 200 }}>
              <MapView
                style={{ flex: 1 }}
                nativeID="reportdetail-MapView-Location"
                onPress={handleMapPress}
              >
                <Camera
                  defaultSettings={{
                    centerCoordinate: [location.lng, location.lat],
                    zoomLevel: 16
                  }}
                />
                <PointAnnotation
                  id="current-location"
                  coordinate={[location.lng, location.lat]}
                  draggable={editingLocation}
                  onDragEnd={async (event) => {
                    if (event.geometry && event.geometry.coordinates) {
                      const [lng, lat] = event.geometry.coordinates;
                      setLocation({ lat, lng });
                      setEditingLocation(false);
                      console.log('[REPORT_DETAIL] Marker dragged to:', lat, lng);

                      // Auto-fetch address for new location
                      await reverseGeocodeLocation(lat, lng);
                    }
                  }}
                >
                  <View style={styles.markerContainer}>
                    <Icon
                      iconType="MaterialIcons"
                      name="location-on"
                      size={40}
                      color="#e74c3c"
                    />
                  </View>
                </PointAnnotation>
              </MapView>
              {editingLocation && (
                <View style={styles.editingOverlay}>
                  <View style={[styles.editingBadge, { backgroundColor: primaryColor }]}>
                    <Icon iconType="MaterialIcons" name="touch-app" size={16} color="#ffffff" />
                    <Text style={styles.editingText}>Tap map or drag marker</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Address Input */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }}>Address</Text>
            {fetchingAddress && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={{ marginLeft: 8, fontSize: 12, color: '#666666' }}>
                  Fetching...
                </Text>
              </View>
            )}
          </View>
          <TextInput
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
              color: '#000000',
              minHeight: 60,
              textAlignVertical: 'top',
            }}
            placeholder="Enter street address or landmark"
            placeholderTextColor="#9ca3af"
            value={address}
            onChangeText={setAddress}
            onFocus={() => setIsEditingAddress(true)}
            onBlur={() => setIsEditingAddress(false)}
            multiline
            numberOfLines={2}
            nativeID="reportdetail-TextInput-Address"
            editable={!fetchingAddress}
          />
        </View>

        {/* Pothole Type Detected Section */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, marginBottom: 12 }}>
            Pothole Type Detected:
          </Text>

          {detectingSeverity ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                padding: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              nativeID="reportdetail-View-DetectingStatus"
            >
              <ActivityIndicator color={primaryColor} size="large" />
              <Text style={{ color: '#666666', fontSize: 14, marginTop: 12 }}>
                Analyzing pothole severity...
              </Text>
            </View>
          ) : detectedSeverity === 'No Pothole Detected' ? (
            <View
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: 12,
                padding: 20,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#F59E0B',
              }}
              nativeID="reportdetail-View-NoPotholeDetected"
            >
              <Icon iconType="MaterialIcons" name="warning" size={48} color="#F59E0B" />
              <Text style={{ color: '#92400E', fontSize: 16, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                No Pothole Detected
              </Text>
              <Text style={{ color: '#92400E', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                The image doesn't appear to contain a pothole. Please capture a clear photo of the pothole.
              </Text>
            </View>
          ) : detectedSeverity ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                overflow: 'hidden',
              }}
              nativeID="reportdetail-View-SeverityResult"
            >
              <Image
                source={getMarkerImage(detectedSeverity)}
                style={{
                  width: '100%',
                  height: 180,
                }}
                resizeMode="cover"
              />
            </View>
          ) : null}
        </View>

        {/* Attachments Section */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, marginBottom: 12 }}>
            Attachments
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {photoUri ? (
              <View style={{ position: 'relative', marginRight: 12 }}>
                <Image
                  key={photoUri}
                  source={{ uri: Platform.OS === 'android' ? `file://${photoUri.replace('file://', '')}` : photoUri }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 8,
                    backgroundColor: '#e5e7eb',
                  }}
                  resizeMode="cover"
                />
                {/* X button to remove photo */}
                <TouchableOpacity
                  onPress={() => {
                    dispatch({
                      type: 'PLUGIN_MODEL_UPDATE',
                      payload: {
                        changesets: [{
                          selector: ['appState', 'value'],
                          newValue: {
                            ...appState,
                            capturedPhoto: null,
                          }
                        }],
                        runOnUpdate: true
                      },
                    });
                    setDetectedSeverity(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    backgroundColor: '#000000',
                    borderRadius: 12,
                    width: 24,
                    height: 24,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  nativeID="reportdetail-TouchableOpacity-RemovePhoto"
                >
                  <Icon iconType="MaterialIcons" name="close" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => (goBack())}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 8,
                  backgroundColor: '#f3f4f6',
                  borderWidth: 2,
                  borderColor: '#d1d5db',
                  borderStyle: 'dashed',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                nativeID="reportdetail-TouchableOpacity-AddPhoto"
              >
                <Icon iconType="MaterialIcons" name="camera-alt" size={32} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={{
            backgroundColor: (detectedSeverity && detectedSeverity !== 'No Pothole Detected') ? primaryColor : '#cccccc',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 20,
            opacity: (detectedSeverity && detectedSeverity !== 'No Pothole Detected') ? 1 : 0.5,
          }}
          onPress={handleSubmit}
          disabled={loading || !detectedSeverity || detectedSeverity === 'No Pothole Detected'}
          nativeID="reportdetail-TouchableOpacity-Submit"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              {(detectedSeverity && detectedSeverity !== 'No Pothole Detected') ? 'Submit' : 'No Pothole Detected'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Supabase Upload Function
async function uploadPotholeReport({ photoUri, latitude, longitude, address, description, userId, deviceId, severity }) {

  // 1. Upload image to Supabase Storage
  const fileName = `pothole_${Date.now()}.jpg`;

  // Read file as blob for React Native
  const response = await fetch(photoUri);
  const blob = await response.blob();

  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/pothole-images/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'image/jpeg',
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('[SUPABASE] Upload error:', errorText);
    throw new Error('Failed to upload image: ' + errorText);
  }

  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/pothole-images/${fileName}`;
  console.log('[SUPABASE] Image uploaded:', imageUrl);

  // 2. Insert pothole data into database
  const potholeData = {
    latitude,
    longitude,
    address,
    description: description || null,
    image_url: imageUrl,
    status: 'verified',
    severity: severity,
    user_id: userId,
    device_id: deviceId,
  };

  console.log('[SUPABASE] Inserting pothole data:', JSON.stringify(potholeData, null, 2));

  const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/potholes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(potholeData),
  });

  console.log('[SUPABASE] DB Response status:', dbResponse.status);

  if (!dbResponse.ok) {
    const errorText = await dbResponse.text();
    console.error('[SUPABASE] DB error:', errorText);
    throw new Error('Failed to save pothole data: ' + errorText);
  }

  const dbData = await dbResponse.json();
  console.log('[SUPABASE] Pothole saved successfully:', JSON.stringify(dbData, null, 2));

  return dbData[0];
}

export const WidgetConfig = {
  primaryColor: '',
  appTitle: '',
};

export const WidgetEditors = [];
export const PropertySettings = [];