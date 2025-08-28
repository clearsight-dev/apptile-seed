#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import <ZegoExpressEngine/ZegoExpressEngine.h>

@interface RCTZegoExpressNativeModule : RCTEventEmitter <RCTBridgeModule>
@property (nonatomic, strong) UIView *previewView;
@property (nonatomic, strong) AVSampleBufferDisplayLayer *previewLayer;
@end
