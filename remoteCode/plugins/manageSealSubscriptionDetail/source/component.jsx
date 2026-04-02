import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { makeBoolean, Icon } from 'apptile-core';
import { useNavigation, useRoute } from '@react-navigation/native';

const SEAL_BASE_URL = 'https://api.apptile.local/seal-subscription';

const STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    bg: '#D1FAE5', color: '#065F46', iconType: 'Feather', icon: 'check-circle' },
  PAUSED:    { label: 'Paused',    bg: '#FEF3C7', color: '#92400E', iconType: 'Feather', icon: 'pause-circle' },
  CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', color: '#991B1B', iconType: 'Feather', icon: 'x-circle' },
};

// --- API helpers ---

async function fetchSubscriptionById(subscriptionId, appId, customerAccessToken) {
  console.log('[Seal] fetchSubscriptionById', subscriptionId);
  const url = `${SEAL_BASE_URL}/subscriptions/get?id=${subscriptionId}`;
  const res = await fetch(url, {
    headers: {
      'x-shopify-app-id': appId,
      'x-shopify-customer-access-token': customerAccessToken,
    },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Seal] fetchSubscriptionById FAILED', res.status, errBody);
    throw new Error('Failed to load subscription details');
  }
  const json = await res.json();
  console.log('[Seal] fetchSubscriptionById OK', JSON.stringify(json).substring(0, 500));
  return json.payload;
}

async function updateSubscriptionAction(
  appId,
  customerAccessToken,
  subscriptionId,
  action,
) {
  const res = await fetch(`${SEAL_BASE_URL}/subscriptions/put`, {
    method: 'PUT',
    headers: {
      'x-shopify-app-id': appId,
      'x-shopify-customer-access-token': customerAccessToken,
    },
    body: JSON.stringify({id: subscriptionId, action: action}),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Seal] cancelSubscription FAILED', res.status, errBody);
    throw new Error('Failed to update subscription action -', action);
  }
  const json = await res.json();
  console.log(
    `[Seal] Action - ${action} subscription updated OK`,
    JSON.stringify(json).substring(0, 200),
  );
  return json;
}

async function updateSubscriptionShipping(appId,
  customerAccessToken, subscriptionId, shippingData) {
  console.log('[Seal] updateSubscriptionShipping', subscriptionId, JSON.stringify(shippingData));
  const res = await fetch(`${SEAL_BASE_URL}/subscriptions/put/edit`, {
    method: 'PUT',
    headers: {
      'x-shopify-app-id': appId,
      'x-shopify-customer-access-token': customerAccessToken,
    },
    body: JSON.stringify({
      id: subscriptionId,
      action: 'edit',
      edit: shippingData,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Seal] updateSubscriptionShipping FAILED', res.status, errBody);
    let parsed = {};
    try { parsed = JSON.parse(errBody); } catch {}
    // AP-23: attach apiMessage for upstream field parsing
    const err = new Error(parsed?.message || 'Failed to update shipping address');
    err.apiMessage = parsed?.message || '';
    throw err;
  }
  const json = await res.json();
  console.log('[Seal] updateSubscriptionShipping OK', JSON.stringify(json).substring(0, 500));
  return json.payload;
}

// --- Helpers ---

function formatDisplayDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'pm' : 'am';
    const h12 = hh % 12 || 12;
    return `${dd}/${mm}/${yyyy} ${h12}:${min} ${ampm}`;
  } catch {
    return isoStr;
  }
}

function buildShippingFormFromSub(sub) {
  if (!sub) return {};
  return {
    s_first_name: sub.s_first_name || '',
    s_last_name: sub.s_last_name || '',
    s_address1: sub.s_address1 || '',
    s_address2: sub.s_address2 || '',
    s_city: sub.s_city || '',
    s_zip: sub.s_zip || '',
    s_province: sub.s_province || '',
    s_province_code: sub.s_province_code || '',
    s_country: sub.s_country || '',
    s_country_code: sub.s_country_code || '',
    s_phone: sub.s_phone || '',
    s_company: sub.s_company || '',
  };
}

// AP-12: parse "field | message. field2 | message2" API error format
function parseFieldErrors(apiMessage) {
  const result = {};
  if (!apiMessage) return result;
  const lines = apiMessage.split('.').map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    const parts = line.split('|');
    if (parts.length === 2) {
      result[parts[0].trim()] = parts[1].trim();
    }
  });
  return result;
}

// --- Component ---

