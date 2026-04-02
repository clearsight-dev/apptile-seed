# 04 — Conversion Process and Validation Checklist

Complete 8-phase process for converting tile.config JSON to a React Native plugin component.
Run every phase in order. Use the validation checklist before finalizing.

---

## Phase 1: Pre-Analysis

Read the entire tile.config JSON. Extract these fields:

| Field | Location | Maps To |
|-------|----------|---------|
| `moduleName` | `modules[0].data.moduleName` | `WrapperTileConfig.name` |
| `moduleUUID` | `modules[0].data.moduleUUID` | Reference only |
| `inputs` | `modules[0].data.inputs` | `useSelector` hooks |
| `events` | `modules[0].data.events` | Event handler names |
| `defaultEventHandlers` | `modules[0].data.defaultEventHandlers.data` | Handler implementations |
| `editors` | `modules[0].data.editors.data` | `WidgetEditors.visibility` + `WidgetEditors.advanced` |
| `basicEditors` | `modules[0].data.basicEditors.data` | `WidgetEditors.basic` |
| `styleEditors` | `modules[0].data.styleEditors.data` | `WidgetEditors.style` |
| `moduleConfig` | `modules[0].data.moduleConfig.data` | Widget tree |

For each event in `defaultEventHandlers.data`:
1. Record the event `label` (e.g., "onEvent1", "addToCart")
2. Record `isExposed`: true or false
3. If `isExposed: false`, record the `method` and all params
4. If multiple handlers share one label, record all of them

For each input in `inputs`:
1. Determine the selector pattern needed (see 03-plugins.md)
2. Note if queries are involved — check `datasources_documentation.md`

Scan all `config.style` blocks for:
- `colors.*` references — list them all
- `typography.*` references — list them all
- Hardcoded hex values — note which widgets use them

---

## Phase 2: Widget Hierarchy Extraction

Parse `moduleConfig.data`. For every key, record:

| Property | What to Note |
|----------|-------------|
| `id` | Widget identifier |
| `type` | `widget`, `state`, or `query` |
| `subtype` | `ContainerWidget`, `TextWidget`, `ImageWidget`, etc. |
| `layout.container` | Parent widget ID (empty string = root) |
| `config.style` | All style properties |
| `config.events` | Widget-level events |
| `config.value` | Text content, image URL, or dynamic binding |

Build the parent-child tree:
1. Root widgets: `layout.container` is `""` or null
2. Children: `layout.container` references parent's `id`
3. Render order follows the tree recursively

Classify each widget:

| Classification | Criteria | Action |
|---------------|----------|--------|
| Rendered widget | `type: "widget"` | Convert to React Native component |
| State plugin | `type: "state"` | Data holder, not rendered |
| Query plugin | `type: "query"` | Convert to `runDatasourceQuery` |

Per-subtype extraction:

**ListViewWidget:**
- `horizontal` — FlatList horizontal prop
- `numColumns` — FlatList numColumns prop
- `isSliderMode` — slider behavior with snap
- `isRepeaterMode` — map() instead of FlatList
- `instances` — data source binding

**TextWidget:**
- `value` — text content or binding
- `numLines` — numberOfLines prop
- `adjustsFontSizeToFit` — boolean prop
- `horizontalAlign` — textAlign style
- `style.typography` — BASE + OVERRIDE pattern
- `style.color` — theme ref or hex

**ImageWidget:**
- `value` — image URL or binding
- `sourceType` — "upload" or "url"
- `assetId` — for getDeviceImage resolution
- `resizeMode` — cover, contain, stretch
- `layout.aspectRatio` — aspectRatio style

**ContainerWidget:**
- `isTappable` — wrap in TouchableOpacity
- `style.padding*` — all padding values
- `style.margin*` — all margin values
- `style.backgroundColor` — theme ref or hex
- `layout.flexDirection` — row or column
- `layout.alignItems` — flex alignment
- `style.borderRadius` — may be borderRadiusEditor (Immutable.Map)

**IconWidget:**
- `iconType` — map to React Native icon family
- `value` — icon name prop
- `style.fontSize` — size prop (as number)
- `style.color` — color prop (resolved via theme)

---

## Phase 3: Layout Properties Analysis

