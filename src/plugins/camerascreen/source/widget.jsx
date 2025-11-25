import { connectWidget } from 'apptile-core';
import {ReactComponent, WidgetConfig, WidgetEditors, PropertySettings} from './component'

const pluginListing = {
  labelPrefix: 'camerascreen',
  type: 'widget',
  name: 'camerascreen',
  description: 'Full screen camera component',
  layout: {
    width: 50,
    height: 30,
  },
  section: 'SDK',
  icon: 'camera',
  manifest: {
    directoryName: 'camerascreen',
  }
};

export default connectWidget('camerascreen', 
  ReactComponent, 
  WidgetConfig, 
  null, 
  WidgetEditors, 
  {
    propertySettings: PropertySettings,
    widgetStyleConfig: [],
    pluginListing,
    docs: {},
  }
);

