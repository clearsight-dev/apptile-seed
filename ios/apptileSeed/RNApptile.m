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

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
