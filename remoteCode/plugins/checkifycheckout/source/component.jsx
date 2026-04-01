import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean, useApptileWindowDims, goBack } from 'apptile-core';
import WebView from 'react-native-webview';

const CHECKIFY_SUCCESS_PAGE_URL_REGEX = /\/thank[_-]you/;

const jsCode = `window.setInterval(() => {
  if (window.location.href?.includes('/thank-you') || window.location.href?.includes('/thank_you')) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'checkout_success'}));
  }
}, 300);
`;

const disableFacebookPixelJsCode = `
window.fbq = function() {};
`;

const checkIsPaymentIntentLink = (link) => {
  if (
    link != undefined &&
    (link.startsWith('upi://pay') ||
      link.startsWith('tez://') ||
      link.startsWith('gpay://') ||
      link.startsWith('paytmmp://') ||
      link.startsWith('phonepe://') ||
      link.startsWith('paytm://'))
  ) {
    return true;
  }
  return false;
};

export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');
  const { height } = useApptileWindowDims();

  // ─── 1. Merchant config ───────────────────────────────────────────────────
  const baseUrl = model.get('baseUrl') || '';
  const disableFacebookPixel = makeBoolean(model.get('disableFacebookPixel') ?? false);

  // ─── 2. Redux data ───────────────────────────────────────────────────────
  const cartToken = useSelector(state => {
    const cartId = state.appModel.values.getIn(['shopify', 'currentCart', 'id']);
    // cartId format: "gid://shopify/Cart/hWN9gLEvYbHqCp6gueckn4YW?key=..."
    if (!cartId) return '';
    const raw = typeof cartId === 'string' ? cartId : (cartId?.toString?.() || '');
    const match = raw.match(/Cart\/(.+)$/);
    return match ? match[1] : raw;
  }, shallowEqual);

  const storeName = useSelector(state => {
    // e.g. "https://soleseriouss.myshopify.com/api/2024-10/graphql.json"
    const apiUrl = state.appModel.values.getIn(['shopify', 'storefrontApiUrl']);
    if (!apiUrl) return '';
    const raw = typeof apiUrl === 'string' ? apiUrl : (apiUrl?.toString?.() || '');
    try {
      const hostname = new URL(raw).hostname; // "soleseriouss.myshopify.com"
      return hostname;
    } catch (e) {
      return '';
    }
  }, shallowEqual);

  // ─── 3. Local state ──────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);

  // ─── 4. Build Checkify checkoutCreate URL ─────────────────────────────────
  const checkoutCreateUrl = useMemo(() => {
    if (!baseUrl || !storeName || !cartToken) return '';

    const cleanBase = baseUrl.replace(/\/$/, '');
    const hostname = cleanBase.replace(/^https?:\/\//, '');
    const params = new URLSearchParams({
      storeName: storeName,
      cartToken: cartToken,
      originUrl: `https://${storeName.replace('.myshopify.com', '.com')}`,
      hostname: hostname,
    });

    const url = `${cleanBase}/api/checkoutCreate?${params.toString()}`;
    console.log('[CheckifyCheckout] checkoutCreate URL:', url);
    return url;
  }, [baseUrl, storeName, cartToken]);

  // ─── 5. WebView callbacks ────────────────────────────────────────────────
  const onLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const onLoadStart = useCallback((syntheticEvent) => {
    const url = syntheticEvent?.nativeEvent?.url;
    console.log('[CheckifyCheckout] onLoadStart:', url);
    if (url && (CHECKIFY_SUCCESS_PAGE_URL_REGEX.test(url) || url.includes('/thank_you') || url.includes('/thank-you'))) {
      console.log('[CheckifyCheckout] Checkout SUCCESS detected!');
      dispatch(goBack());
    }
  }, [dispatch]);

  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'checkout_success') {
        console.log('[CheckifyCheckout] Checkout SUCCESS via postMessage!');
        dispatch(goBack());
      }
    } catch (e) {
      console.log('[CheckifyCheckout] onMessage error:', e);
    }
  }, [dispatch]);

  const injectedJavaScript = useMemo(() => {
    return disableFacebookPixel ? jsCode + disableFacebookPixelJsCode : jsCode;
  }, [disableFacebookPixel]);

  const onShouldStartLoadWithRequest = useCallback((request) => {
    if (checkIsPaymentIntentLink(request.url)) {
      Linking.openURL(request.url)
        .then(() => {
          console.log('[CheckifyCheckout] Opening payment link:', request.url);
        })
        .catch((e) => {
          console.log('[CheckifyCheckout] Unable to open payment link:', e);
        });
      return false;
    }
    return true;
  }, []);

  // ─── 6. Render ────────────────────────────────────────────────────────────
  if (!baseUrl) {
    return (
      <View style={{ flex: 'unset', minHeight: 300, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', padding: 20 }}>
          Please configure the Checkify Base URL in widget settings.
        </Text>
      </View>
    );
  }

  if (!cartToken) {
    return (
      <View style={{ flex: 'unset', minHeight: 300, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, fontSize: 14, color: '#666' }}>Waiting for cart...</Text>
      </View>
    );
  }

  return (
    <View nativeID={'rootElement-' + id} style={{ flex: 'unset', height: height }}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 1 }]}>
          <ActivityIndicator size="large" />
        </View>
      )}
      <WebView
        key={checkoutCreateUrl}
        source={{ uri: checkoutCreateUrl }}
        originWhitelist={['*']}
        incognito={false}
        startInLoadingState={true}
        onLoadEnd={onLoadEnd}
        onLoadStart={onLoadStart}
        onMessage={onMessage}
        injectedJavaScriptForMainFrameOnly={true}
        injectedJavaScript={injectedJavaScript}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="small" />
          </View>
        )}
        style={{ flex: 1 }}
      />
    </View>
  );
}

export const WidgetConfig = {
  baseUrl: '',
  disableFacebookPixel: false,
};

export const WidgetEditors = {
  basic: [
    {
      type: 'codeInput',
      name: 'baseUrl',
      props: {
        label: 'Checkify Base URL (e.g. https://pay.soleseriouss.com)',
        singleLine: true,
      },
    },
  ],
  advanced: [
    {
      type: 'checkbox',
      name: 'disableFacebookPixel',
      props: {
        label: 'Disable Facebook Pixel',
      },
    },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'Checkify Checkout',
  defaultProps: {},
};
