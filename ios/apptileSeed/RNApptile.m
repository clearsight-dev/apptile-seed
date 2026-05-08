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
  NSString *versionCode = [[NSBundle mainBundle] objectForInfoDictionaryKey:(NSString *)kCFBundleVersionKey] ?: @"";
  NSString *googleMapsApiKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"GOOGLE_MAPS_API_KEY"] ?: @"";
  return @{
    @"VERSION_CODE": versionCode,
    @"GOOGLE_MAPS_API_KEY": googleMapsApiKey,
  };
}

RCT_EXPORT_METHOD(notifyJSReady)
{
  NSString *JSReadyNotification = @"JSReadyNotification";
  [[NSNotificationCenter defaultCenter] postNotificationName:JSReadyNotification object:nil];
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
