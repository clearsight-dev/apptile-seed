import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Image, TextInput, Platform, ToastAndroid } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean } from 'apptile-core';
import { useRoute, useNavigation } from '@react-navigation/native';

// --- Loop API helpers ---

async function getLoopToken(baseUrl, apiKey, customerShopifyId) {
  console.log('[Loop] getLoopToken', { baseUrl, customerShopifyId });
  const sessionRes = await fetch(`${baseUrl}/admin/2023-10/customer/${customerShopifyId}/sessionToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Loop-Token': apiKey },
  });
  if (!sessionRes.ok) {
    const errBody = await sessionRes.text().catch(() => '');
    console.log('[Loop] getLoopToken FAILED', sessionRes.status, errBody);
    throw new Error('Failed to get session token from Loop Admin API');
  }
  const sessionData = await sessionRes.json();
  const sessionToken = sessionData.data?.sessionToken || sessionData.sessionToken;
  if (!sessionToken) throw new Error('No session token returned from Loop Admin API');

  const tokenRes = await fetch(`${baseUrl}/storefront/2023-10/auth/refreshToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken }),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => '');
    console.log('[Loop] getLoopToken FAILED', tokenRes.status, errBody);
    throw new Error('Failed to exchange session token for access token');
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.data?.accessToken || tokenData.accessToken;
  console.log('[Loop] getLoopToken OK', accessToken ? 'token received' : 'no token');
  return accessToken;
}

async function fetchSubscriptionDetail(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] fetchSubscriptionDetail', { subscriptionId });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}`, {
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchSubscriptionDetail FAILED', res.status, errBody);
    throw new Error('Failed to fetch subscription details');
  }
  const json = await res.json();
  console.log('[Loop] fetchSubscriptionDetail OK', JSON.stringify(json).substring(0, 500));
  return json;
}

async function fetchCancellationReasons(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] fetchCancellationReasons', { subscriptionId });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/cancellationFlow`, {
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchCancellationReasons FAILED', res.status, errBody);
    throw new Error('Failed to fetch cancellation reasons');
  }
  const json = await res.json();
  console.log('[Loop] fetchCancellationReasons OK', JSON.stringify(json).substring(0, 500));
  return json.data || [];
}

async function cancelSubscription(baseUrl, apiKey, token, subscriptionId, cancellationFlowId, comment) {
  const body = { cancellationFlowId };
  if (comment) body.comment = comment;
  console.log('[Loop] cancelSubscription payload:', JSON.stringify(body));
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.log('[Loop] cancelSubscription FAILED', res.status, errText);
    throw new Error('Failed to cancel subscription');
  }
  const json = await res.json();
  console.log('[Loop] cancelSubscription OK', JSON.stringify(json).substring(0, 500));
  return json;
}

// --- Helpers ---

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return dateStr; }
}

function formatPrice(amount, currency) {
  if (!amount) return '';
  const num = parseFloat(amount);
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : (currency || '$');
  return `${sym}${num.toFixed(2)}`;
}

const FALLBACK_REASONS = [
  { id: 0, reason: 'Too expensive', position: 1 },
  { id: 0, reason: 'Found a better alternative', position: 2 },
  { id: 0, reason: 'No longer needed', position: 3 },
  { id: 0, reason: 'Product quality issues', position: 4 },
  { id: 0, reason: 'Shipping issues', position: 5 },
  { id: 0, reason: 'Other', position: 6 },
];

// --- Component ---

