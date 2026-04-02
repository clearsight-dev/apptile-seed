# 02 -- Patterns Reference

All 17 code patterns for tile-to-React-Native conversion. Each has correct + wrong examples.

---

## Pattern 1: Query Execution (runDatasourceQuery)

Returns `{ data, hasError, errors, hasNextPage }`. Check datasources_documentation.md for output shape.

```javascript
import { runDatasourceQuery } from 'apptile-core';

const [products, setProducts] = useState([]);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  if (!collectionHandle) return;
  const executeQuery = async () => {
    setIsLoading(true);
    try {
      const result = await runDatasourceQuery('shopify', 'GetCollectionProductsByHandle', {
        collectionHandle, first: productsLimit, reverse: false, sortKey,
      });
      if (result.hasError || result.errors.length > 0) return;
      // GetCollectionProductsByHandle returns DIRECT ARRAY
      if (result.data && Array.isArray(result.data)) {
        setProducts(result.data);
      }
    } finally { setIsLoading(false); }
  };
  executeQuery();
}, [collectionHandle, productsLimit, sortKey]);
```

```javascript
// WRONG: Assuming nested property
const products = result.data.products; // May not exist!
// CORRECT: Check docs first. For this query, data IS the array
const products = result.data;
```

Do NOT use: Query Plugin, dsModel.runQuery, Apollo client, cheaplyGetShopifyQueryRunner.

---

## Pattern 2: Add to Cart

Requires shopifyConfig from appConfig AND shopifyData from appModel. Multi-variant -> navigate to selector.

```javascript
const shopifyData = useSelector(state => state.appModel.values.getIn(['shopify']), shallowEqual);
const shopifyConfig = useSelector(state => selectPluginConfig(state, null, 'shopify'), shallowEqual);

const handleAddToCart = useCallback((product, variant) => {
  if (!shopifyData || !shopifyConfig || !variant) return;

  if (product.variants && product.variants.length > 1) {
    dispatch(navigateToScreen('variantSelector', {
      productId: product.id, productHandle: product.handle,
    }));
    return;
  }

  dispatch(triggerAction({
    pluginConfig: shopifyConfig,     // From appConfig.current
    pluginModel: shopifyData,        // From appModel.values
    pluginSelector: ['shopify'],
    eventModelJS: {
      value: 'increaseCartLineItemQuantity',
      params: {
        merchandiseId: variant.id,   // merchandiseId NOT variantId
        quantity: 1,
        syncWithShopify: true,
        successToastText: 'Product added to cart',
      },
    },
  }));

  sendAnalyticsEvent(dispatch, 'addToCart', {
    variantId: variant.id, brand: product.vendor, productType: product.productType,
    price: variant.price, productId: product.id, quantity: 1, currency: 'USD',
    variantTitle: variant.title, title: product.title, referringPage: id,
  });
}, [dispatch, shopifyConfig, shopifyData, id]);
```

```javascript
// WRONG: shopifyData.get('config') for pluginConfig
pluginConfig: shopifyData.get('config')         // Fails
// WRONG: 'addToCart' as event value
eventModelJS: { event: 'addToCart' }            // Wrong key and value
// WRONG: variantId instead of merchandiseId
params: { variantId: variant.id }               // Wrong param name
// WRONG: Not checking shopifyConfig
if (!shopifyData || !variant) { return; }       // Must check shopifyConfig too
```

---

## Pattern 3: Wishlist (Add/Remove)

Uses localWishlistData for BOTH pluginModel AND pluginConfig (exception to Pattern 4). Items are objects with `id` property. GIDs must be split.

