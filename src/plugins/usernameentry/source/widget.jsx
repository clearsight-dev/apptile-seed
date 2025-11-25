import { connectWidget } from 'apptile-core';
import {ReactComponent, WidgetConfig, WidgetEditors, PropertySettings} from './component'

const pluginListing = {
  labelPrefix: 'usernameentry',
  type: 'widget',
  name: 'usernameentry',
  description: 'Username entry screen for device-based user identification',
  layout: {
    width: 50,
    height: 30,
  },
  section: 'SDK',
  icon: 'description',
  manifest: {
    directoryName: 'usernameentry',
  }
};

export default connectWidget('usernameentry', 
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