export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');


  // Configurable props
  const apiKey = model.get('apiKey') || '';
  const baseUrl = (model.get('baseUrl') || 'https://api.loopsubscriptions.com').replace(/\/$/, '');
  const customerShopifyId = useSelector(state => {
    const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
    return gid ? gid.split('/').pop() : null;
  }, shallowEqual);
  const route = useRoute();
  const navigation = useNavigation();
  const subscriptionId = route.params?.subscriptionId || model.get('subscriptionId') || '';
  const primaryColor = model.get('primaryColor') || '#6366F1';
  const secondaryColor = model.get('secondaryColor') || '#8B5CF6';
  const backgroundColor = model.get('backgroundColor') || '#FFFFFF';
  const textColor = model.get('textColor') || '#1F2937';
  const errorColor = model.get('errorColor') || '#EF4444';
  const borderColor = model.get('borderColor') || '#E5E7EB';
  const dangerColor = model.get('dangerColor') || '#DC2626';
  const cardBorderRadius = parseInt(model.get('cardBorderRadius'), 10) || 12;
  const confirmTitle = model.get('confirmTitle') || 'Are you sure you want to cancel?';
  const confirmDescription = model.get('confirmDescription') || 'This action cannot be undone. Your subscription will be cancelled and you will no longer receive future orders.';
  const cancelButtonText = model.get('cancelButtonText') || 'Yes, Cancel Subscription';
  const goBackButtonText = model.get('goBackButtonText') || 'No, Keep Subscription';
  const showReasonSelector = makeBoolean(model.get('showReasonSelector') ?? true);
  const showCommentBox = makeBoolean(model.get('showCommentBox') ?? true);

  const colors = useMemo(() => ({
    primary: primaryColor, secondary: secondaryColor, bg: backgroundColor,
    text: textColor, error: errorColor, border: borderColor, danger: dangerColor,
  }), [primaryColor, secondaryColor, backgroundColor, textColor, errorColor, borderColor, dangerColor]);

  // State
  const [loopToken, setLoopToken] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [cancellationReasons, setCancellationReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('detail'); // 'detail' | 'confirm' | 'success'
  const [cancelling, setCancelling] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [reasonComment, setReasonComment] = useState('');

  // Auth + fetch
  useEffect(() => {
    if (!apiKey || !customerShopifyId) {
      setLoading(false);
      setError(!apiKey ? 'API Key is required.' : 'Customer Shopify ID is required.');
      return;
    }
    if (!subscriptionId) {
      setLoading(false);
      setError('Subscription ID is required.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const token = await getLoopToken(baseUrl, apiKey, customerShopifyId);
        if (cancelled) return;
        setLoopToken(token);
        const [subResult, reasonsResult] = await Promise.allSettled([
          fetchSubscriptionDetail(baseUrl, apiKey, token, subscriptionId),
          fetchCancellationReasons(baseUrl, apiKey, token, subscriptionId),
        ]);
        if (cancelled) return;
        if (subResult.status === 'fulfilled') {
          const sub = subResult.value.subscription || subResult.value.data || subResult.value;
          setSubscription(sub);
        } else {
          throw new Error(subResult.reason?.message || 'Failed to fetch subscription');
        }
        if (reasonsResult.status === 'fulfilled' && reasonsResult.value.length > 0) {
          const sorted = [...reasonsResult.value].sort((a, b) => (a.position || 0) - (b.position || 0));
          setCancellationReasons(sorted);
        } else {
          setCancellationReasons(FALLBACK_REASONS);
        }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [apiKey, baseUrl, customerShopifyId, subscriptionId]);

  // Cancel handler
  const handleCancel = useCallback(async () => {
    if (!loopToken || !selectedReasonId) return;
    try {
      setCancelling(true); setError(null);
      await cancelSubscription(baseUrl, apiKey, loopToken, subscriptionId, selectedReasonId, reasonComment);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Subscription cancelled successfully', ToastAndroid.SHORT);
      }
      navigation.pop(2);
    } catch (e) { setError(e.message); }
    finally { setCancelling(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, selectedReasonId, reasonComment, navigation]);

  // --- Render ---

  if (loading) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.secondary }]}>Loading…</Text>
      </View>
    );
  }
  if (error && !subscription) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }
  if (!subscription) return null;

  const productTitle = subscription.productTitle || subscription.variantTitle || subscription.title || 'Subscription';
  const imageUrl = subscription.productImage || subscription.variantImage || subscription.image;
  const price = formatPrice(subscription.price || subscription.totalPrice, subscription.currencyCode || subscription.currency);
  const freq = subscription.billingPolicy
    ? `Every ${subscription.billingPolicy.intervalCount} ${subscription.billingPolicy.interval}`
    : (subscription.orderFrequency || '');