```javascript
const localWishlistData = useSelector(
  state => state.appModel.values.getIn(['localWishlist']), shallowEqual);
const wishlistItems = localWishlistData?.get('products') || [];
const customerAccessToken = useSelector(
  state => state.appModel.values.getIn(['customerAccessToken', 'value']), shallowEqual);

// Check: GID "gid://shopify/Product/123456" -> split -> "123456", loose equality
const isInWishlist = useCallback(
  productId => wishlistItems.some(item => item.id == productId.split('/').pop()),
  [wishlistItems],
);

// Add
const handleAddToWishlist = product => {
  if (!localWishlistData) return;
  dispatch(triggerAction({
    pluginConfig: localWishlistData.get('config'),  // NOT from appConfig
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

// Remove
const handleRemoveFromWishlist = product => {
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

```javascript
// WRONG: 'productIds' does not exist — use 'products'
localWishlistData?.get('productIds') || [];
// WRONG: Direct comparison without GID splitting
wishlistItems.includes(productId);
// WRONG: item.productId instead of item.id
wishlistItems.some(item => item.productId === productId);
// WRONG: Missing productObj or customerAccessToken in add params
```

---

## Pattern 4: Plugin Config vs Plugin Data

| Plugin | pluginConfig source | pluginModel source |
|---|---|---|
| shopify | `appConfig.current.getIn(['plugins', 'shopify'])` | `appModel.values.getIn(['shopify'])` |
| localWishlist | `localWishlistData.get('config')` | `appModel.values.getIn(['localWishlist'])` |

```javascript
// CORRECT
const shopifyConfig = useSelector(state => selectPluginConfig(state, null, 'shopify'), shallowEqual);
const shopifyData = useSelector(state => state.appModel.values.getIn(['shopify']), shallowEqual);
dispatch(triggerAction({ pluginConfig: shopifyConfig, pluginModel: shopifyData, ... }));

// WRONG: Getting config from plugin data for shopify
pluginConfig: shopifyData.get('config')  // Fails with triggerAction
```

---

## Pattern 5: Navigation

Always wrap in dispatch(). Never call directly. Never pass dispatch as first param.

```javascript
// CORRECT
dispatch(navigateToScreen('Product', { productHandle: product.handle }));
dispatch(navigateToScreen('Collection', { collectionHandle: 'tea' }));
dispatch(navigateToScreen('variantSelector', { productId: product.id, productHandle: product.handle }));

// WRONG
navigateToScreen('Product', { productHandle });             // No dispatch
navigateToScreen(dispatch, 'Product', { productHandle });   // dispatch as param
```

Screen names come from tile.config `screenName` field. Never invent screen names.

---

## Pattern 6: Typography BASE + OVERRIDE

Two layers: BASE (theme profile) + OVERRIDE (tile.config fontSize/lineHeight).

```javascript
const { themeEvaluator } = useTheme();

// BASE from theme
const headingStyles = themeEvaluator('typography.heading');
const subHeadingStyles = themeEvaluator('typography.subHeading');
const bodyStyles = themeEvaluator('typography.body');

// OVERRIDE from tile.config: { _inherit: "typography.heading", fontSize: 16, lineHeight: 24 }
const titleTypography = { fontSize: 16, lineHeight: 24 };

// Apply in order: layout -> BASE -> OVERRIDE -> color
<Text style={[styles.title, headingStyles, titleTypography, { color: textColor }]}>
  {title}
