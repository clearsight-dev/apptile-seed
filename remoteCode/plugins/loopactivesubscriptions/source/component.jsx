import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { makeBoolean } from 'apptile-core';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector, shallowEqual } from 'react-redux';

// ── Auth helper ──────────────────────────────────────────────
async function loopAuth(baseUrl, apiKey, customerShopifyId) {
  console.log('[Loop] loopAuth', { baseUrl, customerShopifyId });
  const sessionRes = await fetch(
    `${baseUrl}/admin/2023-10/customer/${customerShopifyId}/sessionToken`,
    { method: 'POST', headers: { 'X-Loop-Token': apiKey, 'Content-Type': 'application/json' } },
  );
  if (!sessionRes.ok) {
    const errBody = await sessionRes.clone().text();
    console.log('[Loop] loopAuth sessionToken FAILED', sessionRes.status, errBody);
  }
  const sessionJson = await sessionRes.json();
  const sessionToken = sessionJson?.data?.sessionToken || sessionJson?.sessionToken;
  if (!sessionToken) throw new Error('Failed to get session token');
  console.log('[Loop] loopAuth sessionToken OK');

  const tokenRes = await fetch(`${baseUrl}/storefront/2023-10/auth/refreshToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken }),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.clone().text();
    console.log('[Loop] loopAuth refreshToken FAILED', tokenRes.status, errBody);
  }
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson?.data?.accessToken || tokenJson?.accessToken;
  if (!accessToken) throw new Error('Failed to get access token');
  console.log('[Loop] loopAuth refreshToken OK');
  return accessToken;
}

// ── Helpers ──────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}

function formatPrice(amount, currency) {
  if (!amount) return '';
  const num = parseFloat(amount);
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : (currency || '$');
  return `${sym}${num.toFixed(2)}`;
}

function getStatusStyle(status) {
  switch ((status || '').toLowerCase()) {
    case 'active': return { bg: '#DCFCE7', text: '#166534' };
    case 'scheduled': return { bg: '#DBEAFE', text: '#1E40AF' };
    case 'paused': return { bg: '#FEF3C7', text: '#92400E' };
    case 'cancelled': return { bg: '#FEE2E2', text: '#991B1B' };
    case 'expired': return { bg: '#F3F4F6', text: '#6B7280' };
    case 'failed': return { bg: '#FEE2E2', text: '#991B1B' };
    default: return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

// ── Main component ───────────────────────────────────────────
export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');
  const navigation = useNavigation();

  // Config
  const apiKey = model.get('apiKey') || '';
  const baseUrl = (model.get('baseUrl') || 'https://api.loopsubscriptions.com').replace(/\/$/, '');
  const customerShopifyId = useSelector(state => {
    const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
    return gid ? gid.split('/').pop() : null;
  }, shallowEqual);

  const primaryColor = model.get('primaryColor') || '#6366F1';
  const backgroundColor = model.get('backgroundColor') || '#FFFFFF';
  const textColor = model.get('textColor') || '#1F2937';
  const secondaryTextColor = model.get('secondaryTextColor') || '#6B7280';
  const borderColor = model.get('borderColor') || '#E5E7EB';
  const cardBorderRadius = parseInt(model.get('cardBorderRadius'), 10) || 12;
  const showProductImage = makeBoolean(model.get('showProductImage') ?? true);
  const showDeliveryFrequency = makeBoolean(model.get('showDeliveryFrequency') ?? true);
  const showNextOrderDate = makeBoolean(model.get('showNextOrderDate') ?? true);
  const showPrice = makeBoolean(model.get('showPrice') ?? true);
  const activeTabLabel = model.get('activeTabLabel') || 'Active';
  const pastTabLabel = model.get('pastTabLabel') || 'Past';
  const emptyActiveText = model.get('emptyActiveText') || 'No active subscriptions found.';
  const emptyPastText = model.get('emptyPastText') || 'No past subscriptions found.';

  // State
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  const fetchSubs = useCallback(async (cancelled) => {
    if (!apiKey || !customerShopifyId) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      setHasError(false);
      const accessToken = await loopAuth(baseUrl, apiKey, customerShopifyId);
      console.log('[Loop] fetchSubs', { baseUrl, customerShopifyId });
      const res = await fetch(`${baseUrl}/storefront/2023-10/subscription`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'x-api-key': apiKey },
      });
      const json = await res.json();
      if (!res.ok) {
        console.log('[Loop] fetchSubs FAILED', res.status, JSON.stringify(json).substring(0, 500));
      } else {
        console.log('[Loop] fetchSubs OK', JSON.stringify(json).substring(0, 500));
      }
      if (!cancelled) {
        const list = json?.data || [];
        setSubscriptions(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      if (!cancelled) setHasError(true);
    } finally {
      if (!cancelled) setIsLoading(false);
    }
  }, [apiKey, baseUrl, customerShopifyId]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    fetchSubs(cancelled);
    return () => { cancelled = true; };
  }, [fetchSubs]));

  const activeSubs = useMemo(() => {
    return subscriptions.filter(s => ['active', 'scheduled'].includes((s.status || '').toLowerCase()));
  }, [subscriptions]);

  const pastSubs = useMemo(() => {
    return subscriptions.filter(s => !['active', 'scheduled'].includes((s.status || '').toLowerCase()));
  }, [subscriptions]);

  const displayedSubs = activeTab === 'active' ? activeSubs : pastSubs;
  const emptyStateText = activeTab === 'active' ? emptyActiveText : emptyPastText;

  // Render a single line item row
  const renderLineItem = (item, idx) => {
    const imageUrl = item.productImage || item.variantImage || item.image;
    const title = item.productTitle || item.title || 'Product';
    const variant = item.variantTitle || '';
    const price = formatPrice(item.price || item.linePrice, item.currencyCode || item.currency);

    return (
      <View key={idx} style={styles.lineItemRow}>
        {showProductImage && imageUrl ? (
          <Image source={{ uri: imageUrl }} style={[styles.lineItemImage, { borderRadius: 8 }]} />
        ) : showProductImage ? (
          <View style={[styles.lineItemImagePlaceholder, { borderRadius: 8 }]} />
        ) : null}
        <View style={styles.lineItemInfo}>
          <Text style={[styles.lineItemTitle, { color: textColor }]} numberOfLines={2}>{title}</Text>
          {variant ? <Text style={[styles.lineItemVariant, { color: secondaryTextColor }]}>{variant}</Text> : null}
        </View>
        {showPrice && price ? (
          <Text style={[styles.lineItemPrice, { color: textColor }]}>{price}</Text>
        ) : null}
      </View>
    );
  };

  // Render a subscription card
  const renderCard = useCallback(({ item }) => {
    const status = (item.status || 'unknown').toLowerCase();
    const statusColors = getStatusStyle(status);
    const subId = item.id || item.subscriptionContractId;

    const nextOrder = item.nextBillingDateEpoch
      ? formatDate(new Date(item.nextBillingDateEpoch * 1000).toISOString())
      : formatDate(item.nextBillingDate);

    const frequency = item.billingPolicy
      ? `Every ${item.billingPolicy.intervalCount} ${item.billingPolicy.interval}`
      : (item.orderFrequency || '—');

    // Line items — could be an array or we construct from top-level fields
    const lineItems = item.lines || item.lineItems || (item.productTitle ? [item] : []);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('LoopManageSubscription', { subscriptionId: subId })}
        style={[styles.card, { borderColor, borderRadius: cardBorderRadius, backgroundColor }]}
      >
        {/* Top row: Subscription ID + Status Badge */}
        <View style={styles.cardHeader}>
          <Text style={[styles.subscriptionId, { color: textColor }]}>
            Subscription #{subId}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: borderColor }]} />

        {/* Info rows */}
        {showNextOrderDate && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>Next Order Date</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{nextOrder}</Text>
          </View>
        )}
        {showDeliveryFrequency && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: secondaryTextColor }]}>Delivery Frequency</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{frequency}</Text>
          </View>
        )}

        {/* Product line items */}
        {lineItems.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <Text style={[styles.productsLabel, { color: secondaryTextColor }]}>Products</Text>
            {lineItems.map((li, idx) => renderLineItem(li, idx))}
          </>
        )}
      </TouchableOpacity>
    );
  }, [borderColor, cardBorderRadius, backgroundColor, textColor, secondaryTextColor, showProductImage, showPrice, showNextOrderDate, showDeliveryFrequency, navigation]);

  // --- Render ---

  if (isLoading) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: secondaryTextColor }]}>Loading subscriptions…</Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.centered, { backgroundColor }]}>
        <Text style={[styles.errorText, { color: '#EF4444' }]}>Something went wrong. Please check your configuration.</Text>
      </View>
    );
  }

  const renderTab = (tabKey, label, count) => {
    const isSelected = activeTab === tabKey;
    return (
      <TouchableOpacity
        key={tabKey}
        style={[styles.tab, isSelected && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
        onPress={() => setActiveTab(tabKey)}
      >
        <Text style={[styles.tabText, { color: isSelected ? primaryColor : secondaryTextColor }]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View nativeID={'rootElement-' + id} style={[styles.root, { backgroundColor }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: borderColor }]}>
        {renderTab('active', activeTabLabel, activeSubs.length)}
        {renderTab('past', pastTabLabel, pastSubs.length)}
      </View>

      {/* Subscription cards */}
      {displayedSubs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: secondaryTextColor }]}>{emptyStateText}</Text>
        </View>
      ) : (
        <FlatList
          data={displayedSubs}
          keyExtractor={(item, idx) => String(item.id || item.subscriptionContractId || idx)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  root: { flex: 'unset', minHeight: 300, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  centered: { flex: 'unset', minHeight: 200, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabText: { fontSize: 14, fontWeight: '600' },

  listContent: { paddingBottom: 8 },

  // Card
  card: { borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subscriptionId: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },

  divider: { height: 1, marginVertical: 12 },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },

  // Products
  productsLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  lineItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  lineItemImage: { width: 48, height: 48, marginRight: 10, resizeMode: 'cover' },
  lineItemImagePlaceholder: { width: 48, height: 48, marginRight: 10, backgroundColor: '#F3F4F6' },
  lineItemInfo: { flex: 1, marginRight: 8 },
  lineItemTitle: { fontSize: 14, fontWeight: '500' },
  lineItemVariant: { fontSize: 12, marginTop: 2 },
  lineItemPrice: { fontSize: 14, fontWeight: '600' },

  // Empty state
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },

  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center' },
});

export const WidgetConfig = {
  apiKey: '',
  baseUrl: 'https://api.loopsubscriptions.com',
  primaryColor: '#6366F1',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  secondaryTextColor: '#6B7280',
  borderColor: '#E5E7EB',
  cardBorderRadius: 12,
  showProductImage: true,
  showNextOrderDate: true,
  showDeliveryFrequency: true,
  showPrice: true,
  activeTabLabel: 'Active',
  pastTabLabel: 'Past',
  emptyActiveText: 'No active subscriptions found.',
  emptyPastText: 'No past subscriptions found.',
};

export const WidgetEditors = {
  basic: [
    { type: 'editorSectionHeader', name: 'apiSetup', props: { label: 'API SETUP' } },
    { type: 'codeInput', name: 'apiKey', props: { label: 'Loop API Key', placeholder: 'Enter your Loop API key', singleLine: true } },
    { type: 'codeInput', name: 'baseUrl', props: { label: 'Base URL', placeholder: 'https://api.loopsubscriptions.com', singleLine: true } },

    { type: 'editorSectionHeader', name: 'labels', props: { label: 'LABELS' } },
    { type: 'codeInput', name: 'activeTabLabel', props: { label: 'Active Tab Label', singleLine: true } },
    { type: 'codeInput', name: 'pastTabLabel', props: { label: 'Past Tab Label', singleLine: true } },
    { type: 'codeInput', name: 'emptyActiveText', props: { label: 'Empty Active State Text', singleLine: true } },
    { type: 'codeInput', name: 'emptyPastText', props: { label: 'Empty Past State Text', singleLine: true } },
    { type: 'editorSectionHeader', name: 'colors', props: { label: 'COLORS' } },
    { type: 'colorInput', name: 'primaryColor', props: { label: 'Primary / Accent Color' } },
    { type: 'colorInput', name: 'backgroundColor', props: { label: 'Background Color' } },
    { type: 'colorInput', name: 'textColor', props: { label: 'Text Color' } },
    { type: 'colorInput', name: 'secondaryTextColor', props: { label: 'Secondary Text Color' } },
    { type: 'colorInput', name: 'borderColor', props: { label: 'Border Color' } },

    { type: 'editorSectionHeader', name: 'display', props: { label: 'DISPLAY OPTIONS' } },
    { type: 'numericInput', name: 'cardBorderRadius', props: { label: 'Card Border Radius', unit: 'px' } },
    { type: 'checkbox', name: 'showProductImage', props: { label: 'Show Product Image' } },
    { type: 'checkbox', name: 'showNextOrderDate', props: { label: 'Show Next Order Date' } },
    { type: 'checkbox', name: 'showDeliveryFrequency', props: { label: 'Show Delivery Frequency' } },
    { type: 'checkbox', name: 'showPrice', props: { label: 'Show Price' } },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'Loop Active Subscriptions',
  defaultProps: {},
};
