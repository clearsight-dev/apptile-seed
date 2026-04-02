# Apptile Third-Party Integration Handbook

> **Purpose:** This document is the single source of truth for building third-party integration plugins on the Apptile platform. It captures every pattern, anti-pattern, and hard-won lesson from the Loop Subscriptions integration and generalises them for **all** future integrations.
>
> **Before writing any plugin code, read this entire document.**

---

## Table of Contents

1. [Anti-Patterns & Mistakes to Avoid](#anti-patterns--mistakes-to-avoid)
2. [General Patterns](#general-patterns)
3. [Integration: Loop Subscriptions](#integration-loop-subscriptions)
4. [Changelog](#changelog)

---

## Anti-Patterns & Mistakes to Avoid

These are real mistakes made during development. Each one cost significant debugging time. **Do NOT repeat them.**

### 🚨 AP-1: Wrong WidgetEditors Format (Invisible Inputs)

**What happened:** Editor inputs were defined as `{ key: 'prop', label: 'Label', type: 'codeInput' }`. The Apptile editor rendered **nothing** — no inputs appeared for the merchant.

**Root cause:** The platform expects a specific schema: `{ type, name, props: { label } }`. Any other shape is silently ignored.

```javascript
// ❌ WRONG — inputs will be invisible in the editor
{ key: 'apiKey', label: 'API Key', type: 'codeInput' }

// ✅ CORRECT — the ONLY format the platform accepts
{ type: 'codeInput', name: 'apiKey', props: { label: 'API Key' } }
```

**Rule:** Every entry in `WidgetEditors.basic` (or `advanced`) **must** follow `{ type, name, props: { label, ...otherProps } }`. Refer to `README.md` for the full list of available control types and their props.

---

### 🚨 AP-2: Hardcoding Dynamic IDs Instead of Using Redux / Navigation

**What happened:** `customerShopifyId` was added to `WidgetEditors` as a `codeInput`, requiring the merchant to paste it manually. `subscriptionId` was also a manual input on every screen.

**Root cause:** Not knowing that the logged-in user's Shopify ID is already available in the Redux store, and that navigation params can carry IDs between screens.

**Rules:**
- **Logged-in user IDs** → fetch from Redux store (see [Dynamic Shopify Customer ID Fetching](#dynamic-shopify-customer-id-fetching)).
- **Entity IDs passed between screens** → use React Navigation params (see [Inter-Plugin Navigation](#4-inter-plugin-navigation-react-navigation)).
- **Only truly merchant-specific secrets** (API keys, store domains) belong in `WidgetEditors`.

---

### 🚨 AP-3: Missing Merchant Configuration (Colors, Labels, Toggles)

**What happened:** The first implementation had zero configurable colors, labels, or display toggles. The UI was hardcoded, giving merchants no control over appearance.

**Root cause:** Not studying the reference implementation. The reference repo exposed ~20 configurable properties per plugin (primary/secondary/background/text/error/success/border/danger colors, button labels, border radius, display toggles for each section).

**Rule:** For every UI element, ask: _"Should the merchant be able to change this?"_ If yes, add it to both `WidgetConfig` (default value) and `WidgetEditors` (editor control). At minimum, expose:
- **Colors:** `primaryColor`, `secondaryColor`, `backgroundColor`, `textColor`, `borderColor`, `errorColor`, `successColor`, `dangerColor`
- **Labels:** All button labels, section titles, empty-state messages
- **Toggles:** `showXxx` booleans for each optional UI section
- **Layout:** `cardBorderRadius`, padding values

---

### 🚨 AP-4: Root View Styling Causes Layout Collapse

**What happened:** The plugin rendered as a 0-height invisible element in the Apptile preview.

**Root cause:** The root `<View>` had default `flex: 1` which collapses when the parent doesn't provide height.

```javascript
// ❌ WRONG — collapses to 0 height in Apptile preview
<View style={{ flex: 1 }}>

// ✅ CORRECT — prevents collapse
<View style={{ flex: 'unset', minHeight: 300 }}>
```

**Rule:** The outermost `<View>` in `component.jsx` must have `flex: 'unset'` and a reasonable `minHeight` (e.g., 200–400).

---

### 🚨 AP-5: Using `navigateToScreen` for Inter-Plugin Navigation

**What happened:** Initially tried `navigateToScreen` from `apptile-core` to navigate between plugin screens. Params were not received correctly.

**Rule:** Always use `@react-navigation/native` hooks (`useNavigation`, `useRoute`) for inter-plugin screen navigation. `navigateToScreen` from `apptile-core` is for tile-level navigation, not plugin-to-plugin.

---

### 🚨 AP-6: Not Handling Boolean Defaults from `model.get()`

**What happened:** `model.get('showSection')` returned `undefined` or a string `"true"` instead of a boolean, causing conditional renders to break.

```javascript
// ❌ WRONG — unreliable
if (model.get('showSection')) { ... }

// ✅ CORRECT — always coerce with makeBoolean and provide a default
const showSection = makeBoolean(model.get('showSection') ?? true);
```

**Rule:** Always wrap boolean model values with `makeBoolean()` and provide a `?? defaultValue` fallback.

---

### 🚨 AP-7: Forgetting `useEffect` Cleanup / Cancelled Flag

**What happened:** Race conditions when navigating away mid-fetch, causing state updates on unmounted components.

```javascript
// ✅ CORRECT pattern
useEffect(() => {
  let cancelled = false;
  async function fetchData() {
    // ... fetch ...
    if (!cancelled) setState(data);
  }
  fetchData();
  return () => { cancelled = true; };
}, [deps]);
```

**Rule:** Every `useEffect` that does async work must use a `cancelled` flag and clean up on unmount.

---

### 🚨 AP-8: Not Using `shallowEqual` with `useSelector`

**What happened:** Excessive re-renders when reading from Redux without equality check.

```javascript
// ❌ WRONG
const data = useSelector(state => state.appModel.values.getIn(['shopify']));

// ✅ CORRECT
const data = useSelector(
  state => state.appModel.values.getIn(['shopify']),
  shallowEqual
);
```

**Rule:** Every `useSelector` call must include `shallowEqual` as the second argument.

### 🚨 AP-9: Adding a Page-Level `headerTitle` to Plugins

**What happened:** Plugins rendered their own `<Text style={styles.header}>{headerTitle}</Text>` at the top, duplicating the title bar that the Apptile system already provides on every screen.

```javascript
// ❌ WRONG — plugin renders its own page title
const headerTitle = model.get('headerTitle') || 'Active Subscriptions';
// ...
<Text style={[styles.header, { color: textColor }]}>{headerTitle}</Text>

// ✅ CORRECT — no page-level title; the system title bar handles it
// (section headers like "Product Details" inside the page are fine)
```

**Rule:** Never add a top-level `headerTitle` config or render a page-level heading inside a plugin. The Apptile platform provides its own title bar for every screen. Internal section headers (e.g. "Product Details", "Shipping Address") are acceptable.

### 🚨 AP-10: Adding a Back Button Inside a Plugin

**What happened:** The manage-subscription plugin rendered its own "← Back to subscriptions" `TouchableOpacity` that called `navigation.goBack()`. The Apptile system header already provides a back button on every screen, so this was redundant.

```javascript
// ❌ WRONG — plugin renders its own back button
<TouchableOpacity onPress={() => navigation.goBack()}>
  <Text>{backLabel}</Text>
</TouchableOpacity>

// ✅ CORRECT — no back button; the system header handles it
// Navigation events that go *forward* (e.g. navigate to cancel screen) are fine.
```

**Rule:** Never render a back/close button inside a plugin. The Apptile header always provides one. Only keep navigation calls that move the user **forward** to another screen (e.g. `navigation.navigate('LoopCancelSubscription', { subscriptionId })`).

### 🚨 AP-11: Hardcoding Options That Should Come From the API

**What happened:** The frequency-edit UI hardcoded `['DAY', 'WEEK', 'MONTH', 'YEAR']` as interval options. A customer was able to select "1 YEAR" even though the merchant's configuration only supported WEEK and MONTH intervals. The update call succeeded but created an invalid subscription state.

**Root cause:** Assuming a fixed set of options instead of querying the API for what the merchant actually configured.

```javascript
// ❌ WRONG — hardcoded options that may not match the merchant's config
{['DAY', 'WEEK', 'MONTH', 'YEAR'].map(opt => (
  <TouchableOpacity onPress={() => setInterval(opt)}>…</TouchableOpacity>
))}

// ✅ CORRECT — fetch valid options from the API, render only those
const [availableOptions, setAvailableOptions] = useState([]);
useEffect(() => { fetchOptionsFromAPI().then(setAvailableOptions); }, []);
// ...
{availableOptions.map(opt => (
  <TouchableOpacity onPress={() => setInterval(opt)}>…</TouchableOpacity>
))}
```

**Rule:** Only expose a feature in the UI if it is **working and validated through the API**. If the API provides a list of valid options (frequencies, plans, shipping methods, etc.), always fetch and use that list. Never hardcode options that could differ per merchant. If you must hardcode a fallback (e.g. API call fails), keep it conservative — omit anything that could create an invalid state.

### 🚨 AP-12: Field-Level Error Handling on Forms

**What happened:** The address update form showed a generic "Failed to update shipping address" toast when the API returned `422 Unprocessable Entity`. The user had no idea which field was wrong or what to fix.

**Root cause:** The error response body contained per-field validation messages (e.g. `"lastName | Required. countryCode | Required"`) but the code discarded them and threw a single generic message.

```javascript
// ❌ WRONG — generic error, user has no idea what to fix
catch (e) { setActionMessage(e.message); }

// ✅ CORRECT — parse API error, show inline on the offending fields
catch (e) {
  const fieldErrors = parseFieldErrors(e.apiMessage);
  if (Object.keys(fieldErrors).length > 0) {
    setFieldErrors(fieldErrors); // { lastName: 'Required', countryCode: 'Required' }
  } else {
    setActionMessage(e.message);
  }
}
// In the form:
<TextInput style={[styles.input, { borderColor: fieldErrors[field] ? '#EF4444' : borderColor }]} ... />
{fieldErrors[field] ? <Text style={styles.fieldError}>{fieldErrors[field]}</Text> : null}
```

**Rule:** Every form that calls an API must implement **field-level error handling**:
1. Parse the API error response to extract per-field messages.
2. Highlight the offending input (e.g. red border).
3. Show the error message directly below the field.
4. Clear the field error when the user starts editing that field.
5. Fall back to a generic message only if the error cannot be mapped to a specific field.

### 🚨 AP-13: Confirmation Popups Before Destructive / Irreversible Actions

**What happened:** A user accidentally tapped "Get Delivery Now" and an order was placed immediately with no way to undo it. Similarly, "Skip", "Pause", and "Cancel Subscription" executed instantly on tap.

**Root cause:** Action buttons called the API directly on press without asking the user to confirm.

```javascript
// ❌ WRONG — fires immediately, no confirmation
<TouchableOpacity onPress={handleGetDeliveryNow}>
  <Text>Get Delivery Now</Text>
</TouchableOpacity>

// ✅ CORRECT — show a confirmation popup first
import { Alert } from 'react-native';

const confirmAndExecute = (title, message, onConfirm) => {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
};

<TouchableOpacity onPress={() => confirmAndExecute(
  'Place Order Now?',
  'This will place an order immediately. Are you sure?',
  handleGetDeliveryNow
)}>
  <Text>Get Delivery Now</Text>
</TouchableOpacity>
```

**Rule:** Every action that **modifies subscription state** (place order, skip, pause, resume, cancel, update frequency, update address) must show a **confirmation popup** (`Alert.alert`) before executing. The popup must clearly describe what will happen and offer a Cancel option. This prevents accidental taps from triggering irreversible operations.

### 🚨 AP-14: Rules of Hooks — Never Call Hooks After Early Returns

**What happened:** A `useMemo` hook was placed after `if (loading) return …` and `if (error) return …` early returns. When the component transitioned from loading → loaded, React detected a change in the order of Hooks and threw a warning/crash.

```javascript
// ❌ WRONG — hook is conditionally called (after early returns)
if (loading) return <ActivityIndicator />;
if (error) return <Text>{error}</Text>;
if (!subscription) return null;

const matchedPM = useMemo(() => { /* ... */ }, [deps]); // 💥 not called during loading/error renders

// ✅ CORRECT — all hooks called at the top, before any early returns
const matchedPM = useMemo(() => {
  if (!subscription?.id || !Array.isArray(paymentMethods)) return null;
  return paymentMethods.find(pm => pm.id === subscription.customerPaymentMethodId) || null;
}, [subscription?.customerPaymentMethodId, paymentMethods]);

if (loading) return <ActivityIndicator />;
if (error) return <Text>{error}</Text>;
if (!subscription) return null;
```

**Rule:** ALL hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, etc.) must be called at the **top level** of the component function, **before** any conditional `return` statements. Use optional chaining (`?.`) and null checks inside the hook body to handle cases where data isn't available yet.

### 🚨 AP-15: Section Edit Buttons — Use `renderSection` Right-Aligned Button Pattern

**What happened:** Edit buttons were placed below the section content as text links ("Edit Plan →"). This didn't match the web reference which places a compact "Edit" button top-right of the section header.

**Root cause:** Not studying the web reference closely enough for layout patterns.

```javascript
// ❌ WRONG — edit link buried below content
<TouchableOpacity onPress={() => setEditMode('frequency')}>
  <Text style={styles.editLink}>Edit Plan →</Text>
</TouchableOpacity>

// ✅ CORRECT — edit button in section header, right-aligned
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

// Usage:
renderSection('Shipping address', content, 'address', (
  <TouchableOpacity onPress={() => setEditMode('address')}>
    <Text style={styles.sectionEditBtn}>Edit</Text>
  </TouchableOpacity>
))
```

**Rule:** When a section is editable, pass a compact "Edit" button as a `rightButton` parameter to the section renderer, positioned in the section header row. This matches the standard web SaaS pattern and is immediately recognizable to users.

---

### 🚨 AP-16: Stacked Action Buttons Match Web Layout

**What happened:** Action buttons (Get Delivery Now, Skip, Re-schedule) were laid out in a horizontal `flexWrap: 'wrap'` row. On narrow screens, buttons got cramped and misaligned. The web reference stacks them full-width vertically.

```javascript
// ❌ WRONG — horizontal row wrapping
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
  <TouchableOpacity>…Get Delivery Now…</TouchableOpacity>
  <TouchableOpacity>…Skip…</TouchableOpacity>
</View>

// ✅ CORRECT — full-width stacked buttons
<View style={{ marginBottom: 20 }}>
  <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginBottom: 8 }}>
    <Text>Get Your Next Delivery Now</Text>
  </TouchableOpacity>
  <TouchableOpacity style={{ borderWidth: 1.5, paddingVertical: 11, alignItems: 'center', marginBottom: 8 }}>
    <Text>Skip order</Text>
  </TouchableOpacity>
</View>
```

**Rule:** Primary action buttons on detail/manage screens should be **full-width and vertically stacked**, not horizontally wrapped. This matches native mobile patterns and the web reference. The primary action gets a filled background; secondary actions get outlined borders.

---

### 🚨 AP-17: Shipping Address Display — Multi-Line Format

**What happened:** The shipping address was displayed as a single comma-separated line: "123 Main St, Apt 4, New York, NY, 10001, United States". The web reference shows it across multiple lines for readability.

```javascript
// ❌ WRONG — single long line
<Text>{[addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(', ')}</Text>

// ✅ CORRECT — structured multi-line display
<Text>{[addr.firstName, addr.lastName].filter(Boolean).join(' ')}</Text>
<Text>{[addr.address1, addr.address2].filter(Boolean).join(', ')}</Text>
<Text>{[addr.city, addr.province, addr.zip].filter(Boolean).join(', ')}</Text>
<Text>{addr.country || ''}</Text>
```

**Rule:** Display addresses in a structured multi-line format: name on line 1, street on line 2, city/state/zip on line 3, country on line 4. This is the standard format users expect and matches shipping labels.

---

### 🚨 AP-18: Lazy-Load Expandable Sections

**What happened:** Scheduled and past orders were fetched on initial load alongside the subscription detail, slowing the initial render. Most users never expand these sections.

```javascript
// ❌ WRONG — fetch all data upfront
useEffect(() => {
  const [sub, orders, pastOrders] = await Promise.all([
    fetchSubscription(id),
    fetchOrders(id, 'scheduled'),
    fetchOrders(id, 'past'),
  ]);
  // ...
}, []);

// ✅ CORRECT — lazy-load on toggle
const [showScheduledOrders, setShowScheduledOrders] = useState(false);
const [scheduledOrders, setScheduledOrders] = useState(null);

const toggleScheduledOrders = useCallback(() => {
  const next = !showScheduledOrders;
  setShowScheduledOrders(next);
  if (next && scheduledOrders === null) loadOrders('scheduled'); // fetch only on first expand
}, [showScheduledOrders, scheduledOrders]);
```

**Rule:** If a section is collapsed by default and its data isn't needed for the main render, **lazy-load** it when the user first expands. Use `null` as the initial state to distinguish "never loaded" from "loaded but empty". This keeps the initial load fast and reduces unnecessary API calls.

---

### 🚨 AP-19: Always Add Console Logs to API Calls

**What happened:** An API call was returning an unexpected error but the plugin showed only a generic "Failed to update" message. There was no way to see the actual HTTP status, request payload, or response body without adding logs, rebuilding, and retesting.

**Root cause:** API helper functions had no logging. Debugging required modifying code, bundling, and redeploying — a slow loop that could have been avoided.

```javascript
// ❌ WRONG — no visibility into what happened
async function updateFrequency(baseUrl, apiKey, token, subscriptionId, payload) {
  const res = await fetch(`${baseUrl}/storefront/.../frequency`, { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update frequency');
  return res.json();
}

// ✅ CORRECT — log the call, payload, and result/failure
async function updateFrequency(baseUrl, apiKey, token, subscriptionId, payload) {
  console.log('[Loop] updateFrequency', subscriptionId, JSON.stringify(payload));
  const res = await fetch(`${baseUrl}/storefront/.../frequency`, { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[Loop] updateFrequency FAILED', res.status, errBody);
    throw new Error('Failed to update frequency');
  }
  const json = await res.json();
  console.log('[Loop] updateFrequency OK', JSON.stringify(json));
  return json;
}
```

**Rule:** Every API helper function must include `console.log` calls:
1. **Before the request** — log the function name, key identifiers (subscription ID, line ID), and the payload (if any).
2. **On failure** — log the function name + `FAILED`, the HTTP status code, and the raw error body.
3. **On success** — log the function name + `OK` and the response (truncate large responses with `.substring(0, 500)`).
4. **Use a consistent prefix** like `[Loop]` or `[IntegrationName]` so logs can be filtered easily.
5. **Never log sensitive tokens** — log the subscription ID and payload, not the auth token or API key.

---

### 🚨 AP-20: Supplemental Data Fetching With `Promise.allSettled`

**What happened:** The subscription detail object only contained `customerPaymentMethodId` (a numeric ID) but no card brand, last 4 digits, or expiry date. The UI showed a generic "Payment method on file" instead of "Visa •••• 3184".

**Root cause:** The primary API resource doesn't always include all the data the UI needs. A separate endpoint (`/storefront/2023-10/paymentMethod`) had to be called to get the full payment method details.

```javascript
// ❌ WRONG — assume all data is in the primary resource
const subscription = await fetchSubscription(id);
// subscription.paymentInfo is undefined → UI shows nothing useful

// ✅ CORRECT — fetch supplemental data in parallel, non-blocking
useEffect(() => {
  let cancelled = false;
  async function load() {
    const sub = await fetchSubscription(id);
    if (!cancelled) setSubscription(sub);

    // Supplemental fetches — non-critical, don't block the main render
    const [freqResult, pmResult] = await Promise.allSettled([
      listFrequencies(id),
      fetchPaymentMethods(),
    ]);
    if (!cancelled && freqResult.status === 'fulfilled') setFrequencies(freqResult.value);
    if (!cancelled && pmResult.status === 'fulfilled') setPaymentMethods(pmResult.value);
  }
  load();
  return () => { cancelled = true; };
}, [id]);
```

**Rule:** When the primary API resource is missing data the UI needs:
1. Identify the supplemental endpoint that provides it.
2. Fetch it in parallel with other supplemental data using `Promise.allSettled` (not `Promise.all` — a failure in one shouldn't block the others).
3. Treat supplemental data as **non-critical** — the UI should still render a reasonable fallback if the supplemental fetch fails.
4. Match the supplemental data to the primary resource using IDs (e.g., `customerPaymentMethodId` → payment methods list).

### 🚨 AP-21: No Date Picker in the Allowed Library List — Build a Custom Calendar

**What happened:** The reschedule feature needed a date picker. `DatePickerIOS`, `DateTimePicker`, and `@react-native-community/datetimepicker` are not in the allowed library list. Attempting to import them will cause a bundle error.

```javascript
// ❌ WRONG — not in allowed library list
import DateTimePicker from '@react-native-community/datetimepicker';

// ✅ CORRECT — build a custom inline calendar using only View/Text/TouchableOpacity
// Use state to track calMonth/calYear; render a 7-column grid of day cells
const [calMonth, setCalMonth] = useState(new Date().getMonth());
const [calYear, setCalYear] = useState(new Date().getFullYear());
const [selectedDate, setSelectedDate] = useState('');
// Render prev/next month buttons, day-of-week headers, and day cells
// Disable cells before today (compare dateStr < todayStr())
```

**Rule:** There is no date picker component in the allowed library list. For any date selection UI, build a custom calendar using only `View`, `Text`, and `TouchableOpacity` from `react-native`. Use plain JS `Date` math to generate the cell grid.

---

### 🚨 AP-22: Single Global Action Message Breaks Multi-Section UX

**What happened:** A single `actionMessage` state was used for all API actions across the whole plugin. When a frequency update succeeded and showed "Updated!", then the user scrolled to the address section and triggered an error, the original success message was gone. Also, an address error appeared at the top of the page, far from the address form.

**Root cause:** One global message field cannot serve multiple independent sections simultaneously or place the message near the relevant UI.

```javascript
// ❌ WRONG — single message for the whole plugin
const [actionMessage, setActionMessage] = useState(null);
// ... after any action: setActionMessage('Frequency updated.')
// ... all sections show the same message in one place

// ✅ CORRECT — per-section message map
const [sectionMessages, setSectionMessages] = useState({});
// { frequency: 'Updated!', address: 'Invalid zip code', discount: '' }

const setSectionMsg = useCallback((section, msg) => {
  setSectionMessages(prev => ({ ...prev, [section]: msg }));
}, []);
const clearSectionMsg = useCallback((section) => {
  setSectionMessages(prev => { const n = { ...prev }; delete n[section]; return n; });
}, []);

// In the section renderer, render sectionMessages[sectionKey] near the section content
```

**Rule:** For plugins with multiple editable sections, use a `sectionMessages: { [sectionKey]: string }` map and display each section's feedback inline below that section's content. Keep a separate `topMessage` state only for top-level action buttons (pause, resume, skip) that have no associated section.

---

### 🚨 AP-23: Attaching `apiMessage` to Thrown Errors for Upstream Field Parsing

**What happened:** The `updateShippingAddress` helper threw `new Error('Failed to update')`, discarding the API's per-field validation message. The calling code (AP-12) needed the raw API message to extract field errors, but it was already gone.

**Root cause:** The helper function threw a plain `Error` with a generic string, losing the structured API error body.

```javascript
// ❌ WRONG — structured error body is lost
throw new Error('Failed to update shipping address');

// ✅ CORRECT — attach the raw API message to the error object
const err = new Error(parsed?.message || 'Failed to update shipping address');
err.apiMessage = parsed?.message || '';
throw err;

// Caller can then parse it:
catch (e) {
  const fieldErrors = parseFieldErrors(e.apiMessage || '');
  if (Object.keys(fieldErrors).length > 0) {
    setFieldErrors(fieldErrors);
  } else {
    setActionMessage(e.message);
  }
}
```

**Rule:** When an API call fails with a structured error response (e.g. JSON body with `message` or per-field errors), parse the body immediately and attach it as `err.apiMessage` on the thrown `Error`. This lets callers decide whether to display a generic message or parse field-level errors, without re-fetching or re-parsing.

---

### 🚨 AP-24: `<Text>` Rendering in Apptile — Always Use `fontWeight` and Single Template Literals

**What happened:** Text nodes were invisible in the Apptile renderer even though layout space was present. After extensive debugging, two root causes were found:

1. **Missing `fontWeight`** — A `<Text>` without an explicit `fontWeight` prop sometimes does not render in the Apptile web renderer. Always set `fontWeight`. Use `'500'` for normal body text and `'700'` or `'800'` for bold/label text.

2. **Sibling `<Text>` nodes in a flex row** — Putting two `<Text>` nodes side-by-side inside a `flexDirection: 'row'` `<View>` causes the second one to be clipped or invisible. The Apptile renderer does not handle sibling bare `<Text>` in a row correctly.

```javascript
// ❌ WRONG — second Text invisible, no fontWeight
<View style={{ flexDirection: 'row' }}>
  <Text style={{ fontWeight: '700' }}>Label: </Text>
  <Text>{value}</Text>
</View>

// ❌ WRONG — Text without fontWeight may not render
<Text style={{ fontSize: 14, color: textColor }}>{value}</Text>

// ✅ CORRECT — single Text with template literal, always has fontWeight
<Text style={{ fontSize: 14, fontWeight: '500', color: textColor }}>
  {`Label: ${value}`}
</Text>

// ✅ CORRECT — for row layouts, wrap each side in a <View>
<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 14, fontWeight: '500', color: textColor }}>Label</Text>
  </View>
  <View>
    <Text style={{ fontSize: 14, fontWeight: '500', color: textColor }}>{value}</Text>
  </View>
</View>
```

**Rules:**
- **Always** include `fontWeight` on every `<Text>` node. Use `'500'` for normal body text, `'700'` or `'800'` for bold labels/headings.
- **Never** put two sibling bare `<Text>` nodes inside a `flexDirection: 'row'` `<View>` — wrap each in a `<View>` instead.
- **Always** combine label + value into a single `<Text>` using a template literal: `` {`Label: ${value}`} ``
- For bold labels with normal values inline, use a nested `<Text style={{fontWeight:'700'}}>` inside the outer `<Text>` — this is safe; it's only sibling `<Text>` in a row that breaks.

---

## General Patterns

### 1. Plugin Scaffolding

- **Always** use the `tile` CLI to create plugins: `npx tile create`
- Plugins scaffold into `remoteCode/plugins/<pluginNameInCamelCase>/` with:
  - `metadata.json` — declares the plugin name, entry, and editable file (**do NOT edit**)
  - `source/widget.jsx` — auto-generated entry point that calls `connectWidget` (**do NOT edit**)
  - `source/component.jsx` — main implementation (all code goes here)
- The CLI auto-updates `remoteCode/index.js` to import and return the new plugin

#### `metadata.json` format (required, one per plugin folder)

```json
{
  "name": "pluginNameInCamelCase",
  "editableFilePath": "source/component.jsx",
  "entry": "source/widget.jsx"
}
```

#### `widget.jsx` format (auto-generated — never write by hand, shown here for reference)

```jsx
// (NOTE FOR LLM's) Do not modify this file! It is autogenerated at build time and your changes will be lost.
import { connectWidget } from 'apptile-core';
import { ReactComponent, WidgetConfig, WidgetEditors, PropertySettings } from './component';

const pluginListing = {
  labelPrefix: 'pluginNameInCamelCase',
  type: 'widget',
  name: 'pluginNameInCamelCase',       // MUST match folder name exactly (camelCase)
  description: 'Short plugin description',
  layout: { width: 50, height: 30 },
  section: 'SDK',
  icon: 'widget',
  manifest: {
    directoryName: 'pluginNameInCamelCase',  // MUST match folder name
  },
};

export default connectWidget(
  'pluginNameInCamelCase',   // arg 1: plugin name — MUST match folder name
  ReactComponent,            // arg 2: the React component
  WidgetConfig,              // arg 3: default config values
  null,                      // arg 4: always null
  WidgetEditors,             // arg 5: editor controls shown in Apptile editor
  {
    propertySettings: PropertySettings,
    widgetStyleConfig: [],
    pluginListing,
    docs: {},
  },
);
```

> **Critical:** The plugin name string passed to `connectWidget` (and used in `pluginListing.name`, `labelPrefix`, `manifest.directoryName`) **must exactly match the plugin's folder name** in `remoteCode/plugins/`. This is how the Apptile platform discovers and displays the plugin in the editor. Using a different name (e.g. PascalCase display name) will cause the plugin to not appear.

### 2. Component Anatomy

```jsx
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean } from 'apptile-core';

export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');

  // 1. Read merchant config from model
  const apiKey = model.get('apiKey') || '';
  const primaryColor = model.get('primaryColor') || '#007AFF';
  const showSection = makeBoolean(model.get('showSection') ?? true);

  // 2. Read dynamic data from Redux
  const customerShopifyId = useSelector(state => {
    const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
    return gid ? gid.split('/').pop() : null;
  }, shallowEqual);

  // 3. Local state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 4. Data fetching with cleanup
  useEffect(() => {
    let cancelled = false;
    async function load() { /* ... */ if (!cancelled) setData(result); }
    load();
    return () => { cancelled = true; };
  }, [apiKey, customerShopifyId]);

  // 5. Render
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
    { type: 'codeInput', name: 'apiKey', props: { label: 'API Key' } },
    { type: 'colorInput', name: 'primaryColor', props: { label: 'Primary Color' } },
    { type: 'checkbox', name: 'showSection', props: { label: 'Show Section' } },
  ],
};

export const PropertySettings = {};
export const WrapperTileConfig = { name: 'My Plugin', defaultProps: {} };
```

### 3. Merchant Configuration — Minimize Manual Input

- **Only expose properties that require merchant input** (API keys, store identifiers).
- **Dynamic IDs** (e.g., subscription IDs, order IDs) → pass via navigation params, NOT manual editor inputs.
- **Logged-in user IDs** → fetch from Redux store, NOT manual editor inputs.
- Keep fallback IDs in `WidgetConfig` (so `model.get()` has a default) but **remove** them from `WidgetEditors`.
- Colors, labels, and display toggles **always** belong in `WidgetEditors`.

### 4. Inter-Plugin Navigation (React Navigation)

**Always use React Navigation** (`@react-navigation/native`) — do NOT use `navigateToScreen` from `apptile-core` for plugin-to-plugin navigation.

```jsx
// Sender plugin:
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('TargetScreenName', { itemId: '123' });

// Receiver plugin:
import { useRoute } from '@react-navigation/native';
const route = useRoute();
const itemId = route.params?.itemId || model.get('itemId') || '';
```

**Key rules:**
- `useNavigation()` for sender, `useRoute()` for receiver.
- `route.params` is primary source; `model.get()` is fallback.
- Keep the param key in receiver's `WidgetConfig` with empty default.
- Receiver's `WidgetEditors` should **NOT** include navigation params.
- Validate required params before making API calls.

### 5. Third-Party API Authentication

When the third-party API cannot use Shopify session cookies:

1. Use the service's **Admin/Server API** to generate a session or auth token.
2. Exchange that token for a client-facing access token if needed.
3. Store the API key as a merchant-configurable `WidgetEditors` field.
4. Each plugin handles auth independently (self-contained).

### 6. Data Fetching

- Use native `fetch()` for third-party REST APIs (not `runDatasourceQuery`).
- `runDatasourceQuery` from `apptile-core` is only for Shopify/built-in datasources.
- Run auth + data fetching in `useEffect` with a `cancelled` flag for cleanup.
- Handle loading, error, and empty states locally with `useState`.

### 7. Allowed Libraries

Only whitelisted modules: `react`, `react-native`, `react-redux`, `lodash`, `apptile-core`, `@gorhom/portal`, `react-native-webview`, `react-native-video`, `react-native-pager-view`, `react-native-svg`, `react-native-reanimated-carousel`, `react-native-linear-gradient`, `@react-navigation/native`.

### 7a. Using Icons in Plugins

Import the `Icon` component from `apptile-core` and pass an `iconType` prop to select the icon set.

```javascript
import { Icon } from 'apptile-core';

// Usage:
<Icon iconType="Feather" name="pause-circle" size={16} color="#92400E" />
<Icon iconType="Ionicons" name="checkmark-circle" size={16} color="#065F46" />
<Icon iconType="MaterialCommunityIcons" name="close" size={16} color="#EF4444" />
```

**Rules:**
- Always import `Icon` from `apptile-core` — **never** import `Feather`, `Ionicons`, or `MaterialCommunityIcons` directly.
- Pass `iconType` as a string: `"Feather"`, `"Ionicons"`, or `"MaterialCommunityIcons"`.
- `name` is the icon name from the chosen set (e.g. Feather icon names from the Feather icon list).
- Do **not** use emoji characters (e.g. `⏸`, `✓`) as icon substitutes — always use `Icon` instead.

### 10. Inline Edit Mode (In-Place Editing Within a Plugin)

For sections that need editing (frequency, shipping address, order notes, reschedule), use an `editMode` state to toggle between the view and the edit form **within the same component**. Only navigate to a new screen if the edit flow is complex enough to warrant a full screen.

```javascript
const [editMode, setEditMode] = useState(null);
// null | 'frequency' | 'address' | 'reschedule' | 'orderNote'

// In renderSection, pass a rightButton that sets editMode:
renderSection('Delivery Frequency', editMode === 'frequency' ? (
  <FrequencyEditForm onSave={handleSaveFrequency} onCancel={() => setEditMode(null)} />
) : (
  <Text>{freq}</Text>
), 'frequency', (
  <TouchableOpacity onPress={() => setEditMode('frequency')}>
    <Text style={styles.sectionEditBtn}>Edit</Text>
  </TouchableOpacity>
));
```

**When to use:** Edit flows that are 2–5 fields and don't need their own nav history. Keeps the interaction tight and avoids an extra screen transition.

---

### 11. `performAction` Wrapper for Subscription Mutations

Actions that modify subscription state (pause, resume, skip, place order) all follow the same pattern: set loading, call API, show result, refresh data. Extract this into a single `performAction` wrapper:

```javascript
const performAction = useCallback(async (actionFn, successMsg) => {
  if (!loopToken) return;
  try {
    setActionLoading(true);
    setTopMessage(null);
    await actionFn(baseUrl, apiKey, loopToken, subscriptionId);
    setTopMessage(successMsg);
    await loadSubscription(loopToken); // refresh data after mutation
  } catch (e) {
    setTopMessage(e.message);
  } finally {
    setActionLoading(false);
  }
}, [loopToken, baseUrl, apiKey, subscriptionId, loadSubscription]);

// Usage:
const handlePause = () => confirmAndExecute('Pause?', '...', () =>
  performAction(pauseSubscription, 'Subscription paused successfully.')
);
```

This removes ~15 lines of boilerplate per action and makes each handler a one-liner.

---

### 12. Slide-In Panel with `Animated` for Non-Navigation Overlays

For overlays that are contextually tied to a specific row (e.g., editing a line item), use a slide-in panel with `Animated.timing` rather than pushing a new screen. This keeps the subscription context visible behind the panel.

```javascript
const SCREEN_WIDTH = Dimensions.get('window').width;
const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current; // starts off-screen right

const openPanel = (item) => {
  setEditingLine(item);
  Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
};

const closePanel = () => {
  Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
    setEditingLine(null);
  });
};

// Render as a sibling at the root of the component:
<Animated.View style={[styles.slidePanel, { transform: [{ translateX: slideAnim }] }]}>
  {/* panel content */}
</Animated.View>
```

**Key rules:**
- Use `useRef(new Animated.Value(...)).current` — **not** `useState` — so the value survives re-renders without causing them.
- Always `useNativeDriver: true` for transform animations.
- The panel is a direct child of the root `<View>`, absolutely positioned so it overlays the scroll content.

---

### 13. Caching the Auth Token in State

For plugins that make multiple API calls (initial load + user-triggered mutations), avoid re-authenticating on every action by caching the token in component state:

```javascript
const [loopToken, setLoopToken] = useState(null);

useEffect(() => {
  let cancelled = false;
  (async () => {
    const token = await getLoopToken(baseUrl, apiKey, customerShopifyId);
    if (cancelled) return;
    setLoopToken(token);
    // use token for subsequent fetches in the same useEffect
  })();
  return () => { cancelled = true; };
}, [apiKey, baseUrl, customerShopifyId]);

// All action handlers check loopToken before proceeding:
const performAction = useCallback(async (...) => {
  if (!loopToken) return;  // guard against stale/null token
  // ...
}, [loopToken, ...]);
```

**Rule:** Cache the auth token in `useState`. Re-authenticate (by re-triggering the `useEffect`) only when credentials change (`apiKey`, `baseUrl`, `customerShopifyId`). Always guard action handlers with `if (!loopToken) return`.

---

### 8. Apptile Gotchas

| Gotcha | Solution |
|--------|----------|
| `makeBoolean()` required for booleans from `model.get()` | `makeBoolean(model.get('prop') ?? defaultValue)` |
| `useSelector` must use `shallowEqual` | Always pass `shallowEqual` as second arg |
| `PropertySettings` for plugins with no events | Set to `{}` |
| `widget.jsx` is auto-generated | Never edit it |
| Root `<View>` collapses to 0 height | Use `flex: 'unset'` and `minHeight` |
| WidgetEditors format is strict | Must be `{ type, name, props: { label } }` |

### 9. Dynamic Shopify Customer ID Fetching

The logged-in customer's Shopify ID is available in the Redux store. **Never** ask merchants to input it.

**Binding equivalent:** `{{shopify?.loggedInUser?.id?.split('/').pop()}}`

**Code pattern:**
```javascript
import { useSelector, shallowEqual } from 'react-redux';

const customerShopifyId = useSelector(state => {
  const gid = state.appModel.values.getIn(['shopify', 'loggedInUser', 'id']);
  return gid ? gid.split('/').pop() : null;
}, shallowEqual);
```

This converts a Shopify GID (`gid://shopify/Customer/12345`) to a raw numeric ID (`12345`).
