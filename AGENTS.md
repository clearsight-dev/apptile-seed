# AGENTS.md

This is the **apptile-seed** project, a React Native 0.73.8 application that serves as the runtime environment for the Apptile no-code platform (https://app.apptile.io).

## Documentation Structure

The documentation is organized into focused sections for better understanding. Start here:

📚 **[Complete Agent Documentation](./docs/agents/README.md)**

### Quick Links

1. **[Project Overview](./docs/agents/01-project-overview.md)** - Platform details, directory structure, supported libraries
2. **[Creating Plugins](./docs/agents/02-creating-plugins.md)** - Plugin structure, required exports, examples
3. **[Widget Editors Reference](./docs/agents/03-widget-editors.md)** - All editor types with examples
4. **[apptile-core SDK](./docs/agents/04-apptile-core-sdk.md)** - Hooks, navigation, state management, modals
5. **[Creating Navigators](./docs/agents/05-creating-navigators.md)** - Navigator structure and examples
6. **[Rules and Best Practices](./docs/agents/06-rules-and-best-practices.md)** - DO's, DON'Ts, common mistakes

## Quick Start

### For Creating a Plugin:
1. Create folder: `remoteCode/plugins/<plugin-name>/`
2. Add `metadata.json` with plugin name
3. Create `source/widget.jsx` using the template (see Creating Plugins guide)
4. Create `source/component.jsx` with 4 required exports:
   - `ReactComponent` - Main component
   - `WidgetConfig` - Props with initial values
   - `WidgetEditors` - UI controls for no-code editor
   - `PropertySettings` - Event handlers

### For Creating a Navigator:
1. Create folder: `remoteCode/navigators/<navigator-name>/`
2. Add `metadata.json` with file paths
3. Create `source/index.jsx` with navigator implementation

## Supported Libraries (ONLY these 11)

- `react`
- `react-native`
- `react-redux`
- `@gorhom/portal`
- `react-native-svg`
- `graphql-tag`
- `react-native-gesture-handler` (version 2)
- `react-native-webview` (version 13)
- `apptile-core`
- `apptile-shopify`
- `@react-navigation/native`
- `moment`
- `lodash`

**DO NOT** use any other libraries, including Expo libraries.

## Key Concepts

- **Plugins**: Custom React Native components that run in the Apptile platform
- **Navigators**: Define the navigation structure of the app (bottom tabs, stack, etc.)
- **Widget Editors**: UI controls in the no-code platform for configuring plugin properties
- **apptile-core**: SDK providing hooks and utilities (useApptileWindowDims, navigation, etc.)
- **Global Plugins**: State containers accessible across the app via Redux

## Important Notes for AI Agents

- All plugin code goes in `source/component.jsx`
- The `widget.jsx` file must be created using the template provided in the Creating Plugins guide
- Always export exactly 4 things: `ReactComponent`, `WidgetConfig`, `WidgetEditors`, `PropertySettings`
- Use `useApptileWindowDims` instead of React Native's `useWindowDimensions`
- Use `@gorhom/portal` for modals, **NOT** React Native's `Modal`
- Use Immutable.js `.get()` and `.getIn()` to read from model
- Global plugin values are plain JavaScript objects (not Immutable)

## Example Files

- **Plugin**: `remoteCode/plugins/something/source/component.jsx`
- **Navigator**: `remoteCode/navigators/testnav/source/index.jsx`

## Additional Resources

- Apptile Platform: https://app.apptile.io
- Full Documentation: http://127.0.0.1:5500/systemPrompts/latest.html
- Supported Icon Libraries: Material Icons, MaterialCommunityIcons, FontAwesome5, AntDesign, Entypo, Feather, Ionicons