</Text>
```

Available profiles: `typography.heading`, `typography.subHeading`, `typography.body`, `typography.caption`, `typography.button`.

```javascript
// WRONG: Only BASE, missing OVERRIDE
<Text style={[styles.title, headingStyles, { color: textColor }]}>
// WRONG: Only OVERRIDE, missing BASE
<Text style={[styles.title, { fontSize: 16 }, { color: textColor }]}>
// WRONG: Typography in StyleSheet
const styles = StyleSheet.create({ title: { fontSize: 16 } });
```

---

## Pattern 7: Icon Component

```javascript
import { Icon } from 'apptile-core';
<Icon iconType="MaterialCommunityIcons" name="heart-outline" size={20} color={primaryColor} />
```

iconType mapping (tile.config -> React Native):

| tile.config | React Native |
|---|---|
| `"Material Icon"` | `"MaterialCommunityIcons"` |
| `"Material Icons"` | `"MaterialIcons"` |
| `"Font Awesome"` | `"FontAwesome"` |
| `"Font Awesome 5"` | `"FontAwesome5"` |
| `"Ionicons"` | `"Ionicons"` |
| `"Feather"` | `"Feather"` |
| `"AntDesign"` | `"AntDesign"` |
| `"Entypo"` | `"Entypo"` |

Props: `name` from config.value, `size` from config.style.fontSize (as number), `color` from theme.

```javascript
// WRONG: Emoji
<Text>heart</Text>
// WRONG: Unmapped iconType
<Icon iconType="Material Icon" name="heart" />  // Invalid RN iconType
```

---

## Pattern 8: FlatList Item Layout

Remove flex: 1 from items. Add explicit width + minHeight. Remove height: '100%' from nested cards.

```javascript
// CORRECT
lvContainer: { width: 180, minHeight: 330, marginRight: 12, flexDirection: 'column' },
productCard: { flexDirection: 'column', width: '100%' },  // No flex: 1, no height: '100%'

// WRONG
lvContainer: { flex: 1 },        // Causes cutting
productCard: { height: '100%' }, // Causes cutting
```

Calculate minHeight: sum child heights (image + title + price + button + margins) + buffer.

---

## Pattern 9: Style Application Order

```javascript
// CORRECT ORDER (later overrides earlier)
<Text style={[
  styles.text,         // 1. Layout (margins, padding)
  headingStyles,       // 2. Typography BASE
  titleTypography,     // 3. Typography OVERRIDE
  { color: textColor } // 4. Theme color (always last)
]}>

// WRONG: Color first (might be overridden by typography)
<Text style={[{ color: textColor }, headingStyles, styles.text]}>
```

---

## Pattern 10: Variant Handling

Check variant count before adding to cart.

```javascript
// CORRECT
if (product.variants && product.variants.length > 1) {
  dispatch(navigateToScreen('variantSelector', { productId: product.id, productHandle: product.handle }));
  return;
}
dispatch(triggerAction({...})); // Single variant: add directly

// WRONG: Always adding first variant without checking count
dispatch(triggerAction({...})); // Might have multiple variants
```

---

## Pattern 11: Price Display

Check `variant.salePrice < variant.price` for sale. Use display-prefixed fields for formatted strings.

```javascript
{variant.salePrice && variant.salePrice < variant.price ? (
  <>
    <Text style={[styles.salePrice, subHeadingStyles, priceTypo, { color: saleColor }]}>
      {variant.displaySalePrice}
    </Text>
    <Text style={[styles.mrp, bodyStyles, mrpTypo, { color: textColor, textDecorationLine: 'line-through' }]}>
      {variant.displayPrice}
    </Text>
  </>
) : (
  <Text style={[styles.price, subHeadingStyles, priceTypo, { color: textColor }]}>
    {variant.displayPrice}
  </Text>
)}
```

```javascript
// WRONG: Always showing both prices
<Text>{variant.displaySalePrice}</Text><Text>{variant.displayPrice}</Text>
// WRONG: Accessing price.amount (price is already a number)
variant.price.amount
```

---

## Pattern 12: Flex Property Handling

Decision tree for every element:

| Element type | Action |
|---|---|
| Root container | Remove flex: 1, add padding |
| FlatList | Remove flex: 1, add maxHeight |
| FlatList item | Remove flex: 1, add width + minHeight |
| Nested in FlatList item | Remove flex: 1, remove height: '100%' |
| ScrollView | Remove flex: 1, add maxHeight |
| Text | NEVER flex: 1 |
| Image | Add explicit width + height |
| Horizontal slider items | Remove ALL flex: 1 |

```javascript
// CORRECT
rootContainer: { paddingHorizontal: 16, paddingVertical: 12 },
flatList: { maxHeight: 350 },
flatListItem: { width: 180, minHeight: 330, marginRight: 12 },
card: { flexDirection: 'column', width: '100%' },
image: { width: '100%', height: 180 },

