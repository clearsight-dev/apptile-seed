# 01 -- Core Reference: tile.config JSON to React Native

## 1. Role and Available Libraries

Convert Apptile tile.config JSON into React Native components with Redux state, event handling, and themed styling.

### Allowed Libraries

| Library | Use |
|---|---|
| `react` | React core |
| `react-native` | View, Text, Image, Pressable, FlatList, TextInput, ScrollView, Animated, Platform, StyleSheet, ActivityIndicator, PixelRatio, TouchableOpacity |
| `react-native-video` | Video player |
| `react-native-webview` | WebView |
| `@gorhom/portal` | Portal for modals |
| `apptile-core` | All Apptile utilities (see below) |
| `react-redux` | useSelector, useDispatch, shallowEqual |
| `lodash` | Utility functions |
| `immutable` | Immutable.js data structures |

### apptile-core Imports

```javascript
import {
  useTheme,
  generateTypographyByPlatform,
  useLoadedFonts,
  makeBoolean,
  triggerAction,
  navigateToScreen,
  sendAnalyticsEvent,
  performHapticFeedback,
  goBack,
  modelUpdateAction,
  runDatasourceQuery,
  EventTriggerIdentifier,
  TriggerActionIdentifier,
  datasourceTypeModelSel,
  selectPluginConfig,
  createDeepEqualSelector,
  Icon,
  ImageComponent,
} from 'apptile-core';
```

### react-redux Imports

```javascript
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
```

---

## 2. Understanding tile.config JSON Structure

### Top-Level Structure

```javascript
{
  "modules": [{
    "data": {
      "moduleUUID": "uuid-string",
      "moduleName": "Tile Display Name",
      "inputs": ["shopify", "localWishlist"],     // External state deps
      "outputs": [],
      "events": ["onEvent1", "onTap"],            // Available events
      "inputBindings": {
        "data": { "shopify": "{{shopify}}" }
      },
      "defaultEventHandlers": { "data": [...] },  // Event handler configs
      "editors": { "data": {...} },               // Advanced editors
      "basicEditors": { "data": {...} },          // Basic editors
      "styleEditors": { "data": {...} },          // Style editors
      "queries": { "data": {...} },               // Query definitions
      "moduleConfig": { "data": {...} }           // Widget tree
    }
  }]
}
```

### Widget Definition (inside moduleConfig.data)

```javascript
"widgetId": {
  "data": {
    "id": "widgetId",
    "type": "widget",              // "widget", "state", or "query"
    "subtype": "ContainerWidget",  // Determines React Native component
    "config": {
      "data": {
        "value": "Text or {{binding}}",
        "isTappable": false,
        "style": {
          "data": {
            "backgroundColor": "colors.background",
            "padding": "16",
            "typography": {
              "data": {
                "_inherit": "typography.heading",
                "fontSize": 18,
                "lineHeight": 27
              }
            }
          }
        },
        "events": { "data": [...] }
      }
    },
    "layout": {
      "data": {
        "container": "parentWidgetId",   // "" = root
        "flex": 1,
        "flexDirection": "column",
        "justifyContent": "center",
        "alignItems": "center",
        "width": "100%",
        "height": "200",
        "position": "absolute",
        "top": "20",
        "right": "10",
        "bottom": "0",
        "left": "0",
        "hidden": false,                 // or true, or "{{condition}}"
        "overflow": "hidden"
      }
    }
  }
}
```

### Parsing Serialized Types

tile.config wraps values in `__serializedType__` markers for Immutable.js. Always look inside `.data`:

| Type | Access |
|---|---|
| `ImmutableMap` | `object.data.key` |
| `ImmutableList` | `object.data[0]` |
| `ImmutableRecord` | `object.data.field` |

Consistent nesting pattern: `widget.data.config.data.style.data.typography.data._inherit`

### Key Elements to Extract

| Element | Location | Purpose |
|---|---|---|
| Module name | `modules[0].data.moduleName` | Component display name |
| Inputs | `modules[0].data.inputs` | External state deps for useSelector |
| Events | `modules[0].data.events` | Available event names |
| Event handlers | `modules[0].data.defaultEventHandlers.data` | How events map to actions |
| Widget tree | `modules[0].data.moduleConfig.data` | All widgets and their config |
| Queries | `modules[0].data.queries.data` | Data fetching definitions |
| Basic editors | `modules[0].data.basicEditors.data` | Editor UI for basic tab |
| Style editors | `modules[0].data.styleEditors.data` | Editor UI for style tab |

