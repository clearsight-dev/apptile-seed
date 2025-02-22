#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>
#import <React/RCTImageView.h>
#import <React/RCTImageSource.h>
#import <React/RCTImageLoader.h>

@class RCTRootView;

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate>

@property (nonatomic, strong) RCTImageView *splash;
@property BOOL minDurationPassed;
@property BOOL jsLoaded;

@property NSLayoutConstraint *containerCenterX;
@property NSLayoutConstraint *containerCenterY;

@end
