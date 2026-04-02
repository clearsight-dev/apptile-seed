# 03 — Plugins: Redux State, Datasources, Queries, Actions

## Plugin Types Overview

| Type | Count | Examples | Wrapper | Access Pattern |
|------|-------|---------|---------|----------------|
| Datasource | 66+ | ShopifyV_22_10, Searchanize, JudgeMe, LocalWishlist | wrapDatasourceModel() | datasourceTypeModelSel(state, name) |
| Widget | 60+ | TextWidget, ButtonWidget, ListViewWidget | connectWidget() | model.get(prop) |
| State | 19+ | StatePlugin, LocalStoragePlugin, ShopifyPDP_22_10 | connectPlugin() | state.appModel.values.getIn([name]) |
| Query | 3 | QueryPlugin (DEPRECATED) | - | Use runDatasourceQuery instead |
| Module | 3 | ModuleInstance | - | Reusable modular components |

---

## Redux State Architecture

Two distinct Redux stores hold plugin information:

```
state.appModel.values    -> Plugin DATA (current state/values)
state.appConfig.current  -> Plugin CONFIG (configuration for triggerAction)
```

| Store | Path | Purpose |
|-------|------|---------|
| appModel.values | `state.appModel.values.getIn(['pluginName'])` | Reading cart items, wishlist, PDP state |
| appConfig.current | `state.appConfig.current.getIn(['plugins', 'pluginName'])` | Passing to triggerAction as pluginConfig |

### Selector Imports

```javascript
import { useSelector, shallowEqual } from 'react-redux';
import {
  datasourceTypeModelSel,
  selectPluginConfig,
  createDeepEqualSelector,
} from 'apptile-core';
```

### Selector Patterns

Define selectors outside the component for memoization:

```javascript
const shopifyModelSel = state => datasourceTypeModelSel(state, 'shopifyV_22_10');
const shopifyConfigSel = state => selectPluginConfig(state, null, 'shopify');

// Memoized derived selector
const shopifyCartSelector = createDeepEqualSelector(
  shopifyModelSel,
  shopifyDS => shopifyDS?.get('currentCartLineItems'),
);
```

### Plugin Name Mapping

| tile.config input | datasourceTypeModelSel name | selectPluginConfig name |
|---|---|---|
| `shopify` | `'shopifyV_22_10'` | `'shopify'` |
| `localWishlist` | `'LocalWishlist'` | `'localWishlist'` |

### Inline Selector Alternative

```javascript
const shopifyData = useSelector(
  state => state.appModel.values.getIn(['shopify']), shallowEqual);
const shopifyConfig = useSelector(
  state => state.appConfig.current.getIn(['plugins', 'shopify']), shallowEqual);
```

---

## Shopify Integration

### Accessing Shopify Data

```javascript
const shopifyData = useSelector(shopifyModelSel);
const cartLineItems = shopifyData?.get('currentCartLineItems') || [];
const maxLimit = shopifyData?.get('maxCartLineItemLimit'); // 25
const shop = shopifyData?.get('shop');
const currencyCode = shop?.get('paymentSettings')?.get('currencyCode') || 'USD';
const customerAccessToken = shopifyData?.get('loggedInUserAccessToken')?.get('accessToken') || '';
```

### Key Shopify Properties

| Property | Type | Description |
|----------|------|-------------|
| currentCartLineItems | Array | Cart line items |
| maxCartLineItemLimit | Number | Always 25 |
| shop | ImmutableMap | Store info including paymentSettings |
| loggedInUserAccessToken | ImmutableMap | Contains accessToken string |

### Cart Item Fields

merchandiseId, displayQuantity, title, variantTitle, price, image.

### Cart Operations via triggerAction

All cart operations use this structure:

```javascript
dispatch(triggerAction({
  pluginConfig: shopifyConfig,   // From appConfig.current
  pluginModel: shopifyData,      // From appModel.values
  pluginSelector: ['shopify'],
  eventModelJS: { value: 'actionName', params: { ... } },
}));
```