export function ReactComponent({ model }) {
  const route = useRoute();

  // Subscription ID and token: nav params first, model fallback (AP-2)
  const subscriptionId = route.params?.subscriptionId || model.get('subscriptionId') || '';
  const appId = model.get('appId');
  const customerAccessToken = model.get('customerAccessToken');

  // Merchant config
  const primaryColor = model.get('primaryColor') || '#6366F1';
  const backgroundColor = model.get('backgroundColor') || '#F3F4F6';
  const cardBackgroundColor = model.get('cardBackgroundColor') || '#FFFFFF';
  const textColor = model.get('textColor') || '#111827';
  const borderColor = model.get('borderColor') || '#E5E7EB';
  const successColor = model.get('successColor') || '#10B981';
  const errorColor = model.get('errorColor') || '#EF4444';
  const cardBorderRadius = parseInt(model.get('cardBorderRadius') || '12', 10);
  const saveButtonLabel = model.get('saveButtonLabel') || 'Save';
  const cancelButtonLabel = model.get('cancelButtonLabel') || 'Cancel';
  const showBillingSchedule = makeBoolean(model.get('showBillingSchedule') ?? true);
  const showCustomerSection = makeBoolean(model.get('showCustomerSection') ?? true);
  const showShippingSection = makeBoolean(model.get('showShippingSection') ?? true);
  const showBillingAddressSection = makeBoolean(model.get('showBillingAddressSection') ?? true);
  const showPaymentSection = makeBoolean(model.get('showPaymentSection') ?? true);
  const showItemsSection = makeBoolean(model.get('showItemsSection') ?? true);
  const showModelCurrency = makeBoolean(model.get('showModelCurrency') ?? false);
  const modelCurrency = model.get('modelCurrency') || '';

  // All hooks at top level — before any early returns (AP-14)
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(null); // null | 'shipping'
  const [shippingForm, setShippingForm] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [sectionMessages, setSectionMessages] = useState({}); // AP-22
  const [savingShipping, setSavingShipping] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sendingPaymentEmail, setSendingPaymentEmail] = useState(false);
  const [paymentModalMessage, setPaymentModalMessage] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [cancelPauseLoading, setCancelPauseLoading] = useState(false);
  const [cancelPauseMessage, setCancelPauseMessage] = useState(null);
  const [resumeReactivateLoading, setResumeReactivateLoading] = useState(false);
  const [resumeReactivateMessage, setResumeReactivateMessage] = useState(null);

  // useMemo hooks all at top level (AP-14)
  const billingAttempts = useMemo(
    () => (Array.isArray(subscription?.billing_attempts) ? subscription.billing_attempts : []),
    [subscription?.billing_attempts],
  );

  const completedCycles = useMemo(() => {
    // Initial order counts as cycle #1 (billing_min_cycles includes it)
    const initialOrder = subscription?.order_id ? 1 : 0;
    const subsequentCompleted = billingAttempts.filter(a => a.order_id).length;
    return initialOrder + subsequentCompleted;
  }, [subscription?.order_id, billingAttempts]);

  const minCyclesReached = useMemo(() => {
    const min = parseInt(subscription?.billing_min_cycles || '0', 10);
    return min === 0 || completedCycles >= min;
  }, [subscription?.billing_min_cycles, completedCycles]);

  // AP-22: per-section message helpers
  const setSectionMsg = useCallback((section, msg) => {
    setSectionMessages(prev => ({ ...prev, [section]: msg }));
  }, []);

  const clearSectionMsg = useCallback(section => {
    setSectionMessages(prev => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  }, []);

  // AP-7: useEffect with cancelled flag
  useEffect(() => {
    if (!subscriptionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSubscriptionById(appId, customerAccessToken, subscriptionId);
        if (!cancelled) {
          setSubscription(data);
          setShippingForm(buildShippingFormFromSub(data));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [appId, customerAccessToken, subscriptionId]);

  // Shipping field updater with field error clearing (AP-12)
  const updateShippingField = useCallback((field, value) => {
    setShippingForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleSaveShipping = useCallback(async () => {
    setSavingShipping(true);
    clearSectionMsg('shipping');
    setFieldErrors({});
    try {
      await updateSubscriptionShipping(
        appId,
        customerAccessToken,
        subscriptionId,
        shippingForm,
      );
      const updated = await fetchSubscriptionById(
        appId,
        customerAccessToken,
        subscriptionId,
      );
      setSubscription(updated);
      setShippingForm(buildShippingFormFromSub(updated));
      setEditMode(null);
      setSectionMsg('shipping', 'Shipping address updated successfully.');
    } catch (e) {
      // AP-12: field-level errors, AP-23: apiMessage
      const parsed = parseFieldErrors(e.apiMessage || '');
      if (Object.keys(parsed).length > 0) {
        setFieldErrors(parsed);
      } else {
        setSectionMsg('shipping', e.message);
      }
    } finally {
      setSavingShipping(false);
    }
  }, [
    appId,
    customerAccessToken,
    subscriptionId,
    shippingForm,
    clearSectionMsg,
    setSectionMsg,
  ]);

  // AP-15: section renderer with right-aligned edit button
  const renderSection = useCallback(
    (title, children, key, rightButton = null) => (
      <View
        key={key}
        style={{
          backgroundColor: cardBackgroundColor,
          borderRadius: cardBorderRadius,
          borderWidth: 1,
          borderColor,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>{title}</Text>
          {rightButton || null}
        </View>
        <View style={{ height: 1, backgroundColor: borderColor, marginBottom: 12 }} />
        {children}
      </View>
    ),
    [cardBackgroundColor, cardBorderRadius, borderColor, textColor],
  );

  // Render guards — all hooks already called above (AP-14)
  if (!appId || !customerAccessToken || !subscriptionId) {
    return (
      <View style={{ flex: 'unset', width: '100%', height: '100%', backgroundColor, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: errorColor, textAlign: 'center' }}>
          Subscription not found. Please navigate here from your subscriptions list.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 'unset',
          width: '100%',
          height: '100%',
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={primaryColor} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 'unset',
          width: '100%',
          height: '100%',
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
        <Text style={{color: errorColor, textAlign: 'center'}}>{error}</Text>
      </View>
    );
  }

  if (!subscription) {
    return null;
  }

  // Input style factory with field-error highlight (AP-12)
  const inputStyle = field => ({
    borderWidth: 1,
    borderColor: fieldErrors[field] ? errorColor : borderColor,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: textColor,
    backgroundColor: '#FAFAFA',
    marginBottom: fieldErrors[field] ? 2 : 8,
  });

  const subscriptionButtons = (
    <>
      {subscription.status === 'ACTIVE' && minCyclesReached ? (
        <View style={{gap: 8}}>
          <TouchableOpacity
            style={{
              borderWidth: 1.5,
              borderColor: '#F59E0B',
              borderRadius: cardBorderRadius,
              paddingVertical: 12,
              alignItems: 'center',
            }}
            onPress={() => {
              setCancelPauseMessage(null);
              setShowPauseModal(true);
            }}>
            <Text style={{color: '#F59E0B', fontWeight: '600', fontSize: 14}}>
              Pause subscription
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              borderWidth: 1.5,
              borderColor: errorColor,
              borderRadius: cardBorderRadius,
              paddingVertical: 12,
              alignItems: 'center',
            }}
            onPress={() => {
              setCancelPauseMessage(null);
              setShowCancelModal(true);
            }}>
            <Text style={{color: errorColor, fontWeight: '600', fontSize: 14}}>
              Cancel subscription
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {subscription.status === 'PAUSED' ? (
        <TouchableOpacity
          style={{
            borderWidth: 1.5,
            borderColor: '#10B981',
            borderRadius: cardBorderRadius,
            paddingVertical: 12,
            alignItems: 'center'
          }}
          onPress={async () => {
            if (resumeReactivateLoading) return;
            setResumeReactivateLoading(true);
            try {
              await updateSubscriptionAction(
                appId,
                customerAccessToken,
                subscriptionId,
                'resume'
              );
              const updated = await fetchSubscriptionById(
                appId,
                customerAccessToken,
                subscriptionId,
              );
              setSubscription(updated);
            } catch (e) {
              setResumeReactivateMessage({type: 'error', text: e.message});
            } finally {
              setResumeReactivateLoading(false);
            }
          }}
          disabled={resumeReactivateLoading}>
          {resumeReactivateLoading ? (
            <ActivityIndicator color="#10B981" size="small" />
          ) : (
            <Text style={{color: '#10B981', fontWeight: '600', fontSize: 14}}>
              Resume subscription
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {subscription.status === 'CANCELLED' ? (
        <TouchableOpacity
          style={{
            borderWidth: 1.5,
            borderColor: primaryColor,
            borderRadius: cardBorderRadius,
            paddingVertical: 12,
            alignItems: 'center'
          }}
          onPress={async () => {
            if (resumeReactivateLoading) return;
            setResumeReactivateLoading(true);
            try {
              await updateSubscriptionAction(appId,
                customerAccessToken, subscriptionId, 'reactivate');
              const updated = await fetchSubscriptionById(
                appId,
                customerAccessToken,
                subscriptionId,
              );
              setSubscription(updated);
            } catch (e) {
              setResumeReactivateMessage({type: 'error', text: e.message});
            } finally {
              setResumeReactivateLoading(false);
            }
          }}
          disabled={resumeReactivateLoading}>
          {resumeReactivateLoading ? (
            <ActivityIndicator color={primaryColor} size="small" />
          ) : (
            <Text
              style={{color: primaryColor, fontWeight: '600', fontSize: 14}}>
              Reactivate subscription
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {resumeReactivateMessage ? (
        <Text
          style={{
            fontSize: 13,
            color:
              resumeReactivateMessage.type === 'error'
                ? errorColor
                : successColor,
            marginTop: 8,
          }}>
          {resumeReactivateMessage.text}
        </Text>
      ) : null}
    </>
  );

  // ── Section: Subscription info ──────────────────────────────────────────────
  const subscriptionInfoCard = (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderRadius: cardBorderRadius,
        borderWidth: 1,
        borderColor,
        padding: 16,
        marginBottom: 12,
      }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: textColor,
          marginBottom: 14,
        }}>
        #{subscription.id}
      </Text>

      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
        <Text style={{fontSize: 14, color: textColor, fontWeight: 800}}>
          {'Created at: '}
        </Text>
        <Text style={{fontSize: 14, color: textColor, fontWeight: 500}}>
          {formatDisplayDate(subscription.order_placed)}
        </Text>
      </View>

      <View
        style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
        <Text style={{fontSize: 14, fontWeight: '600', color: textColor}}>
          Status:{' '}
        </Text>
        {(() => {
          const s = STATUS_CONFIG[subscription.status] || {
            label: subscription.status,
            bg: '#F3F4F6',
            color: '#6B7280',
            iconType: 'Feather',
            icon: null,
          };
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: s.bg,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}>
              <Text style={{fontSize: 13, fontWeight: '600', color: s.color}}>
                {s.label}
              </Text>
              {s.icon ? (
                <Icon
                  iconType={s.iconType}
                  name={s.icon}
                  size={13}
                  color={s.color}
                  style={{marginLeft: 4}}
                />
              ) : null}
            </View>
          );
        })()}
      </View>

      {subscription.billing_interval ? (
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text
            style={{
              fontSize: 14,
              color: textColor,
              marginBottom: 8,
              fontWeight: 800,
            }}>
            Repeats every{' '}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: textColor,
              marginBottom: 8,
              fontWeight: 500,
            }}>
            {subscription.billing_interval}
          </Text>
        </View>
      ) : null}

      {subscription.billing_min_cycles ? (
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <Text style={{fontSize: 14, color: textColor, fontWeight: 800}}>
            {'Required number of payments: '}
          </Text>
          <Text style={{fontSize: 14, color: textColor, fontWeight: 500}}>
            {`${subscription.billing_min_cycles}`}
          </Text>
        </View>
      ) : null}

      {subscription.billing_min_cycles &&
      subscription.status === 'ACTIVE' &&
      !minCyclesReached ? (
        <Text
          style={{
            fontSize: 14,
            color: '#6B7280',
            marginTop: 8,
            lineHeight: 20,
          }}>
          {
            "You can't yet cancel this subscription, as you didn't yet reach the required number of payments."
          }
        </Text>
      ) : null}
    </View>
  );

  // ── Section: Items ──────────────────────────────────────────────────────────
  const itemsContent = (() => {
    const items = subscription.items || [];
    const apiCur = subscription.currency || '';
    // Format: "API_CUR [MODEL_CUR] $price"
    const fmtPrice = (amount) => {
      const dollars = parseFloat(amount || 0).toFixed(2);
      if (showModelCurrency && modelCurrency) {
        return `${apiCur} ${modelCurrency}${dollars}`;
      }
      return `${apiCur} ${dollars}`;
    };
    // const totalDiscount = items.reduce(
    //   (sum, item) => sum + item.discount_value,
    //   0,
    // );

    return (
      <View>
        {items.map((item, i) => {
          const itemDiscount = parseFloat(item.total_discount || 0);
          return (
            <View
              key={i}
              style={{
                paddingVertical: 6,
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: borderColor,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}>
                <View style={{flex: 1, marginRight: 12}}>
                  <Text
                    style={{fontSize: 14, fontWeight: '500', color: textColor}}>
                    {item.title}{' '}
                    {`x ${item.quantity}`}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  
                  <Text
                    style={{fontSize: 14, fontWeight: '600', color: textColor}}>
                    {fmtPrice(item.final_price || item.original_price)}
                  </Text>
                  {itemDiscount > 0 && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: '#10B981',
                      }}>
                      {`- ${fmtPrice(itemDiscount)}`}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Totals block */}
        <View style={{height: 1, backgroundColor: borderColor, marginTop: 8, marginBottom: 8}} />

        {/* {totalDiscount > 0 && (
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
            <View>
              <Text style={{fontSize: 14, fontWeight: '400', color: '#6B7280'}}>Discount</Text>
            </View>
            <View>
              <Text style={{fontSize: 14, fontWeight: '600', color: '#10B981'}}>
                {`- ${fmtPrice(totalDiscount)}`}
              </Text>
            </View>
          </View>
        )} */}

        {subscription.delivery_price !== undefined && (
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
            <View>
              <Text style={{fontSize: 14, fontWeight: '400', color: '#6B7280'}}>Delivery cost</Text>
            </View>
            <View>
              <Text style={{fontSize: 14, fontWeight: '600', color: textColor}}>
                {fmtPrice(subscription.delivery_price)}
              </Text>
            </View>
          </View>
        )}

        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4}}>
          <View>
            <Text style={{fontSize: 15, fontWeight: '700', color: textColor}}>Total</Text>
          </View>
          <View>
            <Text style={{fontSize: 15, fontWeight: '700', color: textColor}}>
              {fmtPrice(subscription.total_value)}
            </Text>
          </View>
        </View>
      </View>
    );
  })();

  // ── Section: Billing schedule ───────────────────────────────────────────────
  const billingScheduleCard = showBillingSchedule ? (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderRadius: cardBorderRadius,
        borderWidth: 1,
        borderColor,
        padding: 16,
        marginBottom: 12,
      }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: textColor,
          marginBottom: 10,
        }}>
        Billing Schedule
      </Text>
      <View
        style={{height: 1, backgroundColor: borderColor, marginBottom: 12}}
      />

      {subscription.status === 'PAUSED' ? (
        <Text style={{fontSize: 14, color: '#6B7280', fontWeight: 500}}>
          The subscription is not active and no billing attempts were made.
        </Text>
      ) : billingAttempts.length === 0 ? (
        <Text style={{fontSize: 14, color: '#6B7280', fontWeight: 500}}>
          Your billing schedule will be created in a few minutes.
        </Text>
      ) : (
        billingAttempts.map((attempt, idx) => (
          <View key={attempt.id || idx}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
              }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text
                  style={{
                    fontWeight: '600',
                    color: textColor,
                    marginRight: 0,
                    minWidth: 28,
                  }}>
                  #{idx + 1}
                </Text>
                <Text
                  style={{fontSize: 14, color: textColor, fontWeight: '600'}}>
                  {formatDisplayDate(attempt.date)}
                </Text>
              </View>
              <View
                style={{
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  backgroundColor: attempt.order_id
                    ? '#D1FAE5'
                    : attempt.error_code
                    ? '#FEE2E2'
                    : attempt.skipped_on
                    ? '#FEF3C7'
                    : '#F3F4F6',
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: attempt.order_id
                      ? '#065F46'
                      : attempt.error_code
                      ? '#991B1B'
                      : attempt.skipped_on
                      ? '#92400E'
                      : '#6B7280',
                  }}>
                  {attempt.order_id
                    ? 'Payment processed'
                    : attempt.error_code
                    ? 'failed'
                    : attempt.skipped_on
                    ? 'skipped'
                    : 'scheduled'}
                </Text>
              </View>
            </View>
            {idx < billingAttempts.length - 1 && (
              <View style={{height: 1, backgroundColor: borderColor}} />
            )}
          </View>
        ))
      )}
    </View>
  ) : null;

  // ── Section: Customer ───────────────────────────────────────────────────────
  const customerContent = (
    <View>
      <Text
        style={{
          fontSize: 14,
          color: textColor,
          marginBottom: 4,
          fontWeight: 500,
        }}>
        {[subscription.first_name, subscription.last_name]
          .filter(Boolean)
          .join(' ')}
      </Text>
      <Text style={{fontSize: 14, color: textColor, fontWeight: 500}}>
        {subscription.email}
      </Text>
    </View>
  );

  // ── Section: Shipping — view ────────────────────────────────────────────────
  const shippingViewContent = (
    <View>
      {/* Line 1: customer name */}
      <Text
        style={{
          fontSize: 14,
          color: textColor,
          marginBottom: 2,
          fontWeight: 500,
        }}>
        {[subscription.s_first_name, subscription.s_last_name]
          .filter(Boolean)
          .join(' ')}
      </Text>
      {/* Line 2: company (if any) */}
      {subscription.s_company ? (
        <Text
          style={{
            fontSize: 14,
            color: textColor,
            marginBottom: 2,
            fontWeight: 500,
          }}>
          {subscription.s_company}
        </Text>
      ) : null}
      {/* Line 3: address1, address2 */}
      <Text
        style={{
          fontSize: 14,
          color: textColor,
          marginBottom: 2,
          fontWeight: 500,
        }}>
        {[subscription.s_address1, subscription.s_address2]
          .filter(Boolean)
          .join(', ')}
      </Text>
      {/* Line 4: city, province, postal code */}
      <Text
        style={{
          fontSize: 14,
          color: textColor,
          marginBottom: 2,
          fontWeight: 500,
        }}>
        {[subscription.s_city, subscription.s_province, subscription.s_zip]
          .filter(Boolean)
          .join(', ')}
      </Text>
      {/* Line 5: country, phone */}
      <Text
        style={{
          fontSize: 14,
          color: textColor,
          marginBottom: 2,
          fontWeight: 500,
        }}>
        {[subscription.s_country, subscription.s_phone]
          .filter(Boolean)
          .join(', ')}
      </Text>

      {sectionMessages['shipping'] ? (
        <Text
          style={{
            color: successColor,
            fontSize: 13,
            marginTop: 8,
            fontWeight: 500,
          }}>
          {sectionMessages['shipping']}
        </Text>
      ) : null}
    </View>
  );

  // ── Section: Shipping — edit modal ─────────────────────────────────────────
  const fieldLabel = (label) => (
    <Text style={{fontSize: 13, color: '#6B7280', marginBottom: 4, fontWeight: 500}}>
      {label}
    </Text>
  );
  const fieldError = (key) => fieldErrors[key] ? (
    <Text style={{color: errorColor, fontSize: 12, marginBottom: 6, fontWeight: 500}}>
      {fieldErrors[key]}
    </Text>
  ) : null;

  const shippingEditModal = (
    <Modal
      visible={editMode === 'shipping'}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setEditMode(null);
        setFieldErrors({});
        clearSectionMsg('shipping');
        setShippingForm(buildShippingFormFromSub(subscription));
      }}>
      <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'}}>
        <View style={{backgroundColor: cardBackgroundColor, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%'}}>
          {/* Modal header */}
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor}}>
            <Text style={{fontSize: 16, fontWeight: 700, color: textColor}}>Edit shipping address</Text>
            <TouchableOpacity
              onPress={() => {
                setEditMode(null);
                setFieldErrors({});
                clearSectionMsg('shipping');
                setShippingForm(buildShippingFormFromSub(subscription));
              }}>
              <Icon iconType="Feather" name="x" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{padding: 16}} keyboardShouldPersistTaps="handled">
            {/* Country/Region */}
            {fieldLabel('Country/Region')}
            <TextInput
              style={inputStyle('s_country')}
              value={shippingForm.s_country || ''}
              onChangeText={v => updateShippingField('s_country', v)}
              placeholder="Country"
              placeholderTextColor="#9CA3AF"
            />
            {fieldError('s_country')}

            {/* First name + Last name */}
            <View style={{flexDirection: 'row'}}>
              <View style={{flex: 1, marginRight: 6}}>
                {fieldLabel('First name')}
                <TextInput
                  style={inputStyle('s_first_name')}
                  value={shippingForm.s_first_name || ''}
                  onChangeText={v => updateShippingField('s_first_name', v)}
                  placeholder="First name"
                  placeholderTextColor="#9CA3AF"
                />
                {fieldError('s_first_name')}
              </View>
              <View style={{flex: 1, marginLeft: 6}}>
                {fieldLabel('Last name')}
                <TextInput
                  style={inputStyle('s_last_name')}
                  value={shippingForm.s_last_name || ''}
                  onChangeText={v => updateShippingField('s_last_name', v)}
                  placeholder="Last name"
                  placeholderTextColor="#9CA3AF"
                />
                {fieldError('s_last_name')}
              </View>
            </View>

            {/* Address line 1 */}
            {fieldLabel('Address')}
            <TextInput
              style={inputStyle('s_address1')}
              value={shippingForm.s_address1 || ''}
              onChangeText={v => updateShippingField('s_address1', v)}
              placeholder="Address"
              placeholderTextColor="#9CA3AF"
            />
            {fieldError('s_address1')}

            {/* Address line 2 */}
            {fieldLabel('Apartment, suite, etc. (optional)')}
            <TextInput
              style={inputStyle('s_address2')}
              value={shippingForm.s_address2 || ''}
              onChangeText={v => updateShippingField('s_address2', v)}
              placeholder="Apartment, suite, etc."
              placeholderTextColor="#9CA3AF"
            />

            {/* City + Postal code */}
            <View style={{flexDirection: 'row'}}>
              <View style={{flex: 1, marginRight: 6}}>
                {fieldLabel('City')}
                <TextInput
                  style={inputStyle('s_city')}
                  value={shippingForm.s_city || ''}
                  onChangeText={v => updateShippingField('s_city', v)}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                />
                {fieldError('s_city')}
              </View>
              <View style={{flex: 1, marginLeft: 6}}>
                {fieldLabel('Postal code')}
                <TextInput
                  style={inputStyle('s_zip')}
                  value={shippingForm.s_zip || ''}
                  onChangeText={v => updateShippingField('s_zip', v)}
                  placeholder="Postal code"
                  placeholderTextColor="#9CA3AF"
                />
                {fieldError('s_zip')}
              </View>
            </View>

            {/* State/Province */}
            {fieldLabel('State/Province')}
            <TextInput
              style={inputStyle('s_province')}
              value={shippingForm.s_province || ''}
              onChangeText={v => updateShippingField('s_province', v)}
              placeholder="State/Province"
              placeholderTextColor="#9CA3AF"
            />
            {fieldError('s_province')}

            {/* Company + Phone */}
            <View style={{flexDirection: 'row'}}>
              <View style={{flex: 1, marginRight: 6}}>
                {fieldLabel('Company (optional)')}
                <TextInput
                  style={inputStyle('s_company')}
                  value={shippingForm.s_company || ''}
                  onChangeText={v => updateShippingField('s_company', v)}
                  placeholder="Company"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{flex: 1, marginLeft: 6}}>
                {fieldLabel('Phone')}
                <TextInput
                  style={inputStyle('s_phone')}
                  value={shippingForm.s_phone || ''}
                  onChangeText={v => updateShippingField('s_phone', v)}
                  placeholder="Phone"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Section-level error message (AP-22) */}
            {sectionMessages['shipping'] ? (
              <Text style={{color: errorColor, fontSize: 13, marginBottom: 8, fontWeight: 500}}>
                {sectionMessages['shipping']}
              </Text>
            ) : null}

            {/* Save button */}
            <TouchableOpacity
              style={{
                backgroundColor: savingShipping ? '#A5B4FC' : primaryColor,
                borderRadius: cardBorderRadius,
                paddingVertical: 12,
                alignItems: 'center',
                marginBottom: 8,
                marginTop: 8,
              }}
              onPress={handleSaveShipping}
              disabled={savingShipping}>
              {savingShipping ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{color: '#FFFFFF', fontWeight: '600', fontSize: 14}}>
                  {saveButtonLabel}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor,
                borderRadius: cardBorderRadius,
                paddingVertical: 12,
                alignItems: 'center',
                marginBottom: 32,
              }}
              onPress={() => {
                setEditMode(null);
                setFieldErrors({});
                clearSectionMsg('shipping');
                setShippingForm(buildShippingFormFromSub(subscription));
              }}
              disabled={savingShipping}>
              <Text style={{color: textColor, fontSize: 14, fontWeight: 500}}>
                {cancelButtonLabel}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ── Section: Billing address ────────────────────────────────────────────────
  const hasBillingAddress = !!(
    subscription.b_first_name || subscription.b_last_name ||
    subscription.b_address1 || subscription.b_city || subscription.b_country
  );
  const billingAddressContent = hasBillingAddress ? (
    <View>
      {(subscription.b_first_name || subscription.b_last_name) ? (
        <Text style={{fontSize: 14, color: textColor, marginBottom: 2, fontWeight: 500}}>
          {[subscription.b_first_name, subscription.b_last_name].filter(Boolean).join(' ')}
        </Text>
      ) : null}
      {subscription.b_company ? (
        <Text style={{fontSize: 14, color: textColor, marginBottom: 2, fontWeight: 500}}>
          {subscription.b_company}
        </Text>
      ) : null}
      {(subscription.b_address1 || subscription.b_address2) ? (
        <Text style={{fontSize: 14, color: textColor, marginBottom: 2, fontWeight: 500}}>
          {[subscription.b_address1, subscription.b_address2].filter(Boolean).join(', ')}
        </Text>
      ) : null}
      {(subscription.b_city || subscription.b_province || subscription.b_zip) ? (
        <Text style={{fontSize: 14, color: textColor, marginBottom: 2, fontWeight: 500}}>
          {[subscription.b_city, subscription.b_province, subscription.b_zip].filter(Boolean).join(', ')}
        </Text>
      ) : null}
      {subscription.b_country ? (
        <Text style={{fontSize: 14, color: textColor, marginBottom: 2, fontWeight: 500}}>
          {subscription.b_country}
        </Text>
      ) : null}
      {subscription.b_phone ? (
        <Text style={{fontSize: 14, color: '#6B7280', marginTop: 2, fontWeight: 500}}>
          {subscription.b_phone}
        </Text>
      ) : null}
    </View>
  ) : (
    <Text style={{fontSize: 14, color: '#6B7280', fontWeight: 500}}>
      Same as shipping address
    </Text>
  );

  // ── Section: Payment method ─────────────────────────────────────────────────
  const paymentContent = (
    <View>
      {subscription.card_brand || subscription.card_last_digits ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}>
          <View
            style={{
              width: 44,
              height: 30,
              backgroundColor: '#E5E7EB',
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: '#374151',
                fontWeight: 500,
              }}>
              {(subscription.card_brand || '').toUpperCase().substring(0, 5)}
            </Text>
          </View>
          <View>
            <Text style={{fontSize: 14, fontWeight: '600', color: textColor}}>
              {subscription.card_brand
                ? subscription.card_brand.charAt(0).toUpperCase() +
                  subscription.card_brand.slice(1)
                : 'Card'}{' '}
              ending in {subscription.card_last_digits}
            </Text>
            {subscription.card_expiry_month && subscription.card_expiry_year ? (
              <Text style={{fontSize: 13, color: '#6B7280', fontWeight: 500}}>
                Expires on {subscription.card_expiry_month}/
                {subscription.card_expiry_year}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={{fontSize: 14, color: '#6B7280', marginBottom: 16}}>
          No payment method on file.
        </Text>
      )}

      {/* Request email to update payment method */}
      <TouchableOpacity
        style={{
          borderWidth: 1,
          borderColor,
          borderRadius: cardBorderRadius,
          paddingVertical: 12,
          alignItems: 'center',
        }}
        onPress={() => setShowPaymentModal(true)}>
        <Text style={{color: '#9CA3AF', fontSize: 14, fontWeight: 500}}>
          Request email to update payment method
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <View style={{flex: 'unset', minHeight: 300, backgroundColor}}>
      <ScrollView>
        <View style={{padding: 16}}>
          {/* 0. Action buttons */}
          <View
            style={{
              backgroundColor: cardBackgroundColor,
              borderRadius: cardBorderRadius,
              borderWidth: 1,
              borderColor,
              padding: 16,
              marginBottom: 12,
            }}>
            {subscriptionButtons}
          </View>

          {/* 1. Subscription info */}
          {subscriptionInfoCard}

          {/* 2. Items */}
          {showItemsSection &&
            Array.isArray(subscription.items) &&
            subscription.items.length > 0 &&
            renderSection('Items', itemsContent, 'items')}

          {/* 3. Billing schedule */}
          {billingScheduleCard}

          {/* 4. Customer */}
          {showCustomerSection &&
            renderSection('Customer', customerContent, 'customer')}

          {/* 5. Shipping — AP-15: edit button in section header */}
          {showShippingSection &&
            renderSection(
              'Shipping Address',
              shippingViewContent,
              'shipping',
              <TouchableOpacity
                onPress={() => {
                  setEditMode('shipping');
                  clearSectionMsg('shipping');
                }}>
                <Text
                  style={{
                    color: primaryColor,
                    fontSize: 14,
                    fontWeight: '500',
                  }}>
                  Edit
                </Text>
              </TouchableOpacity>,
            )}

          {/* 6. Billing address */}
          {showBillingAddressSection &&
            renderSection('Billing Address', billingAddressContent, 'billingAddress')}

          {/* 7. Payment method */}
          {showPaymentSection &&
            renderSection('Payment Method', paymentContent, 'payment')}
        </View>
      </ScrollView>

      {/* Payment method update modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPaymentModal(false);
          setPaymentModalMessage(null);
        }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              backgroundColor: cardBackgroundColor,
              borderRadius: cardBorderRadius,
              padding: 24,
              width: '100%',
            }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: textColor,
                marginBottom: 8,
              }}>
              Update Payment Method
            </Text>
            {paymentModalMessage ? (
              <Text
                style={{
                  fontSize: 14,
                  marginBottom: 24,
                  lineHeight: 20,
                  color:
                    paymentModalMessage.type === 'error'
                      ? errorColor
                      : successColor,
                }}>
                {paymentModalMessage.text}
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  color: '#6B7280',
                  marginBottom: 24,
                  lineHeight: 20,
                }}>
                A link to update your payment method will be sent to your email
                address.
              </Text>
            )}
            {!paymentModalMessage && (
              <TouchableOpacity
                style={{
                  backgroundColor: sendingPaymentEmail
                    ? '#A5B4FC'
                    : primaryColor,
                  borderRadius: cardBorderRadius,
                  paddingVertical: 13,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
                onPress={async () => {
                  setSendingPaymentEmail(true);
                  try {
                    await sendPaymentMethodUpdateEmail(
                      apiToken,
                      subscriptionId,
                    );
                    setPaymentModalMessage({
                      type: 'success',
                      text: 'Email sent! Check your inbox for the payment update link.',
                    });
                  } catch (e) {
                    setPaymentModalMessage({type: 'error', text: e.message});
                  } finally {
                    setSendingPaymentEmail(false);
                  }
                }}
                disabled={sendingPaymentEmail}>
                {sendingPaymentEmail ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '600',
                      fontSize: 15,
                      fontWeight: 500,
                    }}>
                    Send Email
                  </Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor,
                borderRadius: cardBorderRadius,
                paddingVertical: 13,
                alignItems: 'center',
              }}
              onPress={() => {
                setShowPaymentModal(false);
                setPaymentModalMessage(null);
              }}
              disabled={sendingPaymentEmail}>
              <Text style={{color: textColor, fontSize: 15, fontWeight: 500}}>
                {paymentModalMessage ? 'Close' : cancelButtonLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel subscription modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCancelModal(false);
          setCancelPauseMessage(null);
        }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              backgroundColor: cardBackgroundColor,
              borderRadius: cardBorderRadius,
              padding: 24,
              width: '100%',
            }}>
            {/* X close button */}
            <TouchableOpacity
              style={{position: 'absolute', top: 16, right: 16}}
              onPress={() => {
                setShowCancelModal(false);
                setCancelPauseMessage(null);
              }}>
              <Icon iconType="Feather" name="x" size={20} color={textColor} />
            </TouchableOpacity>

            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: textColor,
                marginBottom: 12,
                marginRight: 28,
              }}>
              Are you sure you want to unsubscribe?
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                lineHeight: 22,
                marginBottom: 24,
              }}>
              Your automatic subscription will be terminated and you won't
              receive any future invoices or get charged automatically.
            </Text>

            {cancelPauseMessage ? (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight:500,
                  color:
                    cancelPauseMessage.type === 'error'
                      ? errorColor
                      : successColor,
                  marginBottom: 16,
                }}>
                {cancelPauseMessage.text}
              </Text>
            ) : null}

            <View
              style={{
                height: 1,
                backgroundColor: borderColor,
                marginBottom: 16,
              }}
            />

            {!cancelPauseMessage && (
              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor,
                  borderRadius: cardBorderRadius,
                  paddingVertical: 13,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelPauseMessage(null);
                }}
                disabled={cancelPauseLoading}>
                <Text style={{color: '#9CA3AF', fontSize: 15, fontWeight: 500}}>
                  Wait, I changed my mind!
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: cancelPauseLoading ? '#F87171' : errorColor,
                borderRadius: cardBorderRadius,
                paddingVertical: 13,
                alignItems: 'center',
              }}
              onPress={async () => {
                if (cancelPauseMessage) {
                  setShowCancelModal(false);
                  setCancelPauseMessage(null);
                  return;
                }
                setCancelPauseLoading(true);
                try {
                  await cancelSubscription(apiToken, subscriptionId);
                  const updated = await fetchSubscriptionById(
                    apiToken,
                    subscriptionId,
                  );
                  setSubscription(updated);
                  setCancelPauseMessage({
                    type: 'success',
                    text: 'Your subscription has been cancelled.',
                  });
                } catch (e) {
                  setCancelPauseMessage({type: 'error', text: e.message});
                } finally {
                  setCancelPauseLoading(false);
                }
              }}
              disabled={cancelPauseLoading}>
              {cancelPauseLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{color: '#FFFFFF', fontWeight: '600', fontSize: 15}}>
                  {cancelPauseMessage ? 'Close' : 'Cancel it'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pause subscription modal */}
      <Modal
        visible={showPauseModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPauseModal(false);
          setCancelPauseMessage(null);
        }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              backgroundColor: cardBackgroundColor,
              borderRadius: cardBorderRadius,
              padding: 24,
              width: '100%',
            }}>
            {/* X close button */}
            <TouchableOpacity
              style={{position: 'absolute', top: 16, right: 16}}
              onPress={() => {
                setShowPauseModal(false);
                setCancelPauseMessage(null);
              }}>
              <Icon iconType="Feather" name="x" size={20} color={textColor} />
            </TouchableOpacity>

            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: textColor,
                marginBottom: 12,
                marginRight: 28,
              }}>
              Pause your subscription?
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                lineHeight: 22,
                marginBottom: 24,
              }}>
              Your subscription will be paused and no further charges will be
              made until you resume it.
            </Text>

            {cancelPauseMessage ? (
              <Text
                style={{
                  fontSize: 14,
                  color:
                    cancelPauseMessage.type === 'error'
                      ? errorColor
                      : successColor,
                  marginBottom: 16,
                }}>
                {cancelPauseMessage.text}
              </Text>
            ) : null}

            <View
              style={{
                height: 1,
                backgroundColor: borderColor,
                marginBottom: 16,
              }}
            />

            {!cancelPauseMessage && (
              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor,
                  borderRadius: cardBorderRadius,
                  paddingVertical: 13,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
                onPress={() => {
                  setShowPauseModal(false);
                  setCancelPauseMessage(null);
                }}
                disabled={cancelPauseLoading}>
                <Text style={{color: '#9CA3AF', fontSize: 15, fontWeight: 500}}>
                  Wait, I changed my mind!
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: cancelPauseLoading ? '#FCD34D' : '#F59E0B',
                borderRadius: cardBorderRadius,
                paddingVertical: 13,
                alignItems: 'center',
              }}
              onPress={async () => {
                if (cancelPauseMessage) {
                  setShowPauseModal(false);
                  setCancelPauseMessage(null);
                  return;
                }
                setCancelPauseLoading(true);
                try {
                  await updateSubscriptionAction(appId,
                customerAccessToken, subscriptionId, 'pause');
                  const updated = await fetchSubscriptionById(
                    appId,
                customerAccessToken,
                    subscriptionId,
                  );
                  setSubscription(updated);
                  setCancelPauseMessage({
                    type: 'success',
                    text: 'Your subscription has been paused.',
                  });
                } catch (e) {
                  setCancelPauseMessage({type: 'error', text: e.message});
                } finally {
                  setCancelPauseLoading(false);
                }
              }}
              disabled={cancelPauseLoading}>
              {cancelPauseLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{color: '#FFFFFF', fontWeight: '600', fontSize: 15}}>
                  {cancelPauseMessage ? 'Close' : 'Pause subscription'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shipping edit modal */}
      {shippingEditModal}
    </View>
  );
}

