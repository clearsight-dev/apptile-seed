import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSelector, shallowEqual} from 'react-redux';
import {LocalStorage, EventTriggerIdentifier} from 'apptile-core';

const CALLBACK_PATH = '/callback';

async function apiPost(url, appId, customerAccessToken, body = {}) {
  // console.log('[AgeVerification] apiPost →', url, 'body:', JSON.stringify(body));
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
  // console.log('[AgeVerification] apiPost ←', res.status, text);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

export function ReactComponent({model, triggerEvent}) {
  const proxyBaseUrl = model.get('ageVerificationProxyBaseUrl') ||
    'http://192.168.1.2:3054';
  const allowedDocumentTypes = model.get('allowedDocumentTypes') || ['P', 'DL'];
  // console.log('proxyBaseUrl', proxyBaseUrl);
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

  const [screen, setScreen] = useState('checking'); // checking | idle | loading | webview | verifying | success | failed | error
  const [webviewUrl, setWebviewUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const callbackTriggered = useRef(false);

  const onVerified = useCallback(() => {
    triggerEvent('onVerified');
  }, [triggerEvent]);

  useEffect(() => {
    const checkVerified = async () => {
      try {
        const user = await LocalStorage.getValue('loggedInUser');
        // console.log('[AgeVerification] loggedInUser:', JSON.stringify(user));
        if (user?.tags?.includes('age-verified')) {
          setScreen('success');
          setTimeout(() => onVerified(), 100);
        } else {
          setScreen('idle');
        }
      } catch {
        setScreen('idle');
      }
    };
    checkVerified();
  }, [onVerified]);

  const callbackUrl = `${proxyBaseUrl}${CALLBACK_PATH}`;

  const startVerification = async () => {
    callbackTriggered.current = false;
    setScreen('loading');
    try {
      // console.log('[AgeVerification] starting — proxyBaseUrl:', proxyBaseUrl, 'appId:', appId, 'callbackUrl:', callbackUrl);
      const data = await apiPost(
        `${proxyBaseUrl}/start`,
        appId,
        customerAccessToken,
        {callback: callbackUrl, allowedDocumentTypes},
      );
      // console.log('[AgeVerification] session created:', data?.session_id, 'url:', data?.url);
      setSessionId(data.session_id);
      setWebviewUrl(data.url);
      setScreen('webview');
    } catch (e) {
      // console.log('[AgeVerification] startVerification error:', e?.message, e?.response?.status, e?.response?.data);
      setErrorMsg('Failed to start verification. Please try again.');
      setScreen('error');
    }
  };

  const doVerify = async sid => {
    if (callbackTriggered.current) return;
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
              await LocalStorage.setValue('loggedInUser', {...user, tags: [...tags, 'age-verified']});
            }
          }
        } catch (e) {
          console.log('[AgeVerification] failed to update loggedInUser tags:', e?.message);
        }
        setScreen('success');
        onVerified();
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

  // ── Screens ────────────────────────────────────────────────────────────────

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

  if (screen === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  if (screen === 'loading' || screen === 'verifying') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.loadingText}>
          {screen === 'loading'
            ? 'Starting verification…'
            : 'Verifying your identity…'}
        </Text>
      </View>
    );
  }

  if (screen === 'success') {
    return (
      <View style={styles.centered}>
        <Text style={styles.successTitle}>Age Verified</Text>
        <Text style={styles.bodyText}>
          You're all set! You can now browse and purchase cannabis products.
        </Text>
      </View>
    );
  }

  if (screen === 'failed') {
    return (
      <View style={styles.centered}>
        <Text style={styles.failedTitle}>Verification Unsuccessful</Text>
        <Text style={styles.bodyText}>
          We could not verify that you meet the age requirement (21+). Please
          try again with a valid government-issued ID.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => setScreen('idle')}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.failedTitle}>Something Went Wrong</Text>
        <Text style={styles.bodyText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.button} onPress={() => setScreen('idle')}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // idle
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Age Verification Required</Text>
      <Text style={styles.bodyText}>
        You must be 21 or older to purchase cannabis products. Please verify
        your age with a government-issued ID.
      </Text>
      <TouchableOpacity
        style={[styles.button, (!appId || !customerAccessToken) && styles.buttonDisabled]}
        onPress={startVerification}
        disabled={!appId || !customerAccessToken}>
        <Text style={styles.buttonText}>Verify My Age</Text>
      </TouchableOpacity>
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
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#065F46',
    textAlign: 'center',
    marginBottom: 16,
  },
  failedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#555',
  },
  button: {
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export const WidgetConfig = {
  ageVerificationProxyBaseUrl: 'http://192.168.1.2:3054',
  allowedDocumentTypes: '{{["P", "DL"]}}',
  onVerified: ''
};

export const WidgetEditors = {
  basic: [
    {
      type: 'codeInput',
      name: 'ageVerificationProxyBaseUrl',
      props: {label: 'Proxy Base Url'},
    },
    {
      type: 'codeInput',
      name: 'allowedDocumentTypes',
      props: {label: 'Allowed Document Types ["P", "DL", "ID", "RP", "HIC"]'},
    },
  ],
};

export const PropertySettings = {
  onVerified: {type: EventTriggerIdentifier},
};