#### Add to Cart

```javascript
const handleAddToCart = (product, variant) => {
  if (!shopifyData || !shopifyConfig || !variant) return;
  if (product.variants && product.variants.length > 1) {
    dispatch(navigateToScreen('variantSelector', {
      productId: product.id, productHandle: product.handle,
    }));
    return;
  }
  dispatch(triggerAction({
    pluginConfig: shopifyConfig,
    pluginModel: shopifyData,
    pluginSelector: ['shopify'],
    eventModelJS: {
      value: 'increaseCartLineItemQuantity',
      params: {
        merchandiseId: variant.id, quantity: 1,
        syncWithShopify: true, successToastText: 'Product added to cart',
      },
    },
  }));
};
```

#### Decrease Quantity

```javascript
dispatch(triggerAction({
  pluginConfig: shopifyConfig, pluginModel: shopifyData, pluginSelector: ['shopify'],
  eventModelJS: {
    value: 'decreaseCartLineItemQuantity',
    params: { merchandiseId, quantity: 1, syncWithShopify: true },
  },
}));
```

#### Remove from Cart

```javascript
dispatch(triggerAction({
  pluginConfig: shopifyConfig, pluginModel: shopifyData, pluginSelector: ['shopify'],
  eventModelJS: { value: 'removeCartLineItem', params: { merchandiseId } },
}));
```

### pluginConfig Source for Shopify

```javascript
// Correct
pluginConfig: shopifyConfig  // from state.appConfig.current.getIn(['plugins', 'shopify'])
```
```javascript
// Wrong — will fail with triggerAction
pluginConfig: shopifyData.get('config')
```

---

## Wishlist Integration

### Selectors

```javascript
const localWishlistModelSel = state => datasourceTypeModelSel(state, 'LocalWishlist');
const wishlistItemsSel = createDeepEqualSelector(
  localWishlistModelSel, LWModel => LWModel?.get('products'),
);
```

### Accessing Wishlist Data

```javascript
const localWishlistData = useSelector(
  state => state.appModel.values.getIn(['localWishlist']), shallowEqual);
const wishlistItems = localWishlistData?.get('productIds') || [];
```

### isInWishlist Check

Shopify IDs are GIDs like `"gid://shopify/Product/123456"`. Wishlist stores numeric IDs.

```javascript
// Correct — split GID, use loose equality
const isInWishlist = (productId) => {
  return wishlistItems.some(item => item.id == productId.split('/').pop());
};
```
```javascript
// Wrong — items are objects with id property, not plain IDs
wishlistItems.includes(productId);
// Wrong — property is id, not productId
wishlistItems.some(item => item.productId === productId);
```

### Add to Wishlist

```javascript
const handleAddToWishlist = (product) => {
  if (!localWishlistData) return;
  dispatch(triggerAction({
    pluginConfig: localWishlistData.get('config'),
    pluginModel: localWishlistData,
    pluginSelector: ['localWishlist'],
    eventModelJS: {
      value: 'addProductToWishlist',
      params: {
        productId: product.id, productHandle: product.handle,
        productObj: product, customerAccessToken,
      },
    },
  }));
};
```

### Remove from Wishlist

```javascript
const handleRemoveFromWishlist = (product) => {
  if (!localWishlistData) return;
  dispatch(triggerAction({
    pluginConfig: localWishlistData.get('config'),
    pluginModel: localWishlistData,
    pluginSelector: ['localWishlist'],
    eventModelJS: {
      value: 'removeProductFromWishlist',
      params: { productId: product.id, productHandle: product.handle, customerAccessToken },
    },
  }));
};
```

### pluginConfig Source Difference

| Plugin | pluginConfig Source |
|--------|-------------------|
| shopify | `shopifyConfig` from `state.appConfig.current.getIn(['plugins', 'shopify'])` |
| localWishlist | `localWishlistData.get('config')` from the plugin data itself |