For every widget, extract from `layout.data`:

```
flex, flexDirection, alignItems, justifyContent
width, height (percentage string or number)
position, top, bottom, left, right
hidden (boolean or binding expression)
aspectRatio
```

### Flex Removal Rules

| Context | Rule |
|---------|------|
| Root container | Remove `flex: 1` |
| FlatList wrapper | Remove `flex: 1` |
| FlatList items | Remove `flex: 1`, add explicit width |
| Horizontal slider items | Remove ALL `flex: 1` |
| TextWidget | Never apply `flex: 1` |
| Absolute positioned | Remove `flex: 1` |
| Sibling space distribution | Keep `flex: 1` only here |

### Width Handling

| tile.config value | Output |
|-------------------|--------|
| `"100%"` | `width: '100%'` (string) |
| `"25%"` | `width: '25%'` (string) |
| `"200"` | `width: 200` (number) |
| No width on slider item | Measure via `onLayout`, not `Dimensions.get('window')` |

### Horizontal Slider Width
Use `onLayout` to measure container, then derive item width:
`itemWidth = containerWidth / numVisible - gap`

---

## Phase 4: Style Extraction

For every widget, extract from `config.style.data`:

### Spacing
All padding/margin values are strings in tile.config. Convert to numbers: `"16"` becomes `16`.
Extract individually: `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` (same for margin).

### Border Radius
Two patterns:
- Simple number: `"borderRadius": "8"` becomes `borderRadius: 8`
- borderRadiusEditor (Immutable.Map with `topLeft`, `topRight`, `bottomLeft`, `bottomRight`): use `getBorderRadiusStyle` helper to parse each corner with `parseInt`

### Typography
Every text has `_inherit` (base) and overrides (`fontSize`, `lineHeight`).
Style application order: `[styles.layout, baseStyles, overrideStyles, {color}]`

### Color Resolution
- `colors.*` prefix: resolve via `themeEvaluator('colors.background')`
- Hex values (`#FFFFFF`): use directly
- `resolveColor` helper: check prefix, call themeEvaluator or return raw value

---

## Phase 5: Event and Query Analysis

### Event Classification

For each event in `defaultEventHandlers.data`:

| Check | If True | Action |
|-------|---------|--------|
| `isExposed: true` | Event bubbles to parent | Use `triggerEvent('eventName')` |
| `isExposed: false` | Handle internally | Check `method` field |

### Internal Event Method Mapping

| tile.config `method` | Implementation |
|---------------------|----------------|
| `navigate` | `dispatch(navigateToScreen(screenName, params))` |
| `triggerAction` | `dispatch(triggerAction({pluginConfig, pluginModel, pluginSelector, eventModelJS}))` |
| `setValue` | `dispatch(modelUpdateAction())` |
| `goBack` | `dispatch(goBack())` |
| `sendTrackAnalytics` | `sendAnalyticsEvent(dispatch, eventName, params)` |
| `triggerHapticFeedback` | `performHapticFeedback(method)` |
| `triggerToast` | Toast notification |
| `forwardModuleEvent` | Follow to the referenced defaultEventHandler |

### forwardModuleEvent Resolution

Widget event with `method: "forwardModuleEvent"` and `value: "onEvent1"`:
1. Find `defaultEventHandlers` entry with `label: "onEvent1"`
2. Read its `isExposed` and `method`
3. If multiple handlers share that label, implement all of them

### Conditional Events

Events with `hasCondition: true`:
1. Read the `condition` template
2. Parse the logic (e.g., `variants.length > 1`)
3. Implement as an if/else in the handler

### Query Conversion

For each QueryPlugin in `moduleConfig.data`:

1. Record `datasource` name (e.g., "shopify")
2. Record `queryName` (e.g., "GetCollectionProductsByHandle")
3. Record `inputVariables` — note dynamic bindings (`{{widget.value}}`)
4. Check `runWhenPageLoads` — if true, fetch in `useEffect` on mount
5. Check `runWhenModelUpdates` — if true, re-fetch when deps change
6. Look up the query in `datasources_documentation.md` for exact params and return shape

---

## Phase 6: Component Planning

Before writing code, plan:

### Imports Needed

