//
//  StartupHandler.m
//  apptileSeed
//
//  Created by Mohammed Aman Khan on 23/05/25.
//

#import "StartupHandler.h"
#import "apptileSeed-Swift.h"
#import "AppDelegate.h"

@implementation StartupHandler

+ (void)handleStartupProcess {
    // Launching apptile startup process in background thread
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        @try {
            [Actions startApptileAppProcess:^(BOOL success) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    [Logger success:[NSString stringWithFormat:@"Startup Process %@", success ? @"Completed" : @"Failed"]];
                  
                  // Get reference to AppDelegate
                  AppDelegate *appDelegate = (AppDelegate *)[[UIApplication sharedApplication] delegate];

                  // Retrieve stored launchOptions
                  UIApplication *application = [UIApplication sharedApplication];
                  [appDelegate startReactNativeApp:application withOptions:appDelegate.storedLaunchOptions];
                });
            }];
        } @catch (NSException *exception) {
            
        }
    });
}

@end