### Wishlist Visibility Toggle

```javascript
// tile.config hidden condition checks if product IS in wishlist
{!isInWishlist(product) && <UnfilledHeartIcon />}
{isInWishlist(product) && <FilledHeartIcon />}
```

---

## Query Execution (runDatasourceQuery)

### The Only Way to Fetch Data in Custom Widgets

```javascript
import { runDatasourceQuery } from 'apptile-core';
```

Do not use: QueryPlugin (deprecated), dsModel.runQuery, direct Apollo calls, cheaplyGetShopifyQueryRunner.

### Basic Pattern

```javascript
const [products, setProducts] = useState([]);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  if (!collectionHandle) return;
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const result = await runDatasourceQuery(
        'shopify',
        'GetCollectionProductsByHandle',
        { collectionHandle, sortKey: 'BEST_SELLING', first: 8, reverse: false },
      );
      if (result.hasError) {
        console.warn('Query error:', result.errors);
      } else if (result.data && Array.isArray(result.data)) {
        setProducts(result.data);
      }
    } catch (error) {
      console.warn('Query failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
  fetchProducts();
}, [collectionHandle]);
```

### Return Shape

```javascript
{ data: Array | Object, hasError: boolean, errors: Array, hasNextPage: boolean }
```

### Common Queries

| Query | Datasource | Returns |
|---|---|---|
| GetCollectionProductsByHandle | shopify | Direct array of products |
| GetProductByHandle | shopify | Single product object |
| GetCart | shopify | Cart object |
| SearchProducts | shopify | Array of products |

### Output Shape Varies by Query

Always check `datasources_documentation.md` before accessing result fields.

```javascript
// Correct — GetCollectionProductsByHandle returns a direct array
const products = result.data;
```
```javascript
// Wrong — assuming nested property
const products = result.data.products;
```

### QueryPlugin in tile.config (Conversion)

Convert QueryPlugin definitions to runDatasourceQuery in useEffect. Dynamic bindings like `"{{RadioGroup1.value}}"` become local state:

```javascript
const [selectedCollection, setSelectedCollection] = useState(defaultValue);
useEffect(() => {
  const fetch = async () => {
    const result = await runDatasourceQuery('shopify', 'GetCollectionProductsByHandle', {
      collectionHandle: selectedCollection, first: 8,
    });
    if (!result.hasError && Array.isArray(result.data)) setProducts(result.data);
  };
  fetch();
}, [selectedCollection]);
```

---

## Product Data Shape

```javascript
{
  id: "gid://shopify/Product/123456",
  handle: "product-slug",
  title: "Product Name",
  vendor: "Brand",
  productType: "Category",
  availableForSale: true,
  featuredImage: "https://cdn.shopify.com/...",   // Direct string URL
  displayMinPrice: "$29.99",                       // Formatted string
  minPrice: 29.99,                                 // Number
  variants: [{
    id: "gid://shopify/ProductVariant/789",
    title: "Default Title",
    price: 29.99,           // Number, not object
    salePrice: 24.99,
    displayPrice: "$29.99",
    displaySalePrice: "$24.99",
    availableForSale: true,
  }],
}
```

### Price Display Logic

```javascript
const variant = product.variants?.[0];
const salePrice = variant?.displaySalePrice;
const hasComparePrice = variant?.salePrice && variant?.price
  && variant.price !== 0 && variant.salePrice !== variant.price;
```

```javascript
// Wrong — price is a number, not an object
variant.price.amount
// Correct
variant.price
```

---

## State Plugin Integration

```javascript
// Read
const stateValue = useSelector(
  state => state.appModel.values.getIn(['myState', 'value']), shallowEqual);

// Update
dispatch(modelUpdateAction([{ selector: ['myState', 'value'], newValue: newData }]));
```

