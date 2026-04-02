# Apptile Plugin Development Guide

## Prerequisites

```bash
npm i -g tile-cli@latest
tile login
```

## Creating a Plugin

```bash
tile create \
  --type plugin \
  --listing-name "pluginNameInCamelCase" \
  --plugin-registry-name "pluginNameInCamelCase" \
  --label-prefix "pluginNameInCamelCase" \
  --display-description "Short description" \
  --editable-file-path "component.jsx" \
  --entry "widget.jsx"
```

**DO NOT manually create files or folders. Always use `tile create`.**

Plugin location: `remoteCode/plugins/<pluginname>/source/`

| File | Purpose |
|------|---------|
| `widget.jsx` | Entry point (auto-generated, do not edit) |
| `component.jsx` | Your React Native component |

Dev server (assume running): `tile serve`

---

## Fetching Tile Config from API

Instead of reading a local tile.config file, fetch the tile JSON from the API:

```
GET https://api.apptile.io/api/tiles/<TileId>
```

**Response structure:**

| Path | Content |
|------|---------|
| `currentSavedVersion.data` | The tile config JSON (same as tile.config) |
| `coverImage` | URL of how the tile should look (reference image) |
| `name` | Tile display name |
| `description` | Tile description |

**Usage:**
```bash
curl -s "https://api.apptile.io/api/tiles/<TileId>" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(json.dumps(d['currentSavedVersion']['data'], indent=2))
"
```

---

## Testing a Plugin

After creating and writing a plugin, test it in the browser:

```
http://127.0.0.1:3024/plugin-render.html?appId=ba6aa76b-f3c6-4641-b356-69cf9e1fb740&fork=154309&screenName=Base&plugin=<pluginId>
```

**`pluginId`** = first argument to `connectWidget()` in `widget.jsx`:
```javascript
// widget.jsx
export default connectWidget(
  'titleWithDescription02',  // ← This is the pluginId
  ReactComponent, ...
);
```

**IMPORTANT: Always open in mobile view.** Open DevTools (F12) → toggle device toolbar (Cmd+Shift+M) before inspecting. Never evaluate layout in desktop dimensions.

**Verification steps:**
1. Open the test URL in browser **in mobile view** (DevTools device toolbar)
2. Compare rendered output with the `coverImage` from the API
3. Check layout, spacing, typography, colors match
4. Verify interactive elements (taps, events) work
5. Check edge cases: empty text, missing images, long text

---

## component.jsx Exports

Every `component.jsx` must export exactly 5 things:

```javascript
export function ReactComponent({model, dispatch, triggerEvent, getDeviceImage}) { ... }
export const WidgetConfig = { /* default values */ };
export const WidgetEditors = { basic: [], visibility: [], style: [], advanced: [] };
export const PropertySettings = {};
export const WrapperTileConfig = { name: 'Display Name', defaultProps: {} };
```

### ReactComponent Props

| Prop | Type | Description |
|------|------|-------------|
| `model` | Immutable.Map | Widget config values via `model.get('key')` |
| `dispatch` | function | Redux dispatch |
| `triggerEvent` | function | Fire exposed events: `triggerEvent('onEvent1')` |
| `getDeviceImage` | function | Resolve uploaded image assets |

### WidgetConfig

Default values for all editable properties. Values accessed via `model.get('key')`.

```javascript
export const WidgetConfig = {
  title: 'Default Title',
  backgroundColor: 'colors.background',    // theme color ref
  titleTypography: Immutable.Map({          // typography map
    _inherit: 'typography.heading',
    fontSize: 18,
    lineHeight: 27,
  }),
  hideTitle: false,
  collections: [],                           // listEditor data
  onEvent1: TriggerActionIdentifier,         // exposed event
};
```

### WidgetEditors

Controls shown in the tile editor. Categories: `basic`, `visibility`, `style`, `advanced`.

