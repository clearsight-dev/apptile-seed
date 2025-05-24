#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>
#import <React/RCTImageView.h>
#import <React/RCTImageSource.h>
#import <React/RCTBridgeDelegate.h>
#import <React/RCTImageLoader.h>

@class RCTRootView;
@class FloatingPreviewControls;
@protocol FloatingPreviewControlsDelegate;

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate, FloatingPreviewControlsDelegate>

@property (nonatomic, strong) RCTImageView *splash;
@property (nonatomic, strong) NSDictionary *storedLaunchOptions;
@property (nonatomic, assign) BOOL minDurationPassed;
@property (nonatomic, assign) BOOL jsLoaded;
@property (nonatomic, strong) FloatingPreviewControls *floatingControls;

- (void)startReactNativeApp:(UIApplication *)application withOptions:(NSDictionary *)launchOptions;

@end
