# apptile-core SDK Features

The apptile-core SDK provides essential hooks and utilities for building plugins.

## useApptileWindowDims

**ALWAYS** use this instead of React Native's `useWindowDimensions`:

```javascript
import { useApptileWindowDims } from 'apptile-core';

const { width, height } = useApptileWindowDims();
```

This hook ensures proper dimensions in both mobile apps and web preview.

## Navigation

### navigateToScreen

Navigate to different screens in the app:

```javascript
import { navigateToScreen, goBack } from 'apptile-core';
import { useDispatch } from 'react-redux';

const dispatch = useDispatch();

// Navigate to a screen
dispatch(navigateToScreen('Account', {}));

// Navigate to Product screen
dispatch(navigateToScreen('Product', { productHandle: 'my-product' }));

// Navigate to Collection screen
dispatch(navigateToScreen('Collection', { collectionHandle: 'summer-sale' }));

// Go back
goBack();
```

## Event Triggers

Create custom events that users can configure in the no-code editor:

```javascript
import { EventTriggerIdentifier } from 'apptile-core';

export function ReactComponent({ model, triggerEvent }) {
  const handlePress = () => {
    triggerEvent('onCustomEvent');
  };
  
  return <Button onPress={handlePress} title="Trigger Event" />;
}

export const WidgetConfig = {
  onCustomEvent: ''
};

export const PropertySettings = {
  onCustomEvent: {
    type: EventTriggerIdentifier
  }
};
```

## Asset/Image Handling

Convert asset IDs to image URLs:

```javascript
import { assetIdToImageSrcSet } from 'apptile-core';
import { useSelector, shallowEqual } from 'react-redux';

const assetId = model.get('image');
const appConfig = useSelector(state => state.appConfig.current, shallowEqual);
const srcSet = assetIdToImageSrcSet(assetId, appConfig) || null;

if (srcSet && srcSet[0]) {
  return <Image source={{ uri: srcSet[0] }} style={{ width: 100, height: 100 }} />;
}

// WidgetEditors configuration for assetEditor
export const WidgetEditors = {
  basic: [
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
  ]
};
```

## Global Plugins (State Management)

Global plugins are state containers accessible across the app.

### Reading from Global Plugin

```javascript
import { useSelector, shallowEqual } from 'react-redux';

const weatherData = useSelector(
  state => state.appModel.values.getIn(['weatherData', 'value']),
  shallowEqual
);

// weatherData is a plain JavaScript object (NOT immutable)
const temperature = weatherData.tokyo.temperature;
```

### Updating Global Plugin

```javascript
import { useDispatch } from 'react-redux';

const dispatch = useDispatch();

dispatch({
  type: 'PLUGIN_MODEL_UPDATE',
  payload: {
    changesets: [{
      selector: ['weatherData', 'value'],
      newValue: {
        tokyo: { temperature: 90 }
      }
    }],
    runOnUpdate: true
  }
});
```

## Modals and Bottom Sheets

**NEVER** use React Native's `Modal` component. Always use `@gorhom/portal`:

```javascript
import React, { useRef, useState } from 'react';
import { View, Text, Animated, Button, Pressable } from 'react-native';
import { Portal } from '@gorhom/portal';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useApptileWindowDims } from 'apptile-core';

export function ReactComponent({ model, pageKey }) {
  const id = model.get('id');
  const { width: screenWidth, height: screenHeight } = useApptileWindowDims();
  
  const [sheetIsRendered, setSheetIsRendered] = useState(false);
  const sheetVisibility = useRef(new Animated.Value(0)).current;

  const closeModal = () => {
    Animated.timing(sheetVisibility, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => setSheetIsRendered(false));
  };

  const openModal = () => {
    setSheetIsRendered(true);
    setTimeout(() => {
      Animated.timing(sheetVisibility, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    });
  };

  let sheet = null;
  if (sheetIsRendered) {
    sheet = (
      <Portal hostName={'root'}>
        <GestureHandlerRootView
          style={{
            width: screenWidth,
            height: screenHeight,
            position: 'absolute',
            backgroundColor: '#00000088'
          }}
        >
          <Pressable
            style={{
              width: screenWidth,
              height: 0.5 * screenHeight,
              position: 'absolute',
              top: 0
            }}
            onPress={closeModal}
          />
          <Animated.View
            style={{
              width: screenWidth,
              height: 0.5 * screenHeight,
              position: 'absolute',
              bottom: 0,
              backgroundColor: 'white',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 10,
              transform: [
                {
                  translateY: sheetVisibility.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5 * screenHeight, 0]
                  })
                }
              ]
            }}
          >
            <Button title="Close" onPress={closeModal} />
            <ScrollView>
              <Text>Sheet Content</Text>
            </ScrollView>
          </Animated.View>
        </GestureHandlerRootView>
      </Portal>
    );
  }

  return (
    <View nativeID={'rootElement-' + id}>
      <Button title="Show Sheet" onPress={openModal} />
      {sheet}
    </View>
  );
}
```

## Toast Messages

```javascript
import { RNToastProvider, useRNToast } from 'apptile-core';

export function ReactComponent({ model }) {
  const id = model.get('id');
  
  return (
    <RNToastProvider>
      <ToastContent pluginRootId={'rootElement-' + id} />
    </RNToastProvider>
  );
}

const ToastContent = ({ pluginRootId }) => {
  const toast = useRNToast();
  
  const showToast = () => {
    toast.show('Success!', {
      type: 'success',
      placement: 'bottom',
      duration: 3000
    });
  };

  return (
    <View nativeID={pluginRootId}>
      <Button title="Show Toast" onPress={showToast} />
    </View>
  );
};
```

## Getting Dispatch Function

Always use `useDispatch` from react-redux:

```javascript
import { useDispatch } from 'react-redux';

export function ReactComponent({ model }) {
  const dispatch = useDispatch();
  
  // Use dispatch for navigation, state updates, etc.
}
```

**DO NOT** expect dispatch as a prop!