```javascript
export const WidgetEditors = {
  basic: [
    { type: 'editorSectionHeader', name: 'Section1', props: { label: 'TILE SETUP' } },
    { type: 'codeInput', name: 'title', props: { label: 'Title', singleLine: true } },
    { type: 'listEditor', name: 'collections', props: { label: 'COLLECTIONS', shopifyType: 'Collection' }, mandatory: true },
    { type: 'aspectRatio', name: 'aspectRatio', props: { label: 'Aspect Ratio' } },
  ],
  visibility: [
    { type: 'checkbox', name: 'hideTitle', props: { label: 'Title', reverse: true, fullSizeLabel: true } },
  ],
  style: [
    { type: 'typographyInput', name: 'titleTypography', props: { label: 'Title', disableExport: true } },
    { type: 'radioGroup', name: 'titleAlign', props: { label: 'Horizontal Alignment', options: [
      { icon: 'alpha-a', value: 'auto' },
      { icon: 'format-align-left', value: 'left' },
      { icon: 'format-align-center', value: 'center' },
      { icon: 'format-align-right', value: 'right' },
      { icon: 'format-align-justify', value: 'justify' },
    ] } },
    { type: 'colorInput', name: 'titleColor', props: { label: 'Title', disableBinding: true } },
    { type: 'borderRadiusEditor', name: 'imageBorderRadius', props: { label: 'Image', options: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'] }, advanceProperty: true },
    { type: 'trblValuesEditor', name: 'padding', props: { options: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], label: 'Tile' }, advanceProperty: true },
  ],
};
```

### PropertySettings

Register exposed events with `EventTriggerIdentifier`:

```javascript
import { EventTriggerIdentifier, TriggerActionIdentifier } from 'apptile-core';

// If events are exposed (isExposed: true in tile.config)
export const PropertySettings = {
  onEvent1: { type: EventTriggerIdentifier },
};

// If all events handled internally (isExposed: false) → empty
export const PropertySettings = {};
```

---

## Available Editor Control Types

### Input Controls
| Type | Props | Description |
|------|-------|-------------|
| `codeInput` | `label, singleLine, noOfLines` | Text input |
| `formatInput` | `label, prefix, suffix` | Formatted text |
| `numericInput` | `label, unit, noUnit` | Number input |
| `codemirrorInput` | `label, language, noOfLines` | Code editor |

### Selection Controls
| Type | Props | Description |
|------|-------|-------------|
| `checkbox` | `label, fullSizeLabel, reverse` | Boolean toggle |
| `radioGroup` | `label, options, schema, disableBinding` | Single select |
| `dropDown` | `label, options` | Dropdown |
| `iconChooserInput` | `label` | Icon picker |

### Visual Controls
| Type | Props | Description |
|------|-------|-------------|
| `colorInput` | `label, disableBinding` | Color picker. **NEVER add `urlProperty`/`assetProperty`/`sourceTypeProperty`** — those are assetEditor-only props and will cause the color to write to the wrong model key |
| `typographyInput` | `label, disableExport` | Typography |
| `assetEditor` | `label, urlProperty, assetProperty, sourceTypeProperty` | Image upload |
| `borderRadiusEditor` | `label, options[]` | Border radius (outputs to `options` array for custom corners) |

### colorInput Naming Convention (MUST follow)
Use these standard names from working plugins. Non-standard names cause property mapping bugs:

| Purpose | Correct `name` | Wrong `name` |
|---------|----------------|--------------|
| Title text color | `titleColor` | ~~headingColor~~ |
| Description text color | `descriptionColor` | |
| Tile background | `backgroundColor` | ~~tileBgColor~~ |
| Card background | `cardBackgroundColor` | ~~cardBgColor~~ |
| Collection name color | `collectionNameColor` | |
| Collection name bg | `collectionNameBackgroundColor` | |

### Layout Controls
| Type | Props | Description |
|------|-------|-------------|
| `trblValuesEditor` | `label, options[]` | Padding/margin (Top/Right/Bottom/Left) |
| `aspectRatio` | `label` | Aspect ratio |

### Alignment Controls (use `radioGroup`, NOT `alignmentEditor`)

