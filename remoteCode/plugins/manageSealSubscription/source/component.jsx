import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean, Icon } from 'apptile-core';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const SEAL_BASE_URL = 'https://api.apptile.local/seal-subscription';


const STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    bg: '#D1FAE5', color: '#065F46', iconType: 'Feather', icon: 'check-circle' },
  PAUSED:    { label: 'Paused',    bg: '#FEF3C7', color: '#92400E', iconType: 'Feather', icon: 'pause-circle' },
  CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', color: '#991B1B', iconType: 'Feather', icon: 'x-circle' },
};

// --- API ---

async function fetchCustomerSubscriptions(appId,
  customerAccessToken) {
  const url = `${SEAL_BASE_URL}/subscriptions/get`;
    console.log('url', url);

  const res = await fetch(url, {
    headers: {
      'x-shopify-app-id': appId,
      'x-shopify-customer-access-token': customerAccessToken,
    },
  });
  console.log('res', res);
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Seal] fetchCustomerSubscriptions FAILED', res.status, errBody);
    throw new Error('Failed to load subscriptions');
  }
  const json = await res.json();
  // API returns { success, payload: { subscriptions: [...], page, total_pages } }
  const data = json.payload?.subscriptions || json.subscriptions || json.payload || [];
  console.log('[Seal] fetchCustomerSubscriptions OK count:', Array.isArray(data) ? data.length : 0);
  return Array.isArray(data) ? data : [];
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

// --- Component ---