---

## 3. Widget Type Mapping

### Subtype to React Native Component

| Subtype | React Native | Notes |
|---|---|---|
| ContainerWidget | `<View>` | Layout container with flex props |
| TextWidget | `<Text>` | With numberOfLines, adjustsFontSizeToFit |
| ImageWidget | `<Image>` | With aspectRatio, resizeMode |
| ButtonWidget | `<Pressable>` + `<Text>` | onPress, disabled, loading |
| IconWidget | `<Icon>` (apptile-core) | iconType mapped, name, size, color |
| ListViewWidget | `<FlatList>` | horizontal, numColumns, slider/repeater modes |
| TextInputWidget | `<TextInput>` | value, onChangeText, placeholder |
| ModalWidget | `<Portal>` + `<View>` | Conditional visibility overlay |
| WebViewWidget | `<WebView>` | react-native-webview |
| VideoPlayerWidget | `<Video>` | react-native-video |
| RadioGroupWidget | `<ScrollView>` + tabs | Input data, selected value |
| DisplayImageList | Not rendered | State plugin -- holds list data |
| ModuleProperty | Not rendered | State plugin -- holds external state ref |
| QueryPlugin | Not rendered | Use runDatasourceQuery instead |

State and query plugins are data holders -- they are NOT rendered as UI.

### ContainerWidget

```javascript
<View
  nativeID="widgetId"
  style={{
    flexDirection: 'column',
    padding: 12,
    backgroundColor: themeEvaluator('colors.background'),
  }}
>
  {children}
</View>
```

### TextWidget

```javascript
<Text
  nativeID="widgetId"
  numberOfLines={numLines}
  adjustsFontSizeToFit={makeBoolean(model.get('adjustsFontSizeToFit'))}
  style={[baseTypography, overrideTypography, { color: textColor }]}
>
  {textValue}
</Text>
```

### ImageWidget

```javascript
<Image
  nativeID="widgetId"
  source={{ uri: imageUrl }}
  style={{ aspectRatio: 1.33, width: '100%' }}
  resizeMode="cover"
/>
```

### ButtonWidget

```javascript
const handlePress = () => {
  if (makeBoolean(model.get('enableHaptics'))) {
    performHapticFeedback(model.get('hapticMethod'));
  }
  // trigger event
};

<Pressable
  nativeID="widgetId"
  onPress={handlePress}
  disabled={makeBoolean(model.get('disabled')) || makeBoolean(model.get('loading'))}
  style={buttonStyles}
>
  {makeBoolean(model.get('loading'))
    ? <ActivityIndicator />
    : <Text>{model.get('value')}</Text>}
</Pressable>
```

### ListViewWidget (basic)

```javascript
<FlatList
  nativeID="widgetId"
  data={listData}
  horizontal={makeBoolean(model.get('horizontal'))}
  numColumns={model.get('numColumns') || 1}
  onEndReached={handleEndReached}
  onEndReachedThreshold={0.5}
  renderItem={({ item, index }) => (
    <View>{/* child widgets using item.property */}</View>
  )}
  keyExtractor={(item, index) => index.toString()}
/>
```

### TextInputWidget

```javascript
<TextInput
  nativeID="widgetId"
  value={inputValue}
  onChangeText={(text) => {
    dispatch(modelUpdateAction([{
      selector: ['widgetId', 'value'],
      newValue: text
    }]));
  }}
  placeholder={placeholder}
  style={inputStyles}
/>
```

### ModalWidget

```javascript
const isVisible = makeBoolean(model.get('value'));
const isDismissible = makeBoolean(model.get('isDismissible'));

<Portal>
  {isVisible && (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={isDismissible ? handleClose : undefined}
      />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        {children}
      </View>
    </View>
  )}
</Portal>
```

### WebViewWidget / VideoPlayerWidget

```javascript
import WebView from 'react-native-webview';
import Video from 'react-native-video';

<WebView nativeID="widgetId" source={{ uri: url }} style={styles} />
<Video nativeID="widgetId" source={{ uri: videoUrl }} paused={paused} muted={muted} resizeMode="cover" />
```

### IconWidget

