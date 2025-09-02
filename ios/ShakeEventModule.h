//
//  ShakeEventModule.h
//  apptileSeed
//
//  Created by Mohammed Aman Khan on 01/09/25.
//

#import "React/RCTEventEmitter.h"
#import "React/RCTBridgeModule.h"

@interface ShakeEventModule : RCTEventEmitter <RCTBridgeModule>
@end

@implementation ShakeEventModule

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[@"ShakeEvent"];
}

- (void)startObserving {
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(emitShakeEvent)
                                               name:@"ShakeEvent"
                                             object:nil];
}

- (void)stopObserving {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)emitShakeEvent {
  [self sendEventWithName:@"ShakeEvent" body:nil];
}

@end