// --- Confirm step ---
  if (step === 'confirm') {
    return (
      <ScrollView nativeID={'rootElement-' + id} style={[styles.root, { backgroundColor: colors.bg }]} contentContainerStyle={styles.scrollContent}>
        {/* Subscription summary */}
        <View style={[styles.card, { borderColor: colors.border, borderRadius: cardBorderRadius }]}>
          <View style={styles.row}>
            {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.image, { borderRadius: cardBorderRadius - 4 }]} /> : null}
            <View style={styles.info}>
              <Text style={[styles.title, { color: colors.text }]}>{productTitle}</Text>
              {price ? <Text style={[styles.price, { color: colors.text }]}>{price}</Text> : null}
              {freq ? <Text style={[styles.subtext, { color: colors.secondary }]}>{freq}</Text> : null}
            </View>
          </View>
        </View>

        {/* Warning */}
        <View style={[styles.warningBox, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '40', borderRadius: cardBorderRadius }]}>
          <Text style={[styles.warningTitle, { color: colors.danger }]}>{confirmTitle}</Text>
          <Text style={[styles.warningDesc, { color: colors.text }]}>{confirmDescription}</Text>
        </View>

        {/* Reason selector */}
        {showReasonSelector && cancellationReasons.length > 0 ? (
          <View style={styles.reasonSection}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Reason for cancellation</Text>
            {cancellationReasons.map(flow => {
              const isSelected = selectedReasonId === flow.id;
              return (
                <TouchableOpacity
                  key={flow.id || flow.reason}
                  style={[styles.reasonOption, {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
                    borderRadius: cardBorderRadius,
                  }]}
                  onPress={() => setSelectedReasonId(flow.id)}
                >
                  <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                    {isSelected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                  <Text style={[styles.reasonText, { color: colors.text }]}>{flow.reason}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Comment box */}
        {showCommentBox ? (
          <View style={styles.commentSection}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Additional comments (optional)</Text>
            <TextInput
              style={[styles.commentInput, { borderColor: colors.border, color: colors.text, borderRadius: cardBorderRadius }]}
              value={reasonComment}
              onChangeText={setReasonComment}
              placeholder="Tell us more about why you're cancelling…"
              placeholderTextColor={colors.secondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        ) : null}

        {/* Error */}
        {error ? <Text style={[styles.errorText, { color: colors.error, marginBottom: 12 }]}>{error}</Text> : null}

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.dangerBtn, { backgroundColor: colors.danger, borderRadius: cardBorderRadius, opacity: (cancelling || !selectedReasonId) ? 0.6 : 1 }]}
          onPress={handleCancel}
          disabled={cancelling || !selectedReasonId}
        >
          {cancelling ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dangerBtnText}>{cancelButtonText}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: cardBorderRadius }]}
          onPress={() => setStep('detail')}
          disabled={cancelling}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{goBackButtonText}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --- Detail step (initial) ---
  return (
    <ScrollView nativeID={'rootElement-' + id} style={[styles.root, { backgroundColor: colors.bg }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.card, { borderColor: colors.border, borderRadius: cardBorderRadius }]}>
        <View style={styles.row}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.image, { borderRadius: cardBorderRadius - 4 }]} /> : null}
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.text }]}>{productTitle}</Text>
            {price ? <Text style={[styles.price, { color: colors.text }]}>{price}</Text> : null}
            {freq ? <Text style={[styles.subtext, { color: colors.secondary }]}>{freq}</Text> : null}
          </View>
        </View>
      </View>

      <Text style={[styles.detailNote, { color: colors.secondary }]}>
        If you cancel, your subscription will be terminated and no further orders will be placed.
      </Text>

      <TouchableOpacity
        style={[styles.dangerBtn, { backgroundColor: colors.danger, borderRadius: cardBorderRadius }]}
        onPress={() => setStep('confirm')}
      >
        <Text style={styles.dangerBtnText}>Proceed to Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  root: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card: { borderWidth: 1, padding: 14, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  image: { width: 72, height: 72, marginRight: 12, resizeMode: 'cover' },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  price: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  subtext: { fontSize: 13, marginBottom: 2 },
  warningBox: { borderWidth: 1, padding: 16, marginBottom: 16 },
  warningTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  warningDesc: { fontSize: 14, lineHeight: 20 },
  reasonSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  reasonOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, marginBottom: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: 14, flex: 1 },
  commentSection: { marginBottom: 16 },
  commentInput: { borderWidth: 1, padding: 12, fontSize: 14, minHeight: 80 },
  dangerBtn: { paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  dangerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', borderWidth: 1, marginBottom: 12 },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  detailNote: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center' },
});

