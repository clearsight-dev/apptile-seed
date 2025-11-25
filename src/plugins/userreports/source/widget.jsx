import { connectWidget } from 'apptile-core';
import {ReactComponent, WidgetConfig, WidgetEditors, PropertySettings} from './component'

const pluginListing = {
  labelPrefix: 'userreports',
  type: 'widget',
  name: 'userreports',
  description: 'User Reports - View all potholes reported by the user',
  layout: {
    width: 50,
    height: 30,
  },
  section: 'SDK',
  icon: 'list',
  manifest: {
    directoryName: 'userreports',
  }
};

export default connectWidget('userreports', 
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

