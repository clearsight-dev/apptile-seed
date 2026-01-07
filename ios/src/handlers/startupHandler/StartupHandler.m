//
//  StartupHandler.m
//  apptileSeed
//
//  Created by Vadivazhagan on 12/03/25.
//

#import "StartupHandler.h"
#import "AppDelegate.h"
#import <UIKit/UIKit.h>

@implementation StartupHandler

+ (void)handleStartupProcess {
    dispatch_async(dispatch_get_main_queue(), ^{
        AppDelegate *appDelegate = (AppDelegate *)[[UIApplication sharedApplication] delegate];
        UIApplication *application = [UIApplication sharedApplication];
        [appDelegate startReactNativeApp:application withOptions:appDelegate.storedLaunchOptions];
    });
}

@end
