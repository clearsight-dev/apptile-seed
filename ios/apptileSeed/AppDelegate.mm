#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTI18nUtil.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTReloadCommand.h>

#if ENABLE_FIREBASE_ANALYTICS
#import <Firebase.h>
#endif

#if ENABLE_FBSDK
#import <AuthenticationServices/AuthenticationServices.h>
#import <SafariServices/SafariServices.h>
#import <FBSDKCoreKit/FBSDKCoreKit-Swift.h>
#endif

#if ENABLE_MOENGAGE
#import <ReactNativeMoEngage/MoEngageInitializer.h>
#import <MoEngageSDK/MoEngageSDK.h>
#endif

#if ENABLE_APPSFLYER
#import <AppsFlyerLib/AppsFlyerLib.h>
#import <AppsFlyerAttribution.h>
#endif

#if ENABLE_CLEVERTAP
#import <CleverTapReactManager.h>
#import <CleverTap.h>
#endif

#import "FloatingPreviewControls.h"

@implementation AppDelegate

- (NSURL *)docsJSBundleUrl {
  NSArray<NSURL *> *documentDirectories = [[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask];
  NSURL *documentsDirectory = [documentDirectories firstObject];
  NSURL *docBundlesDirectory = [documentsDirectory URLByAppendingPathComponent:@"bundles"];
  NSURL *mainJSBundleURL = [docBundlesDirectory URLByAppendingPathComponent:@"main.jsbundle"];
  if ([[NSFileManager defaultManager] fileExistsAtPath:[mainJSBundleURL path]]) {
    return mainJSBundleURL;
  } else {
    return Nil;
  }
}

- (void)resetToDefaultBundle {
  NSURL *bundleURL = [self docsJSBundleUrl];
  NSError *error;
  if (bundleURL != Nil) {
    [[NSFileManager defaultManager] removeItemAtURL:bundleURL error:&error];
  }
  
  if (error) {
    NSLog(@"Failed to delete bundle %@", error.localizedDescription);
  } else {
    RCTTriggerReloadCommandListeners(@"Preview App Unmount");
  }
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
#if ENABLE_CLEVERTAP
  [CleverTap autoIntegrate];
  [[CleverTapReactManager sharedInstance] applicationDidLaunchWithOptions:launchOptions];
#endif
  self.jsLoaded = NO;
  self.minDurationPassed = NO;
  self.moduleName = @"apptileSeed";
  self.initialProps = @{};
  
  [[RCTI18nUtil sharedInstance] allowRTL:NO];
  [[RCTI18nUtil sharedInstance] forceRTL:NO];
  
#if ENABLE_FIREBASE_ANALYTICS
  [FIRApp configure];
#endif

#if ENABLE_FBSDK
  [[FBSDKApplicationDelegate sharedInstance] application:application didFinishLaunchingWithOptions:launchOptions];
  [FBSDKApplicationDelegate.sharedInstance initializeSDK];
#endif
  
#if ENABLE_MOENGAGE
  NSString *moEngageAppId = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"MOENGAGE_APPID"];
  NSString *moEngageDataCenterString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"MOENGAGE_DATACENTER"];
  MoEngageDataCenter moEngageDataCenter;
  
  // TODO(gaurav) add the rest of the cases
  if ([moEngageDataCenterString isEqualToString:@"data_center_1"]) {
    moEngageDataCenter = MoEngageDataCenterData_center_01;
  } else if ([moEngageDataCenterString isEqualToString:@"data_center_2"]) {
    moEngageDataCenter = MoEngageDataCenterData_center_02;
  } else {
    moEngageDataCenter = MoEngageDataCenterData_center_default;
  }
  
  MoEngageSDKConfig* sdkConfig = [[MoEngageSDKConfig alloc] initWithAppId:moEngageAppId dataCenter: moEngageDataCenter];
  sdkConfig.consoleLogConfig = [[MoEngageConsoleLogConfig alloc] initWithIsLoggingEnabled:false loglevel:MoEngageLoggerTypeVerbose];
  [[MoEngageInitializer sharedInstance] initializeDefaultSDKConfig:sdkConfig andLaunchOptions:launchOptions];
#endif

  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];
  
  [self showNativeSplash];

  NSURL *mainJSBundleUrl = [self docsJSBundleUrl];
  if (mainJSBundleUrl != Nil) {
    FloatingPreviewControls *previewControls = [[FloatingPreviewControls alloc] initWithParentView:self.window.rootViewController.view];
    // [self addFloatingButton];
  }
  
  return result;
}

#define ENABLE_NATIVE_SPLASH 1
#define MIN_SPLASH_DURATION 1
#define MAX_SPLASH_DURATION 7