```javascript
// Horizontal alignment
{ type: 'radioGroup', name: 'horizontalAlign', props: { label: 'Horizontal Alignment', options: [
  { icon: 'alpha-a', value: 'auto' },
  { icon: 'format-align-left', value: 'left' },
  { icon: 'format-align-center', value: 'center' },
  { icon: 'format-align-right', value: 'right' },
  { icon: 'format-align-justify', value: 'justify' },
] } }

// Vertical alignment
{ type: 'radioGroup', name: 'verticalAlign', props: { label: 'Vertical Alignment', options: [
  { icon: 'alpha-a', value: 'auto' },
  { icon: 'format-vertical-align-top', value: 'top' },
  { icon: 'format-vertical-align-center', value: 'center' },
  { icon: 'format-vertical-align-bottom', value: 'bottom' },
] } }
```

### Data Controls
| Type | Props | Description |
|------|-------|-------------|
| `listEditor` | `label, shopifyType, disableAdd, maxLength` | Collection/product/image list |
| `editorSectionHeader` | `label` | Section divider |

### Navigation Controls
| Type | Props | Description |
|------|-------|-------------|
| `shopifyCollectionHandleControl` | `label` | Collection selector |
| `shopifyProductHandleControl` | `label` | Product selector |
| `navigationInput` | `label` | Navigation config |

---

## borderRadiusEditor Behavior

Outputs to **multiple properties**:

**Simple mode:** Single value → outputs to `name` property
**Custom corners:** Individual values → outputs to `props.options` array

```javascript
// Editor
{ type: 'borderRadiusEditor', name: 'imageBorderRadius', props: { label: 'Image', options: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'] } }

// WidgetConfig default
imageBorderRadius: Immutable.Map({
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
})

// Component usage
const borderRadiusMap = model.get('imageBorderRadius');
const getBorderRadiusStyle = (map, fallback = 0) => {
  if (!map || !Immutable.Map.isMap(map)) return fallback ? { borderRadius: fallback } : {};
  return {
    borderTopLeftRadius: parseFloat(map.get('borderTopLeftRadius')) || 0,
    borderTopRightRadius: parseFloat(map.get('borderTopRightRadius')) || 0,
    borderBottomLeftRadius: parseFloat(map.get('borderBottomLeftRadius')) || 0,
    borderBottomRightRadius: parseFloat(map.get('borderBottomRightRadius')) || 0,
  };
};
```

---

## Image Upload (getDeviceImage)

### Single Image (assetEditor)

```javascript
export function ReactComponent({model, dispatch, getDeviceImage}) {
  const imageUrl = model.get('value') || '';
  const sourceType = model.get('sourceType') || 'url';
  const assetId = model.get('assetId') || '';

  const {getOptimalImage} = getDeviceImage(assetId);
  const [imageSource, setImageSource] = useState(imageUrl);
  const [layoutSize, setLayoutSize] = useState('');

  useEffect(() => {
    if (sourceType?.toLowerCase() === 'upload' && assetId) {
      const assetSource = getOptimalImage && getOptimalImage(layoutSize);
      if (assetSource?.fileUrl && imageSource !== assetSource.fileUrl) {
        setImageSource(assetSource.fileUrl);
      }
    } else if (imageSource !== imageUrl) {
      setImageSource(imageUrl);
    }
  }, [getOptimalImage, assetId, sourceType, imageUrl, layoutSize]);
}
```

### Multiple Images (listEditor)

```javascript
// Pre-resolve ALL unique assetIds at top level
const uniqueAssetIds = useMemo(() => {
  const ids = new Set();
  collections.forEach(item => { if (item.assetId) ids.add(item.assetId); });
  return Array.from(ids);
}, [collections]);

const deviceImages = {};
uniqueAssetIds.forEach(assetId => {
  const {getOptimalImage} = getDeviceImage(assetId);
  deviceImages[assetId] = getOptimalImage;
});
```

**Rules:** Call `getDeviceImage` at top level only. Never inside useEffect, useMemo, useCallback, loops, or conditionally.

---

## ListEditor Output Format

```javascript
{
  url: "https://cdn.shopify.com/...",
  sourceType: "url",       // or "upload"
  assetId: "",             // populated when sourceType is "upload"
  resizeMode: "cover",
  navEntityType: "Collection",
  navEntityId: "collection-handle",
  title: "Collection Name",
  id: "gid://shopify/Collection/123"
}
```