```javascript
import { Icon } from 'apptile-core';

<Icon
  iconType="MaterialCommunityIcons"  // Mapped from tile.config (see table below)
  name="heart-outline"               // From config.value
  size={20}                          // From config.style.fontSize (as number)
  color={resolvedColor}              // From config.style.color (theme-resolved)
/>
```

iconType mapping:

| tile.config `iconType` | React Native `iconType` prop |
|---|---|
| `"Material Icon"` | `"MaterialCommunityIcons"` |
| `"Material Icons"` | `"MaterialIcons"` |
| `"Font Awesome"` | `"FontAwesome"` |
| `"Font Awesome 5"` | `"FontAwesome5"` |
| `"Ionicons"` | `"Ionicons"` |
| `"Feather"` | `"Feather"` |
| `"AntDesign"` | `"AntDesign"` |

Never use emoji `<Text>` for icons. Always use the `<Icon>` component.

---

## 4. Style Conversion Rules

### String Numbers to Numbers

All numeric style values in tile.config are strings:

```
"padding": "16"      -> padding: 16
"fontSize": "14"     -> fontSize: 14
"borderRadius": "8"  -> borderRadius: 8
"marginTop": "10"    -> marginTop: 10
"flex": 1            -> flex: 1  (already numeric, keep as-is)
```

Percentage widths stay as strings:
```
"width": "25%"  -> width: '25%'
"width": "100%" -> width: '100%'
```

### Theme Colors

Colors starting with `colors.` are theme references resolved via `themeEvaluator`:

```javascript
const { themeEvaluator } = useTheme();

// tile.config                     -> React Native
"colors.background"                -> themeEvaluator('colors.background')
"colors.onBackground"              -> themeEvaluator('colors.onBackground')
"colors.primary"                   -> themeEvaluator('colors.primary')
"colors.onPrimary"                 -> themeEvaluator('colors.onPrimary')
"colors.secondary"                 -> themeEvaluator('colors.secondary')
"colors.onSecondary"               -> themeEvaluator('colors.onSecondary')
```

Hardcoded hex colors (`#FFFFFF`, `#d6d4d4`) use directly as-is.

### Typography: BASE + OVERRIDE Pattern

Every text widget has a typography map with `_inherit` (base) plus overrides:

```json
"typography": { "data": { "_inherit": "typography.heading", "fontSize": 18, "lineHeight": 27 } }
```

Conversion:

```javascript
const typographyMap = model.get('titleTypography') || Immutable.Map();
const baseStyles = themeEvaluator(typographyMap.get('_inherit') || 'typography.heading');
const overrideStyles = {
  fontSize: typographyMap.get('fontSize') || 18,
  lineHeight: typographyMap.get('lineHeight') || 27,
};

// Apply in this order:
<Text style={[styles.title, baseStyles, overrideStyles, { color: titleColor }]}>
```

Style application order: `[layout styles, BASE typography, OVERRIDE typography, color]`

Available typography profiles: `typography.heading`, `typography.subHeading`, `typography.body`, `typography.caption`, `typography.button`

### Layout Props (from layout.data, applied as style)

`flex`, `flexDirection`, `alignItems`, `justifyContent`, `width`, `height`, `overflow` from `layout.data` go directly into the style object. Convert string numbers to numbers (`"200"` -> `200`).

### Padding, Margin, and Absolute Positioning

Extract from `config.style.data`: `"paddingRight": "8"` -> `paddingRight: 8`. Always check the root container -- this is the most commonly missed conversion.

Absolute positioning from `layout.data`: `"position": "absolute", "top": "20"` -> `{ position: 'absolute', top: 20, zIndex: 10 }`

### Flex Rules

Remove `flex: 1` from:
- Root containers
- FlatList and its wrapper
- FlatList items (in horizontal mode)
- Text widgets (always)
- Absolute positioned elements

Keep `flex: 1` only when needed for space distribution between siblings in a row.

For horizontal sliders, use `onLayout` to measure container width, never `Dimensions.get('window')`.

---

## 5. Event Handling

Check `defaultEventHandlers` in tile.config. Each handler has an `isExposed` flag that determines the pattern.

**WARNING: Do NOT generalize from reference plugins. Most existing plugins have isExposed: true, but many tile.configs have isExposed: false events that MUST be handled internally. Always check the tile.config you are converting — do not assume all events are exposed.**

### Path A: isExposed: true (Event Exposed to Parent)

