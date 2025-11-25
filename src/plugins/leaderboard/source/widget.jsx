import { connectWidget } from 'apptile-core';
import {ReactComponent, WidgetConfig, WidgetEditors, PropertySettings} from './component'

const pluginListing = {
  labelPrefix: 'leaderboard',
  type: 'widget',
  name: 'leaderboard',
  description: 'Leaderboard showing top pothole reporters',
  layout: {
    width: 50,
    height: 30,
  },
  section: 'SDK',
  icon: 'description',
  manifest: {
    directoryName: 'leaderboard',
  }
};

export default connectWidget('leaderboard', 
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