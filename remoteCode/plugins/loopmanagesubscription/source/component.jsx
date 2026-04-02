import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Image, TextInput, Alert, Animated, Dimensions, Modal, FlatList, SafeAreaView } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean } from 'apptile-core';
import { useNavigation, useRoute } from '@react-navigation/native';

// --- Loop API helpers ---

async function getLoopToken(baseUrl, apiKey, customerShopifyId) {
  console.log('[Loop] getLoopToken', { baseUrl, customerShopifyId });
  const sessionRes = await fetch(`${baseUrl}/admin/2023-10/customer/${customerShopifyId}/sessionToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Loop-Token': apiKey },
  });
  if (!sessionRes.ok) {
    const errBody = await sessionRes.text().catch(() => '');
    console.log('[Loop] getLoopToken sessionToken FAILED', sessionRes.status, errBody);
    throw new Error('Failed to get session token');
  }
  const sessionData = await sessionRes.json();
  console.log('[Loop] getLoopToken sessionToken OK', JSON.stringify(sessionData));
  const sessionToken = sessionData.data?.sessionToken || sessionData.sessionToken;
  if (!sessionToken) throw new Error('No session token returned');

  const tokenRes = await fetch(`${baseUrl}/storefront/2023-10/auth/refreshToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken }),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => '');
    console.log('[Loop] getLoopToken refreshToken FAILED', tokenRes.status, errBody);
    throw new Error('Failed to exchange session token');
  }
  const tokenData = await tokenRes.json();
  console.log('[Loop] getLoopToken refreshToken OK');
  return tokenData.data?.accessToken || tokenData.accessToken;
}

async function fetchSubscriptionDetail(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] fetchSubscriptionDetail', subscriptionId);
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

async function pauseSubscription(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] pauseSubscription', subscriptionId);
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/pause`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] pauseSubscription FAILED', res.status, errBody);
    throw new Error('Failed to pause subscription');
  }
  const json = await res.json();
  console.log('[Loop] pauseSubscription OK', JSON.stringify(json));
  return json;
}

async function resumeSubscription(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] resumeSubscription', subscriptionId);
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/resume`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] resumeSubscription FAILED', res.status, errBody);
    throw new Error('Failed to resume subscription');
  }
  const json = await res.json();
  console.log('[Loop] resumeSubscription OK', JSON.stringify(json));
  return json;
}

async function skipNextOrder(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] skipNextOrder', subscriptionId);
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/skipNext`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] skipNextOrder FAILED', res.status, errBody);
    throw new Error('Failed to skip next order');
  }
  const json = await res.json();
  console.log('[Loop] skipNextOrder OK', JSON.stringify(json));
  return json;
}

async function placeOrder(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] placeOrder', subscriptionId);
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/placeOrder`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] placeOrder FAILED', res.status, errBody);
    throw new Error('Failed to place order');
  }
  const json = await res.json();
  console.log('[Loop] placeOrder OK', JSON.stringify(json));
  return json;
}

async function rescheduleSubscription(baseUrl, apiKey, token, subscriptionId, newBillingDateEpoch) {
  console.log('[Loop] rescheduleSubscription', subscriptionId, { newBillingDateEpoch });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/reschedule`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ newBillingDateEpoch }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] rescheduleSubscription FAILED', res.status, errBody);
    throw new Error('Failed to reschedule order');
  }
  const json = await res.json();
  console.log('[Loop] rescheduleSubscription OK', JSON.stringify(json));
  return json;
}

async function updateFrequency(baseUrl, apiKey, token, subscriptionId, intervalCount, interval, nextBillingDateEpoch) {
  const payload = { billingPolicy: { intervalCount, interval }, nextBillingDateEpoch };
  console.log('[Loop] updateFrequency', subscriptionId, JSON.stringify(payload));
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/frequency`, {
    method: 'PUT',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] updateFrequency FAILED', res.status, errBody);
    throw new Error('Failed to update frequency');
  }
  const json = await res.json();
  console.log('[Loop] updateFrequency OK', JSON.stringify(json));
  return json;
}

async function listFrequencies(baseUrl, apiKey, token, subscriptionId) {
  console.log('[Loop] listFrequencies', subscriptionId);
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/frequency`, {
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] listFrequencies FAILED', res.status, errBody);
    throw new Error('Failed to fetch available frequencies');
  }
  const json = await res.json();
  console.log('[Loop] listFrequencies OK', JSON.stringify(json));
  return json;
}

async function fetchPaymentMethods(baseUrl, apiKey, token) {
  console.log('[Loop] fetchPaymentMethods');
  const res = await fetch(`${baseUrl}/storefront/2023-10/paymentMethod`, {
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchPaymentMethods FAILED', res.status, errBody);
    throw new Error('Failed to fetch payment methods');
  }
  const json = await res.json();
  console.log('[Loop] fetchPaymentMethods OK', JSON.stringify(json).substring(0, 500));
  return json;
}

async function updateShippingAddress(baseUrl, apiKey, token, subscriptionId, address) {
  console.log('[Loop] updateShippingAddress', subscriptionId, JSON.stringify(address));
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/address`, {
    method: 'PUT',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(address),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.log('[Loop] updateShippingAddress FAILED', res.status, errBody);
    let parsed = null;
    try { parsed = JSON.parse(errBody); } catch (_) {}
    const err = new Error(parsed?.message || 'Failed to update shipping address');
    err.apiMessage = parsed?.message || '';
    throw err;
  }
  const json = await res.json();
  console.log('[Loop] updateShippingAddress OK', JSON.stringify(json));
  return json;
}

async function updateOrderNote(token, subscriptionShopifyId, note) {
  console.log('[Loop] updateOrderNote', { subscriptionShopifyId, note });
  const res = await fetch('https://api.loopwork.co/api/customer/v2/edit_order_note', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionContract_shopify_id: subscriptionShopifyId, note }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] updateOrderNote FAILED', res.status, errBody);
    let parsed = null;
    try { parsed = JSON.parse(errBody); } catch (_) {}
    throw new Error(parsed?.message || 'Failed to update order note');
  }
  const json = await res.json();
  console.log('[Loop] updateOrderNote OK', JSON.stringify(json));
  return json;
}

async function applyDiscountCode(baseUrl, apiKey, token, subscriptionId, code) {
  console.log('[Loop] applyDiscountCode', subscriptionId, { code });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/discount`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] applyDiscountCode FAILED', res.status, errBody);
    let parsed = null;
    try { parsed = JSON.parse(errBody); } catch (_) {}
    throw new Error(parsed?.message || 'Invalid or expired discount code');
  }
  const json = await res.json();
  console.log('[Loop] applyDiscountCode OK', JSON.stringify(json));
  return json;
}

async function removeDiscountCode(baseUrl, apiKey, token, subscriptionId, discountShopifyId) {
  console.log('[Loop] removeDiscountCode', subscriptionId, { discountShopifyId });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/discount/${discountShopifyId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] removeDiscountCode FAILED', res.status, errBody);
    throw new Error('Failed to remove discount code');
  }
  const json = await res.json();
  console.log('[Loop] removeDiscountCode OK', JSON.stringify(json));
  return json;
}

async function updateLineItem(baseUrl, apiKey, token, subscriptionId, lineId, quantity) {
  console.log('[Loop] updateLineItem', subscriptionId, lineId, { quantity });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/line/${lineId}/quantity`, {
    method: 'PUT',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] updateLineItem FAILED', res.status, errBody);
    throw new Error('Failed to update item quantity');
  }
  const json = await res.json();
  console.log('[Loop] updateLineItem OK', JSON.stringify(json));
  return json;
}

async function removeLineItem(baseUrl, apiKey, token, subscriptionId, lineId) {
  console.log('[Loop] removeLineItem', subscriptionId, lineId);
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/line/${lineId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] removeLineItem FAILED', res.status, errBody);
    throw new Error('Failed to remove item');
  }
  const json = await res.json();
  console.log('[Loop] removeLineItem OK', JSON.stringify(json));
  return json;
}

async function fetchSwapProducts(token, lineItemId, search, page) {
  const params = new URLSearchParams({ lineItem_id: String(lineItemId), search: search || '', page: String(page || 1), token: 'token' });
  console.log('[Loop] fetchSwapProducts', { lineItemId, search, page });
  const res = await fetch(`https://api.loopwork.co/api/customer/v2/read_swap_products?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchSwapProducts FAILED', res.status, errBody);
    throw new Error('Failed to fetch swap products');
  }
  const json = await res.json();
  console.log('[Loop] fetchSwapProducts OK, keys:', Object.keys(json), 'full:', JSON.stringify(json).substring(0, 1000));
  return json;
}

async function fetchUpsellProducts(token, subscriptionId, customerShopifyId, storeDomain, search, source) {
  const params = new URLSearchParams({
    search: search || '',
    page: '1',
    myshopify_domain: storeDomain || '',
    action: 'add',
    contractId: String(subscriptionId),
    customerShopifyId: String(customerShopifyId),
    limit: '50',
    source: source || 'SEE_MORE',
  });
  console.log('[Loop] fetchUpsellProducts', { subscriptionId, search, source });
  const res = await fetch(`https://api.loopwork.co/api/customer/v2/read_upsell_products?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchUpsellProducts FAILED', res.status, errBody);
    throw new Error('Failed to fetch upsell products');
  }
  const json = await res.json();
  console.log('[Loop] fetchUpsellProducts OK', JSON.stringify(json).substring(0, 1000));
  return json;
}

async function fetchUpsellProfile(token, subscriptionId, customerShopifyId, storeDomain) {
  const params = new URLSearchParams({
    search: '', page: '1', myshopify_domain: storeDomain || '',
    token: 'testToken', contractId: String(subscriptionId),
    limit: '50', source: 'UPSELL_BANNER',
    customerShopifyId: String(customerShopifyId),
  });
  console.log('[Loop] fetchUpsellProfile', { subscriptionId });
  const res = await fetch(`https://api.loopwork.co/api/customer/v2/upsellProfileProducts?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchUpsellProfile FAILED', res.status, errBody);
    throw new Error('Failed to fetch upsell profile');
  }
  const json = await res.json();
  console.log('[Loop] fetchUpsellProfile OK', JSON.stringify(json).substring(0, 500));
  return json;
}

async function fetchShopifyRecommendations(storeDomain, productId, limit) {
  console.log('[Loop] fetchShopifyRecommendations', { storeDomain, productId });
  const res = await fetch(
    `https://${storeDomain}/recommendations/products.json?product_id=${productId}&limit=${limit || 10}&intent=related`
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchShopifyRecommendations FAILED', res.status, errBody);
    throw new Error('Failed to fetch Shopify recommendations');
  }
  const json = await res.json();
  console.log('[Loop] fetchShopifyRecommendations RESPONSE', json);
  return json;
}

async function fetchSmartUpsellProducts(token, subscriptionId, customerShopifyId, storeDomain, upsellProfileId, productIds, search) {
  const params = new URLSearchParams({
    search: search || '', page: '1', myshopify_domain: storeDomain || '',
    token: 'testToken', contractId: String(subscriptionId),
    limit: '50', source: 'UPSELL_BANNER',
    customerShopifyId: String(customerShopifyId),
    upsellProfileId: String(upsellProfileId),
    productIds: JSON.stringify(productIds),
  });
  const url = `https://api.loopwork.co/api/customer/v2/upsellSmartProfileProducts?${params.toString()}`;
  console.log('[Loop] fetchSmartUpsellProducts REQUEST', url);
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] fetchSmartUpsellProducts FAILED', res.status, errBody);
    throw new Error('Failed to fetch smart upsell products');
  }
  const json = await res.json();
  console.log('[Loop] fetchSmartUpsellProducts RESPONSE', json);
  return json;
}