The event bubbles up to whoever instantiates this tile. Your component fires it; the parent handles it.
- Use `triggerEvent('onEvent1')` from component props
- Do NOT write navigation, cart, wishlist, or analytics logic — the platform handles it

```javascript
import { EventTriggerIdentifier, TriggerActionIdentifier } from 'apptile-core';

// Component receives triggerEvent as prop
export function ReactComponent({ model, dispatch, triggerEvent }) {
  const handlePress = () => {
    triggerEvent('onEvent1');  // Just the event name
  };

  return <Pressable onPress={handlePress}>{/* ... */}</Pressable>;
}

// WidgetConfig -- register event slot
export const WidgetConfig = {
  onEvent1: TriggerActionIdentifier,  // The imported constant, not a string
};

// PropertySettings -- declare as event trigger
export const PropertySettings = {
  onEvent1: { type: EventTriggerIdentifier },  // The imported constant, not a string
};
```

Naming convention: `onEvent1`, `onEvent2`, `onEvent3`, etc. Default value is `TriggerActionIdentifier`.

### Path B: isExposed: false (Handle Internally)

You MUST write the actual logic. Do NOT use triggerEvent for these — it will not work.
Look at the handler's `method` field and implement the action directly:

| method | Code |
|---|---|
| `navigate` | `dispatch(navigateToScreen(screenName, params))` |
| `triggerAction` | `dispatch(triggerAction({pluginConfig, pluginModel, pluginSelector, eventModelJS}))` |
| `setValue` | `dispatch(modelUpdateAction([{selector, newValue}]))` |
| `goBack` | `dispatch(goBack())` |
| `sendTrackAnalytics` | `sendAnalyticsEvent(dispatch, eventName, params)` |
| `triggerHapticFeedback` | `performHapticFeedback(method)` |
| `forwardModuleEvent` | Follow the chain to the actual defaultEventHandler |

Only use screen names, plugin IDs, action values, and param keys that appear in tile.config. Never fabricate.

### navigate

JSON:
```json
{ "method": "navigate", "screenName": "Product", "params": { "productHandle": "?event.productHandle" } }
```

React:
```javascript
const handleTap = (productHandle) => {
  dispatch(navigateToScreen('Product', { productHandle }));
};
```

### triggerAction (on a plugin)

JSON:
```json
{
  "method": "triggerAction", "pluginId": "shopify",
  "value": "increaseCartLineItemQuantity",
  "params": { "merchandiseId": "?event.merchandiseId", "quantity": 1 }
}
```

React:
```javascript
const shopifyModelSel = state => datasourceTypeModelSel(state, 'shopifyV_22_10');
const shopifyConfigSel = state => selectPluginConfig(state, null, 'shopify');

// Inside component:
const ShopifyDSModel = useSelector(shopifyModelSel);
const ShopifyDSConfig = useSelector(shopifyConfigSel);

const handleAddToCart = (merchandiseId) => {
  dispatch(
    triggerAction({
      pluginConfig: ShopifyDSConfig,    // from selectPluginConfig
      pluginModel: ShopifyDSModel,      // from datasourceTypeModelSel
      pluginSelector: ['shopify'],
      eventModelJS: {
        value: 'increaseCartLineItemQuantity',
        params: { merchandiseId, quantity: 1, syncWithShopify: false },
      },
    }),
  );
};
```

### setValue

JSON:
```json
{ "method": "setValue", "pluginId": "cartNoteModal", "value": "{{true}}" }
```

React:
```javascript
const handleOpen = () => {
  dispatch(modelUpdateAction([{
    selector: ['cartNoteModal', 'value'],
    newValue: true
  }]));
};
```

With nested selector:
```json
{ "method": "setValue", "pluginId": "shopifyPDP", "selector": ["selectedOptions", "Size"], "value": "?event.value" }
```

```javascript
const handleSizeChange = (size) => {
  dispatch(modelUpdateAction([{
    selector: ['shopifyPDP', 'selectedOptions', 'Size'],
    newValue: size
  }]));
};
```

### goBack

```javascript
const handleBack = () => {
  dispatch(goBack());
};
```

### sendTrackAnalytics

JSON:
```json
{ "method": "sendTrackAnalytics", "value": "addToCart", "params": { "productId": "?event.productId" } }
```

React:
```javascript
sendAnalyticsEvent('addToCart', {
  productId: product.id,
  variantId: variant.id,
  price: variant.salePrice,
  quantity: 1,
  currency: currencyCode,
  title: product.title,
});
```

