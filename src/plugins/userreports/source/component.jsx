import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useApptileWindowDims, Icon, goBack } from 'apptile-core';
import { useSelector, shallowEqual } from 'react-redux';
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
  const { width, height } = useApptileWindowDims();
  const [userPotholes, setUserPotholes] = useState([]);
  const [loading, setLoading] = useState(true);

  const appState = useSelector(
    state => state.appModel.values.getIn(['appState', 'value']),
    shallowEqual
  );

  const theme = appState?.theme || 'light';
  const currentUser = appState?.currentUser;
  const isDark = theme === 'dark';
  const backgroundColor = isDark ? '#231c0f' : '#f8f7f5';
  const textColor = isDark ? '#ffffff' : '#231c0f';
  const cardBg = isDark ? '#3a3020' : '#ffffff';

  useEffect(() => {
    fetchUserPotholes();
  }, [currentUser]);

  const fetchUserPotholes = async () => {
    if (!currentUser?.device_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[USER_REPORTS] Fetching potholes for device:', currentUser.device_id);

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/potholes?device_id=eq.${currentUser.device_id}&select=*&order=created_at.desc`,
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[USER_REPORTS] Fetched potholes:', data.length);
      setUserPotholes(data);
    } catch (error) {
      console.error('[USER_REPORTS] Error fetching potholes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    goBack();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <View
      nativeID={'rootElement-' + id}
      style={[styles.container, { width, height, backgroundColor }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          nativeID="userreports-TouchableOpacity-BackButton"
        >
          <Icon iconType="MaterialIcons" name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>My Reports</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#501F16" />
            <Text style={{ color: textColor, marginTop: 12 }}>Loading your reports...</Text>
          </View>
        ) : userPotholes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon iconType="MaterialIcons" name="report-problem" size={64} color="#9ca3af" />
            <Text style={[styles.emptyText, { color: textColor }]}>No reports yet</Text>
            <Text style={[styles.emptySubtext, { color: '#9ca3af' }]}>
              Start reporting potholes to see them here
            </Text>
          </View>
        ) : (
          <>
            {userPotholes.map((pothole, index) => (
              <View
                key={pothole.id}
                style={[styles.reportCard, { backgroundColor: cardBg }]}
                nativeID={`userreports-View-Card-${pothole.id}`}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <Text style={[styles.reportNumber, { color: textColor }]}>
                    #{index + 1} {pothole.address?.split(',')[0] || 'Unknown Location'}
                  </Text>
                  <Text style={[styles.reportDate, { color: '#9ca3af' }]}>
                    Date: {formatDate(pothole.created_at)}
                  </Text>
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                  {/* Pothole Image */}
                  <Image
                    source={{ uri: pothole.image_url }}
                    style={styles.potholeImage}
                    resizeMode="cover"
                  />

                  {/* Address */}
                  <View style={styles.addressContainer}>
                    <Text style={[styles.addressLabel, { color: textColor }]}>Address:</Text>
                    <Text style={[styles.addressText, { color: '#6b7280' }]}>
                      {pothole.address || 'No address provided'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Powered by Tile - Always visible */}
        <View style={styles.poweredByContainer}>
          <Text style={[styles.poweredByText, { color: '#9ca3af' }]}>Powered by</Text>
          <SvgXml
            xml={tileSvg}
            width={60}
            height={24}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export const WidgetConfig = {
  primaryColor: '',
  appTitle: '',
};

export const WidgetEditors = [];

export const PropertySettings = [];