### DisplayImageList (State Plugin Variant)

Not rendered. Holds list data for listEditor:

```javascript
const collectionsRaw = model.get('collections');
const collectionsJS = collectionsRaw?.toJS ? collectionsRaw.toJS() : collectionsRaw || [];
const collections = Array.isArray(collectionsJS) ? collectionsJS : [];
```

---

## ShopifyPDP Integration

```javascript
const pdpData = useSelector(
  state => state.appModel.values.getIn(['shopifyPDP']), shallowEqual);

const product = pdpData?.get('product');
const activeVariant = pdpData?.get('activeVariant');
const selectedOptions = pdpData?.get('selectedOptions')?.toJS() || {};
const variantCount = pdpData?.get('variantCount') || 1;

// Update selected option
dispatch(modelUpdateAction([{
  selector: ['shopifyPDP', 'selectedOptions', optionName], newValue: value,
}]));

// Update quantity
dispatch(modelUpdateAction([{
  selector: ['shopifyPDP', 'variantCount'], newValue: quantity,
}]));
```

---

## triggerAction Reference

```javascript
dispatch(triggerAction({
  pluginConfig: PluginConfig,
  pluginModel: PluginModel,
  pluginSelector: ['pluginName'],
  eventModelJS: { value: 'actionName', params: { ... } },
}));
```

| Plugin | Action Value | Key Params |
|---|---|---|
| shopify | increaseCartLineItemQuantity | merchandiseId, quantity, syncWithShopify, successToastText |
| shopify | decreaseCartLineItemQuantity | merchandiseId, quantity, syncWithShopify |
| shopify | removeCartLineItem | merchandiseId |
| localWishlist | addProductToWishlist | productId, productHandle, productObj, customerAccessToken |
| localWishlist | removeProductFromWishlist | productId, productHandle, customerAccessToken |

Use `merchandiseId` (not `variantId`) for all cart actions.

---

## Analytics Events

```javascript
// Add to Cart
sendAnalyticsEvent(dispatch, 'addToCart', {
  variantId, brand, productType, price, productId, quantity,
  currency, variantTitle, title, referringTile, referringPage,
});

// Add to Wishlist
sendAnalyticsEvent(dispatch, 'addToWishlist', {
  currency, available, price, productId, productType, title, brand, quantity,
});
```

---

## Navigation

All calls must be wrapped in dispatch:

```javascript
dispatch(navigateToScreen('Product', { productHandle }));
dispatch(navigateToScreen('Collection', { collectionHandle }));
dispatch(navigateToScreen('variantSelector', { productId, productHandle }));
dispatch(navigateToScreen('Cart', {}));
dispatch(goBack());
```

```javascript
// Wrong
navigateToScreen('Product', { productHandle });
navigateToScreen(dispatch, 'Product', { productHandle });
```

---

## Haptic Feedback

```javascript
const enableHaptics = makeBoolean(model.get('enableHaptics'));
const hapticMethod = model.get('hapticMethod');
if (enableHaptics) performHapticFeedback(hapticMethod);
```

Methods: `impactLight`, `impactMedium`, `impactHeavy`, `notificationSuccess`, `tap`, `tick`.

---

## Model Update via Events

### setValue from tile.config

```json
{ "method": "setValue", "pluginId": "cartNoteModal", "value": "{{true}}" }
```
```javascript
dispatch(modelUpdateAction([{ selector: ['cartNoteModal', 'value'], newValue: true }]));
```

### Nested Property Update

```json
{ "method": "setValue", "pluginId": "shopifyPDP", "selector": ["selectedOptions", "Size"] }
```
```javascript
dispatch(modelUpdateAction([{
  selector: ['shopifyPDP', 'selectedOptions', 'Size'], newValue: size,
}]));
```

---

## Visibility Conditions