export function ReactComponent({ model }) {
  const navigation = useNavigation();

  // Merchant config
  //  const appId = model.get('appId') || '';
  const detailPageName =
    model.get('detailPageName') || 'manageSealSubscriptionDetail';
  const primaryColor = model.get('primaryColor') || '#6366F1';
  const backgroundColor = model.get('backgroundColor') || '#F3F4F6';
  const cardBackgroundColor = model.get('cardBackgroundColor') || '#FFFFFF';
  const textColor = model.get('textColor') || '#111827';
  const borderColor = model.get('borderColor') || '#E5E7EB';
  const successColor = model.get('successColor') || '#10B981';
  const errorColor = model.get('errorColor') || '#EF4444';
  const cardBorderRadius = parseInt(model.get('cardBorderRadius') || '12', 10);
  const editButtonLabel = model.get('editButtonLabel') || 'Edit subscription';
  const emptyStateMessage =
    model.get('emptyStateMessage') || 'No subscriptions found';
  const showStatus = makeBoolean(model.get('showStatus') ?? true);
  const showTotalValue = makeBoolean(model.get('showTotalValue') ?? true);
  const showRepeatFrequency = makeBoolean(
    model.get('showRepeatFrequency') ?? true,
  );
  const showCreatedDate = makeBoolean(model.get('showCreatedDate') ?? true);
  const showItems = makeBoolean(model.get('showItems') ?? true);

  // Dynamic customer data from Redux (AP-2, AP-8, AP-9)
  const appId = useSelector(
    state => state.appModel.values.getIn(['Apptile', 'appUUID']),
    shallowEqual,
  );

  const customerAccessToken = useSelector(
    state =>
      state.appModel.values.getIn([
        'shopify',
        'loggedInUserAccessToken',
        'accessToken',
      ]) ||
      'shcat_eyJraWQiOiIwIiwiYWxnIjoiRUQyNTUxOSJ9.eyJzaG9wSWQiOjE3Nzk1MzI5LCJjaWQiOiJhMjU0MTU4Zi1hNmY1LTQ0NzktODQwZC01YmIzNzQ4NjRiYzYiLCJpYXQiOjE3NzUxMzU0NjIsImV4cCI6MTc3NTEzOTA2MiwiaXNzIjoiaHR0cHM6XC9cL3Nob3BpZnkuY29tXC9hdXRoZW50aWNhdGlvblwvMTc3OTUzMjkiLCJzdWIiOjgwMjE4ODE3ODIzNTEsInNjb3BlIjoib3BlbmlkIGVtYWlsIGN1c3RvbWVyLWFjY291bnQtYXBpOmZ1bGwiLCJydGlkIjoiMDE5ZDRlMmEtM2ViZi01NzRjLTNjNjAtYjQ2NzI2ZDM1OTZiIiwic2lkIjoiMDFLTjcyTURQSFhBWjdaSllEVlROMTVSU1kifQ.t41EUJUM5WSDTvrmrNfF9ZZYY8Wem6ZWg_JYCrTTAiHtKkKByZBLLHvwuzADdg9fdxDYwck2qJB8zAXgN_EEAg',
    shallowEqual,
  );

  // All hooks at top level before any early returns (AP-14)
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useFocusEffect(
    useCallback(() => {
      if (!appId || !customerAccessToken) {
        setLoading(false);
        return;
      }
      console.log('customeraccesstoken', customerAccessToken);
      console.log('appid', appId);

      let cancelled = false;
      async function load() {
        setLoading(true);
        setError(null);
        try {
          const data = await fetchCustomerSubscriptions(
            appId,
            customerAccessToken,
          );
          if (!cancelled) setSubscriptions(data);
        } catch (e) {
          if (!cancelled) setError(e.message);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
      return () => {
        cancelled = true;
      };
    }, [appId, customerAccessToken]),
  );

  const handleEditSubscription = useCallback(
    sub => {
      navigation.navigate(detailPageName, {
        subscriptionId: sub.id,
        editUrl: sub.edit_url,
      });
    },
    [detailPageName, navigation],
  );

  // Render guards — all hooks already called above (AP-14)
  if (!appId || !customerAccessToken) {
    return (
      <View
        style={{
          flex: 'unset',
          minHeight: 300,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
        <Text style={{color: errorColor, textAlign: 'center'}}>
          Cant find appID and customer access token from the model.
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

  if (subscriptions.length === 0) {
    return (
      <View
        style={{
          flex: 'unset',
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          width: '100%',
          height: '100%',
        }}>
        <Text style={{color: textColor, fontSize: 16}}>
          {emptyStateMessage}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 'unset',
        minHeight: 300,
        backgroundColor,
        width: '100%',
        height: '100%',
      }}>
      <ScrollView>
        <View style={{padding: 16}}>
          {subscriptions.map(sub => (
            <View
              key={sub.id}
              style={{
                backgroundColor: cardBackgroundColor,
                borderRadius: cardBorderRadius,
                borderWidth: 1,
                borderColor,
                padding: 16,
                marginBottom: 16,
              }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: textColor,
                  marginBottom: 12,
                }}>
                {`#${sub.id}`}
              </Text>

              {showTotalValue && (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: textColor,
                    marginBottom: 8,
                  }}>
                  <Text style={{fontWeight: '800'}}>{'Total value: '}</Text>
                  {`${sub.currency} $${parseFloat(sub.total_value || 0).toFixed(
                    2,
                  )}`}
                </Text>
              )}

              {showRepeatFrequency && sub.billing_interval && (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: textColor,
                    marginBottom: 8,
                  }}>
                  <Text style={{fontWeight: '800'}}>{'Repeats every '}</Text>
                  {sub.billing_interval}
                </Text>
              )}

              {showCreatedDate && sub.order_placed && (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: textColor,
                    marginBottom: 8,
                  }}>
                  <Text style={{fontWeight: '800'}}>{'Created on: '}</Text>
                  {formatDisplayDate(sub.order_placed)}
                </Text>
              )}

              {showStatus && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                  <Text
                    style={{fontSize: 14, fontWeight: '800', color: textColor}}>
                    Status:{' '}
                  </Text>
                  {(() => {
                    const s = STATUS_CONFIG[sub.status] || {
                      label: sub.status,
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
                          marginLeft: 4,
                        }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: s.color,
                          }}>
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
              )}

              {/* Edit subscription button (AP-16: full-width stacked) */}
              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor: primaryColor,
                  borderRadius: cardBorderRadius,
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 8,
                  marginBottom:
                    showItems &&
                    Array.isArray(sub.items) &&
                    sub.items.length > 0
                      ? 16
                      : 0,
                }}
                onPress={() => handleEditSubscription(sub)}>
                <Text
                  style={{
                    color: primaryColor,
                    fontSize: 14,
                    fontWeight: '500',
                  }}>
                  {editButtonLabel}
                </Text>
              </TouchableOpacity>

              {showItems &&
                Array.isArray(sub.items) &&
                sub.items.length > 0 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: textColor,
                        marginBottom: 8,
                      }}>
                      Items
                    </Text>
                    {sub.items.map((item, i) => (
                      <Text
                        key={i}
                        style={{
                          fontSize: 14,
                          color: '#6B7280',
                          marginBottom: 2,
                        }}>
                        {item.title && item.title.length > 35
                          ? item.title.substring(0, 35) + '...'
                          : item.title}{' '}
                        x {item.quantity}
                      </Text>
                    ))}
                  </View>
                )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export const WidgetConfig = {
  // appId: '',
  detailPageName: 'manageSealSubscriptionDetail',
  primaryColor: '#6366F1',
  backgroundColor: '#F3F4F6',
  cardBackgroundColor: '#FFFFFF',
  textColor: '#111827',
  borderColor: '#E5E7EB',
  successColor: '#10B981',
  errorColor: '#EF4444',
  cardBorderRadius: 12,
  editButtonLabel: 'Edit subscription',
  emptyStateMessage: 'No subscriptions found',
  showStatus: true,
  showTotalValue: true,
  showRepeatFrequency: true,
  showCreatedDate: true,
  showItems: true,
};

export const WidgetEditors = {
  basic: [
    // {type: 'codeInput', name: 'appId', props: {label: 'App id'}},
    {
      type: 'codeInput',
      name: 'detailPageName',
      props: {label: 'Subscription Detail Page Name'},
    },
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
      name: 'editButtonLabel',
      props: {label: 'Edit Button Label'},
    },
    {
      type: 'codeInput',
      name: 'emptyStateMessage',
      props: {label: 'Empty State Message'},
    },
    {type: 'checkbox', name: 'showStatus', props: {label: 'Show Status'}},
    {
      type: 'checkbox',
      name: 'showTotalValue',
      props: {label: 'Show Total Value'},
    },
    {
      type: 'checkbox',
      name: 'showRepeatFrequency',
      props: {label: 'Show Repeat Frequency'},
    },
    {
      type: 'checkbox',
      name: 'showCreatedDate',
      props: {label: 'Show Created Date'},
    },
    {type: 'checkbox', name: 'showItems', props: {label: 'Show Items'}},
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'SealManageSubscriptions',
  defaultProps: {},
};
