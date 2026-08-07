//
//  RNApptile.m
//  apptileSeed
//
//  Created by Gaurav Gautam on 15/02/25.
//

#import "RNApptile.h"

@implementation RNApptile

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}
RCT_EXPORT_MODULE(RNApptile)

//+ (NSString *) appVersion
//{
//    return [[NSBundle mainBundle] objectForInfoDictionaryKey: @"CFBundleShortVersionString"];
//}
//
//+ (NSString *) build
//{
//    return [[NSBundle mainBundle] objectForInfoDictionaryKey: (NSString *)kCFBundleVersionKey];
//}
- (NSDictionary *)constantsToExport
{
  return @{ @"VERSION_CODE": [[NSBundle mainBundle] objectForInfoDictionaryKey: (NSString *)kCFBundleVersionKey] };
}

RCT_EXPORT_METHOD(notifyJSReady)
{
  NSString *JSReadyNotification = @"JSReadyNotification";
  [[NSNotificationCenter defaultCenter] postNotificationName:JSReadyNotification object:nil];
}

// Called by javascript the moment it has subscribed to Linking's 'url' event.
// notifyJSReady is not a substitute: it fires when the root component mounts, which
// can be seconds before apptile-core's modules are evaluated. React Native drops
// 'url' events that have no subscriber, so the app delegate holds any deeplink that
// arrives before this point and flushes it here.
RCT_EXPORT_METHOD(markDeepLinkListenerReady)
{
  NSString *notification = @"ApptileDeepLinkListenerReadyNotification";
  [[NSNotificationCenter defaultCenter] postNotificationName:notification object:nil];
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
