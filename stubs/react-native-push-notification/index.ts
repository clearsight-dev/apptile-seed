// Stub for react-native-push-notification
// Firebase Analytics in apptile-core calls PushNotification.configure(), so we need these methods

const PushNotification = {
  configure: (options: any) => {
    console.log('[PushNotification Stub] configure() called - using OneSignal instead');
    if (options && options.onRegister) {
      options.onRegister({ token: 'stub-token', os: 'ios' });
    }
  },
  localNotification: () => {},
  localNotificationSchedule: () => {},
  requestPermissions: () => Promise.resolve(),
  checkPermissions: (cb: any) => cb && cb({ alert: false, badge: false, sound: false }),
  cancelLocalNotification: () => {},
  cancelAllLocalNotifications: () => {},
  setApplicationIconBadgeNumber: () => {},
  getApplicationIconBadgeNumber: (cb: any) => cb && cb(0),
  popInitialNotification: (cb: any) => cb && cb(null),
  abandonPermissions: () => {},
  registerNotificationActions: () => {},
  clearAllNotifications: () => {},
  removeAllDeliveredNotifications: () => {},
  getDeliveredNotifications: (cb: any) => cb && cb([]),
  getScheduledLocalNotifications: (cb: any) => cb && cb([]),
  removeDeliveredNotifications: () => {},
  invokeApp: () => {},
  getChannels: (cb: any) => cb && cb([]),
  channelExists: (_id: string, cb: any) => cb && cb(false),
  createChannel: (_ch: any, cb: any) => cb && cb(true),
  channelBlocked: (_id: string, cb: any) => cb && cb(false),
  deleteChannel: () => {},
};



export default PushNotification;