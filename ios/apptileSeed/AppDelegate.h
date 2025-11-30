#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>

@class RCTRootView;

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate>

@property (nonatomic, strong) NSDictionary *storedLaunchOptions;

- (void)startReactNativeApp:(UIApplication *)application withOptions:(NSDictionary *)launchOptions;

@end
