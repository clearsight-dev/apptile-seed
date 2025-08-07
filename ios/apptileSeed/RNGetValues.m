//
//  RNGetValues.m
//  apptileSeed
//
//  Created by Gaurav Gautam on 22/11/24.
//

#import "RNGetValues.h"

@implementation RNGetValues

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}
RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(getKey:(NSString *)key callback:(RCTResponseSenderBlock)callback)
{
  NSString *value = [[NSBundle mainBundle].infoDictionary objectForKey:key];
  callback(@[[NSNull null], value ?: [NSNull null]]);
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