async function fetchUpsellWithSmartProfile(token, subscriptionId, customerShopifyId, storeDomain, subscriptionLines) {
  try {
    // Step 1: Get upsell profile to determine profile type and ID
    const profileRes = await fetchUpsellProfile(token, subscriptionId, customerShopifyId, storeDomain);
    const profileData = profileRes.data || profileRes;
    const upsellProfileId = profileData.upsellProfileId;

    if (!upsellProfileId) {
      throw new Error('No upsell profile ID, falling back');
    }

    // Step 2: Get Shopify recommendations using first line item's product ID
    const firstLine = (subscriptionLines || [])[0];
    const productId = firstLine?.product_shopify_id || firstLine?.productShopifyId || firstLine?.shopifyProductId;
    if (!productId) throw new Error('No product ID in first line item, falling back');

    const recsRes = await fetchShopifyRecommendations(storeDomain, productId, 10);
    const recProducts = recsRes.products || [];
    // Collect all variant IDs from recommended products
    const variantIds = [];
    recProducts.forEach(p => { (p.variants || []).forEach(v => { if (v.id) variantIds.push(v.id); }); });
    variantIds.splice(10); // Match website behavior: send only first 10 variant IDs
    if (!variantIds.length) throw new Error('No variant IDs from recommendations, falling back');

    // Step 3: Fetch smart upsell products using profile ID + variant IDs
    const smartRes = await fetchSmartUpsellProducts(token, subscriptionId, customerShopifyId, storeDomain, upsellProfileId, variantIds, '');
    const smartProducts = smartRes.data?.results || smartRes.data?.products || smartRes.data || [];

    // Step 4: Filter Shopify recommendations to only include products verified by smart upsell
    //         and enrich with image from smart upsell data
    if (Array.isArray(smartProducts) && smartProducts.length > 0) {
      const smartByProductId = {};
      smartProducts.forEach(p => {
        const pid = String(p.product_shopify_id || p.productShopifyId || p.shopifyProductId || p.id);
        smartByProductId[pid] = p;
      });
      const verified = recProducts
        .filter(p => smartByProductId[String(p.id)])
        .map(p => {
          const smart = smartByProductId[String(p.id)];
          const smartImg = smart.image || smart.productImage || smart.featured_image;
          return {
            ...p,
            image: smartImg || p.featured_image || p.images?.[0]?.src || p.images?.[0],
            price: smart.price,
            sp_discounted_price: smart.sp_discounted_price,
            upsell_discounted_price: smart.upsell_discounted_price,
            currency_code: smart.currency_code || p.currency_code,
          };
        })
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      console.log('[Loop] Verified products:', verified.length, 'of', recProducts.length, 'recommendations');
      if (verified.length > 0) {
        return { products: verified, profileCache: { profileId: upsellProfileId, variantIds } };
      }
    }
    throw new Error('No verified products after filtering, falling back');
  } catch (e) {
    console.log('[Loop] Smart upsell flow failed, falling back to read_upsell_products:', e.message);
    // Fallback: old API
    const fallback = await fetchUpsellProducts(token, subscriptionId, customerShopifyId, storeDomain, '', 'SEE_MORE');
    const products = fallback.data?.results || fallback.data?.products || fallback.data || fallback.products || fallback.results || [];
    return { products: Array.isArray(products) ? products : [], profileCache: null };
  }
}

async function addOneTimeProduct(baseUrl, apiKey, token, subscriptionId, variantShopifyId, quantity, isOneTime, sellingPlanGroupId) {
  const payload = { variantShopifyId, quantity, isUpsell: true };
  if (!isOneTime && sellingPlanGroupId) payload.sellingPlanGroupId = sellingPlanGroupId;
  console.log('[Loop] addOneTimeProduct', subscriptionId, JSON.stringify(payload));
  // One-time add uses /line/once; subscription add uses /line
  const endpoint = isOneTime
    ? `${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/line/once`
    : `${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/line`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] addOneTimeProduct FAILED', res.status, errBody);
    let parsed = null;
    try { parsed = JSON.parse(errBody); } catch (_) {}
    const err = new Error(parsed?.message || 'Failed to add product');
    err.apiMessage = parsed?.message || '';
    throw err;
  }
  const json = await res.json();
  console.log('[Loop] addOneTimeProduct OK', JSON.stringify(json));
  return json;
}

async function swapLineItem(baseUrl, apiKey, token, subscriptionId, lineId, variantShopifyId, quantity) {
  console.log('[Loop] swapLineItem', subscriptionId, lineId, { variantShopifyId, quantity });
  const res = await fetch(`${baseUrl}/storefront/2023-10/subscription/${subscriptionId}/line/${lineId}/swap`, {
    method: 'PUT',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantShopifyId, quantity }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] swapLineItem FAILED', res.status, errBody);
    let parsed = null;
    try { parsed = JSON.parse(errBody); } catch (_) {}
    throw new Error(parsed?.message || 'Failed to swap product');
  }
  const json = await res.json();
  console.log('[Loop] swapLineItem OK', JSON.stringify(json));
  return json;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

// --- Helpers ---

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return dateStr; }
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

function extractDiscount(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') raw = raw.percentage ?? raw.value ?? raw.amount ?? null;
  if (raw == null) return null;
  const num = parseFloat(raw);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num);
}

// Safely coerce any API value to a renderable string.
// Handles { percentage }, { fixed_amount }, nested objects, etc.
function safeStr(val, fallback = '') {
  if (val == null) return fallback;
  if (typeof val === 'string') return val || fallback;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (val.percentage != null) return `${val.percentage}%`;
    if (val.fixed_amount != null) return `$${val.fixed_amount}`;
    if (val.amount != null) return String(val.amount);
    if (val.value != null) return safeStr(val.value, fallback);
    return fallback;
  }
  return fallback;
}

