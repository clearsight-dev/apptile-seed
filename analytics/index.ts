// This file is generated at build time based on the integrations added to the app
import {Platform} from 'react-native';
import {checkATTPermission, ApptileAnalytics, addCustomEventListener} from 'apptile-core';
import {
  Firebase as FirebaseAnalytics,
  // __ENABLED_ANALYTICS_IMPORTS__
} from 'apptile-core';

import {
  initStoreWithRootSagas,
} from 'apptile-core';

import { loadDatasourcePlugins } from 'apptile-datasource';
import { initPlugins } from 'apptile-plugins';
// __EXTRA_LEGACY_PLUGIN_IMPORTS__

import { initNavs } from '../src/indexNav';
import { initPlugins as initRemotePlugins } from '../src';

initStoreWithRootSagas();
loadDatasourcePlugins();
initPlugins();
initRemotePlugins();
initNavs();

// The plugins initialized here will not be available in the web
// as an addon. This is only meant for toggling exsiting plugins which
// are tightly integrated with apptile-core. Use remoteCode folder for
// everything else
// __EXTRA_LEGACY_INITIALIZERS__

export async function init() {
  if (Platform.OS === 'ios') {
    try {
      await checkATTPermission();
    } catch (err) {
      console.log('Failure in att check', err);
    }
  }

  try {
    await ApptileAnalytics.initialize([
      FirebaseAnalytics,
      // __ENABLED_ANALYTICS__
    ]);
  } catch (err) {
    console.error('Failure in initializing ApptileAnalytics');
  }
}

addCustomEventListener('ApptileAnalyticsSendEvent', (type, name, params) => {
  ApptileAnalytics.sendEvent(type, name, params);
});