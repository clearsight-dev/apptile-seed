# Apptile Agent Documentation

Welcome to the Apptile agent documentation! This guide will help AI agents understand how to create custom plugins and navigators for the Apptile no-code platform.

## Documentation Structure

This documentation is split into focused sections for better understanding:

### 1. [Project Overview](./01-project-overview.md)
- Platform details and architecture
- Directory structure
- Supported libraries
- Build and development setup
- Additional resources

### 2. [Creating Plugins](./02-creating-plugins.md)
- Plugin file structure
- Required exports (ReactComponent, WidgetConfig, WidgetEditors, PropertySettings)
- Minimal plugin example
- Plugin with configurable props
- Data model patterns
- Example plugin reference

### 3. [Widget Editors Reference](./03-widget-editors.md)
- All available editor types
- Common editor configurations with examples
- Best practices for exposing properties
- How to use each editor type

### 4. [apptile-core SDK](./04-apptile-core-sdk.md)
- useApptileWindowDims hook
- Navigation (navigateToScreen, goBack)
- Event triggers
- Asset/Image handling
- Global plugins (state management)
- Modals and bottom sheets
- Toast messages
- Getting dispatch function

### 5. [Creating Navigators](./05-creating-navigators.md)
- Navigator file structure
- Bottom tab navigator example
- Stack navigator example
- Key points and best practices
- Example navigator reference

### 6. [Rules and Best Practices](./06-rules-and-best-practices.md)
- Critical DO's (8 rules)
- Critical DON'Ts (13 rules)
- Best practices for component structure, styling, performance, error handling
- Testing guidelines
- Common mistakes to avoid

## Quick Start

1. **Read the Project Overview** to understand the platform
2. **Follow Creating Plugins** to build your first plugin
3. **Reference Widget Editors** to add configurable properties
4. **Use apptile-core SDK** for platform features
5. **Follow Rules and Best Practices** to avoid common mistakes

## Key Concepts

- **Plugins**: Custom React Native components that run in the Apptile platform
- **Navigators**: Define the navigation structure of the app
- **Widget Editors**: UI controls in the no-code platform for configuring plugins
- **apptile-core**: SDK providing hooks and utilities
- **Global Plugins**: State containers accessible across the app

## Important Notes

- All plugin code goes in `source/component.jsx`
- The `widget.jsx` file must be created using the template provided in the Creating Plugins guide
- Always export exactly 4 things: ReactComponent, WidgetConfig, WidgetEditors, PropertySettings
- Use `useApptileWindowDims` instead of React Native's `useWindowDimensions`
- Use `@gorhom/portal` for modals, NOT React Native's Modal
- Only use the 11 supported libraries

## Example Files

- Plugin: `remoteCode/plugins/something/source/component.jsx`
- Navigator: `remoteCode/navigators/testnav/source/index.jsx`

## Additional Resources

- Apptile Platform: https://app.apptile.io
- Full Documentation: http://127.0.0.1:5500/systemPrompts/latest.html
- Supported Icon Libraries: Material Icons, MaterialCommunityIcons, FontAwesome5, AntDesign, Entypo, Feather, Ionicons

## Getting Help

If you encounter issues:
1. Check the Rules and Best Practices document
2. Review the example plugin and navigator
3. Verify you're using only supported libraries
4. Ensure all required exports are present
5. Check that nativeID props are added to all elements