function toDateStr(epoch) {
  if (!epoch) return '';
  const d = new Date(epoch * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Component ---

export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');
  const navigation = useNavigation();

  // Config
  const apiKey = model.get('apiKey') || '';
  const baseUrl = (model.get('baseUrl') || 'https://api.loopsubscriptions.com').replace(/\/$/, '');
  const storeDomain = model.get('storeDomain') || '';
  const customerShopifyId = useSelector(state => {
    const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
    return gid ? gid.split('/').pop() : null;
  }, shallowEqual);
  const route = useRoute();
  const subscriptionId = route.params?.subscriptionId || model.get('subscriptionId') || '';

  const primaryColor = model.get('primaryColor') || '#6366F1';
  const backgroundColor = model.get('backgroundColor') || '#FFFFFF';
  const textColor = model.get('textColor') || '#1F2937';
  const secondaryTextColor = model.get('secondaryTextColor') || '#6B7280';
  const borderColor = model.get('borderColor') || '#E5E7EB';
  const cardBorderRadius = parseInt(model.get('cardBorderRadius'), 10) || 12;

  const showOneTimeAdd = makeBoolean(model.get('showOneTimeAdd') ?? true);
  const showSkipOption = makeBoolean(model.get('showSkipOption') ?? true);
  const showGetDeliveryNow = makeBoolean(model.get('showGetDeliveryNow') ?? true);
  const showReschedule = makeBoolean(model.get('showReschedule') ?? true);
  const showPauseResume = makeBoolean(model.get('showPauseResume') ?? true);
  const showFrequencyEdit = makeBoolean(model.get('showFrequencyEdit') ?? true);
  const showAddressEdit = makeBoolean(model.get('showAddressEdit') ?? true);
  const showPaymentDetails = makeBoolean(model.get('showPaymentDetails') ?? true);
  const showProductDetails = makeBoolean(model.get('showProductDetails') ?? true);
  const showOrderNotes = makeBoolean(model.get('showOrderNotes') ?? true);
  const showDiscountCode = makeBoolean(model.get('showDiscountCode') ?? true);

  // State
  const [loopToken, setLoopToken] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [topMessage, setTopMessage] = useState(null); // for top action buttons only
  const [sectionMessages, setSectionMessages] = useState({}); // { products: '...', frequency: '...', address: '...', orderNote: '...', discount: '...' }
  const [editMode, setEditMode] = useState(null); // null | 'frequency' | 'address' | 'reschedule' | 'orderNote'

  const setSectionMsg = useCallback((section, msg) => {
    setSectionMessages(prev => ({ ...prev, [section]: msg }));
  }, []);
  const clearSectionMsg = useCallback((section) => {
    setSectionMessages(prev => { const n = { ...prev }; delete n[section]; return n; });
  }, []);

  // Frequency edit state
  const [freqCount, setFreqCount] = useState('');
  const [freqInterval, setFreqInterval] = useState('MONTH');
  const [availableFrequencies, setAvailableFrequencies] = useState([]);

  // Address edit state
  const [addrFields, setAddrFields] = useState({ firstName: '', lastName: '', address1: '', address2: '', city: '', province: '', provinceCode: '', zip: '', country: '', countryCode: '' });
  const [addrErrors, setAddrErrors] = useState({});

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState(null);

  // Reschedule state
  const [selectedDate, setSelectedDate] = useState('');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // Order note state
  const [orderNote, setOrderNote] = useState('');

  // Discount code state
  const [discountInput, setDiscountInput] = useState('');
  const [discountLoading, setDiscountLoading] = useState(false);

  // Edit product panel state
  const [editingLine, setEditingLine] = useState(null); // the line item being edited
  const [panelView, setPanelView] = useState('edit'); // 'edit' | 'swap'
  const [editQty, setEditQty] = useState(1);
  const [swapProducts, setSwapProducts] = useState([]);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [panelMsg, setPanelMsg] = useState(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Upsell / one-time add state
  const [upsellProducts, setUpsellProducts] = useState(null); // null = not loaded yet
  const [upsellProfileData, setUpsellProfileData] = useState(null); // { profileId, variantIds } for smart search
  const [upsellContainerWidth, setUpsellContainerWidth] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalView, setAddModalView] = useState('list'); // 'list' | 'detail'
  const [addSearch, setAddSearch] = useState('');
  const [addListResults, setAddListResults] = useState([]);
  const [addListLoading, setAddListLoading] = useState(false);
  const [selectedAddProduct, setSelectedAddProduct] = useState(null);
  const [addOptionValues, setAddOptionValues] = useState({});
  const [addOpenDropdown, setAddOpenDropdown] = useState(null); // name of currently open option dropdown
  const [addQty, setAddQty] = useState(1);
  const [addPurchaseType, setAddPurchaseType] = useState('oneTime');
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductMsg, setAddProductMsg] = useState(null);
  const addSlideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Fetch subscription detail
  const loadSubscription = useCallback(async (token) => {
    if (!subscriptionId) { setError('Subscription ID is required.'); setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const data = await fetchSubscriptionDetail(baseUrl, apiKey, token, subscriptionId);
      const sub = data.subscription || data.data || data;
      setSubscription(sub);
      if (sub.billingPolicy) {
        setFreqCount(String(sub.billingPolicy.intervalCount || 1));
        setFreqInterval(sub.billingPolicy.interval || 'MONTH');
      }
      if (sub.shippingAddress) {
        setAddrFields({
          firstName: sub.shippingAddress.firstName || '',
          lastName: sub.shippingAddress.lastName || '',
          address1: sub.shippingAddress.address1 || '',
          address2: sub.shippingAddress.address2 || '',
          city: sub.shippingAddress.city || '',
          province: sub.shippingAddress.province || '',
          provinceCode: sub.shippingAddress.provinceCode || sub.shippingAddress.province_code || '',
          zip: sub.shippingAddress.zip || '',
          country: sub.shippingAddress.country || '',
          countryCode: sub.shippingAddress.countryCode || sub.shippingAddress.country_code || '',
        });
      }
      setOrderNote(sub.orderNote || sub.note || '');
      if (sub.nextBillingDateEpoch) {
        setSelectedDate(toDateStr(sub.nextBillingDateEpoch));
      }
      return sub;
    } catch (e) { setError(e.message); return null; }
    finally { setLoading(false); }
  }, [baseUrl, apiKey, subscriptionId]);

  useEffect(() => {
    if (!apiKey || !customerShopifyId) {
      setLoading(false);
      setError(!apiKey ? 'API Key is required.' : 'Customer Shopify ID is required.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getLoopToken(baseUrl, apiKey, customerShopifyId);
        if (cancelled) return;
        setLoopToken(token);
        const sub = await loadSubscription(token);
        const subLines = sub?.lines || sub?.lineItems || [];
        const [freqResult, pmResult, upsellResult] = await Promise.allSettled([
          listFrequencies(baseUrl, apiKey, token, subscriptionId),
          fetchPaymentMethods(baseUrl, apiKey, token),
          fetchUpsellWithSmartProfile(token, subscriptionId, customerShopifyId, storeDomain, subLines),
        ]);
        if (!cancelled && freqResult.status === 'fulfilled') {
          const freqs = freqResult.value.data || freqResult.value.frequencies || freqResult.value || [];
          if (Array.isArray(freqs)) setAvailableFrequencies(freqs);
        }
        if (!cancelled && pmResult.status === 'fulfilled') {
          const methods = pmResult.value.data || [];
          if (Array.isArray(methods)) setPaymentMethod(methods);
        }
        if (!cancelled && upsellResult.status === 'fulfilled') {
          const { products, profileCache } = upsellResult.value;
          setUpsellProducts(Array.isArray(products) ? products : []);
          if (profileCache) setUpsellProfileData(profileCache);
        } else if (!cancelled) {
          setUpsellProducts([]); // mark as loaded (failed gracefully)
        }
      } catch (e) { if (!cancelled) { setError(e.message); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, [apiKey, baseUrl, customerShopifyId, subscriptionId]);

  // Actions
  const performAction = useCallback(async (actionFn, successMsg) => {
    if (!loopToken) return;
    try {
      setActionLoading(true); setTopMessage(null);
      await actionFn(baseUrl, apiKey, loopToken, subscriptionId);
      setTopMessage(successMsg);
      await loadSubscription(loopToken);
    } catch (e) { setTopMessage(e.message); }
    finally { setActionLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, loadSubscription]);

  const confirmAndExecute = (title, message, onConfirm) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const handlePause = () => confirmAndExecute('Pause Subscription?', 'Your subscription will be paused until you resume it.', () => performAction(pauseSubscription, 'Subscription paused successfully.'));
  const handleResume = () => confirmAndExecute('Resume Subscription?', 'Your subscription will be resumed and orders will continue.', () => performAction(resumeSubscription, 'Subscription resumed successfully.'));
  const handleSkip = () => confirmAndExecute('Skip Next Order?', 'Your next scheduled order will be skipped.', () => performAction(skipNextOrder, 'Next order skipped successfully.'));
  const handleGetDeliveryNow = () => confirmAndExecute('Place Order Now?', 'This will place an order immediately. Are you sure?', () => performAction(placeOrder, 'Order placed successfully.'));

  const handleReschedule = useCallback(async () => {
    if (!loopToken || !selectedDate) return;
    const parts = selectedDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const epoch = Math.floor(d.getTime() / 1000);
    try {
      setActionLoading(true); setTopMessage(null);
      await rescheduleSubscription(baseUrl, apiKey, loopToken, subscriptionId, epoch);
      setTopMessage('Order rescheduled successfully.');
      setEditMode(null);
      await loadSubscription(loopToken);
    } catch (e) { setTopMessage(e.message); }
    finally { setActionLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, selectedDate, loadSubscription]);

  const handleSaveFrequency = useCallback(async () => {
    if (!loopToken || !subscription) return;
    try {
      setActionLoading(true); clearSectionMsg('frequency');
      const nextEpoch = subscription.nextBillingDateEpoch || Math.floor(Date.now() / 1000);
      await updateFrequency(baseUrl, apiKey, loopToken, subscriptionId, parseInt(freqCount, 10), freqInterval, nextEpoch);
      setSectionMsg('frequency', 'Frequency updated successfully.');
      setEditMode(null);
      await loadSubscription(loopToken);
    } catch (e) { setSectionMsg('frequency', e.message); }
    finally { setActionLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, freqCount, freqInterval, subscription, loadSubscription, setSectionMsg, clearSectionMsg]);

  const parseAddrErrors = useCallback((apiMessage) => {
    const errors = {};
    if (!apiMessage) return errors;
    const parts = apiMessage.split('.');
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const sepIdx = trimmed.indexOf('|');
      if (sepIdx !== -1) {
        const field = trimmed.substring(0, sepIdx).trim();
        const msg = trimmed.substring(sepIdx + 1).trim();
        const key = field.charAt(0).toLowerCase() + field.slice(1);
        errors[key] = msg;
      }
    });
    return errors;
  }, []);

  const handleSaveAddress = useCallback(async () => {
    if (!loopToken) return;
    try {
      setActionLoading(true); clearSectionMsg('address'); setAddrErrors({});
      const payload = {
        firstName: addrFields.firstName, lastName: addrFields.lastName,
        address1: addrFields.address1, address2: addrFields.address2,
        city: addrFields.city, province: addrFields.province,
        provinceCode: addrFields.provinceCode || addrFields.province,
        zip: addrFields.zip, country: addrFields.country,
        countryCode: addrFields.countryCode || addrFields.country,
      };
      await updateShippingAddress(baseUrl, apiKey, loopToken, subscriptionId, payload);
      setSectionMsg('address', 'Address updated successfully.');
      setAddrErrors({});
      setEditMode(null);
      await loadSubscription(loopToken);
    } catch (e) {
      const fieldErrors = parseAddrErrors(e.apiMessage || '');
      if (Object.keys(fieldErrors).length > 0) {
        setAddrErrors(fieldErrors);
      } else {
        setSectionMsg('address', e.message);
      }
    }
    finally { setActionLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, addrFields, loadSubscription, parseAddrErrors, setSectionMsg, clearSectionMsg]);

  const handleSaveOrderNote = useCallback(async () => {
    if (!loopToken || !subscription) return;
    const shopifyId = subscription.shopifyId || subscription.subscriptionContractShopifyId || subscription.id;
    try {
      setActionLoading(true); clearSectionMsg('orderNote');
      await updateOrderNote(loopToken, shopifyId, orderNote);
      setSectionMsg('orderNote', 'Order note updated successfully.');
      setEditMode(null);
      await loadSubscription(loopToken);
    } catch (e) { setSectionMsg('orderNote', e.message); }
    finally { setActionLoading(false); }
  }, [loopToken, subscription, orderNote, loadSubscription, setSectionMsg, clearSectionMsg]);

  const handleApplyDiscount = useCallback(async () => {
    if (!loopToken || !discountInput.trim()) return;
    try {
      setDiscountLoading(true); clearSectionMsg('discount');
      await applyDiscountCode(baseUrl, apiKey, loopToken, subscriptionId, discountInput.trim());
      setSectionMsg('discount', 'Discount code applied successfully.');
      setDiscountInput('');
      await loadSubscription(loopToken);
    } catch (e) { setSectionMsg('discount', e.message); }
    finally { setDiscountLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, discountInput, loadSubscription, setSectionMsg, clearSectionMsg]);

  const handleRemoveDiscount = useCallback(async (discountShopifyId, code) => {
    if (!loopToken) return;
    confirmAndExecute('Remove Discount?', `Remove discount code "${code}"?`, async () => {
      try {
        setDiscountLoading(true); clearSectionMsg('discount');
        await removeDiscountCode(baseUrl, apiKey, loopToken, subscriptionId, discountShopifyId);
        setSectionMsg('discount', 'Discount code removed.');
        await loadSubscription(loopToken);
      } catch (e) { setSectionMsg('discount', e.message); }
      finally { setDiscountLoading(false); }
    });
  }, [loopToken, baseUrl, apiKey, subscriptionId, loadSubscription, setSectionMsg, clearSectionMsg]);

  // Panel open/close
  const openEditPanel = useCallback((line) => {
    setEditingLine(line);
    setPanelView('edit');
    setEditQty(line.quantity || 1);
    setPanelMsg(null);
    setSwapProducts([]);
    setSwapSearch('');
    Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [slideAnim]);

  const closePanel = useCallback(() => {
    Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
      setEditingLine(null);
      setPanelView('edit');
      setPanelMsg(null);
    });
  }, [slideAnim]);

  const handlePanelUpdateQty = useCallback(async () => {
    if (!loopToken || !editingLine) return;
    const lineId = editingLine.id || editingLine.lineId;
    try {
      setActionLoading(true); setPanelMsg(null);
      await updateLineItem(baseUrl, apiKey, loopToken, subscriptionId, lineId, editQty);
      setPanelMsg('Quantity updated successfully.');
      await loadSubscription(loopToken);
      closePanel();
    } catch (e) { setPanelMsg(e.message); }
    finally { setActionLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, editingLine, editQty, loadSubscription, closePanel]);

  const handleOpenSwapView = useCallback(async () => {
    if (!loopToken || !editingLine) return;
    const lineId = editingLine.id || editingLine.lineId;
    setPanelView('swap');
    setPanelMsg(null);
    setSwapSearch('');
    setSwapLoading(true);
    try {
      const json = await fetchSwapProducts(loopToken, lineId, '', 1);
      const products = json.data?.results || json.data || [];
      console.log('[Loop] handleOpenSwapView products count:', products.length, 'total:', json.data?.total_products);
      setSwapProducts(Array.isArray(products) ? products : []);
    } catch (e) { setPanelMsg(e.message); }
    finally { setSwapLoading(false); }
  }, [loopToken, editingLine]);

  const handleSwapSearch = useCallback(async () => {
    if (!loopToken || !editingLine) return;
    const lineId = editingLine.id || editingLine.lineId;
    setSwapLoading(true); setPanelMsg(null);
    try {
      const json = await fetchSwapProducts(loopToken, lineId, swapSearch, 1);
      const products = json.data?.results || json.data || [];
      setSwapProducts(Array.isArray(products) ? products : []);
    } catch (e) { setPanelMsg(e.message); }
    finally { setSwapLoading(false); }
  }, [loopToken, editingLine, swapSearch]);

  const handleSelectSwap = useCallback(async (product) => {
    if (!loopToken || !editingLine) return;
    const lineId = editingLine.id || editingLine.lineId;
    const variantShopifyId = product.variant_shopify_id || product.variantShopifyId || product.shopifyId || product.id;
    const qty = editingLine.quantity || 1;
    try {
      setActionLoading(true); setPanelMsg(null);
      await swapLineItem(baseUrl, apiKey, loopToken, subscriptionId, lineId, variantShopifyId, qty);
      setSectionMsg('products', 'Product swapped successfully.');
      await loadSubscription(loopToken);
      closePanel();
    } catch (e) { setPanelMsg(e.message); }
    finally { setActionLoading(false); }
  }, [loopToken, baseUrl, apiKey, subscriptionId, editingLine, loadSubscription, closePanel, setSectionMsg]);

  const handleRemoveLine = useCallback(async (lineId, title) => {
    if (!loopToken) return;
    confirmAndExecute('Remove Item?', `Remove "${title}" from your subscription?`, async () => {
      try {
        setActionLoading(true); clearSectionMsg('products');
        await removeLineItem(baseUrl, apiKey, loopToken, subscriptionId, lineId);
        setSectionMsg('products', 'Item removed.');
        await loadSubscription(loopToken);
      } catch (e) { setSectionMsg('products', e.message); }
      finally { setActionLoading(false); }
    });
  }, [loopToken, baseUrl, apiKey, subscriptionId, loadSubscription, setSectionMsg, clearSectionMsg]);

  // --- Upsell / Add-product handlers ---

  const openAddPanel = useCallback((initialProduct) => {
    setAddSearch('');
    setAddListResults(upsellProducts || []);
    setAddProductMsg(null);
    setAddOpenDropdown(null);
    if (initialProduct) {
      const options = initialProduct.product_options || initialProduct.options || [];
      const initial = {};
      options.forEach(opt => { if (opt.values?.length) initial[opt.name] = opt.values[0]; });
      setAddOptionValues(initial);
      setAddQty(1);
      setAddPurchaseType('oneTime');
      setSelectedAddProduct(initialProduct);
      setAddModalView('detail');
    } else {
      setSelectedAddProduct(null);
      setAddModalView('list');
    }
    setAddModalOpen(true);
    Animated.timing(addSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [addSlideAnim, upsellProducts]);

  const closeAddPanel = useCallback(() => {
    Animated.timing(addSlideAnim, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
      setAddModalOpen(false);
      setSelectedAddProduct(null);
      setAddModalView('list');
      setAddProductMsg(null);
    });
  }, [addSlideAnim]);

  const handleAddSearch = useCallback(async () => {
    if (!loopToken) return;
    setAddListLoading(true); setAddProductMsg(null);
    try {
      let results = [];
      if (upsellProfileData) {
        // Use smart upsell search with cached profile data
        const json = await fetchSmartUpsellProducts(loopToken, subscriptionId, customerShopifyId, storeDomain, upsellProfileData.profileId, upsellProfileData.variantIds, addSearch);
        results = json.data?.results || json.data?.products || json.data || [];
      } else {
        // Fallback to old search
        const json = await fetchUpsellProducts(loopToken, subscriptionId, customerShopifyId, storeDomain, addSearch, 'SEE_MORE');
        results = json.data?.results || json.data?.products || json.data || json.products || json.results || [];
      }
      setAddListResults(Array.isArray(results) ? results : []);
    } catch (e) { setAddProductMsg(e.message); }
    finally { setAddListLoading(false); }
  }, [loopToken, subscriptionId, customerShopifyId, storeDomain, addSearch, upsellProfileData]);

  const handleSelectForAdd = useCallback((product) => {
    const options = product.product_options || product.options || [];
    const initial = {};
    options.forEach(opt => { if (opt.values?.length) initial[opt.name] = opt.values[0]; });
    setAddOptionValues(initial);
    setAddOpenDropdown(null);
    setAddQty(1);
    setAddPurchaseType('oneTime');
    setSelectedAddProduct(product);
    setAddModalView('detail');
    setAddProductMsg(null);
  }, []);

  const computeAddVariant = useCallback(() => {
    if (!selectedAddProduct) return null;
    // upsell products from read_upsell_products API have variant_shopify_id directly on the product
    if (selectedAddProduct.variant_shopify_id) {
      return { variant_shopify_id: selectedAddProduct.variant_shopify_id };
    }
    // fallback: try variants array (other API shapes)
    const variants = selectedAddProduct.variants || [];
    if (!variants.length) return null;
    if (!Object.keys(addOptionValues).length) return variants[0];
    const matched = variants.find(v => {
      const opts = v.selectedOptions || v.options || [];
      if (Array.isArray(opts)) {
        return Object.entries(addOptionValues).every(([name, val]) =>
          opts.some(o => o.name === name && o.value === val)
        );
      }
      return Object.entries(addOptionValues).every(([name, val]) => opts[name] === val);
    });
    return matched || variants[0];
  }, [selectedAddProduct, addOptionValues]);

  const handleConfirmAdd = useCallback(async () => {
    if (!loopToken || !selectedAddProduct) return;
    const variant = computeAddVariant();
    const variantShopifyId = variant?.shopifyId || variant?.variant_shopify_id || variant?.variantShopifyId || variant?.id;
    if (!variantShopifyId) { setAddProductMsg('Could not determine variant. Please try again.'); return; }
    const isOneTime = addPurchaseType === 'oneTime';
    const spg = (selectedAddProduct.selling_plan_groups || selectedAddProduct.sellingPlanGroups || [])[0];
    const sellingPlanGroupId = !isOneTime
      ? (spg?.id || spg?.selling_plan_group_id || spg?.sellingPlanGroupId ||
         selectedAddProduct.selling_plan_group_id || selectedAddProduct.sellingPlanGroupId)
      : undefined;
    try {
      setAddProductLoading(true); setAddProductMsg(null);
      await addOneTimeProduct(baseUrl, apiKey, loopToken, subscriptionId, variantShopifyId, addQty, isOneTime, sellingPlanGroupId);
      setAddProductMsg('Product added successfully!');
      await loadSubscription(loopToken);
      setTimeout(closeAddPanel, 1500);
    } catch (e) { setAddProductMsg(e.message); }
    finally { setAddProductLoading(false); }
  }, [loopToken, selectedAddProduct, computeAddVariant, addPurchaseType, addQty, baseUrl, apiKey, subscriptionId, loadSubscription, closeAddPanel]);

  // --- Render helpers ---

  const renderSection = (title, children, key, rightButton) => {
    const msg = sectionMessages[key];
    return (
      <View key={key} style={[styles.section, { borderColor, borderRadius: cardBorderRadius }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
          {rightButton || null}
        </View>
        <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />
        {msg ? (
          <View style={[styles.sectionMsgBox, { borderRadius: cardBorderRadius }]}>
            <Text style={{ fontSize: 13, color: msg.includes('success') ? '#10B981' : '#EF4444' }}>{msg}</Text>
          </View>
        ) : null}
        {children}
      </View>
    );
  };

  // Find the matching payment method from fetched list (must be before early returns)
  const paymentMethodId = subscription?.customerPaymentMethodId || null;
  const matchedPM = useMemo(() => {
    if (!paymentMethodId || !Array.isArray(paymentMethod)) return null;
    return paymentMethod.find(pm => pm.id === paymentMethodId) || null;
  }, [paymentMethodId, paymentMethod]);

  // --- Render ---

  if (loading) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: secondaryTextColor }]}>Loading subscription…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.centered, { backgroundColor }]}>
        <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
      </View>
    );
  }
  if (!subscription) return null;

  const status = (subscription.status || '').toLowerCase();
  const statusColors = getStatusStyle(status);
  const isPaused = status === 'paused';
  const isActive = status === 'active';
  const lineItems = subscription.lines || subscription.lineItems || (subscription.productTitle ? [subscription] : []);
  const currencyCode = subscription.currencyCode || subscription.currency;
  const price = formatPrice(subscription.price || subscription.totalPrice, currencyCode);
  const shippingPrice = subscription.shippingPrice || subscription.deliveryPrice || subscription.totalShippingPrice || null;
  const shippingStr = shippingPrice ? formatPrice(shippingPrice, currencyCode) : null;
  const deliveryChargeText = model.get('deliveryChargeText') || 'shipping per delivery';
  const nextOrder = subscription.nextBillingDateEpoch
    ? formatDate(new Date(subscription.nextBillingDateEpoch * 1000).toISOString())
    : formatDate(subscription.nextBillingDate);
  const freq = subscription.billingPolicy
    ? `Deliver Every ${subscription.billingPolicy.intervalCount} ${(subscription.billingPolicy.interval || '').charAt(0).toUpperCase() + (subscription.billingPolicy.interval || '').slice(1).toLowerCase()}s`
    : safeStr(subscription.orderFrequency);
  const addr = subscription.shippingAddress || {};
  const lastPaymentStatus = safeStr(subscription.lastPaymentStatus) || null;
  const lastChargedDate = subscription.lastBillingDate || subscription.lastOrderDate || subscription.lastPaymentDate || null;
  const appliedDiscounts = subscription.discountCodes || subscription.discounts || subscription.appliedDiscounts || [];

  return (
    <View nativeID={'rootElement-' + id} style={[styles.root, { backgroundColor }]}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, alignSelf: 'flex-start' }]}>
        <Text style={[styles.statusText, { color: statusColors.text }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>

      {/* Price + frequency summary */}
      {price ? (
        <Text style={[styles.priceSummary, { color: textColor }]}>{price}</Text>
      ) : null}
      {freq ? (
        <Text style={[styles.freqSummary, { color: secondaryTextColor }]}>{freq}</Text>
      ) : null}

      {/* Next order date */}
      <Text style={[styles.nextOrderText, { color: textColor, fontWeight: '600' }]}>
        Next order: {nextOrder}
      </Text>

      {/* Delivery charge */}
      <Text style={[styles.deliveryChargeText, { color: secondaryTextColor }]}>
        {shippingStr ? `${shippingStr} ${deliveryChargeText}` : deliveryChargeText}
      </Text>

      {/* Last charged date */}
      {lastChargedDate ? (
        <Text style={[styles.lastChargedText, { color: secondaryTextColor }]}>
          Your last order was charged on {formatDate(lastChargedDate)}.
        </Text>
      ) : null}

      {/* Top action message */}
      {topMessage ? (
        <View style={[styles.msgBox, { borderColor, borderRadius: cardBorderRadius }]}>
          <Text style={{ fontSize: 14, color: topMessage.includes('success') ? '#10B981' : '#EF4444' }}>{topMessage}</Text>
        </View>
      ) : null}
      {actionLoading ? <ActivityIndicator size="small" color={primaryColor} style={{ marginVertical: 8 }} /> : null}

      {/* Action buttons — stacked like the web version */}
      <View style={styles.actionsColumn}>
        {showGetDeliveryNow && isActive ? (
          <TouchableOpacity style={[styles.actionBtnFull, { backgroundColor: textColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]} onPress={handleGetDeliveryNow} disabled={actionLoading}>
            <Text style={styles.actionBtnFullText}>Get Your Next Delivery Now</Text>
          </TouchableOpacity>
        ) : null}
        {showSkipOption && isActive ? (
          <TouchableOpacity style={[styles.actionBtnOutlineFull, { borderColor: textColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]} onPress={handleSkip} disabled={actionLoading}>
            <Text style={[styles.actionBtnOutlineFullText, { color: textColor }]}>Skip order</Text>
          </TouchableOpacity>
        ) : null}
        {showReschedule && isActive ? (
          editMode === 'reschedule' ? (
            <View style={[styles.rescheduleForm, { borderColor, borderRadius: cardBorderRadius }]}>
              <Text style={[styles.fieldLabel, { color: secondaryTextColor, marginTop: 0, marginBottom: 8 }]}>Select a new date</Text>
              {(() => {
                const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
                const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                const cells = [];
                for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                return (
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <TouchableOpacity onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} style={{ padding: 8 }}><Text style={{ fontSize: 18, color: primaryColor }}>‹</Text></TouchableOpacity>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }}>{monthLabel}</Text>
                      <TouchableOpacity onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} style={{ padding: 8 }}><Text style={{ fontSize: 18, color: primaryColor }}>›</Text></TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(h => <Text key={h} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: secondaryTextColor, marginBottom: 6 }}>{h}</Text>)}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {cells.map((day, i) => {
                        if (day === null) return <View key={'e' + i} style={{ width: '14.28%', height: 36 }} />;
                        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = dateStr === selectedDate;
                        const disabled = dateStr < tomorrowStr;
                        return (
                          <TouchableOpacity key={dateStr} disabled={disabled} onPress={() => setSelectedDate(dateStr)} style={{ width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: isSelected ? primaryColor : 'transparent' }}>
                            <Text style={{ fontSize: 14, color: isSelected ? '#FFF' : disabled ? borderColor : textColor, fontWeight: isSelected ? '700' : '400' }}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
              <View style={styles.rescheduleActions}>
                <TouchableOpacity
                  style={[styles.actionBtnFull, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, flex: 1, opacity: (actionLoading || !selectedDate) ? 0.6 : 1 }]}
                  onPress={() => confirmAndExecute('Re-schedule Order?', `Reschedule your next order to ${selectedDate}?`, handleReschedule)}
                  disabled={actionLoading || !selectedDate}
                >
                  <Text style={styles.actionBtnFullText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtnOutlineFull, { borderColor, borderRadius: cardBorderRadius, flex: 1, marginLeft: 8 }]}
                  onPress={() => setEditMode(null)}
                >
                  <Text style={[styles.actionBtnOutlineFullText, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={[styles.actionBtnOutlineFull, { borderColor: textColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]} onPress={() => setEditMode('reschedule')} disabled={actionLoading}>
              <Text style={[styles.actionBtnOutlineFullText, { color: textColor }]}>Re-schedule</Text>
            </TouchableOpacity>
          )
        ) : null}
        {showPauseResume && isPaused ? (
          <TouchableOpacity style={[styles.actionBtnFull, { backgroundColor: '#10B981', borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]} onPress={handleResume} disabled={actionLoading}>
            <Text style={styles.actionBtnFullText}>Resume</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Product Details Section */}
      {showProductDetails && lineItems.length > 0 ? renderSection('Subscription details', (
        <>
          {lineItems.map((item, idx) => {
            const imgUrl = item.productImage || item.variantImage || item.image;
            const title = safeStr(item.productTitle || item.title, 'Product');
            const variant = safeStr(item.variantTitle);
            const qty = item.quantity || 1;
            const linePrice = formatPrice(item.price || item.linePrice, item.currencyCode || currencyCode);
            const compareAtPrice = item.compareAtPrice || item.compare_at_price;
            const compareStr = compareAtPrice ? formatPrice(compareAtPrice, item.currencyCode || currencyCode) : null;
            const lineId = item.id || item.lineId;
            const isOutOfStock = item.inventoryQuantity != null && item.inventoryQuantity <= 0;
            const discountPct = extractDiscount(item.discountPercentage ?? item.subscriptionDiscount ?? item.discount_percentage);

            return (
              <View key={lineId || idx} style={[styles.productCard, idx > 0 && { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: borderColor }]}>
                <View style={styles.productRow}>
                  {imgUrl ? <Image source={{ uri: imgUrl }} style={styles.productImage} /> : <View style={styles.productImagePlaceholder} />}
                  <View style={styles.productInfo}>
                    <Text style={[styles.productTitle, { color: textColor }]} numberOfLines={2}>{title}</Text>
                    {variant ? <Text style={[styles.productVariant, { color: secondaryTextColor }]}>{variant}</Text> : null}
                    {isOutOfStock ? <Text style={styles.outOfStock}>Out of stock</Text> : null}
                    {discountPct ? (
                      <View style={[styles.discountBadge, { backgroundColor: primaryColor + '15' }]}>
                        <Text style={[styles.discountBadgeText, { color: primaryColor }]}>Subscription discount ({discountPct}%)</Text>
                      </View>
                    ) : null}
                    <View style={styles.productPriceRow}>
                      {linePrice ? <Text style={[styles.productPrice, { color: textColor }]}>{linePrice}</Text> : null}
                      {compareStr ? <Text style={[styles.comparePrice, { color: secondaryTextColor, marginLeft: 6 }]}>{compareStr}</Text> : null}
                    </View>
                    <Text style={[styles.productQty, { color: secondaryTextColor }]}>Qty: {qty}</Text>
                  </View>
                  <TouchableOpacity style={[styles.editProductBtn, { borderColor: primaryColor }]} onPress={() => openEditPanel(item)}>
                    <Text style={[styles.editProductBtnText, { color: primaryColor }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      ), 'products') : null}

      {/* Upsell / One-Time Add Section */}
      {showOneTimeAdd ? (
        <View
          style={[styles.upsellSection, { backgroundColor }]}
          onLayout={e => setUpsellContainerWidth(e.nativeEvent.layout.width)}
        >
          <Text style={[styles.upsellTitle, { color: textColor }]}>Goes well with your next order...</Text>

          {/* Loading state */}
          {upsellProducts === null ? (
            <ActivityIndicator size="small" color={primaryColor} style={{ marginVertical: 20, alignSelf: 'flex-start' }} />
          ) : upsellProducts.length === 0 ? (
            <Text style={[styles.upsellEmptyText, { color: secondaryTextColor }]}>No add-on products available.</Text>
          ) : (() => {
            const cardWidth = upsellContainerWidth ? upsellContainerWidth * 0.72 : 240;
            return (
              <>
                <FlatList
                  data={upsellProducts}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={cardWidth + 12}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingRight: 8 }}
                  keyExtractor={(p, i) => String(p.id || i)}
                  renderItem={({ item: product }) => {
                    const pImg = product.image;
                    const pTitle = safeStr(product.title || product.product_title || product.productTitle, 'Product');
                    const cur = product.currency_code || product.currencyCode || currencyCode;
                    const spPrice = product.sp_discounted_price;
                    const origPrice = product.price || product.upsell_discounted_price;
                    const pPriceRaw = spPrice || origPrice;
                    const pPrice = pPriceRaw ? formatPrice(pPriceRaw, cur) : '';
                    const hasDiscount = spPrice && origPrice && parseFloat(origPrice) > parseFloat(spPrice);
                    const pCompare = hasDiscount ? formatPrice(origPrice, cur) : '';
                    return (
                      <View style={[styles.upsellCard, { width: cardWidth, borderRadius: cardBorderRadius }]}>
                        {pImg
                          ? <Image source={{ uri: pImg }} style={styles.upsellCardImage} />
                          : <View style={styles.upsellCardImagePlaceholder} />}
                        <Text style={[styles.upsellCardTitle, { color: textColor }]} numberOfLines={2}>{pTitle}</Text>
                        <View style={styles.upsellCardBottom}>
                          <View style={styles.upsellCardPriceRow}>
                            {pPrice ? <Text style={[styles.upsellCardPrice, { color: textColor }]}>{pPrice}</Text> : null}
                            {pCompare ? <Text style={styles.upsellCardCompare}>{pCompare}</Text> : null}
                          </View>
                          <TouchableOpacity
                            style={[styles.upsellAddBtn, { backgroundColor: primaryColor, borderRadius: 20 }]}
                            onPress={() => openAddPanel(product)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.upsellAddBtnText}>+ Add</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />
                <TouchableOpacity onPress={() => openAddPanel(null)} style={styles.seeMoreLink}>
                  <Text style={[styles.seeMoreText, { color: textColor }]}>See more products</Text>
                </TouchableOpacity>
              </>
            );
          })()}
        </View>
      ) : null}

      {/* Order Notes Section */}
      {showOrderNotes ? renderSection('Order notes', (
        <>
          {editMode === 'orderNote' ? (
            <View>
              <TextInput
                style={[styles.noteInput, { borderColor, color: textColor, borderRadius: cardBorderRadius }]}
                value={orderNote}
                onChangeText={setOrderNote}
                placeholder="Add your note"
                placeholderTextColor={secondaryTextColor}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.rescheduleActions}>
                <TouchableOpacity
                  style={[styles.actionBtnFull, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, flex: 1, opacity: actionLoading ? 0.6 : 1 }]}
                  onPress={() => confirmAndExecute('Save Order Note?', 'Your order note will be updated.', handleSaveOrderNote)}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.actionBtnFullText}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtnOutlineFull, { borderColor, borderRadius: cardBorderRadius, flex: 1, marginLeft: 8 }]}
                  onPress={() => setEditMode(null)}
                >
                  <Text style={[styles.actionBtnOutlineFullText, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.addressText, { color: orderNote ? textColor : secondaryTextColor }]}>
                {orderNote || 'Add your note'}
              </Text>
            </>
          )}
        </>
      ), 'orderNote', (
        editMode !== 'orderNote' ? (
          <TouchableOpacity onPress={() => setEditMode('orderNote')}>
            <Text style={[styles.sectionEditBtn, { color: primaryColor, borderColor: primaryColor }]}>Edit</Text>
          </TouchableOpacity>
        ) : null
      )) : null}

      {/* Discount Code Section */}
      {showDiscountCode ? renderSection('Discount code', (
        <>
          {/* Applied discounts */}
          {Array.isArray(appliedDiscounts) && appliedDiscounts.length > 0 ? (
            <View style={{ marginBottom: 10 }}>
              {appliedDiscounts.map((d, i) => {
                const code = typeof d === 'string' ? d : safeStr(d.code || d.discountCode);
                const shopifyId = d.shopifyId || d.id || '';
                const discountValue = safeStr(d.value ?? d.amount);
                return (
                  <View key={shopifyId || code || i} style={[styles.appliedDiscount, { borderColor, borderRadius: cardBorderRadius }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.discountCode, { color: textColor }]}>{code}</Text>
                      {discountValue ? <Text style={[styles.discountValue, { color: secondaryTextColor }]}>{discountValue}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveDiscount(shopifyId, code)} disabled={discountLoading}>
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : null}
          {/* Input row */}
          <View style={styles.discountRow}>
            <TextInput
              style={[styles.discountInput, { borderColor, color: textColor, borderRadius: cardBorderRadius }]}
              value={discountInput}
              onChangeText={setDiscountInput}
              placeholder="Discount code"
              placeholderTextColor={secondaryTextColor}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, opacity: (!discountInput.trim() || discountLoading) ? 0.6 : 1 }]}
              onPress={handleApplyDiscount}
              disabled={!discountInput.trim() || discountLoading}
            >
              {discountLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.applyBtnText}>Apply</Text>}
            </TouchableOpacity>
          </View>
        </>
      ), 'discount') : null}

      {/* Subscription Plan Section */}
      {showFrequencyEdit && (isActive || isPaused) ? renderSection('Subscription plan', (
        <>
          <Text style={[styles.addressText, { color: textColor }]}>{freq || '—'}</Text>
          {editMode === 'frequency' ? (
            <View style={styles.editForm}>
              {availableFrequencies.length > 0 ? (
                <>
                  <Text style={[styles.fieldLabel, { color: secondaryTextColor }]}>Select Plan</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalScroll} contentContainerStyle={styles.intervalRow}>
                    {availableFrequencies.map((f, idx) => {
                      const fInterval = f.interval || f.deliveryInterval;
                      const fCount = f.intervalCount || f.deliveryIntervalCount;
                      const key = `${fCount}-${fInterval}-${idx}`;
                      const isSelected = String(freqCount) === String(fCount) && freqInterval === fInterval;
                      return (
                        <TouchableOpacity key={key} style={[styles.intervalBtn, { borderColor, backgroundColor: isSelected ? primaryColor : 'transparent' }]} onPress={() => { setFreqCount(String(fCount)); setFreqInterval(fInterval); }}>
                          <Text style={{ color: isSelected ? '#FFF' : textColor, fontSize: 13, fontWeight: '600' }}>Every {fCount} {fInterval}{fCount > 1 ? 'S' : ''}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text style={[styles.fieldLabel, { color: secondaryTextColor }]}>Interval Count</Text>
                  <TextInput style={[styles.input, { borderColor, color: textColor }]} value={freqCount} onChangeText={setFreqCount} keyboardType="numeric" />
                  <Text style={[styles.fieldLabel, { color: secondaryTextColor }]}>Interval</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalScroll} contentContainerStyle={styles.intervalRow}>
                    {['DAY', 'WEEK', 'MONTH'].map(opt => (
                      <TouchableOpacity key={opt} style={[styles.intervalBtn, { borderColor, backgroundColor: freqInterval === opt ? primaryColor : 'transparent' }]} onPress={() => setFreqInterval(opt)}>
                        <Text style={{ color: freqInterval === opt ? '#FFF' : textColor, fontSize: 13, fontWeight: '600' }}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]} onPress={() => confirmAndExecute('Update Frequency?', 'Your subscription frequency will be updated.', handleSaveFrequency)} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save Frequency</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ), 'plan', (
        editMode !== 'frequency' ? (
          <TouchableOpacity onPress={() => setEditMode('frequency')}>
            <Text style={[styles.sectionEditBtn, { color: primaryColor, borderColor: primaryColor }]}>Edit</Text>
          </TouchableOpacity>
        ) : null
      )) : null}

      {/* Shipping Address Section */}
      {showAddressEdit ? renderSection('Shipping address', (
        <>
          {editMode === 'address' ? (
            <View style={styles.editForm}>
              {['firstName', 'lastName', 'address1', 'address2', 'city', 'province', 'provinceCode', 'zip', 'country', 'countryCode'].map(field => {
                const labels = { firstName: 'First Name', lastName: 'Last Name', address1: 'Address 1', address2: 'Address 2', city: 'City', province: 'Province / State', provinceCode: 'Province Code (e.g. CA, NY)', zip: 'Zip / Postal Code', country: 'Country', countryCode: 'Country Code (e.g. US, IN)' };
                const fieldError = addrErrors[field];
                const autoCapitalize = (field === 'countryCode' || field === 'provinceCode') ? 'characters' : 'words';
                return (
                  <View key={field}>
                    <Text style={[styles.fieldLabel, { color: secondaryTextColor }]}>{labels[field] || field}</Text>
                    <TextInput
                      style={[styles.input, { borderColor: fieldError ? '#EF4444' : borderColor, color: textColor }]}
                      value={addrFields[field]}
                      onChangeText={val => {
                        const finalVal = (field === 'countryCode' || field === 'provinceCode') ? val.toUpperCase() : val;
                        setAddrFields(prev => ({ ...prev, [field]: finalVal }));
                        if (addrErrors[field]) setAddrErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
                      }}
                      placeholder={labels[field] || field}
                      autoCapitalize={autoCapitalize}
                      maxLength={(field === 'countryCode') ? 2 : (field === 'provinceCode') ? 5 : undefined}
                    />
                    {fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
                  </View>
                );
              })}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]} onPress={() => confirmAndExecute('Update Address?', 'Your shipping address will be updated.', handleSaveAddress)} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save Address</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.addressText, { color: textColor }]}>
                {[addr.firstName, addr.lastName].filter(Boolean).join(' ')}
              </Text>
              <Text style={[styles.addressText, { color: textColor }]}>
                {[addr.address1, addr.address2].filter(Boolean).join(', ')}
              </Text>
              <Text style={[styles.addressText, { color: textColor }]}>
                {[addr.city, addr.province, addr.zip].filter(Boolean).join(', ')}
              </Text>
              <Text style={[styles.addressText, { color: textColor }]}>
                {addr.country || ''}
              </Text>
            </>
          )}
        </>
      ), 'address', (
        editMode !== 'address' ? (
          <TouchableOpacity onPress={() => setEditMode('address')}>
            <Text style={[styles.sectionEditBtn, { color: primaryColor, borderColor: primaryColor }]}>Edit</Text>
          </TouchableOpacity>
        ) : null
      )) : null}

      {/* Payment Details Section */}
      {showPaymentDetails ? renderSection('Payment details', (
        <View>
          {matchedPM ? (
            <>
              {matchedPM.card ? (
                <View style={styles.paymentRow}>
                  <Text style={[styles.infoValue, { color: textColor, textTransform: 'capitalize' }]}>
                    {matchedPM.card.brand || 'Card'} ending in {matchedPM.card.lastDigits || '****'}
                  </Text>
                  {matchedPM.card.expiryMonth != null && matchedPM.card.expiryYear != null ? (
                    <Text style={[styles.infoLabel, { color: secondaryTextColor, marginTop: 2 }]}>
                      Expires {String(matchedPM.card.expiryMonth).padStart(2, '0')}/{matchedPM.card.expiryYear}
                    </Text>
                  ) : null}
                </View>
              ) : matchedPM.payPal ? (
                <Text style={[styles.infoValue, { color: textColor }]}>
                  PayPal — {matchedPM.payPal.email || 'Connected'}
                </Text>
              ) : matchedPM.shopPay ? (
                <Text style={[styles.infoValue, { color: textColor }]}>
                  ShopPay ending in {matchedPM.shopPay.lastDigits || '****'}
                </Text>
              ) : (
                <Text style={[styles.addressText, { color: textColor }]}>Payment method on file</Text>
              )}
              {matchedPM.lastUpdated ? (
                <Text style={[styles.infoLabel, { color: secondaryTextColor, marginTop: 2 }]}>
                  Last updated on {formatDate(matchedPM.lastUpdated)}
                </Text>
              ) : null}
              {matchedPM.status === 'expired' ? (
                <Text style={[styles.fieldError, { marginTop: 4 }]}>Payment method expired</Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.addressText, { color: textColor }]}>
              {paymentMethodId ? 'Payment method on file' : 'No payment method'}
            </Text>
          )}
          {lastPaymentStatus ? (
            <Text style={[styles.addressText, { color: lastPaymentStatus === 'SUCCESS' ? '#16A34A' : '#EF4444', marginTop: 4 }]}>
              Last payment: {lastPaymentStatus === 'SUCCESS' ? 'Successful' : lastPaymentStatus}
            </Text>
          ) : null}
        </View>
      ), 'payment') : null}

      {/* Pause subscription */}
      {showPauseResume && isActive ? (
        <TouchableOpacity
          style={[styles.pauseBtn, { borderColor: textColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]}
          onPress={handlePause}
          disabled={actionLoading}
        >
          <Text style={[styles.pauseBtnText, { color: textColor }]}>Pause subscription</Text>
        </TouchableOpacity>
      ) : null}

      {/* Cancel subscription */}
      {isActive ? (
        <TouchableOpacity
          style={styles.cancelLink}
          onPress={() => navigation.navigate('LoopCancelSubscription', { subscriptionId })}
        >
          <Text style={[styles.cancelLinkText, { color: '#EF4444' }]}>Cancel subscription</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>

    <Modal visible={!!editingLine} transparent animationType="none" onRequestClose={closePanel}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closePanel} />
        <Animated.View style={[styles.slidePanel, { transform: [{ translateX: slideAnim }] }]}>
          {panelView === 'edit' && editingLine ? (() => {
            const imgUrl = editingLine.productImage || editingLine.variantImage || editingLine.image;
            const title = safeStr(editingLine.productTitle || editingLine.title, 'Product');
            const linePrice = formatPrice(editingLine.price || editingLine.linePrice, editingLine.currencyCode || currencyCode);
            const compareAtPrice = editingLine.compareAtPrice || editingLine.compare_at_price;
            const compareStr = compareAtPrice ? formatPrice(compareAtPrice, editingLine.currencyCode || currencyCode) : null;
            const discountPct = extractDiscount(editingLine.discountPercentage ?? editingLine.subscriptionDiscount ?? editingLine.discount_percentage);
            return (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Header */}
                <SafeAreaView>
                  <View style={styles.panelHeader}>
                    <Text style={[styles.panelTitle, { color: textColor }]}>Edit product</Text>
                    <TouchableOpacity onPress={closePanel}><Text style={{ fontSize: 22, color: secondaryTextColor }}>✕</Text></TouchableOpacity>
                  </View>
                </SafeAreaView>
                <View style={[styles.panelDivider, { backgroundColor: borderColor }]} />

                {/* Product image */}
                {imgUrl ? <Image source={{ uri: imgUrl }} style={styles.panelProductImage} /> : null}

                {/* Product info */}
                <Text style={[styles.panelProductTitle, { color: textColor }]}>{title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  {linePrice ? <Text style={[styles.panelPrice, { color: textColor }]}>{linePrice}</Text> : null}
                  {compareStr ? <Text style={[styles.panelComparePrice, { color: secondaryTextColor }]}>{compareStr}</Text> : null}
                </View>
                {discountPct ? (
                  <View style={[styles.discountBadge, { backgroundColor: primaryColor + '15', marginTop: 8 }]}>
                    <Text style={[styles.discountBadgeText, { color: primaryColor }]}>Subscription discount ({discountPct}%)</Text>
                  </View>
                ) : null}

                {/* Quantity */}
                <Text style={[styles.panelQtyLabel, { color: textColor }]}>Quantity</Text>
                <View style={[styles.panelQtyControls, { borderColor }]}>
                  <TouchableOpacity style={styles.panelQtyBtn} onPress={() => { if (editQty > 1) setEditQty(editQty - 1); }} disabled={editQty <= 1}>
                    <Text style={[styles.panelQtyBtnText, { color: editQty <= 1 ? borderColor : textColor }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.panelQtyValue, { color: textColor }]}>{editQty}</Text>
                  <TouchableOpacity style={styles.panelQtyBtn} onPress={() => setEditQty(editQty + 1)}>
                    <Text style={[styles.panelQtyBtnText, { color: textColor }]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Panel message */}
                {panelMsg ? <Text style={{ fontSize: 13, color: panelMsg.includes('success') ? '#10B981' : '#EF4444', marginTop: 12 }}>{panelMsg}</Text> : null}
              </ScrollView>
            );
          })() : null}

          {panelView === 'swap' ? (
            <View style={{ flex: 1 }}>
              {/* Header */}
              <SafeAreaView>
                <View style={styles.panelHeader}>
                  <Text style={[styles.panelTitle, { color: textColor }]}>Select product</Text>
                  <TouchableOpacity onPress={closePanel}><Text style={{ fontSize: 22, color: secondaryTextColor }}>✕</Text></TouchableOpacity>
                </View>
              </SafeAreaView>
              <View style={[styles.panelDivider, { backgroundColor: borderColor }]} />

              {/* Search */}
              <View style={styles.swapSearchRow}>
                <TextInput
                  style={[styles.swapSearchInput, { borderColor, color: textColor }]}
                  value={swapSearch}
                  onChangeText={setSwapSearch}
                  placeholder="Search"
                  placeholderTextColor={secondaryTextColor}
                  onSubmitEditing={handleSwapSearch}
                />
                <TouchableOpacity style={[styles.swapSearchBtn, { backgroundColor: primaryColor }]} onPress={handleSwapSearch}>
                  <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Search</Text>
                </TouchableOpacity>
              </View>

              {/* Product list */}
              {swapLoading ? <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 20 }} /> : (
                <FlatList
                  data={swapProducts}
                  keyExtractor={(p, i) => String(p.variant_shopify_id || p.id || i)}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  renderItem={({ item: product }) => {
                    const pImg = product.image || product.variantImage || product.productImage;
                    const pTitle = safeStr(product.product_title || product.title || product.productTitle, 'Product');
                    const hasDiscount = product.sp_discounted_price != null && product.sp_discounted_price !== product.price;
                    const pPrice = formatPrice(hasDiscount ? product.sp_discounted_price : product.price, product.currency_code || currencyCode);
                    const pCompare = hasDiscount ? product.price : null;
                    const pCompareStr = pCompare ? formatPrice(pCompare, product.currency_code || currencyCode) : null;
                    return (
                      <View style={[styles.swapCard, { borderColor, borderRadius: cardBorderRadius }]}>
                        {pImg ? <Image source={{ uri: pImg }} style={styles.swapCardImage} /> : <View style={[styles.swapCardImage, { backgroundColor: '#F3F4F6' }]} />}
                        <View style={styles.swapCardInfo}>
                          <Text style={[styles.swapCardTitle, { color: textColor }]} numberOfLines={2}>{pTitle}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            {pPrice ? <Text style={[styles.swapCardPrice, { color: textColor }]}>{pPrice}</Text> : null}
                            {pCompareStr ? <Text style={[styles.swapCardCompare, { color: secondaryTextColor }]}>{pCompareStr}</Text> : null}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.swapSelectBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius }]}
                          onPress={() => handleSelectSwap(product)}
                          disabled={actionLoading}
                        >
                          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Select</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  ListEmptyComponent={!swapLoading ? <Text style={[styles.swapEmpty, { color: secondaryTextColor }]}>No products found.</Text> : null}
                />
              )}

              {/* Panel message */}
              {panelMsg ? <Text style={{ fontSize: 13, color: '#EF4444', paddingHorizontal: 20, marginTop: 8 }}>{panelMsg}</Text> : null}
            </View>
          ) : null}

          {/* Bottom buttons */}
          <View style={styles.panelFooter}>
            {panelView === 'edit' ? (
              <>
                <TouchableOpacity
                  style={[styles.panelUpdateBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, opacity: actionLoading ? 0.6 : 1 }]}
                  onPress={handlePanelUpdateQty}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.panelUpdateBtnText}>Update</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.panelSwapBtn, { borderColor: textColor, borderRadius: cardBorderRadius }]}
                  onPress={handleOpenSwapView}
                >
                  <Text style={[styles.panelSwapBtnText, { color: textColor }]}>Swap</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => { setPanelView('edit'); setPanelMsg(null); }}>
                <Text style={[styles.panelGoBackText, { color: textColor }]}>Go back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={closePanel} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>

    {/* Add one-time product modal */}
    <Modal visible={addModalOpen} transparent animationType="none" onRequestClose={closeAddPanel}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeAddPanel} />
        <Animated.View style={[styles.slidePanel, { transform: [{ translateX: addSlideAnim }] }]}>

          {/* LIST VIEW */}
          {addModalView === 'list' ? (
            <View style={{ flex: 1 }}>
              <SafeAreaView>
                <View style={styles.panelHeader}>
                  <Text style={[styles.panelTitle, { color: textColor }]}>Select product</Text>
                  <TouchableOpacity onPress={closeAddPanel}><Text style={{ fontSize: 22, color: secondaryTextColor }}>✕</Text></TouchableOpacity>
                </View>
              </SafeAreaView>
              <View style={[styles.panelDivider, { backgroundColor: borderColor }]} />

              {/* Search */}
              <View style={styles.swapSearchRow}>
                <TextInput
                  style={[styles.swapSearchInput, { borderColor, color: textColor }]}
                  value={addSearch}
                  onChangeText={setAddSearch}
                  placeholder="Search"
                  placeholderTextColor={secondaryTextColor}
                  onSubmitEditing={handleAddSearch}
                />
                {addSearch.length > 0 ? (
                  <TouchableOpacity onPress={() => { setAddSearch(''); setAddListResults(upsellProducts || []); setAddProductMsg(null); }} style={{ padding: 8, marginRight: 4 }}>
                    <Text style={{ fontSize: 18, color: secondaryTextColor }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.swapSearchBtn, { backgroundColor: primaryColor }]} onPress={handleAddSearch}>
                  <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Search</Text>
                </TouchableOpacity>
              </View>

              {/* Product list */}
              {addListLoading ? <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 20 }} /> : (
                <FlatList
                  data={addListResults}
                  keyExtractor={(p, i) => String(p.id || i)}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  renderItem={({ item: product }) => {
                    const pImg = product.image || product.productImage || product.images?.[0]?.src;
                    const pTitle = safeStr(product.product_title || product.title || product.productTitle, 'Product');
                    const pPriceRaw = product.price || product.sp_discounted_price;
                    const cur = product.currency_code || product.currencyCode || currencyCode;
                    const pPrice = pPriceRaw ? formatPrice(pPriceRaw, cur) : '';
                    const pCompare = '';
                    return (
                      <View style={[styles.swapCard, { borderColor, borderRadius: cardBorderRadius }]}>
                        {pImg ? <Image source={{ uri: pImg }} style={styles.swapCardImage} /> : <View style={[styles.swapCardImage, { backgroundColor: '#F3F4F6' }]} />}
                        <View style={styles.swapCardInfo}>
                          <Text style={[styles.swapCardTitle, { color: textColor }]} numberOfLines={2}>{pTitle}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            {pPrice ? <Text style={[styles.swapCardPrice, { color: textColor }]}>{pPrice}</Text> : null}
                            {pCompare ? <Text style={[styles.swapCardCompare, { color: secondaryTextColor }]}>{pCompare}</Text> : null}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.swapSelectBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius }]}
                          onPress={() => handleSelectForAdd(product)}
                        >
                          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Select</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  ListEmptyComponent={!addListLoading ? <Text style={[styles.swapEmpty, { color: secondaryTextColor }]}>No products found.</Text> : null}
                />
              )}
              {addProductMsg ? <Text style={{ fontSize: 13, color: '#EF4444', paddingHorizontal: 20, marginTop: 8 }}>{addProductMsg}</Text> : null}
            </View>
          ) : null}

          {/* DETAIL VIEW */}
          {addModalView === 'detail' && selectedAddProduct ? (() => {
            const product = selectedAddProduct;
            const pImg = product.image || product.productImage || product.images?.[0]?.src;
            const pTitle = safeStr(product.product_title || product.title || product.productTitle, 'Product');
            const cur = product.currency_code || product.currencyCode || currencyCode;
            const basePrice = product.price ? formatPrice(product.price, cur) : '';
            const subPrice = product.sp_discounted_price ? formatPrice(product.sp_discounted_price, cur) : '';
            const displayPrice = (addPurchaseType === 'subscription' && subPrice) ? subPrice : basePrice;
            const strikePrice = (addPurchaseType === 'subscription' && subPrice && basePrice) ? basePrice : '';
            const options = product.product_options || product.options || [];
            const spg = (product.selling_plan_groups || product.sellingPlanGroups || [])[0];
            const directSellingPlanGroupId = product.selling_plan_group_id || product.sellingPlanGroupId;
            const savingsPct = extractDiscount(
              product.upsell_subscription_discount_value ??
              spg?.savingsPercent ?? spg?.savings_percent ?? spg?.discount
            ) || (
              product.sp_discounted_price && product.price
                ? Math.round((1 - parseFloat(product.sp_discounted_price) / parseFloat(product.price)) * 100) || null
                : null
            );
            const hasSubscriptionOption = !!(spg || directSellingPlanGroupId || product.sp_discounted_price || savingsPct);
            return (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <SafeAreaView>
                  <View style={styles.panelHeader}>
                    <Text style={[styles.panelTitle, { color: textColor }]}>Add product</Text>
                    <TouchableOpacity onPress={closeAddPanel}><Text style={{ fontSize: 22, color: secondaryTextColor }}>✕</Text></TouchableOpacity>
                  </View>
                </SafeAreaView>
                <View style={[styles.panelDivider, { backgroundColor: borderColor }]} />

                {/* Product image */}
                {pImg ? (
                  <Image source={{ uri: pImg }} style={[styles.panelProductImage, { alignSelf: 'center', marginTop: 20, marginBottom: 8 }]} resizeMode="contain" />
                ) : (
                  <View style={[styles.panelProductImage, { alignSelf: 'center', marginTop: 20, marginBottom: 8, backgroundColor: '#F3F4F6' }]} />
                )}

                {/* Product name + price */}
                <Text style={[styles.panelProductTitle, { color: textColor, paddingHorizontal: 20, marginTop: 12 }]}>{pTitle}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 4, gap: 8 }}>
                  <Text style={[styles.panelPrice, { color: textColor }]}>{displayPrice}</Text>
                  {strikePrice ? <Text style={{ fontSize: 15, color: secondaryTextColor, textDecorationLine: 'line-through' }}>{strikePrice}</Text> : null}
                </View>

                {/* Variant options — dropdown style */}
                {options.length > 0 ? (
                  <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                    <Text style={[styles.panelQtyLabel, { color: textColor, paddingHorizontal: 0, marginTop: 0, marginBottom: 12 }]}>Choose product options</Text>
                    {options.map(opt => {
                      const isOpen = addOpenDropdown === opt.name;
                      const selectedVal = addOptionValues[opt.name] || (opt.values?.[0] ?? '');
                      return (
                        <View key={opt.name} style={{ marginBottom: 14 }}>
                          <Text style={[styles.fieldLabel, { color: secondaryTextColor, marginTop: 0, marginBottom: 6 }]}>{opt.name}</Text>
                          <TouchableOpacity
                            style={[styles.addDropdownBtn, { borderColor, backgroundColor }]}
                            onPress={() => setAddOpenDropdown(isOpen ? null : opt.name)}
                            activeOpacity={0.8}
                          >
                            <Text style={{ flex: 1, fontSize: 15, color: textColor }}>{selectedVal}</Text>
                            <Text style={{ fontSize: 13, color: secondaryTextColor }}>{isOpen ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                          {isOpen ? (
                            <View style={[styles.addDropdownList, { borderColor, backgroundColor }]}>
                              {(opt.values || []).map(val => (
                                <TouchableOpacity
                                  key={val}
                                  style={[styles.addDropdownItem, { borderBottomColor: borderColor }]}
                                  onPress={() => {
                                    setAddOptionValues(prev => ({ ...prev, [opt.name]: val }));
                                    setAddOpenDropdown(null);
                                  }}
                                >
                                  <Text style={{ fontSize: 15, color: textColor, fontWeight: val === selectedVal ? '700' : '400' }}>{val}</Text>
                                  {val === selectedVal ? <Text style={{ color: primaryColor, fontSize: 16 }}>✓</Text> : null}
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Quantity */}
                <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                  <Text style={[styles.panelQtyLabel, { color: textColor, paddingHorizontal: 0, marginTop: 0, marginBottom: 12 }]}>Quantity</Text>
                  <View style={[styles.panelQtyControls, { borderColor }]}>
                    <TouchableOpacity style={styles.panelQtyBtn} onPress={() => { if (addQty > 1) setAddQty(addQty - 1); }} disabled={addQty <= 1}>
                      <Text style={[styles.panelQtyBtnText, { color: addQty <= 1 ? borderColor : textColor }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.panelQtyValue, { color: textColor }]}>{addQty}</Text>
                    <TouchableOpacity style={styles.panelQtyBtn} onPress={() => setAddQty(addQty + 1)}>
                      <Text style={[styles.panelQtyBtnText, { color: textColor }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Purchase options */}
                <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                  <Text style={[styles.panelQtyLabel, { color: textColor, paddingHorizontal: 0, marginTop: 0, marginBottom: 8, fontWeight: '700' }]}>Purchase options</Text>
                  <TouchableOpacity style={styles.purchaseOptionRow} onPress={() => setAddPurchaseType('oneTime')}>
                    <View style={[styles.radioOuter, { borderColor: addPurchaseType === 'oneTime' ? primaryColor : borderColor }]}>
                      {addPurchaseType === 'oneTime' ? <View style={[styles.radioInner, { backgroundColor: primaryColor }]} /> : null}
                    </View>
                    <Text style={[styles.purchaseOptionLabel, { color: textColor }]}>Add one-time</Text>
                  </TouchableOpacity>
                  {hasSubscriptionOption ? (
                    <TouchableOpacity style={styles.purchaseOptionRow} onPress={() => setAddPurchaseType('subscription')}>
                      <View style={[styles.radioOuter, { borderColor: addPurchaseType === 'subscription' ? primaryColor : borderColor }]}>
                        {addPurchaseType === 'subscription' ? <View style={[styles.radioInner, { backgroundColor: primaryColor }]} /> : null}
                      </View>
                      <Text style={[styles.purchaseOptionLabel, { color: textColor }]}>
                        Add subscription{savingsPct ? `, Save ${savingsPct}%` : ''}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Message */}
                {addProductMsg ? (
                  <Text style={{ fontSize: 13, color: addProductMsg.includes('success') ? '#10B981' : '#EF4444', paddingHorizontal: 20, marginTop: 12 }}>
                    {addProductMsg}
                  </Text>
                ) : null}
              </ScrollView>
            );
          })() : null}

          {/* Footer */}
          <View style={styles.panelFooter}>
            {addModalView === 'detail' ? (
              <>
                <TouchableOpacity
                  style={[styles.panelUpdateBtn, { backgroundColor: primaryColor, borderRadius: cardBorderRadius, opacity: addProductLoading ? 0.6 : 1 }]}
                  onPress={handleConfirmAdd}
                  disabled={addProductLoading}
                >
                  {addProductLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={styles.panelUpdateBtnText}>{addPurchaseType === 'oneTime' ? 'Add One-time' : 'Add Subscription'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAddModalView('list'); setAddProductMsg(null); }}>
                  <Text style={[styles.panelGoBackText, { color: textColor }]}>Go back</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity onPress={closeAddPanel} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' }}>Close</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 'unset', minHeight: 400 },
  centered: { flex: 'unset', minHeight: 200, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Status
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, marginBottom: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Summary
  priceSummary: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  freqSummary: { fontSize: 14, marginBottom: 4 },
  nextOrderText: { fontSize: 15, marginBottom: 4 },
  deliveryChargeText: { fontSize: 13, marginBottom: 4 },
  lastChargedText: { fontSize: 13, marginBottom: 16 },

  // Message
  msgBox: { borderWidth: 1, padding: 12, marginBottom: 12 },

  // Action buttons — stacked full-width
  actionsColumn: { marginBottom: 20 },
  actionBtnFull: { paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  actionBtnFullText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  actionBtnOutlineFull: { borderWidth: 1.5, paddingVertical: 11, alignItems: 'center', marginBottom: 8 },
  actionBtnOutlineFullText: { fontSize: 15, fontWeight: '600' },

  // Reschedule form
  rescheduleForm: { borderWidth: 1, padding: 14, marginBottom: 8 },
  rescheduleActions: { flexDirection: 'row', marginTop: 8 },

  // Sections
  section: { borderWidth: 1, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionEditBtn: { fontSize: 13, fontWeight: '600', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  sectionDivider: { height: 1, marginVertical: 12 },
  sectionMsgBox: { backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },

  // Product details
  productCard: {},
  productRow: { flexDirection: 'row', alignItems: 'flex-start' },
  productImage: { width: 64, height: 64, borderRadius: 8, marginRight: 12, resizeMode: 'cover' },
  productImagePlaceholder: { width: 64, height: 64, borderRadius: 8, marginRight: 12, backgroundColor: '#F3F4F6' },
  productInfo: { flex: 1, marginRight: 8 },
  productTitle: { fontSize: 14, fontWeight: '600' },
  productVariant: { fontSize: 12, marginTop: 2 },
  productQty: { fontSize: 12, marginTop: 3 },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  productPrice: { fontSize: 14, fontWeight: '700' },
  comparePrice: { fontSize: 13, textDecorationLine: 'line-through' },
  outOfStock: { fontSize: 12, color: '#EF4444', fontWeight: '600', marginTop: 3 },
  discountBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 4 },
  discountBadgeText: { fontSize: 11, fontWeight: '600' },
  editProductBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
  editProductBtnText: { fontSize: 13, fontWeight: '600' },

  // Modal / Slide panel
  modalOverlay: { flex: 1, flexDirection: 'row' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  slidePanel: { width: SCREEN_WIDTH * 0.85, backgroundColor: '#FFFFFF', position: 'absolute', top: 0, right: 0, bottom: 0, shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  panelTitle: { fontSize: 20, fontWeight: '700' },
  panelDivider: { height: 1, marginBottom: 16 },
  panelProductImage: { width: '100%', height: 250, resizeMode: 'contain', marginBottom: 16, paddingHorizontal: 20 },
  panelProductTitle: { fontSize: 17, fontWeight: '600', paddingHorizontal: 20 },
  panelPrice: { fontSize: 16, fontWeight: '700', paddingHorizontal: 20 },
  panelComparePrice: { fontSize: 14, textDecorationLine: 'line-through', marginLeft: 8 },
  panelQtyLabel: { fontSize: 15, fontWeight: '600', marginTop: 20, paddingHorizontal: 20 },
  panelQtyControls: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8, marginLeft: 20 },
  panelQtyBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  panelQtyBtnText: { fontSize: 20, fontWeight: '600' },
  panelQtyValue: { fontSize: 16, fontWeight: '600', minWidth: 30, textAlign: 'center' },
  panelFooter: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  panelUpdateBtn: { paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  panelUpdateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  panelSwapBtn: { borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  panelSwapBtnText: { fontSize: 16, fontWeight: '600' },
  panelGoBackText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'center', paddingVertical: 10 },

  // Swap product list
  swapSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  swapSearchInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginRight: 8 },
  swapSearchBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  swapCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, marginHorizontal: 20, marginBottom: 10 },
  swapCardImage: { width: 70, height: 70, borderRadius: 8, resizeMode: 'cover', marginRight: 12 },
  swapCardInfo: { flex: 1, marginRight: 8 },
  swapCardTitle: { fontSize: 14, fontWeight: '600' },
  swapCardPrice: { fontSize: 14, fontWeight: '700' },
  swapCardCompare: { fontSize: 12, textDecorationLine: 'line-through', marginLeft: 6 },
  swapSelectBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  swapEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  // Order notes
  noteInput: { borderWidth: 1, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },

  // Discount code
  discountRow: { flexDirection: 'row', alignItems: 'center' },
  discountInput: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginRight: 8 },
  applyBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  applyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  appliedDiscount: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 10, marginBottom: 8 },
  discountCode: { fontSize: 14, fontWeight: '600' },
  discountValue: { fontSize: 12, marginTop: 2 },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },

  // Edit forms
  editForm: { marginTop: 12 },
  editLink: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 4 },
  fieldError: { color: '#EF4444', fontSize: 12, marginBottom: 4, marginTop: 2 },
  intervalScroll: { marginBottom: 8 },
  intervalRow: { flexDirection: 'row', gap: 8 },
  intervalBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  saveBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // Payment
  paymentRow: { marginBottom: 4 },

  // Upsell section
  upsellSection: { marginBottom: 14 },
  upsellTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  upsellEmptyText: { fontSize: 14, marginBottom: 12 },
  upsellCard: {
    padding: 14,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  upsellCardImage: { width: '100%', height: 200, resizeMode: 'contain', marginBottom: 14 },
  upsellCardImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#F3F4F6', marginBottom: 14, borderRadius: 8 },
  upsellCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  upsellCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upsellCardPriceRow: { flexDirection: 'column' },
  upsellCardPrice: { fontSize: 15, fontWeight: '700' },
  upsellCardCompare: { fontSize: 13, textDecorationLine: 'line-through', color: '#9CA3AF' },
  upsellAddBtn: { paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  upsellAddBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  seeMoreLink: { marginTop: 16, alignSelf: 'flex-start' },
  seeMoreText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },

  // Purchase option radio buttons
  purchaseOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  purchaseOptionLabel: { fontSize: 15 },
  // Add product dropdown
  addDropdownBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addDropdownList: { borderWidth: 1, borderTopWidth: 0, borderRadius: 8, borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden', marginTop: -1 },
  addDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },

  // Address
  addressText: { fontSize: 14, lineHeight: 20 },

  // Pause + Cancel
  pauseBtn: { borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  pauseBtnText: { fontSize: 15, fontWeight: '600' },
  cancelLink: { alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  cancelLinkText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },

  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center' },
});

// --- Config ---

export const WidgetConfig = {
  apiKey: '',
  baseUrl: 'https://api.loopsubscriptions.com',
  storeDomain: '',
  subscriptionId: '',
  primaryColor: '#6366F1',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  secondaryTextColor: '#6B7280',
  borderColor: '#E5E7EB',
  cardBorderRadius: 12,

  showSkipOption: true,
  showGetDeliveryNow: true,
  showReschedule: true,
  showPauseResume: true,
  showFrequencyEdit: true,
  showAddressEdit: true,
  showPaymentDetails: true,
  showProductDetails: true,
  showOrderNotes: true,
  showDiscountCode: true,
  showOneTimeAdd: true,
  deliveryChargeText: 'shipping per delivery',
};

export const WidgetEditors = {
  basic: [
    { type: 'editorSectionHeader', name: 'apiSetup', props: { label: 'API SETUP' } },
    { type: 'codeInput', name: 'apiKey', props: { label: 'Loop API Key', placeholder: 'Enter your Loop API key', singleLine: true } },
    { type: 'codeInput', name: 'baseUrl', props: { label: 'Base URL', placeholder: 'https://api.loopsubscriptions.com', singleLine: true } },
    { type: 'codeInput', name: 'storeDomain', props: { label: 'Store Domain (myshopify)', placeholder: 'yourstore.myshopify.com', singleLine: true } },

    { type: 'codeInput', name: 'deliveryChargeText', props: { label: 'Delivery Charge Label', placeholder: 'shipping per delivery', singleLine: true } },

    { type: 'editorSectionHeader', name: 'colors', props: { label: 'COLORS' } },
    { type: 'colorInput', name: 'primaryColor', props: { label: 'Primary / Accent Color' } },
    { type: 'colorInput', name: 'backgroundColor', props: { label: 'Background Color' } },
    { type: 'colorInput', name: 'textColor', props: { label: 'Text Color' } },
    { type: 'colorInput', name: 'secondaryTextColor', props: { label: 'Secondary Text Color' } },
    { type: 'colorInput', name: 'borderColor', props: { label: 'Border Color' } },

    { type: 'editorSectionHeader', name: 'display', props: { label: 'DISPLAY OPTIONS' } },
    { type: 'numericInput', name: 'cardBorderRadius', props: { label: 'Card Border Radius', unit: 'px' } },
    { type: 'checkbox', name: 'showProductDetails', props: { label: 'Show Product Details' } },
    { type: 'checkbox', name: 'showFrequencyEdit', props: { label: 'Show Subscription Plan' } },
    { type: 'checkbox', name: 'showAddressEdit', props: { label: 'Show Shipping Address' } },
    { type: 'checkbox', name: 'showPaymentDetails', props: { label: 'Show Payment Details' } },
    { type: 'checkbox', name: 'showOrderNotes', props: { label: 'Show Order Notes' } },
    { type: 'checkbox', name: 'showDiscountCode', props: { label: 'Show Discount Code' } },
    { type: 'checkbox', name: 'showGetDeliveryNow', props: { label: 'Show Get Delivery Now Button' } },
    { type: 'checkbox', name: 'showSkipOption', props: { label: 'Show Skip Button' } },
    { type: 'checkbox', name: 'showReschedule', props: { label: 'Show Re-schedule Button' } },
    { type: 'checkbox', name: 'showPauseResume', props: { label: 'Show Pause / Resume' } },
    { type: 'checkbox', name: 'showOneTimeAdd', props: { label: 'Show "Goes Well With" Upsell Section' } },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'Loop Manage Subscription',
  defaultProps: {},
};
