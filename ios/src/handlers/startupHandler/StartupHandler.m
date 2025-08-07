//
//  StartupHandler.m
//  apptileSeed
//
//  Created by Vadivazhagan on 12/03/25.
//

#import "StartupHandler.h"
#import "apptileSeed-Swift.h"
#import "AppDelegate.h"
#import <UIKit/UIKit.h>

@implementation StartupHandler

+ (void)handleStartupProcess {
    // Launching apptile startup process in background thread
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        @try {
            [Logger info:[NSString stringWithFormat:@"Running in: %@", [NSThread isMainThread] ? @"Main Thread" : @"Background Thread"]];
            [Logger info:@"Starting Startup Process"];
          
            [Actions startApptileAppProcess:^(BOOL updateRequired, NSString *appStoreUrl) {
                dispatch_async(dispatch_get_main_queue(), ^{
                  if (updateRequired) {
                      // Call Swift function to show the update alert
                      [Logger warn:@"Mandatory app update required. Showing alert."];
                      [Actions showUpdateRequiredAlertWithUrl:appStoreUrl];
                      // Do NOT proceed to start RN app if update is required
                  } else {
                      // Proceed to start the React Native app
                      [Logger success:@"Startup Process Completed (no mandatory update needed). Starting RN App."];
                      AppDelegate *appDelegate = (AppDelegate *)[[UIApplication sharedApplication] delegate];
                      UIApplication *application = [UIApplication sharedApplication];
                      [appDelegate startReactNativeApp:application withOptions:appDelegate.storedLaunchOptions];
                  }
                });
            }];
        } @catch (NSException *exception) {
            [Logger error:[NSString stringWithFormat:@"Startup Process failed: %@", exception.reason]];
        }
    });
}

@end