### triggerHapticFeedback

```javascript
performHapticFeedback('impactMedium');
// Methods: 'impactLight', 'impactMedium', 'impactHeavy', 'tap', 'tick',
//          'notificationSuccess', 'notificationWarning', 'notificationError'
```

### forwardModuleEvent Pattern

`method: "forwardModuleEvent"` with `value: "onEvent1"` forwards to `defaultEventHandlers` with `label: "onEvent1"`. Follow the chain to the actual action(s).

### Multiple Handlers on Same Event

One event label can have multiple handlers. Execute ALL:
```javascript
const handlePress = (item) => {
  dispatch(navigateToScreen('Collection', { collectionHandle: item.navEntityId }));
  performHapticFeedback('impactMedium');
};
```

### Conditional Events (hasCondition)

```javascript
// condition: "{{plugin.data[i].variants.length>1}}"
if (product.variants.length > 1) {
  dispatch(navigateToScreen('variantSelector', { productId: product.id, productHandle: product.handle }));
} else {
  // Add to cart directly
}
```

---

## 6. Converting Dynamic Values to useSelector

### Standard Binding

JSON template: `{{shopify.value.currentCart.lines}}`

```javascript
const cartLines = useSelector(
  state => state.appModel.values.getIn(['shopify', 'currentCart', 'lines']) || [],
  shallowEqual
);
```

### State Plugin Value

JSON template: `{{statePlugin.value.isVisible}}`

```javascript
const isVisible = useSelector(
  state => state.appModel.values.getIn(['statePlugin', 'value', 'isVisible']) || false,
  shallowEqual
);
```

### List Item Binding (with [i])

JSON template: `{{shopify.value.currentCart.lines[i].quantity}}`

This resolves inside a FlatList renderItem -- use `item.quantity`:

```javascript
<FlatList
  data={cartLines}
  renderItem={({ item }) => (
    <Text>{item.quantity}</Text>
  )}
/>
```

### Plugin Model vs Config Selectors

Define selectors outside the component. Use `datasourceTypeModelSel` for model data and `selectPluginConfig` for config:

```javascript
const shopifyModelSel = state => datasourceTypeModelSel(state, 'shopifyV_22_10');
const shopifyConfigSel = state => selectPluginConfig(state, null, 'shopify');
const shopifyCartSelector = createDeepEqualSelector(
  shopifyModelSel, ds => ds?.get('currentCartLineItems'),
);
```

| tile.config pluginId | datasourceTypeModelSel name | selectPluginConfig name |
|---|---|---|
| `shopify` | `'shopifyV_22_10'` | `'shopify'` |
| `localWishlist` | `'LocalWishlist'` | `'localWishlist'` |

---

## 7. Visibility Conditions

The `layout.hidden` field controls rendering:

### Always Show

```json
"hidden": false
```
Render normally, no conditional.

### Always Hide

```json
"hidden": true
```
Do not render the widget.

### Conditional Render

```json
"hidden": "{{shopify.value.cart.lines.length === 0}}"
```

```javascript
const cartLines = useSelector(
  state => state.appModel.values.getIn(['shopify', 'cart', 'lines']) || [],
  shallowEqual
);

// hidden when length === 0, so show when length > 0
return cartLines.length > 0 ? <View>{/* content */}</View> : null;
```

Another example:
```json
"hidden": "{{!statePlugin.value.isVisible}}"
```

```javascript
const isVisible = useSelector(
  state => state.appModel.values.getIn(['statePlugin', 'value', 'isVisible']) || false,
  shallowEqual
);

return isVisible ? <View>{/* content */}</View> : null;
```

---

## 8. Building Component Hierarchy

### Parsing layout.container

1. Parse all widgets from `moduleConfig.data`
2. Root widgets have `layout.container: ""` or `null`
3. Children reference parent via `layout.container: "parentId"`
4. Render recursively from root to leaves
5. Set `nativeID` prop matching the widget id

### Example

```
ProductCarousel (container: "")    <- Root
  TitleRow (container: "ProductCarousel")
    Title (container: "TitleRow")
    ViewAll (container: "TitleRow")
  ProductLV (container: "ProductCarousel")  <- FlatList
    Card (container: "ProductLV")           <- Repeated per item
```