export const WidgetConfig = {
  subscriptionId: '',
  primaryColor: '#6366F1',
  backgroundColor: '#F3F4F6',
  cardBackgroundColor: '#FFFFFF',
  textColor: '#111827',
  borderColor: '#E5E7EB',
  successColor: '#10B981',
  errorColor: '#EF4444',
  cardBorderRadius: 12,
  saveButtonLabel: 'Save',
  cancelButtonLabel: 'Cancel',
  showBillingSchedule: true,
  showCustomerSection: true,
  showShippingSection: true,
  showBillingAddressSection: true,
  showPaymentSection: true,
  showItemsSection: true,
  showModelCurrency: false,
  modelCurrency: '',
};

export const WidgetEditors = {
  basic: [
    {type: 'codeInput', name: 'appId', props: {label: 'App id'}},
    {type: 'codeInput', name: 'customerAccessToken', props: {label: 'Customer Access Token'}},
  ],
  advanced: [
    {type: 'colorInput', name: 'primaryColor', props: {label: 'Primary Color'}},
    {
      type: 'colorInput',
      name: 'backgroundColor',
      props: {label: 'Background Color'},
    },
    {
      type: 'colorInput',
      name: 'cardBackgroundColor',
      props: {label: 'Card Background Color'},
    },
    {type: 'colorInput', name: 'textColor', props: {label: 'Text Color'}},
    {type: 'colorInput', name: 'borderColor', props: {label: 'Border Color'}},
    {type: 'colorInput', name: 'successColor', props: {label: 'Success Color'}},
    {type: 'colorInput', name: 'errorColor', props: {label: 'Error Color'}},
    {
      type: 'codeInput',
      name: 'cardBorderRadius',
      props: {label: 'Card Border Radius'},
    },
    {
      type: 'codeInput',
      name: 'saveButtonLabel',
      props: {label: 'Save Button Label'},
    },
    {
      type: 'codeInput',
      name: 'cancelButtonLabel',
      props: {label: 'Cancel Button Label'},
    },
    {
      type: 'checkbox',
      name: 'showBillingSchedule',
      props: {label: 'Show Billing Schedule'},
    },
    {
      type: 'checkbox',
      name: 'showCustomerSection',
      props: {label: 'Show Customer Section'},
    },
    {
      type: 'checkbox',
      name: 'showShippingSection',
      props: {label: 'Show Shipping Section'},
    },
    {
      type: 'checkbox',
      name: 'showBillingAddressSection',
      props: {label: 'Show Billing Address Section'},
    },
    {
      type: 'checkbox',
      name: 'showPaymentSection',
      props: {label: 'Show Payment Section'},
    },
    {
      type: 'checkbox',
      name: 'showItemsSection',
      props: {label: 'Show Items Section'},
    },
    {
      type: 'checkbox',
      name: 'showModelCurrency',
      props: {label: 'Show Currency from Model'},
    },
    {
      type: 'codeInput',
      name: 'modelCurrency',
      props: {label: 'Model Currency (e.g. USD)'},
    },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'SealManageSubscriptionDetail',
  defaultProps: {},
};