// WRONG
rootContainer: { flex: 1 },  // Fills screen, cutting
flatListItem: { flex: 1 },   // Cut in middle
card: { height: '100%' },    // Fills parent, cutting
```

Common cutting scenarios:

| Scenario | Cause | Fix |
|---|---|---|
| Widget cut at bottom | Root has flex: 1 | Remove flex: 1 from root |
| Cards cut in middle | FlatList item has flex: 1 | Remove flex: 1, add minHeight |
| Content overflows | No explicit height | Add maxHeight to FlatList |
| Vertical cutting | height: '100%' on nested | Remove height: '100%' |
| Horizontal cutting | No width on FlatList item | Add explicit width |
| Image not showing | No height on Image | Add explicit height |

---

## Pattern 13: Exposing Properties

### WidgetConfig (defaults)

```javascript
export const WidgetConfig = {
  title: 'New Arrivals', viewAllText: 'View All', addToCartText: 'Add to Cart',
  productsLimit: 6, imageAspectRatio: 1,
  showHeader: true, showPrice: true,
  sortKey: 'COLLECTION_DEFAULT', collections: [], images: [],
  onEvent1: TriggerActionIdentifier, onEvent2: TriggerActionIdentifier,  // Imported constant, for exposed events only
};
```

### WidgetEditors (UI controls)

```javascript
export const WidgetEditors = {
  basic: [
    { type: 'editorSectionHeader', name: 'tileSetup', props: { label: 'TILE SETUP' } },
    { type: 'codeInput', name: 'title', props: { label: 'Title', singleLine: true } },
    { type: 'numberInput', name: 'productsLimit', props: { label: 'Products', min: 1, max: 20 } },
    { type: 'checkbox', name: 'showHeader', props: { label: 'Show Header', reverse: true } },
    { type: 'dropDown', name: 'sortKey', props: {
      label: 'Sort By', options: ['COLLECTION_DEFAULT', 'BEST_SELLING', 'CREATED', 'PRICE', 'TITLE'],
    }},
    { type: 'shopifyCollectionHandleControl', name: 'collectionHandle', props: { label: 'Collection' } },
    { type: 'listEditor', name: 'images', props: {  // NOT codeInput for arrays
      label: 'Images', itemSchema: {
        url: { type: 'text', label: 'URL', required: true },
        sourceType: { type: 'text', label: 'Source Type' },
        assetId: { type: 'text', label: 'Asset ID' },
        title: { type: 'text', label: 'Title' },
      },
    }},
    { type: 'borderRadiusEditor', name: 'imageBorderRadius', props: {
      label: 'Image', options: [
        'imageBorderTopLeftRadius', 'imageBorderTopRightRadius',
        'imageBorderBottomRightRadius', 'imageBorderBottomLeftRadius',
      ],
    }},
    // Alignment — use radioGroup, NOT alignmentEditor
    { type: 'radioGroup', name: 'horizontalAlign', props: { label: 'Horizontal Alignment', options: [
      { icon: 'alpha-a', value: 'auto' },
      { icon: 'format-align-left', value: 'left' },
      { icon: 'format-align-center', value: 'center' },
      { icon: 'format-align-right', value: 'right' },
      { icon: 'format-align-justify', value: 'justify' },
    ] } },
    { type: 'radioGroup', name: 'verticalAlign', props: { label: 'Vertical Alignment', options: [
      { icon: 'alpha-a', value: 'auto' },
      { icon: 'format-vertical-align-top', value: 'top' },
      { icon: 'format-vertical-align-center', value: 'center' },
      { icon: 'format-vertical-align-bottom', value: 'bottom' },
    ] } },
  ],
};
```

### PropertySettings (exposed events only)

```javascript
// Without exposed events:
export const PropertySettings = {};