- (void)showNativeSplash {
#ifdef ENABLE_NATIVE_SPLASH
  // Register for a notification sent from RNApptile that is
  // originated from javascript side in order to remove splash
  NSString *JSReadyNotification = @"JSReadyNotification";
  [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(jsDidLoad:)
                                                 name:JSReadyNotification
                                               object:nil];
  RCTBridge *bridge = self.bridge;

  // Load the splash image or first frame of gif from bundle
  NSURL *pngURL = [[NSBundle mainBundle] URLForResource:@"splash" withExtension:@"png"];
  NSURLRequest *requestPng = [NSURLRequest requestWithURL:pngURL];
  RCTImageSource *pngImageSource = [[RCTImageSource alloc] initWithURLRequest:requestPng size:CGSizeZero scale:1.0];
  RCTImageView *rctImageView = [[RCTImageView alloc] initWithBridge:bridge];
  rctImageView.imageSources = @[pngImageSource];
#endif
#ifdef ENABLE_NATIVE_SPLASH_WITH_GIF
  // Load the gif from the bundle
  NSURL *gifURL = [[NSBundle mainBundle] URLForResource:@"splash" withExtension:@"gif"];
  NSURLRequest *request = [NSURLRequest requestWithURL:gifURL];
  RCTImageSource *imageSource = [[RCTImageSource alloc] initWithURLRequest:request size:CGSizeZero scale:1.0];
  
  // Replace first frame with gif after 500ms (required for LaunchScreen.storyboard fadeout animation)
  NSTimeInterval delayInSeconds = 0.5;
  dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
  dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
    if (self.splash != NULL) {
      [self.splash removeFromSuperview];
      [self.splash setImageSources:@[imageSource]];
      [self.window.rootViewController.view addSubview:self.splash];
    }
  });
#endif 
#ifdef ENABLE_NATIVE_SPLASH
  // Attempt to remove splash after minimum play duration
  NSTimeInterval minSplashDuration = MIN_SPLASH_DURATION + 0.5;
  dispatch_time_t minSplashTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(minSplashDuration * NSEC_PER_SEC));
  dispatch_after(minSplashTime, dispatch_get_main_queue(), ^(void){
    self.minDurationPassed = YES;
    if (self.splash != NULL && self.jsLoaded == YES) {
      [self.splash removeFromSuperview];
      self.splash = NULL;
    }
  });
  
  // Remove the splash after max duration if its not removed yet
  NSTimeInterval maxSplashDuration = MAX_SPLASH_DURATION + 0.5;
  dispatch_time_t maxSplashTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(maxSplashDuration * NSEC_PER_SEC));
  dispatch_after(maxSplashTime, dispatch_get_main_queue(), ^(void){
    if (self.splash != NULL) {
      [self.splash removeFromSuperview];
      self.splash = NULL;
    }
  });
  
  // append the splash image or gif to the window
  rctImageView.frame = self.window.frame;
  rctImageView.resizeMode = RCTResizeModeCover;
  self.splash = rctImageView;
  UIView *root = self.window.rootViewController.view;
  [root addSubview:rctImageView];
#endif
}

- (void)jsDidLoad:(NSNotification *) note
{
#ifdef ENABLE_NATIVE_SPLASH
  self.jsLoaded = YES;
  if (self.splash != NULL && self.minDurationPassed == YES) {
    [self.splash removeFromSuperview];
    self.splash = NULL;
  }
#endif
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  NSURL *url = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
  NSURL *mainJSBundleURL = [self docsJSBundleUrl];
  if (mainJSBundleURL == Nil) {
    mainJSBundleURL = url;
  }
  
  return mainJSBundleURL;
#else
  /*
  // Get the path to the Documents directory
  NSArray<NSURL *> *documentDirectories = [[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask];
  NSURL *documentsDirectory = [documentDirectories firstObject];

  // Create the file URL for main.jsbundle inside the bundles subdirectory
  NSURL *docBundlesDirectory = [documentsDirectory URLByAppendingPathComponent:@"bundles"];
  NSURL *mainJSBundleURL = [docBundlesDirectory URLByAppendingPathComponent:@"main.jsbundle"];

  // Check if the file exists at the specified URL
  if (![[NSFileManager defaultManager] fileExistsAtPath:[mainJSBundleURL path]]) {
      mainJSBundleURL = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  }
  return mainJSBundleURL;
  */
  NSURL *mainJSBundleURL = [self docsJSBundleUrl];
  if (mainJSBundleURL == Nil) {
    mainJSBundleURL = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  }
  return mainJSBundleURL;
#endif
}

- (BOOL)application:(UIApplication *)app openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
#if ENABLE_FBSDK
  if ([[FBSDKApplicationDelegate sharedInstance] application:app openURL:url options:options]) {
    return YES;
  }
#endif
  
#if ENABLE_APPSFLYER
  [[AppsFlyerAttribution shared] handleOpenUrl:url options:options];
#endif
  return [RCTLinkingManager application:app openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
#if ENABLE_APPSFLYER
  [[AppsFlyerAttribution shared] continueUserActivity:userActivity restorationHandler:restorationHandler];
#endif
 return [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
}

@end