| Category | Examples |
|----------|---------|
| React | `useState`, `useEffect`, `useCallback`, `useMemo` |
| React Native | `View`, `Text`, `Image`, `FlatList`, `TouchableOpacity`, `ScrollView`, `StyleSheet` |
| Redux | `useSelector` (only if `inputs` non-empty) |
| apptile-core | `useTheme`, `makeBoolean`, `navigateToScreen`, `goBack`, `triggerAction`, `datasourceTypeModelSel`, `selectPluginConfig`, `createDeepEqualSelector`, `EventTriggerIdentifier`, `TriggerActionIdentifier`, `performHapticFeedback`, `sendAnalyticsEvent`, `runDatasourceQuery`, `Icon` |
| Libraries | `Immutable` from immutable, `_` from lodash |

### WidgetConfig Defaults

Every `model.get()` needs a default:

| Type | Default Format |
|------|----------------|
| Typography | `Immutable.Map({_inherit: 'typography.heading', fontSize: 18, lineHeight: 27})` |
| Color | `'colors.onBackground'` (theme ref string) |
| Boolean | `true` or `false` |
| List/Array | `[]` |
| Exposed event | `TriggerActionIdentifier` |

### WidgetEditors

Map `basicEditors` to `basic`, `editors` to `visibility` + `advanced`, `styleEditors` to `style`.
Each entry needs: `editorSectionHeader` for groups, correct control type, `advanceProperty`/`mandatory` flags where specified, `listEditor` for arrays, `borderRadiusEditor`/`trblValuesEditor` with options arrays.

---

## Phase 7: Implementation

Write `component.jsx` in this exact order:

1. **Imports** — grouped: React, React Native, Redux, apptile-core, libraries
2. **Selectors** (outside component) — plugin model/config selectors, memoized derived selectors
3. **ReactComponent function** — `export function ReactComponent({model, dispatch, id, triggerEvent})`
4. **model.get()** — one line per property, grouped by widget
5. **Theme/colors** — `useTheme()`, `themeEvaluator()` for all color resolutions
6. **Typography** — BASE from `themeEvaluator(_inherit)` + OVERRIDE (`fontSize`, `lineHeight`) per text widget
7. **useSelector** — external state hooks for each input
8. **useEffect queries** — `runDatasourceQuery` with loading/error handling
9. **Event handlers** — one per event, check isExposed for pattern choice
10. **JSX tree** — match hierarchy exactly, apply `nativeID` props
11. **StyleSheet.create** — at bottom of component
12. **Exports** — `WidgetConfig`, `WidgetEditors`, `PropertySettings`, `WrapperTileConfig`

---

## Phase 8: Verification

Run every check in the validation checklist below before completing.

---

## Pre-Completion Validation Checklist

### Structure

- [ ] All imports from allowed libraries only (React, React Native, apptile-core, immutable, lodash)
- [ ] Component hierarchy matches tile.config `layout.container` tree exactly
- [ ] All widgets from tile.config present in JSX
- [ ] State plugins (type: "state") not rendered
- [ ] Query plugins (type: "query") converted to `runDatasourceQuery`
- [ ] Root element has `nativeID={'rootElement-' + id}`
- [ ] Text elements have `nativeID={'Text-' + id + '-name'}`
- [ ] No invented widget IDs or names

### Layout

- [ ] Root container: no `flex: 1`
- [ ] FlatList wrapper: no `flex: 1`
- [ ] FlatList items: no `flex: 1`, explicit width set
- [ ] Horizontal slider: `onLayout` width measurement, not `Dimensions.get('window')`
- [ ] All padding values extracted from tile.config `config.style` (none missed)
- [ ] All margin values extracted from tile.config `config.style` (none missed)
- [ ] Absolute positioned elements have exact `top`/`bottom`/`left`/`right` from tile.config
- [ ] Percentage widths kept as strings (`'100%'`)
- [ ] Numeric widths converted from strings to numbers

### Typography

- [ ] Every text widget has BASE styles from `themeEvaluator(_inherit)`
- [ ] Every text widget has OVERRIDE styles (`fontSize`, `lineHeight`)
- [ ] Style array order: `[styles.layout, baseStyles, overrideStyles, {color}]`
- [ ] `numberOfLines` matches tile.config `numLines` value
- [ ] `adjustsFontSizeToFit` matches tile.config value
- [ ] `textAlign` matches tile.config `horizontalAlign`