```javascript
<View nativeID="ProductCarousel" style={styles.root}>
  <View nativeID="TitleRow" style={styles.titleRow}>
    <Text nativeID="Title">{titleText}</Text>
    <Pressable nativeID="ViewAll" onPress={handleViewAll}><Text>View All</Text></Pressable>
  </View>
  <FlatList nativeID="ProductLV" data={products} horizontal
    renderItem={({ item }) => (
      <View nativeID="Card">
        <Image source={{ uri: item.featuredImage }} />
        <Text>{item.title}</Text>
      </View>
    )}
    keyExtractor={(item) => item.id}
  />
</View>
```

### Dynamic Bindings in the Tree

`{{pluginId.value[i].property}}` means "current item in a repeater/list":
- `[i]` maps to `item.property` inside `renderItem`
- The widget consuming `[i]` must be a child of a ListViewWidget

---

## 9. Handling Lists (ListViewWidget)

### Repeater Mode (isRepeaterMode: true)

Used for grids. Set numColumns and calculate item width:

```javascript
// tile.config: numColumns: 2, isRepeaterMode: true
<FlatList
  data={gridData}
  numColumns={2}
  renderItem={({ item }) => (
    <View style={{ width: '50%', padding: 4 }}>
      {/* item content */}
    </View>
  )}
  keyExtractor={(item, index) => index.toString()}
/>
```

For 3 columns:
```javascript
<FlatList
  data={gridData}
  numColumns={3}
  renderItem={({ item }) => (
    <View style={{ width: '33.33%', padding: 4 }}>
      {/* item content */}
    </View>
  )}
/>
```

### Slider Mode (isSliderMode: true, horizontal: true)

Full-width paging slider with snap-to-item behavior.

Step 1: Measure container width
```javascript
const [containerWidth, setContainerWidth] = useState(0);
const itemWidth = containerWidth || 375;

const handleLayout = useCallback(event => {
  const { width } = event.nativeEvent.layout;
  if (width > 0 && width !== containerWidth) {
    setContainerWidth(width);
  }
}, [containerWidth]);
```

Step 2: getItemLayout (required for snap performance)
```javascript
const getItemLayout = useCallback(
  (data, index) => ({
    length: itemWidth,
    offset: itemWidth * index,
    index,
  }),
  [itemWidth],
);
```

Step 3: Viewability tracking for pagination dots
```javascript
const [currentIndex, setCurrentIndex] = useState(0);

const onViewableItemsChanged = useCallback(({ viewableItems, changed }) => {
  if (viewableItems && viewableItems.length > 0) {
    const visibleIdx = changed.find(it => it.isViewable)?.index ?? viewableItems[0]?.index ?? 0;
    setCurrentIndex(visibleIdx);
  }
}, []);

// Must be a stable ref
const viewabilityConfigCallbackPairs = useRef([{
  onViewableItemsChanged,
  viewabilityConfig: { itemVisiblePercentThreshold: 50 },
}]);
```

Step 4: Render FlatList with all slider props
```javascript
<View onLayout={handleLayout}>
  <FlatList
    data={sliderData}
    renderItem={({ item }) => (
      <Pressable style={{ width: itemWidth }}>
        <Image source={{ uri: item.image }} resizeMode="cover" />
      </Pressable>
    )}
    keyExtractor={(item, index) => `slide-${index}`}
    getItemLayout={getItemLayout}
    horizontal pagingEnabled
    showsHorizontalScrollIndicator={false}
    scrollEventThrottle={16}
    decelerationRate="fast"
    bounces={false}
    snapToInterval={itemWidth}
    disableIntervalMomentum={true}
    viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
    removeClippedSubviews={true}
    initialNumToRender={3}
    maxToRenderPerBatch={3}
    windowSize={5}
  />
</View>
```

Do NOT use `onScroll` with manual offset calculation for pagination. Use `viewabilityConfigCallbackPairs`.

Do NOT use `Dimensions.get('window').width`. Always measure via `onLayout`.

### Dynamic Data in Lists

`{{shopify.value.cart.lines[i].merchandise.product.title}}` in a child of ListViewWidget maps to `item.merchandise?.product?.title` in renderItem.

```javascript
const cartLines = useSelector(
  state => state.appModel.values.getIn(['shopify', 'cart', 'lines']) || [],
  shallowEqual
);

<FlatList data={cartLines}
  renderItem={({ item }) => <Text>{item.merchandise?.product?.title || ''}</Text>}
  keyExtractor={(item, index) => index.toString()}
/>
```

