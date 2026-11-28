#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>
#import <React/RCTImageView.h>
#import <React/RCTImageSource.h>
#import <React/RCTImageLoader.h>

@class RCTRootView;

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate>

@property (nonatomic, strong) UIView *splash;
// The startup window that hosts the splash. Kept alive (above React Native's own window,
// which RCTAppDelegate creates separately) until the splash is dismissed.
@property (nonatomic, strong) UIWindow *splashWindow;
@property BOOL stopSplashAnimation;
@property (nonatomic, strong) NSDictionary *storedLaunchOptions;
// A deeplink that arrived before javascript had subscribed to Linking's 'url'
// event, and whether it has subscribed yet. See deliverDeepLinkURL:.
@property (nonatomic, strong) NSURL *pendingDeepLinkURL;
@property BOOL deepLinkListenerReady;
@property BOOL minDurationPassed;
@property BOOL jsLoaded;

- (void)startReactNativeApp:(UIApplication *)application withOptions:(NSDictionary *)launchOptions;

@end