### Colors

- [ ] No hardcoded colors where tile.config uses `colors.*` references
- [ ] All `colors.*` references resolved via `themeEvaluator()`
- [ ] Hardcoded hex values used only where tile.config specifies hex
- [ ] Color defaults in WidgetConfig use theme ref strings (e.g., `'colors.onBackground'`)
- [ ] colorInput names follow convention: `titleColor`, `descriptionColor`, `backgroundColor`, `cardBackgroundColor` (NOT `headingColor`, `tileBgColor`, `cardBgColor`)
- [ ] colorInput props only contain `label` and `disableBinding` — NEVER `urlProperty`/`assetProperty`/`sourceTypeProperty`

### Events

- [ ] Every `isExposed: true` event uses `triggerEvent('eventName')` prop
- [ ] Every `isExposed: false` event handled internally with correct method
- [ ] `navigateToScreen` calls wrapped in `dispatch()`
- [ ] `triggerAction` calls include `pluginConfig` AND `pluginModel`
- [ ] Multiple handlers on same event label all execute
- [ ] `forwardModuleEvent` chains resolved to actual handlers
- [ ] Conditional events have if/else logic matching tile.config condition
- [ ] Screen names from tile.config only — none fabricated
- [ ] Plugin IDs from tile.config only — none fabricated
- [ ] Action values from tile.config only — none fabricated

### Images

- [ ] `getDeviceImage` called at component top level only (not inside renderItem)
- [ ] sourceType check: `'upload'` uses `getOptimalImage`, else uses URL directly
- [ ] Multiple images in a list: pre-resolve all assetIds before map/FlatList
- [ ] `layoutSize` measurement via `onLayout` for responsive images
- [ ] `resizeMode` matches tile.config value
- [ ] `aspectRatio` matches tile.config `layout.aspectRatio`

### Icons

- [ ] `iconType` mapped correctly per table in 02-patterns.md
- [ ] `"Material Icon"` maps to `"MaterialCommunityIcons"`
- [ ] Using `name` prop (from tile.config `config.value`)
- [ ] Using `size` prop (from tile.config `config.style.fontSize`, as number)
- [ ] Using `color` prop (resolved via theme)
- [ ] No emoji substitution — always use `Icon` component

### Border Radius

- [ ] Simple number: converted from string to number
- [ ] borderRadiusEditor: uses `Immutable.Map` default with all 4 corners
- [ ] `getBorderRadiusStyle` helper function parses each corner
- [ ] WidgetEditors uses `borderRadiusEditor` control type with options array

### WidgetConfig

- [ ] Every `model.get()` call has a corresponding default in WidgetConfig
- [ ] Typography defaults use `Immutable.Map({_inherit, fontSize, lineHeight})`
- [ ] Color defaults use theme ref strings like `'colors.onBackground'`
- [ ] Boolean defaults match tile.config values (`true` or `false`)
- [ ] List defaults use `[]`
- [ ] Exposed events use `TriggerActionIdentifier` (the imported constant)
- [ ] String defaults match tile.config text content

### Alignment

- [ ] Alignment editors use `radioGroup` type — NEVER `alignmentEditor`
- [ ] Horizontal alignment options: `auto`, `left`, `center`, `right`, `justify`
- [ ] Vertical alignment options: `auto`, `top`, `center`, `bottom`

### WidgetEditors

- [ ] `basic` array matches tile.config `basicEditors` section
- [ ] `visibility` + `advanced` arrays match tile.config `editors` section
- [ ] `style` array matches tile.config `styleEditors` section
- [ ] `editorSectionHeader` entries present for each group
- [ ] Control types match tile.config `editorType.type` values
- [ ] `listEditor` used for collection/product/image arrays (not `codeInput`)
- [ ] `borderRadiusEditor` has options array for border radius controls
- [ ] `trblValuesEditor` has options array for padding/margin controls
- [ ] `advanceProperty: true` set where tile.config specifies
- [ ] `mandatory: true` set where tile.config specifies

### PropertySettings

