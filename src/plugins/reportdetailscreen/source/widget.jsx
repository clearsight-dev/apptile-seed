import { connectWidget } from 'apptile-core';
import {ReactComponent, WidgetConfig, WidgetEditors, PropertySettings} from './component'

const pluginListing = {
  labelPrefix: 'reportdetail',
  type: 'widget',
  name: 'reportdetail',
  description: 'Report pothole detail screen with location and image',
  layout: {
    width: 50,
    height: 30,
  },
  section: 'SDK',
  icon: 'description',
  manifest: {
    directoryName: 'reportdetail',
  }
};

export default connectWidget('reportdetail', 
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