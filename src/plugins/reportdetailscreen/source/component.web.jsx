import React, { useState, useEffect } from 'react';
import { useApptileWindowDims, navigateToScreen, goBack } from 'apptile-core';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';

const SUPABASE_URL = 'https://diaasjjzbtgogqlnondp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYWFzamp6YnRnb2dxbG5vbmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTk4MjMsImV4cCI6MjA3NjE5NTgyM30.Ehb4bUtkteo_7If7znjoURGlVO8EjBozB7Kh2UMIzCI';

export function ReactComponent({ model }) {
  const id = model.get('id');
  const { width, height } = useApptileWindowDims();
  const dispatch = useDispatch();

  // Get photo URI from navigation params or global state
  const appState = useSelector(
    state => state.appModel.values.getIn(['appState', 'value']),
    shallowEqual
  );

  const photoUri = appState?.capturedPhoto || null;
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [editingLocation, setEditingLocation] = useState(false);

  // Get current location on mount using browser geolocation API
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
          setGettingLocation(false);
          console.log('[REPORT_DETAIL_WEB] Location:', latitude, longitude);
        },
        (error) => {
          console.error('[REPORT_DETAIL_WEB] Location error:', error);
          alert('Could not get your location. Please enable location access.');
          // Fallback to Bangalore center
          setLocation({ lat: 12.9716, lng: 77.5946 });
          setGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setLocation({ lat: 12.9716, lng: 77.5946 });
      setGettingLocation(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (!photoUri) {
      alert('No photo captured');
      return;
    }

    if (!location) {
      alert('Location not available');
      return;
    }

    if (!address.trim()) {
      alert('Please enter an address');
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
      });

      console.log('[REPORT_DETAIL_WEB] Upload result:', result);

      alert('Pothole report submitted successfully! AI is analyzing the severity.');
      
      // Clear captured photo from state
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
      
      // Navigate back to map
      dispatch(navigateToScreen('MapView', {}));
    } catch (error) {
      console.error('[REPORT_DETAIL_WEB] Submit error:', error);
      alert('Failed to submit report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    dispatch(goBack());
  };

  const handleEditLocation = () => {
    if (editingLocation) {
      // Cancel editing mode
      setEditingLocation(false);
    } else {
      // Enable editing mode
      setEditingLocation(true);
      alert('Click anywhere on the map to set the pothole location.');
    }
  };

  const handleMapClick = (event) => {
    if (!editingLocation) return;

    // For web, we'll use a simple click on the map area
    // In a real implementation with Google Maps/Leaflet, you'd get actual coordinates
    // For now, just show that it's interactive
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple calculation to adjust lat/lng based on click position
    // This is a placeholder - real map libraries handle this properly
    const latOffset = ((rect.height / 2 - y) / rect.height) * 0.01;
    const lngOffset = ((x - rect.width / 2) / rect.width) * 0.01;

    setLocation({
      lat: location.lat + latOffset,
      lng: location.lng + lngOffset,
    });
    setEditingLocation(false);
    console.log('[REPORT_DETAIL_WEB] Location updated');
    alert('Location updated successfully!');
  };

  const theme = appState?.theme || 'light';
  const isDark = theme === 'dark';
  const backgroundColor = isDark ? '#231c0f' : '#f8f7f5';
  const cardBackground = isDark ? '#3a3020' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#231c0f';
  const secondaryTextColor = isDark ? '#d0c9b9' : '#6b6456';
  const primaryColor = '#f9a406';

  const styles = {
    container: {
      width: width + 'px',
      height: height + 'px',
      backgroundColor,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      backgroundColor: cardBackground,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    backButton: {
      width: '40px',
      height: '40px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
    },
    headerTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: textColor,
    },
    scrollView: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
    },
    photoContainer: {
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: cardBackground,
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '12px',
      color: textColor,
    },
    photoPreview: {
      width: '100%',
      height: '250px',
      borderRadius: '8px',
      objectFit: 'cover',
    },
    mapContainer: {
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: cardBackground,
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
    mapHeader: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
    },
    editLocationButton: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: '12px',
      paddingRight: '12px',
      paddingTop: '6px',
      paddingBottom: '6px',
      borderRadius: '6px',
      backgroundColor: editingLocation ? '#6b6456' : primaryColor,
      border: 'none',
      cursor: 'pointer',
      gap: '4px',
    },
    editLocationText: {
      color: '#ffffff',
      fontSize: '12px',
      fontWeight: '600',
      marginLeft: '4px',
    },
    editLocationIcon: {
      fontSize: '16px',
      color: '#ffffff',
    },
    mapWrapper: {
      height: '200px',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '8px',
      backgroundColor: '#e0e0e0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      cursor: editingLocation ? 'crosshair' : 'default',
    },
    mapPlaceholder: {
      color: secondaryTextColor,
      fontSize: '14px',
    },
    marker: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -100%)',
      fontSize: '40px',
      color: editingLocation ? primaryColor : '#e74c3c',
      transition: 'color 0.3s ease',
    },
    editingOverlay: {
      position: 'absolute',
      top: '8px',
      left: '8px',
      right: '8px',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
    },
    editingBadge: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: '12px',
      paddingRight: '12px',
      paddingTop: '8px',
      paddingBottom: '8px',
      borderRadius: '20px',
      backgroundColor: primaryColor,
      gap: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    },
    editingBadgeText: {
      color: '#ffffff',
      fontSize: '13px',
      fontWeight: '600',
      marginLeft: '4px',
    },
    coordinates: {
      fontSize: '12px',
      textAlign: 'center',
      color: secondaryTextColor,
    },
    inputContainer: {
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: cardBackground,
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
    input: {
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: isDark ? '#6b6456' : '#d0c9b9',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '14px',
      minHeight: '50px',
      color: textColor,
      backgroundColor: isDark ? '#2a2418' : '#ffffff',
      fontFamily: 'inherit',
      resize: 'vertical',
      width: '100%',
      boxSizing: 'border-box',
    },
    descriptionInput: {
      minHeight: '100px',
    },
    submitButton: {
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: primaryColor,
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '600',
      border: 'none',
      cursor: loading ? 'not-allowed' : 'pointer',
      marginTop: '8px',
      minHeight: '50px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: loading ? 0.7 : 1,
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
    loadingText: {
      marginTop: '16px',
      fontSize: '16px',
      color: textColor,
    },
    spinner: {
      width: '40px',
      height: '40px',
      border: `4px solid ${isDark ? '#3a3020' : '#f0f0f0'}`,
      borderTop: `4px solid ${primaryColor}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
  };

  if (gettingLocation) {
    return (
      <div id={'rootElement-' + id} style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <div style={styles.loadingText}>Getting your location...</div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div id={'rootElement-' + id} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton} id="reportdetail-button-back">
          <span style={{ fontSize: '24px' }}>←</span>
        </button>
        <div style={styles.headerTitle}>Report Pothole</div>
        <div style={{ width: '40px' }}></div>
      </div>

      <div style={styles.scrollView}>
        {/* Photo Preview */}
        {photoUri && (
          <div style={styles.photoContainer}>
            <div style={styles.sectionTitle}>Captured Photo</div>
            <img src={photoUri} style={styles.photoPreview} alt="Captured pothole" />
          </div>
        )}

        {/* Map with Location */}
        {location && (
          <div style={styles.mapContainer}>
            <div style={styles.mapHeader}>
              <div style={styles.sectionTitle}>Location</div>
              <button
                onClick={handleEditLocation}
                style={styles.editLocationButton}
                id="reportdetail-button-editlocation"
              >
                <span style={styles.editLocationIcon}>
                  {editingLocation ? '✖' : '✏️'}
                </span>
                <span style={styles.editLocationText}>
                  {editingLocation ? 'Cancel' : 'Edit Location'}
                </span>
              </button>
            </div>
            <div style={styles.mapWrapper} onClick={handleMapClick}>
              <div style={styles.mapPlaceholder}>
                {editingLocation ? 'Click to set location' : 'Map Preview'}
              </div>
              <div style={styles.marker}>📍</div>
              {editingLocation && (
                <div style={styles.editingOverlay}>
                  <div style={styles.editingBadge}>
                    <span style={{ fontSize: '16px' }}>👆</span>
                    <span style={styles.editingBadgeText}>Click map to set location</span>
                  </div>
                </div>
              )}
            </div>
            <div style={styles.coordinates}>
              Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
            </div>
          </div>
        )}

        {/* Address Input */}
        <div style={styles.inputContainer}>
          <div style={styles.sectionTitle}>Address *</div>
          <textarea
            style={styles.input}
            placeholder="Enter street address or landmark"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            id="reportdetail-textarea-address"
          />
        </div>

        {/* Description Input */}
        <div style={styles.inputContainer}>
          <div style={styles.sectionTitle}>Description (Optional)</div>
          <textarea
            style={{ ...styles.input, ...styles.descriptionInput }}
            placeholder="Add any additional details about the pothole"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            id="reportdetail-textarea-description"
          />
        </div>

        {/* Submit Button */}
        <button
          style={styles.submitButton}
          onClick={handleSubmit}
          disabled={loading}
          id="reportdetail-button-submit"
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Supabase Upload Function for Web
async function uploadPotholeReport({ photoUri, latitude, longitude, address, description }) {
  // 1. Upload image to Supabase Storage
  const fileName = `pothole_${Date.now()}.jpg`;

  // For web, photoUri is a data URL or blob URL
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
    console.error('[SUPABASE_WEB] Upload error:', errorText);
    throw new Error('Failed to upload image: ' + errorText);
  }

  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/pothole-images/${fileName}`;
  console.log('[SUPABASE_WEB] Image uploaded:', imageUrl);

  // 2. Insert pothole data into database
  const potholeData = {
    latitude,
    longitude,
    address,
    description,
    image_url: imageUrl,
    status: 'pending',
    severity: null,
    created_at: new Date().toISOString(),
  };

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

  if (!dbResponse.ok) {
    const errorText = await dbResponse.text();
    console.error('[SUPABASE_WEB] DB error:', errorText);
    throw new Error('Failed to save pothole data: ' + errorText);
  }

  const dbData = await dbResponse.json();
  console.log('[SUPABASE_WEB] Pothole saved:', dbData);

  // 3. Trigger edge function for AI analysis (async, don't wait)
  fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pothole_id: dbData[0].id,
      image_url: imageUrl,
    }),
  }).catch(err => console.error('[REPORT_DETAIL_WEB] Edge function error:', err));

  return dbData[0];
}

export const WidgetConfig = {
  primaryColor: '',
  appTitle: '',
};

export const WidgetEditors = [];
export const PropertySettings = [];