### Flex Rules for Horizontal Sliders

Remove `flex: 1` from all of these in horizontal slider context:
- Root container style
- FlatList wrapper style
- Item container style
- Absolute positioned overlay elements
- Text elements
- Button containers

Keep `flex: 1` only in vertical lists where needed for space distribution between row siblings.

---

## Component Template

```javascript
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Image, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import {
  useTheme, makeBoolean, navigateToScreen, triggerAction,
  performHapticFeedback, modelUpdateAction,
  datasourceTypeModelSel, selectPluginConfig, createDeepEqualSelector,
  Icon, EventTriggerIdentifier, TriggerActionIdentifier,
} from 'apptile-core';

// Selectors OUTSIDE component
const shopifyModelSel = state => datasourceTypeModelSel(state, 'shopifyV_22_10');
const shopifyConfigSel = state => selectPluginConfig(state, null, 'shopify');

export function ReactComponent({ model, dispatch, triggerEvent, getDeviceImage }) {
  const id = model.get('id');
  const { themeEvaluator } = useTheme();
  const ShopifyDSModel = useSelector(shopifyModelSel);
  const ShopifyDSConfig = useSelector(shopifyConfigSel);

  // NOTE: triggerEvent is for isExposed:true events only. For isExposed:false, handle internally (see Section 5).
  const handlePress = () => triggerEvent('onEvent1');

  return (
    <View nativeID={id} style={styles.root}>
      {/* Component tree matching tile.config hierarchy */}
    </View>
  );
}

export const WidgetConfig = { onEvent1: TriggerActionIdentifier };
export const WidgetEditors = { basic: [] };
export const PropertySettings = { onEvent1: { type: EventTriggerIdentifier } };
export const WrapperTileConfig = { name: 'Tile Name from moduleName', defaultProps: {} };

const styles = StyleSheet.create({ root: { flexDirection: 'column' } });
```

---

## Editor Mapping

tile.config has 3 editor sections that map to WidgetEditors categories:

| tile.config section | WidgetEditors category |
|---|---|
| `basicEditors` | `basic` |
| `editors` | `visibility` + `advanced` |
| `styleEditors` | `style` |

**Splitting `editors` into `visibility` vs `advanced`:** tile.config `editors` entries with `hidden` checkbox patterns go to `visibility`. Entries with section headers like 'INTERACTION', 'CARDS', size controls go to `advanced`.

Each editor entry has:
- `selector`: path to widget property being edited
- `editorType.type`: control type (codeInput, checkbox, colorPicker, etc.)
- `editorType.name`: property name in model
- `editorType.props`: control configuration
- `advanceProperty`: if true, add `advanceProperty: true` to editor
- `mandatory`: if true, add `mandatory: true`

Flatten the selector path into a single property name in WidgetConfig/WidgetEditors.

### borderRadiusEditor

Uses `Immutable.Map` with all 4 corners. The editor stores corner values inside the map.

```javascript
// Editor config
{
  type: 'borderRadiusEditor',
  name: 'imageBorderRadius',
  props: {
    label: 'Image',
    options: [
      'borderTopLeftRadius', 'borderTopRightRadius',
      'borderBottomRightRadius', 'borderBottomLeftRadius',
    ],
  },
}

// WidgetConfig — Immutable.Map with all 4 corners
imageBorderRadius: Immutable.Map({
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
})

// Component — helper to extract from map
const getBorderRadiusStyle = (borderRadiusMap, fallback = 0) => {
  if (!borderRadiusMap || !Immutable.Map.isMap(borderRadiusMap)) {
    return fallback ? { borderRadius: fallback } : {};
  }
  return {
    borderTopLeftRadius: parseFloat(borderRadiusMap.get('borderTopLeftRadius')) || 0,
    borderTopRightRadius: parseFloat(borderRadiusMap.get('borderTopRightRadius')) || 0,
    borderBottomLeftRadius: parseFloat(borderRadiusMap.get('borderBottomLeftRadius')) || 0,
    borderBottomRightRadius: parseFloat(borderRadiusMap.get('borderBottomRightRadius')) || 0,
  };
};

const imageBorderRadiusStyle = getBorderRadiusStyle(model.get('imageBorderRadius'));
```

Property names inside the map use camelCase (not hyphenated). Use `Immutable.Map` default (NOT flat undefined properties).
