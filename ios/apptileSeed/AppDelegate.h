#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>
#import <React/RCTImageView.h>
#import <React/RCTImageSource.h>
#import <React/RCTImageLoader.h>

@class RCTRootView;

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate>

@property (nonatomic, strong) RCTImageView *splash;
@property (nonatomic, strong) NSDictionary *storedLaunchOptions;
// A deeplink that arrived before javascript had subscribed to Linking's 'url'
// event, and whether it has subscribed yet. See deliverDeepLinkURL:.
@property (nonatomic, strong) NSURL *pendingDeepLinkURL;
@property BOOL deepLinkListenerReady;
@property BOOL minDurationPassed;
@property BOOL jsLoaded;

- (void)startReactNativeApp:(UIApplication *)application withOptions:(NSDictionary *)launchOptions;

@end
