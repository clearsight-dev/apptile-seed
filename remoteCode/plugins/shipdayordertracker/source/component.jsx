import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';

export function ReactComponent({ model }) {
  const id = model.get('id');
  const apiKey = model.get('apiKey') || '';

  const route = useRoute();
  const shopifyOrderId = route.params?.shopifyOrderId || model.get('shopifyOrderId') || '';

  const [trackingLink, setTrackingLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shopifyOrderId || !apiKey) {
      setError('Missing order ID or API key');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTrackingLink() {
      try {
        console.log('[ShipdayOrderTracker] Fetching order from Shipday for Shopify order ID:', shopifyOrderId);

        const res = await fetch(`https://api.shipday.com/orders/${shopifyOrderId}`, {
          headers: { Authorization: apiKey },
        });

        if (!res.ok) {
          const body = await res.text();
          console.log('[ShipdayOrderTracker] FAILED', res.status, body);
          throw new Error(`Shipday API error: ${res.status}`);
        }

        const json = await res.json();
        console.log('[ShipdayOrderTracker] OK', json);

        const orders = Array.isArray(json) ? json : [json];
        const link = orders[0]?.trackingLink || null;

        console.log('[ShipdayOrderTracker] trackingLink:', link);

        if (!cancelled) setTrackingLink(link);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrackingLink();
    return () => { cancelled = true; };
  }, [shopifyOrderId, apiKey]);

  return (
    <View
      nativeID={'rootElement-' + id}
      style={{ flex: 'unset', minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      {loading && <ActivityIndicator size="large" />}

      {!loading && error && (
        <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
      )}

      {!loading && !error && !trackingLink && (
        <Text style={{ textAlign: 'center', color: '#666' }}>No tracking link available yet.</Text>
      )}

      {!loading && !error && trackingLink && (
        <Text style={{ textAlign: 'center', color: '#007AFF' }}>{trackingLink}</Text>
      )}
    </View>
  );
}

export const WidgetConfig = {
  apiKey: '',
  shopifyOrderId: '',
};

export const WidgetEditors = {
  basic: [
    { type: 'codeInput', name: 'apiKey', props: { label: 'Shipday API Key' } },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'Shipday Order Tracker',
  defaultProps: {},
};