- [ ] Exposed events registered: `{ onEvent1: { type: EventTriggerIdentifier } }`
- [ ] All exposed events from tile.config included
- [ ] Empty `{}` if no exposed events exist

### Cart (if applicable)

- [ ] Uses `merchandiseId` (not `variantId`) for cart params
- [ ] `pluginConfig` from `selectPluginConfig(state, null, 'shopify')`
- [ ] `pluginModel` from `datasourceTypeModelSel(state, 'shopifyV_22_10')`
- [ ] `pluginSelector` is `['shopify']`
- [ ] Multi-variant check: `variants.length > 1` routes to variantSelector

### Wishlist (if applicable)

- [ ] Product ID split: `.split('/').pop()` for numeric comparison
- [ ] Loose equality: `item.id == productId.split('/').pop()`
- [ ] `productObj` includes full product data with `image` mapped from `featuredImage`
- [ ] Add/remove use correct action values from tile.config

### Queries (if applicable)

- [ ] Query name matches `datasources_documentation.md` exactly
- [ ] Input variables match documentation schema
- [ ] Loading state handled (`isLoading` with `setIsLoading`)
- [ ] Empty state handled (empty array or null check)
- [ ] Error state handled (`result.hasError` check)
- [ ] Immutable `.toJS()` conversion applied where needed

---

## Common Failures and Fixes

| Failure | Cause | Fix |
|---------|-------|-----|
| Text truncated | Missing or wrong `numberOfLines` | Match `numLines` from tile.config |
| Content touches edges | Root container padding missing | Extract all padding values from tile.config `config.style` |
| Slider does not snap | Using `Dimensions.get('window')` | Use `onLayout` container measurement |
| Widget fills entire screen | Root has `flex: 1` | Remove `flex: 1` from root container |
| Cards cut off in FlatList | FlatList items have `flex: 1` | Remove `flex: 1`, add explicit width/height |
| Icons not showing | Wrong `iconType` value | Map `"Material Icon"` to `"MaterialCommunityIcons"` |
| Colors wrong at runtime | Hardcoded hex instead of theme ref | Use `themeEvaluator('colors.x')` for all `colors.*` refs |
| Events not firing | Using `triggerAction` for exposed events | Use `triggerEvent` for `isExposed: true` events |
| Wishlist check fails | Direct full GID comparison | Split GID with `.split('/').pop()` and use loose equality |
| Cart add fails | Using `shopifyData.get('config')` | Use `selectPluginConfig(state, null, 'shopify')` |
| Query returns empty | Wrong input variable names | Check `datasources_documentation.md` for exact param names |
| Typography missing | Only applied override, no base | Apply both BASE from `themeEvaluator` and OVERRIDE |
| borderRadius not applied | Treated Immutable.Map as number | Use `getBorderRadiusStyle` helper for Map values |
| Editor not working | Used `codeInput` for array data | Use `listEditor` for all list/array properties |
| Padding asymmetric | Used shorthand `padding` instead of per-side | Extract `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` individually |
| FlatList horizontal broken | Missing `showsHorizontalScrollIndicator` | Add `showsHorizontalScrollIndicator={false}` |
| Image not loading | Called `getDeviceImage` inside renderItem | Move `getDeviceImage` to component top level |
| Multiple events lost | Only implemented first handler for label | Implement all handlers sharing the same event label |
| Color editor changes wrong property | Used non-standard property name (e.g., `headingColor`) | Use standard names: `titleColor`, `backgroundColor`, `cardBackgroundColor` |
| Color editor writes to border/other | Added `urlProperty`/`assetProperty` to colorInput | Remove — those props are for `assetEditor` only |
| Alignment editor not rendering | Used `alignmentEditor` type | Use `radioGroup` with icon/value options |

---

## Fabrication Rules

| Category | Rule |
|----------|------|
| Screen names | Only use values from tile.config `screenName` fields |
| Plugin IDs | Only use values from tile.config `pluginId` fields |
| Action values | Only use values from tile.config `eventModelJS.value` fields |
| Query names | Only use values from `datasources_documentation.md` |
| Input variables | Only use params documented in `datasources_documentation.md` |
| Editor types | Only use control types found in tile.config `editorType.type` |

If a value is not found in tile.config or the documentation files, do not guess.
Ask for clarification instead of fabricating values.
