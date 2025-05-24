import moment from 'moment';
import {Platform} from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';

export const getFormattedDate = (date: string) => {
  return moment(date).format('DD MMM, (hh:mm A) ');
};

export const sendToast = (message: string, toast: any) => {
  toast.show(message, {
    placement: 'top',
    type: 'info',
  });
};

export const getCustomPreviewBundlePath = (appId: string) =>
  `${RNFetchBlob.fs.dirs.DocumentDir}/preview/${appId}`;

export const getCustomPreviewBundleZipPath = (appId: string) =>
  `${RNFetchBlob.fs.dirs.DocumentDir}/preview/${appId}/bundles.zip`;

export const getLocalBundleTrackerPath = () =>
  `${RNFetchBlob.fs.dirs.DocumentDir}/localBundleTracker.json`;

export const getJSBundleName = () =>
  Platform.select({android: 'index.android.bundle', ios: 'main.jsbundle'}) ||
  'main.jsbundle';

export const getPreviewTrackerPath = () =>
  `${RNFetchBlob.fs.dirs.DocumentDir}/previewTracker.json`;

export const getAssetsDirPath = () =>
  `${RNFetchBlob.fs.dirs.DocumentDir}/assets`;