// With exposed events (import EventTriggerIdentifier from apptile-core):
export const PropertySettings = {
  onEvent1: { type: EventTriggerIdentifier },  // Imported constant, NOT a string
  onEvent2: { type: EventTriggerIdentifier },
};
```

### Using in component

```javascript
import { makeBoolean } from 'apptile-core';
const title = model.get('title');
const showHeader = makeBoolean(model.get('showHeader')); // Always makeBoolean for booleans
```

```javascript
// WRONG: Hardcoded values
const title = 'New Arrivals';              // Should be model.get('title')
// WRONG: No makeBoolean
const showHeader = model.get('showHeader'); // Might be string "true"
// WRONG: codeInput for lists
{ type: 'codeInput', name: 'collections' } // Use listEditor
```

---

## Pattern 14: Image Upload (getDeviceImage)

### Single image

```javascript
export function ReactComponent({model, dispatch, getDeviceImage}) {
  const {value, resizeMode, sourceType, assetId} = model.toJS();
  const {getOptimalImage} = getDeviceImage(assetId);  // Top level, single call
  const [imageSource, setImageSource] = useState(value);
  const [layoutSize, setLayoutSize] = useState('');

  useEffect(() => {
    if (sourceType && sourceType.toLowerCase() !== 'url' && assetId) {
      const assetSource = getOptimalImage && getOptimalImage(layoutSize);
      const url = assetSource?.fileUrl ?? null;
      if (url !== imageSource) setImageSource(url);
    } else if (value !== imageSource) {
      setImageSource(value);
    }
  }, [getOptimalImage, assetId, sourceType, value, layoutSize]);
}
```

### Multiple images (pre-resolution pattern)

```javascript
const imageList = model.get('imageList') || [];

// Step 1: All unique assetIds
const uniqueAssetIds = useMemo(() => {
  const ids = new Set();
  imageList.forEach(item => { if (item.assetId) ids.add(item.assetId); });
  return Array.from(ids);
}, [imageList]);

// Step 2: Pre-call getDeviceImage for ALL at top level (consistent hook order)
const deviceImages = {};
uniqueAssetIds.forEach(assetId => {
  const assetSource = getDeviceImage(assetId);
  deviceImages[assetId] = assetSource.imageRecord?.fileUrl;
});

// Step 3: Transform
const transformedData = useMemo(() => {
  return imageList.map(item => {
    if (item.sourceType?.toLowerCase() !== 'url' && item.assetId && deviceImages[item.assetId]) {
      return { ...item, image: deviceImages[item.assetId] };
    }
    return { ...item, image: item.url };
  });
}, [imageList, deviceImages]);
```

```javascript
// WRONG: getDeviceImage inside useEffect
useEffect(() => { imageList.forEach(item => { getDeviceImage(item.assetId); }); }, []);
// WRONG: getDeviceImage inside useMemo
useMemo(() => imageList.map(item => getDeviceImage(item.assetId)), []);
// WRONG: getDeviceImage conditionally
if (item.sourceType === 'upload') { getDeviceImage(item.assetId); }
```

---

## Pattern 15: borderRadiusEditor

Custom corners override simple radius. Use undefined check (0 is valid radius).

```javascript
// WidgetConfig
imageBorderRadius: 0,
imageBorderTopLeftRadius: undefined,     // camelCase, NOT hyphenated
imageBorderTopRightRadius: undefined,
imageBorderBottomRightRadius: undefined,
imageBorderBottomLeftRadius: undefined,

// Component
const imageBorderRadius = parseInt(model.get('imageBorderRadius'), 10) || 0;
const tl = model.get('imageBorderTopLeftRadius');
const tr = model.get('imageBorderTopRightRadius');
const br = model.get('imageBorderBottomRightRadius');
const bl = model.get('imageBorderBottomLeftRadius');