| hidden Value | Meaning | React |
|-------------|---------|-------|
| `false` | Always visible | Render normally |
| `true` | Always hidden | Do not render |
| `"{{expression}}"` | Conditional | Evaluate expression |

```javascript
// Simple boolean
const showWidget = !makeBoolean(model.get('hideWidget'));
{showWidget && <Component />}

// Query data condition: "hidden": "{{!query31.data||!query31.data[i]}}"
{product && <Component />}

// Wishlist toggle
{!isInWishlist(product) && <UnfilledIcon />}
{isInWishlist(product) && <FilledIcon />}
```

---

## RadioGroupWidget Conversion

RadioGroupWidget converts to horizontal ScrollView with selectable tabs:

```javascript
const [selectedValue, setSelectedValue] = useState(initialValue);
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {items.map((item, index) => {
    const isActive = selectedValue === item.value;
    return (
      <TouchableOpacity key={index}
        style={[styles.tab, isActive && styles.activeTab]}
        onPress={() => setSelectedValue(item.value)}>
        <Text style={[
          isActive ? activeBaseStyles : inactiveBaseStyles,
          { color: isActive ? activeColor : inactiveColor },
        ]}>{item.name}</Text>
      </TouchableOpacity>
    );
  })}
</ScrollView>
```

Input binding `{{list1.value.map(e=>({name:e.title,value:e.navEntityId}))}}` transforms collections into `{name, value}` pairs.

---

## Complete Redux Setup Pattern

Every complex tile with Shopify + wishlist needs this full setup:

```javascript
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import {
  useApptileWindowDims, navigateToScreen, modelUpdateAction, triggerAction,
  sendAnalyticsEvent, performHapticFeedback, goBack, makeBoolean,
  runDatasourceQuery, datasourceTypeModelSel, selectPluginConfig, createDeepEqualSelector,
} from 'apptile-core';

// Memoized selectors outside component
const shopifyModelSel = state => datasourceTypeModelSel(state, 'shopifyV_22_10');
const localWishlistModelSel = state => datasourceTypeModelSel(state, 'LocalWishlist');
const shopifyCartSelector = createDeepEqualSelector(
  shopifyModelSel, ds => ds?.get('currentCartLineItems'));
const wishlistItemsSel = createDeepEqualSelector(
  localWishlistModelSel, lw => lw?.get('productIds'));

export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');
  const { width } = useApptileWindowDims();

  // Plugin DATA
  const shopifyData = useSelector(shopifyModelSel);
  const localWishlistData = useSelector(localWishlistModelSel);

  // Plugin CONFIG (required for shopify triggerAction)
  const shopifyConfig = useSelector(
    state => state.appConfig.current.getIn(['plugins', 'shopify']), shallowEqual);

  // Derived data
  const cartItems = useSelector(shopifyCartSelector) || [];
  const wishlistItems = useSelector(wishlistItemsSel) || [];
  const customerAccessToken = shopifyData
    ?.get('loggedInUserAccessToken')?.get('accessToken') || '';

  // Wishlist check
  const isInWishlist = useCallback((productId) => {
    return wishlistItems.some(item => item.id == productId?.split('/')?.pop());
  }, [wishlistItems]);

  // ... handlers and render
}
```

---

## Quick Reference: Correct vs Wrong

| Pattern | Correct | Wrong |
|---------|---------|-------|
| Shopify pluginConfig | `shopifyConfig` (from appConfig) | `shopifyData.get('config')` |
| Wishlist pluginConfig | `localWishlistData.get('config')` | from appConfig |
| Navigation | `dispatch(navigateToScreen(...))` | `navigateToScreen(...)` without dispatch |
| Wishlist check | `item.id == productId.split('/').pop()` | `wishlistItems.includes(productId)` |
| Price access | `variant.price` | `variant.price.amount` |
| Query result | `result.data` (for collection queries) | `result.data.products` |
| Cart params | `merchandiseId: variant.id` | `variantId: variant.id` |
