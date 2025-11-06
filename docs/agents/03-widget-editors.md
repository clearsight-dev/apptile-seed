# Widget Editors Reference

Widget editors define the UI controls in the no-code platform that allow users to configure plugin properties.

## Available Editor Types

- **colorInput** - Color picker
- **radioGroup** - Button group for selecting one option
- **codeInput** - Text input or JavaScript expression
- **checkbox** - Boolean switch
- **dropDown** - Dropdown selector
- **borderRadiusEditor** - Corner radius control
- **trblValuesEditor** - Margin/padding control
- **assetEditor** - Image picker from asset library
- **cloudinaryEditor** - Video picker
- **rangeSliderInput** - Slider for numeric values
- **typographyInput** - Font settings selector
- **iconChooserInput** - Icon picker

## Common Editor Configurations

### Color Picker
```javascript
{
  targets: ['myplugin-View-container'],
  type: 'colorInput',
  name: 'backgroundColor',
  props: { label: 'Background Color' }
}
```

### Dropdown
```javascript
{
  targets: [],
  type: 'dropDown',
  name: 'alignment',
  props: {
    label: 'Alignment',
    options: ['left', 'center', 'right']
  }
}
```

### Checkbox
```javascript
{
  targets: [],
  type: 'checkbox',
  name: 'showTitle',
  props: { label: 'Show Title' }
}
```

### Range Slider
```javascript
{
  targets: [],
  type: 'rangeSliderInput',
  name: 'fontSize',
  defaultValue: 16,
  props: {
    label: 'Font Size',
    minRange: 10,
    maxRange: 40,
    step: 1
  }
}
```

### Border Radius
```javascript
{
  targets: [],
  type: 'borderRadiusEditor',
  name: 'cornerRadius',
  props: {
    label: 'Corner Radius',
    placeholder: '0',
    options: [
      'cornerRadiusTopLeftRadius',
      'cornerRadiusTopRightRadius',
      'cornerRadiusBottomRightRadius',
      'cornerRadiusBottomLeftRadius'
    ],
    layout: 'square'
  }
}
```

### Icon Chooser
```javascript
{
  targets: [],
  type: 'iconChooserInput',
  name: 'icon',
  props: {
    label: 'Icon',
    iconTypeProp: 'iconType'
  }
}

// Usage in component:
const iconName = model.get('icon');
const iconType = model.get('iconType');
```

### Asset Editor (Image Picker)
```javascript
{
  targets: ['myplugin-Image-myimage'],
  type: 'assetEditor',
  name: 'image',
  props: {
    label: 'Image',
    assetProperty: 'image',
    urlProperty: 'imageUrl',
    sourceTypeProperty: 'imageType'
  }
}
```

### Cloudinary Editor (Video Picker)
```javascript
{
  targets: [],
  type: 'cloudinaryEditor',
  name: 'videourl',
  props: {
    label: 'Video',
    urlProperty: 'videourl',
    placeholder: ''
  }
}
```

### Typography Input
```javascript
{
  targets: [],
  type: 'typographyInput',
  name: 'typography',
  props: {
    label: 'Typography'
  }
}
```

### Radio Group
```javascript
{
  targets: [],
  type: 'radioGroup',
  name: 'alignment',
  props: {
    label: 'Text alignment',
    options: [
      {
        text: '_',
        value: 'none'
      },
      {
        iconType: 'MaterialIcons',
        icon: 'align-vertical-top',
        text: '',
        value: 'top'
      },
      {
        iconType: 'MaterialIcons',
        icon: 'align-vertical-center',
        text: '',
        value: 'center'
      },
      {
        iconType: 'MaterialIcons',
        icon: 'align-vertical-bottom',
        text: '',
        value: 'bottom'
      }
    ]
  }
}
```

### TRBL Values Editor (Margin/Padding)
```javascript
{
  targets: [],
  type: 'trblValuesEditor',
  name: 'margin',
  props: {
    label: 'Item Margin',
    options: [
      'item_marginTop',
      'item_marginRight',
      'item_marginBottom',
      'item_marginLeft'
    ]
  }
}
```

## Best Practices

1. **Always expose sensible properties** for customization:
   - Text on buttons and labels
   - Colors for text and backgrounds
   - Corner radius, padding, spacing
   - Images via assetEditor

2. **Use appropriate editor types**:
   - Use `colorInput` for colors
   - Use `assetEditor` for images (not URL input)
   - Use `checkbox` for boolean values
   - Use `dropDown` for many options, `radioGroup` for few options

3. **Provide clear labels**:
   - Make labels descriptive and user-friendly
   - Use proper capitalization

4. **Set sensible defaults**:
   - Initialize all props in `WidgetConfig`
   - Provide fallback values in component code

