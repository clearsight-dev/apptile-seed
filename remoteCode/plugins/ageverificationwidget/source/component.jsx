import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {WebView} from 'react-native-webview';
import {useSelector, shallowEqual} from 'react-redux';
import {
  LocalStorage,
  EventTriggerIdentifier,
  Icon,
  getPlatformStyles,
} from 'apptile-core';

const CALLBACK_PATH = '/callback';

async function apiPost(url, appId, customerAccessToken, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-shopify-app-id': appId,
      'x-shopify-customer-access-token': customerAccessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

function IconBubble({bg, iconType, iconName, iconSize, iconColor}) {
  return (
    <View style={[styles.iconBubble, {backgroundColor: bg}]}>
      <Icon
        iconType={iconType}
        name={iconName}
        style={{fontSize: iconSize, color: iconColor}}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  accentColor,
  buttonTypography,
  buttonTextColor,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {backgroundColor: accentColor},
        disabled && styles.pillDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text
        style={[styles.pillText, buttonTypography, {color: buttonTextColor}]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RetryButton({
  label,
  onPress,
  retryButtonBg,
  buttonTypography,
  buttonTextColor,
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, {backgroundColor: retryButtonBg}]}
      onPress={onPress}>
      <Text
        style={[styles.pillText, buttonTypography, {color: buttonTextColor}]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SupportLink({contactSupportUrl, contactSupportText}) {
  if (!contactSupportUrl) {
    return null;
  }
  return (
    <TouchableOpacity
      style={styles.supportLinkWrap}
      onPress={() => Linking.openURL(contactSupportUrl)}>
      <Text style={styles.supportLink}>{contactSupportText}</Text>
    </TouchableOpacity>
  );
}

export function ReactComponent({model, modelStyles}) {
  const navigation = useNavigation();
  const onVerifiedScreen = model.get('onVerifiedScreen') || '';
  const onVerifiedParentNav = model.get('onVerifiedParentNav') || '';

  const proxyBaseUrl =
    model.get('ageVerificationProxyBaseUrl') || 'http://192.168.1.2:3054';
  const allowedDocumentTypes = model.get('allowedDocumentTypes') || ['P', 'DL'];

  // ── Text (from model) ────────────────────────────────────────────────────────
  const idleTitle = model.get('idleTitle') || 'AGE VERIFICATION REQUIRED';
  const idleBody =
    model.get('idleBody') ||
    'You must be 21 or older to purchase cannabis products. Please verify your age with a government-issued ID.';
  const idleButtonText = model.get('idleButtonText') || 'VERIFY MY AGE';
  const checkingLabel =
    model.get('checkingLabel') || 'CHECKING VERIFICATION STATUS..';
  const loadingLabel = model.get('loadingLabel') || 'KEEP YOUR ID HANDY..';
  const verifyingLabel = model.get('verifyingLabel') || 'VERIFYING YOUR AGE..';
  const failedTitle = model.get('failedTitle') || 'VERIFICATION UNSUCCESSFUL';
  const failedBody =
    model.get('failedBody') ||
    'We could not verify that you meet the age requirement (21+). Please try again with a valid government-issued ID.';
  const retryButtonText = model.get('retryButtonText') || 'TRY AGAIN';
  const contactSupportText =
    model.get('contactSupportText') || 'Contact Support';
  const contactSupportUrl = model.get('contactSupportUrl') || '';

  // ── Icons (names/type from model, colors/size from modelStyles) ──────────────
  const iconType = model.get('iconType') || 'Material Icons';
  const idleIconName = model.get('idleIconName') || 'badge';
  const failedIconName = model.get('failedIconName') || 'cancel';

  // ── Styles (from modelStyles via widgetStyleConfig) ──────────────────────────
  const {
    titleTypography,
    bodyTypography,
    buttonTypography,
    backgroundColor = '#fff',
    accentColor = '#4ECDC4',
    titleColor = '#111',
    failedTitleColor = '#CD1212',
    bodyTextColor = '#555',
    retryButtonBackgroundColor: retryButtonBg = '#111',
    primaryButtonTextColor = '#111',
    retryButtonTextColor = '#fff',
    iconSize = 32,
    idleIconColor = '#A0E8F1',
    idleIconBgColor = 'rgba(160,232,241,0.2)',
    failedIconColor = '#CD1212',
    failedIconBgColor = 'rgba(205,18,18,0.4)',
  } = modelStyles ? getPlatformStyles(modelStyles) : {};
  // ── Redux ────────────────────────────────────────────────────────────────────
  const appId = useSelector(
    state => state?.appModel?.values.getIn(['Apptile', 'appUUID']),
    shallowEqual,
  );
  const customerAccessToken = useSelector(
    state =>
      state?.appModel?.values.getIn([
        'shopify',
        'loggedInUserAccessToken',
        'accessToken',
      ]),
    shallowEqual,
  );

  const [screen, setScreen] = useState('checking');
  const [webviewUrl, setWebviewUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const callbackTriggered = useRef(false);

  const navigateOnVerified = useCallback(() => {
    if (onVerifiedScreen && onVerifiedParentNav) {
      navigation.navigate(onVerifiedParentNav, {screen: onVerifiedScreen});
    } else if (onVerifiedScreen) {
      navigation.navigate(onVerifiedScreen);
    }
  }, [navigation, onVerifiedScreen, onVerifiedParentNav]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const checkVerified = async () => {
        try {
          const user = await LocalStorage.getValue('loggedInUser');
          if (cancelled) {
            return;
          }
          if (user?.tags?.includes('age-verified')) {
            navigateOnVerified();
          } else {
            setScreen('idle');
          }
        } catch (e) {
          console.log('[AgeVerification] checkVerified error:', e?.message);
          if (!cancelled) {
            setScreen('idle');
          }
        }
      };
      checkVerified();
      return () => {
        cancelled = true;
      };
    }, [navigateOnVerified]),
  );

  const callbackUrl = `${proxyBaseUrl}${CALLBACK_PATH}`;

  const startVerification = async () => {
    callbackTriggered.current = false;
    setScreen('loading');
    try {
      const data = await apiPost(
        `${proxyBaseUrl}/start`,
        appId,
        customerAccessToken,
        {callback: callbackUrl, allowedDocumentTypes},
      );
      setSessionId(data.session_id);
      setWebviewUrl(data.url);
      setScreen('webview');
    } catch (e) {
      setErrorMsg('Failed to start verification. Please try again.');
      setScreen('error');
    }
  };

  const doVerify = async sid => {
    if (callbackTriggered.current) {
      return;
    }
    callbackTriggered.current = true;
    setScreen('verifying');
    try {
      const data = await apiPost(
        `${proxyBaseUrl}/verify/${sid}`,
        appId,
        customerAccessToken,
      );
      if (data.verified) {
        try {
          const user = await LocalStorage.getValue('loggedInUser');
          if (user) {
            const tags = Array.isArray(user.tags) ? user.tags : [];
            if (!tags.includes('age-verified')) {
              await LocalStorage.setValue('loggedInUser', {
                ...user,
                tags: [...tags, 'age-verified'],
              });
            }
          }
        } catch (e) {
          console.log(
            '[AgeVerification] failed to update loggedInUser tags:',
            e?.message,
          );
        }
        navigateOnVerified();
      } else {
        setScreen('failed');
      }
    } catch (e) {
      setErrorMsg('Verification check failed. Please try again.');
      setScreen('error');
    }
  };

  const handleNavChange = navState => {
    if (navState.url?.includes(CALLBACK_PATH)) {
      doVerify(sessionId);
    }
  };

  const handleShouldStartLoad = request => {
    if (request.url?.includes(CALLBACK_PATH)) {
      doVerify(sessionId);
      return false;
    }
    return true;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const containerStyle = [styles.centered, {backgroundColor}];
  const bodyStyle = [styles.bodyText, bodyTypography, {color: bodyTextColor}];

  // ── Screens ──────────────────────────────────────────────────────────────────

  if (screen === 'checking') {
    return (
      <View style={[styles.centered, {backgroundColor}]}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text
          style={[styles.spinnerLabel, titleTypography, {color: titleColor}]}>
          {checkingLabel}
        </Text>
      </View>
    );
  }

  if (screen === 'webview' && webviewUrl) {
    return (
      <View style={styles.fullScreen}>
        <WebView
          source={{uri: webviewUrl}}
          onNavigationStateChange={handleNavChange}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
        />
      </View>
    );
  }

  if (screen === 'loading' || screen === 'verifying') {
    return (
      <View style={[styles.centered, {backgroundColor}]}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text
          style={[styles.spinnerLabel, titleTypography, {color: titleColor}]}>
          {screen === 'loading' ? loadingLabel : verifyingLabel}
        </Text>
      </View>
    );
  }

  if (screen === 'failed') {
    return (
      <View style={containerStyle}>
        <IconBubble
          bg={failedIconBgColor}
          iconType={iconType}
          iconName={failedIconName}
          iconSize={iconSize}
          iconColor={failedIconColor}
        />
        <Text
          style={[styles.title, titleTypography, {color: failedTitleColor}]}>
          {failedTitle}
        </Text>
        <Text style={bodyStyle}>{failedBody}</Text>
        <RetryButton
          label={retryButtonText}
          onPress={() => setScreen('idle')}
          retryButtonBg={retryButtonBg}
          buttonTypography={buttonTypography}
          buttonTextColor={retryButtonTextColor}
        />
        <SupportLink
          contactSupportUrl={contactSupportUrl}
          contactSupportText={contactSupportText}
        />
      </View>
    );
  }

  if (screen === 'error') {
    return (
      <View style={containerStyle}>
        <IconBubble
          bg={failedIconBgColor}
          iconType={iconType}
          iconName={failedIconName}
          iconSize={iconSize}
          iconColor={failedIconColor}
        />
        <Text
          style={[styles.title, titleTypography, {color: failedTitleColor}]}>
          Something Went Wrong
        </Text>
        <Text style={bodyStyle}>{errorMsg}</Text>
        <RetryButton
          label={retryButtonText}
          onPress={() => setScreen('idle')}
          retryButtonBg={retryButtonBg}
          buttonTypography={buttonTypography}
          buttonTextColor={retryButtonTextColor}
        />
        <SupportLink
          contactSupportUrl={contactSupportUrl}
          contactSupportText={contactSupportText}
        />
      </View>
    );
  }

  // idle
  return (
    <View style={containerStyle}>
      <IconBubble
        bg={idleIconBgColor}
        iconType={iconType}
        iconName={idleIconName}
        iconSize={iconSize}
        iconColor={idleIconColor}
      />
      <Text style={[styles.title, titleTypography, {color: titleColor}]}>
        {idleTitle}
      </Text>
      <Text style={bodyStyle}>{idleBody}</Text>
      <PrimaryButton
        label={idleButtonText}
        onPress={startVerification}
        disabled={!appId || !customerAccessToken}
        accentColor={accentColor}
        buttonTypography={buttonTypography}
        buttonTextColor={primaryButtonTextColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {flex: 1},
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    // fontSize: 17,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  bodyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  spinnerLabel: {
    marginTop: 20,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pill: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 50,
    alignItems: 'center',
  },
  pillDisabled: {
    backgroundColor: '#ccc',
  },
  pillText: {
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  supportLinkWrap: {
    marginTop: 24,
  },
  supportLink: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'underline',
  },
});

export const WidgetConfig = {
  ageVerificationProxyBaseUrl: 'http://192.168.1.2:3054',
  allowedDocumentTypes: '{{["P", "DL"]}}',
  onVerifiedScreen: '',
  onVerifiedParentNav: 'Main',
  iconType: 'Material Icons',
  idleIconName: 'badge',
  idleIconColor: '#4ECDC4',
  idleIconBgColor: 'rgba(78,205,196,0.15)',
  failedIconName: 'cancel',
  failedIconColor: '#CC0000',
  failedIconBgColor: 'rgba(204,0,0,0.10)',
  idleTitle: 'AGE VERIFICATION REQUIRED',
  idleBody:
    'You must be 21 or older to purchase cannabis products. Please verify your age with a government-issued ID.',
  idleButtonText: 'VERIFY MY AGE',
  checkingLabel: 'CHECKING VERIFICATION STATUS..',
  loadingLabel: 'KEEP YOUR ID HANDY..',
  verifyingLabel: 'VERIFYING YOUR AGE..',
  failedTitle: 'VERIFICATION UNSUCCESSFUL',
  failedBody:
    'We could not verify that you meet the age requirement (21+). Please try again with a valid government-issued ID.',
  retryButtonText: 'TRY AGAIN',
  contactSupportText: 'Contact Support',
  contactSupportUrl: '',
};

export const WidgetEditors = {
  basic: [
    {
      type: 'codeInput',
      name: 'ageVerificationProxyBaseUrl',
      props: {label: 'Proxy Base Url'},
    },
    {
      type: 'textInput',
      name: 'onVerifiedParentNav',
      props: {label: 'Parent Navigator Name (e.g. Main)'},
    },
    {
      type: 'textInput',
      name: 'onVerifiedScreen',
      props: {label: 'Navigate To Screen (on verified, e.g. Home)'},
    },
    {
      type: 'codeInput',
      name: 'allowedDocumentTypes',
      props: {label: 'Allowed Document Types ["P", "DL", "ID", "RP", "HIC"]'},
    },
    {
      type: 'iconChooserInput',
      name: 'idleIconName',
      props: {label: 'Verify Age Screen Icon'},
    },
    {
      type: 'iconChooserInput',
      name: 'failedIconName',
      props: {label: 'Unsuccessful Screen Icon'},
    },
    {type: 'textInput', name: 'idleTitle', props: {label: 'Title'}},
    {type: 'textInput', name: 'idleBody', props: {label: 'Body Text'}},
    {
      type: 'textInput',
      name: 'idleButtonText',
      props: {label: 'Verify Button Label'},
    },
    {
      type: 'textInput',
      name: 'checkingLabel',
      props: {label: 'Checking Status Label'},
    },
    {type: 'textInput', name: 'loadingLabel', props: {label: 'Loading Label'}},
    {
      type: 'textInput',
      name: 'verifyingLabel',
      props: {label: 'Verifying Label'},
    },
    {type: 'textInput', name: 'failedTitle', props: {label: 'Failed Title'}},
    {type: 'textInput', name: 'failedBody', props: {label: 'Failed Body'}},
    {
      type: 'textInput',
      name: 'retryButtonText',
      props: {label: 'Retry Button Label'},
    },
    {
      type: 'textInput',
      name: 'contactSupportText',
      props: {label: 'Contact Support Label'},
    },
    {
      type: 'textInput',
      name: 'contactSupportUrl',
      props: {label: 'Contact Support URL'},
    },
  ],
};

export const PropertySettings = {};
