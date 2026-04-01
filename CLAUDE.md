# CLAUDE.md — Apptile Plugin Development Reference

> **This is the single source of truth for working with this repository.** Read this file before writing any plugin code. It consolidates `README.md`, `Repo.md`, and `agent.md`.

---

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [Critical Rules (Read First)](#critical-rules-read-first)
3. [Plugin Scaffolding & File Structure](#plugin-scaffolding--file-structure)
4. [Plugin Anatomy — Component Structure](#plugin-anatomy--component-structure)
5. [WidgetConfig & WidgetEditors](#widgetconfig--widgeteditors)
6. [All Available Editor Control Types](#all-available-editor-control-types)
7. [Property Access & Model Patterns](#property-access--model-patterns)
8. [Redux & State Management](#redux--state-management)
9. [Inter-Plugin Navigation](#inter-plugin-navigation)
10. [Data Fetching Patterns](#data-fetching-patterns)
11. [Image Upload (assetEditor + getDeviceImage)](#image-upload-asseteditor--getdeviceimage)
12. [Tile JSON → React Native Conversion](#tile-json--react-native-conversion)
13. [Event Handling Patterns](#event-handling-patterns)
14. [Style Conversion Rules](#style-conversion-rules)
15. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
16. [General Patterns & Best Practices](#general-patterns--best-practices)
17. [Third-Party Integration Patterns](#third-party-integration-patterns)
18. [Query Execution (runDatasourceQuery)](#query-execution-rundatasourcequery)
19. [Allowed Libraries](#allowed-libraries)
20. [Pre-Commit Checklist](#pre-commit-checklist)

---

## Repository Overview

This is an **Apptile seed repo** for building mobile app plugins on the Apptile platform. Plugins are React Native components served remotely and rendered inside Apptile-powered mobile apps.

- `remoteCode/plugins/` — All plugin source files
- `remoteCode/index.js` — Plugin registry (register new plugins here)
- `remoteCode/indexNav.js` — Navigation plugin registry
- `analytics/index.ts` — Analytics tracking
- `apptile.config.json` — App configuration
- `ios/` / `android/` — Native app shells

---

## Critical Rules (Read First)

**🚨 NEVER create plugin files manually. ALWAYS use the CLI:**
```bash
tile create \
  --type plugin \
  --listing-name "pluginNameInCamelCase" \
  --plugin-registry-name "pluginNameInCamelCase" \
  --label-prefix "pluginNameInCamelCase" \
  --display-description "Description" \
  --editable-file-path "component.jsx" \
  --entry "widget.jsx"
```

**🚨 NEVER edit `widget.jsx`** — it is auto-generated. All implementation goes in `component.jsx`.

**🚨 WidgetEditors format is strict.** The only accepted format is:
```javascript
{ type: 'codeInput', name: 'apiKey', props: { label: 'API Key' } }
// NOT: { key: 'apiKey', label: 'API Key', type: 'codeInput' }  ← invisible in editor
```

**🚨 Root `<View>` must NEVER use `flex: 1`** — it collapses to 0 height:
```javascript
// ❌ WRONG
<View style={{ flex: 1 }}>
// ✅ CORRECT
<View style={{ flex: 'unset', minHeight: 300 }}>
```

**🚨 ALL booleans from `model.get()` must be wrapped with `makeBoolean()`:**
```javascript
const showSection = makeBoolean(model.get('showSection') ?? true);
```

**🚨 ALL `useSelector` calls must include `shallowEqual`:**
```javascript
const data = useSelector(state => state.appModel.values.getIn(['shopify']), shallowEqual);
```

**🚨 ALL hooks must be called BEFORE any early `return` statements** (React Rules of Hooks).

---

## Plugin Scaffolding & File Structure

### Creating a Plugin
```bash
tile create \
  --type plugin \
  --listing-name "myPlugin" \
  --plugin-registry-name "myPlugin" \
  --label-prefix "myPlugin" \
  --display-description "My Plugin Description" \
  --editable-file-path "component.jsx" \
  --entry "widget.jsx"
```

### After Creation
- Plugin lives at `remoteCode/plugins/<PluginName>/source/`
- `widget.jsx` — auto-generated entry point (**do NOT edit**)
- `component.jsx` — all implementation goes here
- Register the plugin in `remoteCode/index.js`

### Development Server
```bash
tile serve   # Assume already running in background
```

### Bundling
```bash
npx tile bundle
```

---

## Plugin Anatomy — Component Structure

```jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean } from 'apptile-core';

export function ReactComponent({ model, dispatch, getDeviceImage }) {
  const id = model.get('id');

  // ─── 1. Read merchant config from model ───────────────────────────────────
  const apiKey       = model.get('apiKey') || '';
  const primaryColor = model.get('primaryColor') || '#007AFF';
  const showSection  = makeBoolean(model.get('showSection') ?? true);

  // ─── 2. Read dynamic data from Redux (ALL hooks before any early return) ──
  const customerShopifyId = useSelector(state => {
    const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
    return gid ? gid.split('/').pop() : null;
  }, shallowEqual);

  // ─── 3. Local state ────────────────────────────────────────────────────────
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ─── 4. Memos & callbacks (before early returns) ──────────────────────────
  const processedData = useMemo(() => {
    if (!data) return null;
    return data; // transform here
  }, [data]);

  // ─── 5. Data fetching with cleanup ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetch(`...`);
        const json = await result.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [apiKey, customerShopifyId]);

  // ─── 6. Early returns AFTER all hooks ─────────────────────────────────────
  if (loading) return <ActivityIndicator />;
  if (error)   return <Text style={{ color: 'red' }}>{error}</Text>;
  if (!data)   return null;

  // ─── 7. Render ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 'unset', minHeight: 300 }}>
      {/* ... */}
    </View>
  );
}

export const WidgetConfig = {
  apiKey: '',
  primaryColor: '#007AFF',
  showSection: true,
};

export const WidgetEditors = {
  basic: [
    { type: 'codeInput',   name: 'apiKey',        props: { label: 'API Key' } },
    { type: 'colorInput',  name: 'primaryColor',  props: { label: 'Primary Color' } },
    { type: 'checkbox',    name: 'showSection',   props: { label: 'Show Section' } },
  ],
};

export const PropertySettings = {};
export const WrapperTileConfig = { name: 'My Plugin', defaultProps: {} };
```

---

## WidgetConfig & WidgetEditors

### WidgetConfig — Default Values
```javascript
export const WidgetConfig = {
  // Text and Content
  value: 'Default Text',
  placeholder: 'Enter text here',

  // Layout and Dimensions
  sliderHeight: 240,
  aspectRatio: null,
  numLines: 1,

  // Styling
  backgroundColor: 'transparent',
  color: '#000000',
  borderRadius: 8,

  // Behavior
  slideAutoplayToggle: true,
  incognito: false,

  // Data Arrays
  imageList: [],
  cartDetails: {},

  // Timing
  timer: 5000,
  initialDelay: 0,

  // Navigation
  navEntityType: '',
  navEntityId: '',

  // Loading
  isLoading: false,
};
```

### WidgetEditors — Minimum Required Merchant Configs

For every UI element, expose these at minimum:
- **Colors:** `primaryColor`, `secondaryColor`, `backgroundColor`, `textColor`, `borderColor`, `errorColor`, `successColor`, `dangerColor`
- **Labels:** All button labels, section titles, empty-state messages
- **Toggles:** `showXxx` booleans for each optional section
- **Layout:** `cardBorderRadius`, padding values
- **Secrets:** API keys, store domains (only truly merchant-specific)

**Do NOT expose in WidgetEditors:**
- `customerShopifyId` — fetch from Redux
- Dynamic record IDs (e.g., `itemId`, `orderId`) — pass via navigation params

### Conditional Visibility
```javascript
{
  type: 'numericInput',
  name: 'borderRadius',
  props: { label: 'Border Radius', unit: 'px' },
  hidden: model => !model.get('showBorder'),  // only visible when showBorder is true
}
```

---

## All Available Editor Control Types

### Input Controls
| Type | Description | Key Props |
|------|-------------|-----------|
| `codeInput` | Multi-line text with syntax highlighting | `singleLine`, `noOfLines`, `validationPattern`, `validationError` |
| `numericInput` | Numeric input with units | `unit`, `noUnit` |
| `rangeSliderInput` | Slider with min/max | `minRange`, `maxRange`, `steps` |
| `formatInput` | Text with prefix/suffix | `prefix`, `suffix` |
| `regexInput` | Text with regex validation | `showRecommendation`, `regexLabel` |
| `codemirrorInput` | Advanced code editor | `language`, `noOfLines`, `ignoreBinding` |

### Selection Controls
| Type | Description | Key Props |
|------|-------------|-----------|
| `checkbox` | Boolean toggle | `fullSizeLabel`, `reverse` |
| `radioGroup` | Single-select | `options: ['opt1', 'opt2']` |
| `dropDown` | Dropdown menu | `options: ['opt1', 'opt2']` |
| `iconChooserInput` | Icon picker | — |

### Visual Controls
| Type | Description | Key Props |
|------|-------------|-----------|
| `colorInput` | Color picker | — |
| `typographyInput` | Font/text styling | `disableExport` |
| `assetEditor` | Image/file upload | `urlProperty`, `assetProperty`, `sourceTypeProperty` (all **MANDATORY**) |
| `richTextStyleControl` | Rich text editor | — |

### Layout Controls
| Type | Description | Key Props |
|------|-------------|-----------|
| `quadInput` | 4-value (padding/margin) | `layout: 'quad'`, `options: ['px', 'em', '%']` |
| `borderRadiusEditor` | Border radius (simple + per-corner) | `options: ['prefixBorderTopLeftRadius', ...]` |
| `trblValuesEditor` | Top/Right/Bottom/Left | `options: ['px', 'em', '%']` |
| `alignmentEditor` | Content alignment | — |
| `aspectRatio` | Aspect ratio control | — |

### Data Controls
| Type | Description | Key Props |
|------|-------------|-----------|
| `jsonInput` | JSON editor | — |
| `customList` | Dynamic list builder | — |
| `listEditor` | Image/item list | `entityType: 'Product'/'Collection'/'default'`, `maxLength`, `minLength` |
| `customData` | Custom property editor | — |

### Navigation & Specialized Controls
| Type | Description |
|------|-------------|
| `pageIdSelector` | Page selection |
| `screenSelector` | Screen selection |
| `navigationInput` | Navigation config |
| `currencySelector` | Currency selection |
| `dateAndTimeInput` | Date/time picker |
| `valueMinMaxEditor` | Min/max values |
| `textDecorationInput` | Text decoration |
| `textTransformInput` | Text transform |

### Shopify-Specific Controls
| Type | Description |
|------|-------------|
| `shopifyCollectionHandleControl` | Shopify collection picker |
| `shopifyProductHandleControl` | Shopify product picker |
| `shopifyBlogHandleControl` | Shopify blog picker |

### 🚨 borderRadiusEditor — Critical Behavior

The `borderRadiusEditor` outputs to **multiple properties**:

```javascript
// Editor config:
{
  type: 'borderRadiusEditor',
  name: 'imageBorderRadius',  // simple radius property
  props: {
    label: 'Image Border',
    options: [
      'imageBorderTopLeftRadius',      // custom corner names (camelCase, no hyphens)
      'imageBorderTopRightRadius',
      'imageBorderBottomRightRadius',
      'imageBorderBottomLeftRadius',
    ],
  },
}

// WidgetConfig:
const WidgetConfig = {
  imageBorderRadius: 0,
  imageBorderTopLeftRadius: undefined,     // default undefined, not 0
  imageBorderTopRightRadius: undefined,
  imageBorderBottomRightRadius: undefined,
  imageBorderBottomLeftRadius: undefined,
};

// Component usage:
const hasCustomBorder =
  imageBorderTopLeftRadius !== undefined ||
  imageBorderTopRightRadius !== undefined ||
  imageBorderBottomRightRadius !== undefined ||
  imageBorderBottomLeftRadius !== undefined;

const borderStyles = hasCustomBorder ? {
  borderTopLeftRadius: imageBorderTopLeftRadius,
  borderTopRightRadius: imageBorderTopRightRadius,
  borderBottomRightRadius: imageBorderBottomRightRadius,
  borderBottomLeftRadius: imageBorderBottomLeftRadius,
} : { borderRadius: imageBorderRadius };
```

---

## Property Access & Model Patterns

```javascript
// Simple property
const value = model.get('propertyName');

// Boolean (ALWAYS use makeBoolean)
const isEnabled = makeBoolean(model.get('isEnabled') ?? true);

// Number
const radius = parseInt(model.get('borderRadius'), 10) || 0;

// With fallback
const color = model.get('primaryColor') || '#007AFF';

// Nested (immutable)
const nestedValue = model.get('parent')?.get('child');
```

### propertySettings — Event Handlers and Value Processors
```javascript
export const PropertySettings = {
  onPress: { type: 'EventTriggerIdentifier' },
  onLoadEnd: { type: 'EventTriggerIdentifier' },
  isLoading: {
    getValue: (model, val) => makeBoolean(val),
  },
};
```

---

## Redux & State Management

### Accessing Shopify Data
```javascript
// Plugin DATA (from appModel)
const shopifyData = useSelector(
  state => state.appModel.values.getIn(['shopify']),
  shallowEqual
);

// Plugin CONFIG (from appConfig — for triggerAction)
const shopifyConfig = useSelector(
  state => state.appConfig.current.getIn(['plugins', 'shopify']),
  shallowEqual
);

// Cart items
const cartLines = shopifyData?.get('currentCartLineItems') || [];
const maxLimit  = shopifyData?.get('maxCartLineItemLimit') || 25;
```

### Dynamic Shopify Customer ID (NEVER ask merchant to paste this)
```javascript
const customerShopifyId = useSelector(state => {
  const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
  return gid ? gid.split('/').pop() : null;  // "gid://shopify/Customer/12345" → "12345"
}, shallowEqual);
```

### Accessing Other Plugin Data
```javascript
// State plugin
const stateValue = useSelector(
  state => state.appModel.values.getIn(['myState', 'value']),
  shallowEqual
);

// ShopifyPDP
const pdpData = useSelector(
  state => state.appModel.values.getIn(['shopifyPDP']),
  shallowEqual
);
const product       = pdpData?.get('product');
const activeVariant = pdpData?.get('activeVariant');
const selectedOpts  = pdpData?.get('selectedOptions')?.toJS() || {};
```

### Updating State
```javascript
import { modelUpdateAction } from 'apptile-core';

// Simple update
dispatch(modelUpdateAction([{ selector: ['pluginId', 'value'], newValue: true }]));

// Nested update
dispatch(modelUpdateAction([{ selector: ['shopifyPDP', 'selectedOptions', 'Size'], newValue: 'M' }]));
```

### Dynamic Value Template → useSelector Mapping
| JSON Template | React Code |
|---------------|------------|
| `{{shopify.value.currentCart.lines}}` | `state.appModel.values.getIn(['shopify', 'currentCart', 'lines']) \|\| []` |
| `{{statePlugin.value.isVisible}}` | `state.appModel.values.getIn(['statePlugin', 'value', 'isVisible']) \|\| false` |

---

## Inter-Plugin Navigation

**ALWAYS use `@react-navigation/native`** — do NOT use `navigateToScreen` from `apptile-core` for plugin-to-plugin navigation (`navigateToScreen` is for tile-level navigation only).

```jsx
// Sender plugin:
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('TargetScreenName', { itemId: '123' });

// Receiver plugin:
import { useRoute } from '@react-navigation/native';
const route  = useRoute();
const itemId = route.params?.itemId || model.get('itemId') || '';
```

**Rules:**
- `route.params` is primary source; `model.get()` is fallback
- Keep param key in receiver's `WidgetConfig` with empty default
- Receiver's `WidgetEditors` should NOT include navigation params
- Validate required params before API calls
- No back button in plugins — the Apptile header provides one
- No page-level title — the Apptile title bar handles it

---

## Data Fetching Patterns

### Basic Fetch with Cleanup
```javascript
useEffect(() => {
  let cancelled = false;
  async function fetchData() {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!cancelled) setState(json);
    } catch (e) {
      if (!cancelled) setError(e.message);
    }
  }
  fetchData();
  return () => { cancelled = true; };
}, [deps]);
```

### Parallel Supplemental Data (non-blocking)
```javascript
// Primary resource first, then supplemental in parallel
useEffect(() => {
  let cancelled = false;
  async function load() {
    const primary = await fetchPrimaryResource(id);
    if (!cancelled) setPrimaryData(primary);

    // Non-critical supplemental data
    const [optionsResult, metaResult] = await Promise.allSettled([
      listOptions(id),
      fetchMetadata(),
    ]);
    if (!cancelled && optionsResult.status === 'fulfilled') setOptions(optionsResult.value);
    if (!cancelled && metaResult.status === 'fulfilled')    setMetadata(metaResult.value);
  }
  load();
  return () => { cancelled = true; };
}, [id]);
```

### Lazy-Loading Collapsed Sections
```javascript
const [showOrders, setShowOrders]   = useState(false);
const [orders, setOrders]           = useState(null); // null = never loaded

const toggleOrders = useCallback(() => {
  const next = !showOrders;
  setShowOrders(next);
  if (next && orders === null) loadOrders(); // fetch only on first expand
}, [showOrders, orders]);
```

### API Helper — Logging Pattern
```javascript
async function callApi(baseUrl, token, id, payload) {
  console.log('[Plugin] callApi', id, JSON.stringify(payload));
  const res = await fetch(`${baseUrl}/endpoint/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Plugin] callApi FAILED', res.status, errBody);
    const parsed = JSON.parse(errBody || '{}');
    const err = new Error(parsed?.message || 'Failed');
    err.apiMessage = parsed?.message || '';   // attach for field-level error parsing
    throw err;
  }
  const json = await res.json();
  console.log('[Plugin] callApi OK', JSON.stringify(json).substring(0, 500));
  return json;
}
```

### Auth Token Caching
```javascript
const [token, setToken] = useState(null);

useEffect(() => {
  let cancelled = false;
  (async () => {
    const t = await authenticate(apiKey, customerShopifyId);
    if (!cancelled) setToken(t);
  })();
  return () => { cancelled = true; };
}, [apiKey, customerShopifyId]);

// Guard all action handlers:
const handleAction = useCallback(async () => {
  if (!token) return;  // guard against null token
  // ...
}, [token]);
```

### performAction — Reusable Mutation Wrapper
```javascript
const performAction = useCallback(async (actionFn, successMsg) => {
  if (!authToken) return;
  try {
    setActionLoading(true);
    setTopMessage(null);
    await actionFn(baseUrl, authToken, resourceId);
    setTopMessage(successMsg);
    await refreshData(authToken); // refresh after mutation
  } catch (e) {
    setTopMessage(e.message);
  } finally {
    setActionLoading(false);
  }
}, [authToken, baseUrl, resourceId, refreshData]);
```

### Section-Level Error Messages (multi-section plugins)
```javascript
const [sectionMessages, setSectionMessages] = useState({});

const setSectionMsg   = useCallback((section, msg) => {
  setSectionMessages(prev => ({ ...prev, [section]: msg }));
}, []);
const clearSectionMsg = useCallback((section) => {
  setSectionMessages(prev => { const n = { ...prev }; delete n[section]; return n; });
}, []);

// Render inline below each section:
{sectionMessages['frequency'] && <Text style={styles.sectionError}>{sectionMessages['frequency']}</Text>}
```

---

## Image Upload (assetEditor + getDeviceImage)

### assetEditor — Mandatory Properties
```javascript
{
  type: 'assetEditor',
  name: 'backgroundImage',
  props: {
    label: 'Background Image',
    urlProperty: 'value',              // MANDATORY: stores the image URL
    assetProperty: 'assetId',          // MANDATORY: stores the assetId
    sourceTypeProperty: 'sourceType',  // MANDATORY: 'upload' | 'url'
  },
}
```

### WidgetConfig for Image Upload
```javascript
export const WidgetConfig = {
  value: '',          // urlProperty
  sourceType: 'url',  // sourceTypeProperty
  assetId: '',        // assetProperty
};
```

### Single Image Usage
```javascript
export function ReactComponent({ model, dispatch, getDeviceImage }) {
  const { value, sourceType, assetId } = model.toJS();

  // ✅ Call getDeviceImage at TOP LEVEL (never inside useMemo/useEffect/conditionals)
  const { getOptimalImage } = getDeviceImage(assetId);
  const [imageSource, setImageSource] = useState(value);
  const [layoutSize, setLayoutSize]   = useState('');

  useEffect(() => {
    if (sourceType?.toLowerCase() === 'upload' && assetId) {
      const url = getOptimalImage?.(layoutSize)?.fileUrl ?? null;
      if (imageSource !== url) setImageSource(url);
    } else {
      if (imageSource !== value) setImageSource(value);
    }
  }, [getOptimalImage, assetId, sourceType, value, layoutSize]);

  return <Image source={{ uri: imageSource }} />;
}
```

### Multiple Images — Pre-Resolution Pattern
```javascript
// Step 1: collect unique assetIds
const uniqueAssetIds = useMemo(() => {
  const ids = new Set();
  imageList.forEach(item => { if (item.assetId) ids.add(item.assetId); });
  return Array.from(ids);
}, [imageList]);

// Step 2: call getDeviceImage for ALL at top level (consistent hook order)
const deviceImages = {};
uniqueAssetIds.forEach(assetId => {
  const { imageRecord } = getDeviceImage(assetId);
  deviceImages[assetId] = imageRecord?.fileUrl;
});

// Step 3: transform data using pre-resolved images
const transformedData = useMemo(() => {
  return imageList.map(item => ({
    ...item,
    image: (item.sourceType?.toLowerCase() !== 'url' && item.assetId && deviceImages[item.assetId])
      ? deviceImages[item.assetId]
      : item.url,
  }));
}, [imageList, deviceImages]);
```

---

## Tile JSON → React Native Conversion

### Pre-Conversion Checklist
- [ ] Read ALL padding/margin from `tile.config` root container
- [ ] Check if ListViewWidget uses horizontal slider
- [ ] Check for image upload (`sourceType` field)
- [ ] List all theme colors (`colors.*`) and resolve to hex
- [ ] Note typography overrides (`fontSize`, `lineHeight`)
- [ ] Note `borderRadiusEditor` uses (custom corner names are camelCase)
- [ ] Note absolutely positioned elements
- [ ] Plan width measurement with `onLayout` for sliders

### Critical Conversion Rules

**1. Root Container Padding — ALWAYS check:**
```javascript
// tile.config has padding: "12" → React Native:
topBannerContainer: { padding: 12, flexDirection: 'column' }
```

**2. Horizontal Sliders — measure container, not screen:**
```javascript
const [containerWidth, setContainerWidth] = useState(0);
const itemWidth = containerWidth || 375;

<View onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
  <FlatList snapToInterval={itemWidth} />
</View>
```

**3. Horizontal Sliders — remove `flex: 1`:**
```javascript
// REMOVE flex: 1 from: root, FlatList wrapper, items, absolute elements
root: { /* no flex: 1 */ flexDirection: 'column' }
```

**4. Theme Colors — use actual values, not string tokens:**
```javascript
'colors.background' → '#FFFFFF'
'colors.primary'    → '#007AFF'
'colors.text'       → '#000000'
```

### Widget Type Mappings
| JSON subtype | React Native |
|-------------|--------------|
| `ContainerWidget` | `<View nativeID="pluginId">` |
| `TextWidget` | `<Animated.Text nativeID="pluginId">` |
| `ImageWidget` | `<Image nativeID="pluginId">` |
| `ButtonWidget` | `<Pressable nativeID="pluginId"><Text>...</Text></Pressable>` |
| `ListViewWidget` | `<FlatList nativeID="pluginId">` |
| `TextInputWidget` | `<TextInput nativeID="pluginId">` |
| `ModalWidget` | `<Portal><View>...</View></Portal>` |
| `WebViewWidget` | `<WebView nativeID="pluginId">` |
| `VideoPlayerWidget` | `<Video nativeID="pluginId">` |

### Component Hierarchy
Build parent-child tree using `layout.container`. Root elements have `container: ""` or `null`. Render recursively.

---

## Event Handling Patterns

### Navigation
```javascript
// Forward navigation
const handleTap = (productHandle) => {
  dispatch(navigateToScreen('Product', { productHandle }));
};

// Go back
const handleBack = () => { dispatch(goBack()); };
```

### Shopify Add to Cart
```javascript
dispatch(triggerAction({
  pluginConfig: shopifyConfig,
  pluginModel: shopifyData,
  pluginSelector: ['shopify'],
  eventModelJS: {
    value: 'increaseCartLineItemQuantity',
    params: { merchandiseId: variantId, quantity, syncWithShopify: true, successToastText: 'Added to cart' },
  },
}));
```

### Model Update
```javascript
dispatch(modelUpdateAction([{ selector: ['cartNoteModal', 'value'], newValue: true }]));
```

### Execute Query (DEPRECATED — use runDatasourceQuery instead)
```javascript
// Legacy only — do NOT use in new code
dispatch(triggerEvent({ pluginSelector: ['productQuery'], eventName: 'executeQuery' }));
```

### Haptic Feedback
```javascript
const enableHaptics = makeBoolean(model.get('enableHaptics'));
const hapticMethod  = model.get('hapticMethod'); // 'impactLight', 'impactMedium', 'impactHeavy', 'notificationSuccess'

if (enableHaptics) performHapticFeedback(hapticMethod);
```

### Analytics
```javascript
dispatch(sendAnalyticsEvent('track', 'addToCart', { productId, price }));
```

### Confirmation Before Destructive Actions
```javascript
import { Alert } from 'react-native';

const confirmAndExecute = (title, message, onConfirm) => {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
};

// Every action that modifies data MUST use this for destructive operations
<TouchableOpacity onPress={() => confirmAndExecute('Delete?', 'Remove this item?', handleDelete)}>
```

---

## Style Conversion Rules

```javascript
// JSON → React Native
"padding": "12"           → padding: 12
"backgroundColor": "colors.background" → backgroundColor: '#FFFFFF'
"borderRadius": "8"       → borderRadius: 8
"typography.body"         → extract fontSize, lineHeight, fontFamily
"spacing.md"              → 16

// Layout (from layout object + style object merged):
{
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
}
```

---

## Anti-Patterns to Avoid

### AP-1: Wrong WidgetEditors Format
```javascript
// ❌ WRONG — invisible in editor
{ key: 'apiKey', label: 'API Key', type: 'codeInput' }
// ✅ CORRECT
{ type: 'codeInput', name: 'apiKey', props: { label: 'API Key' } }
```

### AP-2: Hardcoding Dynamic IDs
- ❌ Asking merchant to paste `customerShopifyId`
- ✅ Fetch from Redux: `state.appModel.values.getIn(['shopify', 'loggedInUser', 'id'])`
- ❌ Putting dynamic record IDs (e.g., `itemId`) in WidgetEditors
- ✅ Pass via React Navigation params

### AP-3: Missing Merchant Configuration
Always expose colors, labels, and display toggles in WidgetEditors.

### AP-4: Root View `flex: 1` Collapse
```javascript
// ❌ <View style={{ flex: 1 }}>
// ✅ <View style={{ flex: 'unset', minHeight: 300 }}>
```

### AP-5: Using `navigateToScreen` for Plugin-to-Plugin Navigation
Use `@react-navigation/native` hooks (`useNavigation`, `useRoute`).

### AP-6: Booleans Without `makeBoolean()`
```javascript
// ❌ if (model.get('showSection'))
// ✅ if (makeBoolean(model.get('showSection') ?? true))
```

### AP-7: `useEffect` Without Cancelled Flag
Every async `useEffect` must return `() => { cancelled = true; }`.

### AP-8: `useSelector` Without `shallowEqual`
Always: `useSelector(selector, shallowEqual)`.

### AP-9: Page-Level Header in Plugin
The Apptile title bar is always present. Never add a `headerTitle` or top-level heading.

### AP-10: Back Button in Plugin
Never render a back button. The Apptile header provides one.

### AP-11: Hardcoded Options That Should Come From API
Always fetch valid options from the API. Never hardcode what could vary per merchant.

### AP-12: Generic Error Messages on Forms
Parse API error response, show field-level inline errors with red borders. Attach `err.apiMessage` on thrown errors.

### AP-13: No Confirmation for Destructive Actions
Always use `Alert.alert` before any state-changing or irreversible action (e.g., delete, update, remove).

### AP-14: Hooks After Early Returns
ALL hooks must be at the top of the function, before any `return` statement. Use optional chaining inside hook bodies.

### AP-15: Edit Buttons Not Right-Aligned
Use `renderSection(title, children, key, rightButton)` pattern with "Edit" button in section header.

### AP-16: Horizontal Button Rows on Mobile
Action buttons should be full-width and vertically stacked. Primary = filled, secondary = outlined.

### AP-17: Single-Line Address Display
Display addresses in multi-line format: name / street / city+state+zip / country.

### AP-18: Fetching All Data Upfront
Lazy-load data for collapsed sections. Use `null` as initial state to track "never loaded".

### AP-19: API Helpers Without Logs
Log: function name + key IDs + payload BEFORE request; `FAILED` + status + error body on failure; `OK` + response on success. Never log auth tokens.

### AP-20: Missing Supplemental Data
Use `Promise.allSettled` (not `Promise.all`) for parallel non-critical fetches. Always match by ID.

### AP-21: Using Date Picker Libraries
No date picker is in the allowed library list. Build a custom calendar with `View`, `Text`, `TouchableOpacity`.

### AP-22: Single Global Action Message
Use `sectionMessages: { [sectionKey]: string }` map, not a single `actionMessage`.

### AP-23: Losing API Error in Thrown Error
```javascript
const err = new Error(parsed?.message || 'Failed');
err.apiMessage = parsed?.message || '';  // attach for upstream field parsing
throw err;
```

---

## General Patterns & Best Practices

### Section Renderer Pattern
```javascript
const renderSection = (title, children, key, rightButton) => (
  <View key={key} style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rightButton || null}
    </View>
    <View style={styles.sectionDivider} />
    {children}
  </View>
);

// Usage with edit button:
renderSection('Settings', content, 'settings', (
  <TouchableOpacity onPress={() => setEditMode('settings')}>
    <Text style={styles.sectionEditBtn}>Edit</Text>
  </TouchableOpacity>
))
```

### Inline Edit Mode
```javascript
const [editMode, setEditMode] = useState(null);
// null | 'settings' | 'address' | 'details' | 'notes'

// In section render:
editMode === 'settings' ? (
  <SettingsEditForm onSave={handleSave} onCancel={() => setEditMode(null)} />
) : (
  <Text>{currentValue}</Text>
)
```

### Slide-In Panel (Animated)
```javascript
const SCREEN_WIDTH = Dimensions.get('window').width;
const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current; // useRef, NOT useState

const openPanel = () => {
  Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
};
const closePanel = () => {
  Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
    setEditingItem(null);
  });
};

<Animated.View style={[styles.slidePanel, { transform: [{ translateX: slideAnim }] }]}>
  {/* panel content */}
</Animated.View>
```

### Custom Calendar (No Library Available)
```javascript
const [calMonth, setCalMonth] = useState(new Date().getMonth());
const [calYear,  setCalYear]  = useState(new Date().getFullYear());
const [selectedDate, setSelectedDate] = useState('');
// Render with prev/next buttons, 7-column grid, disable past dates
```

### Apptile Gotchas Summary
| Gotcha | Solution |
|--------|----------|
| `makeBoolean()` for booleans | `makeBoolean(model.get('prop') ?? defaultValue)` |
| `useSelector` needs `shallowEqual` | Always pass as second arg |
| `PropertySettings` on no-event plugins | Set to `{}` |
| `widget.jsx` is auto-generated | Never edit it |
| Root `<View>` collapses to 0 | Use `flex: 'unset'` + `minHeight` |
| WidgetEditors format strict | Must be `{ type, name, props: { label } }` |
| No date picker library | Build custom calendar |

---

## Third-Party Integration Patterns

When building plugins that integrate with external services (subscription platforms, loyalty programs, CRM tools, etc.), follow these patterns.

### Multi-Plugin Navigation Flow
For integrations that span multiple screens, use a consistent navigation pattern:
```
List Screen → [tap item] → Detail/Manage Screen → [action btn] → Action Screen
       ↓ passes resourceId              ↓ passes resourceId
```

### Authentication (Multi-Step Token Exchange)
Many third-party services require a multi-step auth flow since native Shopify session cookies are unavailable in Apptile:
```
1. Exchange a merchant-provided admin key for a session token
   POST /admin/customer/{customerShopifyId}/sessionToken
   Header: X-Admin-Token: <adminKey>
   → returns sessionToken

2. Exchange session token for an access token (JWT)
   POST /auth/refreshToken
   Body: { sessionToken }
   → returns accessToken (JWT)

3. All subsequent API calls:
   Authorization: Bearer <accessToken>
```

### Merchant-Required Config
Expose only truly merchant-specific settings in WidgetEditors:

| Property | Editor Type | Notes |
|----------|-------------|-------|
| `baseUrl` | `codeInput` | Service API base URL |
| `storeDomain` | `codeInput` | Merchant's store domain (if needed) |

Add additional service-specific credentials as needed (e.g., admin keys, client IDs).

### NOT Exposed (Auto-Managed)
| Property | Source |
|----------|--------|
| `customerShopifyId` | Redux: `shopify.loggedInUser.id.split('/').pop()` |
| Dynamic record IDs | React Navigation params |

### Common Integration Issues & Solutions
| Issue | Solution |
|-------|----------|
| App Proxy returns 401 in Apptile | Use direct API auth (multi-step token exchange) |
| API response structure varies | Use fallback: `data.resource \|\| data.data \|\| data` |
| Need tabbed views (e.g., active vs past) | Tabbed interface with status filtering |
| Supplemental data may fail independently | `Promise.allSettled` to fetch in parallel |
| Destructive actions need safety | `Alert.alert` before any mutating API call |
| API error messages too generic | Parse response body for user-facing message |

---

## Query Execution (runDatasourceQuery)

> **⚠️ Query Plugin is DEPRECATED. Do NOT use it.** Use `runDatasourceQuery` from `apptile-core`.

### The ONLY Supported Pattern
```javascript
import { runDatasourceQuery } from 'apptile-core';

useEffect(() => {
  if (!collectionHandle) return;

  const execute = async () => {
    setIsLoading(true);
    try {
      // 1. Check datasources_documentation.md for exact query name + output structure
      const result = await runDatasourceQuery(
        'shopify',                       // datasource name
        'GetCollectionProductsByHandle', // query name (exact, case-sensitive)
        { collectionHandle, first: 6, sortKey: 'COLLECTION_DEFAULT' }
      );

      // 2. Log to verify structure matches docs
      console.log('Query result:', { hasError: result.hasError, dataType: typeof result.data });

      if (result.hasError) { setHasError(true); return; }

      // 3. Extract data using EXACT structure from datasources_documentation.md
      // GetCollectionProductsByHandle returns a direct array (NOT result.data.products)
      if (Array.isArray(result.data)) {
        setProducts(result.data);
      }
    } catch (e) {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  execute();
}, [collectionHandle]);
```

### Result Format
```javascript
result = {
  data: any,           // transformed data — could be array [] OR object {}
  rawData: any,        // original API response
  hasNextPage: bool,
  paginationMeta: any,
  errors: any,
  hasError: bool,
}
```

### MANDATORY: Check `datasources_documentation.md` First
Before writing any query code:
1. Search for the exact query name
2. Read the **Sample Output** section completely
3. Note whether output is a direct array `[]` or object with properties `{}`
4. Use EXACT field names from the sample
5. **DO NOT ASSUME the structure**

### Common Output Patterns
```javascript
// Pattern 1: Direct Array (e.g., GetCollectionProductsByHandle)
const products = result.data;  // ✅ NOT result.data.products

// Pattern 2: Object with Properties
const products = result.data.products;  // Only if docs show this structure
```

---

## Allowed Libraries

Only these modules may be imported:
```
react
react-native
react-redux
lodash
apptile-core
@gorhom/portal
react-native-webview
react-native-video
react-native-pager-view
react-native-svg
react-native-reanimated-carousel
react-native-linear-gradient
@react-navigation/native
```

**NOT allowed:** `@react-native-community/datetimepicker`, `DatePickerIOS`, `DateTimePicker`, or any package not listed above.

### apptile-core Exports
```javascript
import {
  useApptileWindowDims,
  navigateToScreen,
  modelUpdateAction,
  triggerAction,
  triggerEvent,
  sendAnalyticsEvent,
  performHapticFeedback,
  goBack,
  makeBoolean,
  connectWidget,
  runDatasourceQuery,
} from 'apptile-core';
```

---

## Pre-Commit Checklist

Copy this for every new plugin or integration:

- [ ] Created via `npx tile create` (not manually)
- [ ] `widget.jsx` untouched
- [ ] `component.jsx` has all code
- [ ] Plugin registered in `remoteCode/index.js`
- [ ] `WidgetEditors` use `{ type, name, props: { label } }` format
- [ ] Root `<View>` has `flex: 'unset'` and `minHeight`
- [ ] ALL `useSelector` calls use `shallowEqual`
- [ ] ALL booleans from `model.get()` wrapped in `makeBoolean()`
- [ ] ALL `useEffect` async operations have `cancelled` flag cleanup
- [ ] ALL hooks called before any early `return` statement
- [ ] Dynamic IDs (customerShopifyId, record IDs) NOT in WidgetEditors
- [ ] Colors, labels, display toggles exposed in WidgetEditors
- [ ] API keys/secrets exposed as `codeInput` in WidgetEditors
- [ ] Inter-plugin navigation uses `@react-navigation/native`
- [ ] No back button rendered in plugin
- [ ] No page-level title rendered in plugin
- [ ] Loading, error, and empty states all handled
- [ ] Confirmation popups (`Alert.alert`) before all destructive actions
- [ ] Field-level error handling on all forms
- [ ] API helpers log before, on failure, and on success
- [ ] Auth token cached in state; action handlers guard with `if (!token) return`
- [ ] Multi-section plugins use `sectionMessages` map
- [ ] `err.apiMessage` attached when throwing API errors
- [ ] Supplemental data uses `Promise.allSettled`, not `Promise.all`
- [ ] Date selection uses custom calendar (no library)
- [ ] `Animated.Value` in `useRef` (not `useState`) for slide panels
- [ ] `getDeviceImage` called at top level (not conditionally)
- [ ] `PropertySettings` exported as `{}`
- [ ] Tested with `npx tile bundle`
- [ ] Only imports from allowed library list