const hasCustom = tl !== undefined || tr !== undefined || br !== undefined || bl !== undefined;
const imageBorderStyles = hasCustom
  ? { borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl }
  : { borderRadius: imageBorderRadius };

<View style={[styles.container, imageBorderStyles]} />
```

```javascript
// WRONG: Only simple radius (missing custom corners)
<View style={{ borderRadius: imageBorderRadius }} />
// WRONG: Hyphenated names
'image-borderTopLeftRadius'  // Should be camelCase
// WRONG: Falsy check (0 is valid)
if (tl) // Skips 0. Use: tl !== undefined
```

---

## Pattern 16: Container Width Measurement (Sliders)

Measure with onLayout. Never use Dimensions.get('window').

```javascript
const [containerWidth, setContainerWidth] = useState(0);
const itemWidth = containerWidth || 375;

const handleLayout = useCallback(event => {
  const {width} = event.nativeEvent.layout;
  if (width > 0 && width !== containerWidth) setContainerWidth(width);
}, [containerWidth]);

// onLayout on CONTAINER, not FlatList
<View onLayout={handleLayout}>
  <FlatList
    horizontal pagingEnabled
    snapToInterval={itemWidth}
    getItemLayout={(data, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
    showsHorizontalScrollIndicator={false} decelerationRate="fast"
    bounces={false} disableIntervalMomentum={true}
    renderItem={({item}) => <View style={{width: itemWidth}}>{/* Content */}</View>}
  />
</View>
```

```javascript
// WRONG
const itemWidth = Dimensions.get('window').width; // Ignores container padding
```

---

## Pattern 17: Pagination Dots (Slider Mode)

Use viewabilityConfigCallbackPairs with useRef. NOT onScroll manual calculation.

```javascript
const [currentIndex, setCurrentIndex] = useState(0);

const onViewableItemsChanged = useCallback(({viewableItems, changed}) => {
  if (viewableItems && viewableItems.length > 0) {
    const visible = changed.find(it => it.isViewable)?.index ?? -1;
    setCurrentIndex(visible < 0 ? (viewableItems[0]?.index ?? 0) : visible);
  }
}, []);

const viewabilityConfigCallbackPairs = useRef([
  { onViewableItemsChanged, viewabilityConfig: { itemVisiblePercentThreshold: 50 } },
]);

<FlatList
  viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
  scrollEventThrottle={16}
/>

{slides.map((_, i) => (
  <View key={i} style={[styles.dot, { backgroundColor: i === currentIndex ? active : inactive }]} />
))}
```

```javascript
// WRONG: Manual scroll calculation
const handleScroll = (e) => { setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / itemWidth)); };
<FlatList onScroll={handleScroll} />
```

---

## Event Handling (Exposed vs Internal)

See 01-core.md Section 5 for complete event handling reference.

---

## Analytics

```javascript
import { sendAnalyticsEvent } from 'apptile-core';

sendAnalyticsEvent(dispatch, 'addToCart', {
  variantId: variant.id, brand: product.vendor, productType: product.productType,
  price: variant.price, productId: product.id, quantity: 1, currency: 'USD',
  variantTitle: variant.title, title: product.title, referringPage: id,
});

sendAnalyticsEvent(dispatch, 'addToWishlist', {
  currency: 'USD', available: product.availableForSale, price: product.variants?.[0]?.price,
  productId: product.id, productType: product.productType, title: product.title,
  brand: product.vendor, quantity: 1,
});
```

---

## Haptic Feedback

```javascript
import { performHapticFeedback } from 'apptile-core';
performHapticFeedback('impactMedium');
// Methods: 'impactLight', 'impactMedium', 'impactHeavy', 'tap', 'tick',
//          'notificationSuccess', 'notificationWarning', 'notificationError'
```
