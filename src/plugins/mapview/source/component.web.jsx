import React, { useState, useRef, useEffect } from 'react';
import { useApptileWindowDims, Icon, navigateToScreen } from 'apptile-core';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';

export function ReactComponent({ model }) {
  const id = model.get('id');
  const dispatch = useDispatch();
  const { width: windowWidth, height: windowHeight } = useApptileWindowDims();
  const mapRef = useRef(null);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [map, setMap] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(12);

  // Access global appState plugin
  const appState = useSelector(
    state => state.appModel.values.getIn(['appState', 'value']),
    shallowEqual
  );

  const theme = appState?.theme || 'light';

  // Sample pothole data with locations across Bangalore
  const samplePotholes = [
    // Central Bangalore (MG Road, Brigade Road area)
    { id: 1, lat: 12.9716, lng: 77.5946, severity: 'severe', description: 'Large pothole on MG Road' },
    { id: 2, lat: 12.9726, lng: 77.5956, severity: 'moderate', description: 'Medium pothole near Brigade Road' },
    { id: 3, lat: 12.9706, lng: 77.5936, severity: 'minor', description: 'Small pothole on Church Street' },

    // Koramangala area
    { id: 4, lat: 12.9352, lng: 77.6245, severity: 'severe', description: 'Deep pothole on 80 Feet Road' },
    { id: 5, lat: 12.9279, lng: 77.6271, severity: 'moderate', description: 'Pothole near Sony Signal' },
    { id: 6, lat: 12.9308, lng: 77.6195, severity: 'minor', description: 'Small crack on 5th Block' },

    // Indiranagar area
    { id: 7, lat: 12.9784, lng: 77.6408, severity: 'severe', description: 'Large pothole on 100 Feet Road' },
    { id: 8, lat: 12.9716, lng: 77.6412, severity: 'moderate', description: 'Pothole near CMH Road' },
    { id: 9, lat: 12.9698, lng: 77.6389, severity: 'minor', description: 'Small pothole on 12th Main' },

    // Whitefield area
    { id: 10, lat: 12.9698, lng: 77.7499, severity: 'severe', description: 'Deep pothole on ITPL Main Road' },
    { id: 11, lat: 12.9780, lng: 77.7380, severity: 'moderate', description: 'Pothole near Whitefield Station' },
    { id: 12, lat: 12.9634, lng: 77.7421, severity: 'minor', description: 'Small crack on Varthur Road' },

    // Jayanagar area
    { id: 13, lat: 12.9250, lng: 77.5838, severity: 'severe', description: 'Large pothole on 4th Block' },
    { id: 14, lat: 12.9165, lng: 77.5905, severity: 'moderate', description: 'Pothole near Jayanagar Shopping Complex' },
    { id: 15, lat: 12.9298, lng: 77.5920, severity: 'minor', description: 'Small pothole on 9th Block' },

    // Malleshwaram area
    { id: 16, lat: 13.0067, lng: 77.5703, severity: 'severe', description: 'Deep pothole on Sampige Road' },
    { id: 17, lat: 13.0015, lng: 77.5750, severity: 'moderate', description: 'Pothole near Mantri Square' },
    { id: 18, lat: 13.0089, lng: 77.5680, severity: 'minor', description: 'Small crack on 8th Cross' },

    // Electronic City area
    { id: 19, lat: 12.8456, lng: 77.6603, severity: 'severe', description: 'Large pothole on Hosur Road' },
    { id: 20, lat: 12.8398, lng: 77.6789, severity: 'moderate', description: 'Pothole near Infosys Gate' },
    { id: 21, lat: 12.8512, lng: 77.6512, severity: 'minor', description: 'Small pothole on Phase 1' },

    // Hebbal area
    { id: 22, lat: 13.0358, lng: 77.5970, severity: 'severe', description: 'Deep pothole on Outer Ring Road' },
    { id: 23, lat: 13.0289, lng: 77.5912, severity: 'moderate', description: 'Pothole near Hebbal Flyover' },
    { id: 24, lat: 13.0412, lng: 77.6034, severity: 'minor', description: 'Small crack on Bellary Road' },

    // BTM Layout area
    { id: 25, lat: 12.9165, lng: 77.6101, severity: 'severe', description: 'Large pothole on BTM 2nd Stage' },
    { id: 26, lat: 12.9089, lng: 77.6189, severity: 'moderate', description: 'Pothole near Udupi Garden' },
    { id: 27, lat: 12.9234, lng: 77.6045, severity: 'minor', description: 'Small pothole on 1st Stage' },

    // HSR Layout area
    { id: 28, lat: 12.9116, lng: 77.6473, severity: 'severe', description: 'Deep pothole on 27th Main Road' },
    { id: 29, lat: 12.9067, lng: 77.6389, severity: 'moderate', description: 'Pothole near Sector 1' },
    { id: 30, lat: 12.9189, lng: 77.6512, severity: 'minor', description: 'Small crack on Sector 2' },
  ];

  const potholes = samplePotholes;

  // Theme colors
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1a1a1a' : '#f5f5f5';
  const cardBg = isDark ? '#2a2a2a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const secondaryText = isDark ? '#cccccc' : '#666666';

  // Severity colors
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'severe':
        return '#ef4444';
      case 'moderate':
        return '#f59e0b';
      case 'minor':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  // Initialize map (using Google Maps or Leaflet)
  useEffect(() => {
    // For web, you would initialize a map library here
    // This is a placeholder - you'll need to add actual map library
    console.log('[MAP] Map initialized for web');
  }, []);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 1, 18));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 1, 1));
  };

  const handleMyLocation = () => {
    console.log('[MAP] My location pressed');
  };

  const handleReportPothole = () => {
    dispatch(navigateToScreen('Camera', {}));
  };

  const handleProfilePress = () => {
    dispatch(navigateToScreen('Profile', {}));
  };

  return (
    <div
      id={'rootElement-' + id}
      style={{
        width: windowWidth,
        height: windowHeight,
        backgroundColor: bgColor,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Map Container - Placeholder for actual map */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#e5e7eb',
          position: 'relative',
        }}
      >
        {/* Placeholder text */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>Map View (Web)</p>
          <p style={{ fontSize: 14, margin: '8px 0 0 0' }}>
            Integrate Google Maps or Leaflet here
          </p>
          <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>
            {potholes.length} potholes in Bangalore
          </p>
        </div>
      </div>

      {/* Top Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundColor: cardBg,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon iconType="MaterialIcons" name="location-on" size={24} color="#f9a406" />
          <span style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>
            Pothole Tracker
          </span>
        </div>

        <button
          onClick={handleProfilePress}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#f9a406',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon iconType="MaterialIcons" name="person" size={24} color="#ffffff" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={handleZoomIn}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: cardBg,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Icon iconType="MaterialIcons" name="add" size={24} color={textColor} />
        </button>

        <button
          onClick={handleZoomOut}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: cardBg,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Icon iconType="MaterialIcons" name="remove" size={24} color={textColor} />
        </button>
      </div>

      {/* My Location Button */}
      <button
        onClick={handleMyLocation}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 100,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: cardBg,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Icon iconType="MaterialIcons" name="my-location" size={24} color="#f9a406" />
      </button>

      {/* Report Pothole Button */}
      <button
        onClick={handleReportPothole}
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f9a406',
          border: 'none',
          borderRadius: 28,
          padding: '14px 24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 12px rgba(249,164,6,0.4)',
        }}
      >
        <Icon iconType="MaterialIcons" name="camera-alt" size={24} color="#ffffff" />
        <span style={{ fontSize: 16, fontWeight: 'bold', color: '#ffffff' }}>
          Report Pothole
        </span>
      </button>
    </div>
  );
}

export const WidgetConfig = {};
export const WidgetEditors = {};
export const PropertySettings = {};