// --- Config ---

export const WidgetConfig = {
  apiKey: '',
  baseUrl: 'https://api.loopsubscriptions.com',
  subscriptionId: '',
  primaryColor: '#6366F1',
  secondaryColor: '#8B5CF6',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  errorColor: '#EF4444',
  borderColor: '#E5E7EB',
  dangerColor: '#DC2626',
  cardBorderRadius: 12,

  confirmTitle: 'Are you sure you want to cancel?',
  confirmDescription: 'This action cannot be undone. Your subscription will be cancelled and you will no longer receive future orders.',
  cancelButtonText: 'Yes, Cancel Subscription',
  goBackButtonText: 'No, Keep Subscription',
  showReasonSelector: true,
  showCommentBox: true,
};

export const WidgetEditors = {
  basic: [
    { type: 'editorSectionHeader', name: 'apiSetup', props: { label: 'API SETUP' } },
    { type: 'codeInput', name: 'apiKey', props: { label: 'Loop API Key', placeholder: 'Enter your Loop API key', singleLine: true } },
    { type: 'codeInput', name: 'baseUrl', props: { label: 'Base URL', placeholder: 'https://api.loopsubscriptions.com', singleLine: true } },

    { type: 'editorSectionHeader', name: 'labels', props: { label: 'LABELS & TEXT' } },
    { type: 'codeInput', name: 'confirmTitle', props: { label: 'Confirmation Title', singleLine: true } },
    { type: 'codeInput', name: 'confirmDescription', props: { label: 'Confirmation Description', singleLine: false, noOfLines: 3 } },
    { type: 'codeInput', name: 'cancelButtonText', props: { label: 'Cancel Button Text', singleLine: true } },
    { type: 'codeInput', name: 'goBackButtonText', props: { label: 'Go Back Button Text', singleLine: true } },

    { type: 'editorSectionHeader', name: 'colors', props: { label: 'COLORS' } },
    { type: 'colorInput', name: 'primaryColor', props: { label: 'Primary Color' } },
    { type: 'colorInput', name: 'secondaryColor', props: { label: 'Secondary Color' } },
    { type: 'colorInput', name: 'backgroundColor', props: { label: 'Background Color' } },
    { type: 'colorInput', name: 'textColor', props: { label: 'Text Color' } },
    { type: 'colorInput', name: 'errorColor', props: { label: 'Error Color' } },
    { type: 'colorInput', name: 'borderColor', props: { label: 'Border Color' } },
    { type: 'colorInput', name: 'dangerColor', props: { label: 'Danger/Cancel Color' } },

    { type: 'editorSectionHeader', name: 'display', props: { label: 'DISPLAY OPTIONS' } },
    { type: 'numericInput', name: 'cardBorderRadius', props: { label: 'Card Border Radius', unit: 'px' } },
    { type: 'checkbox', name: 'showReasonSelector', props: { label: 'Show Cancellation Reason' } },
    { type: 'checkbox', name: 'showCommentBox', props: { label: 'Show Comment Box' } },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'Loop Cancel Subscription',
  defaultProps: {},
};