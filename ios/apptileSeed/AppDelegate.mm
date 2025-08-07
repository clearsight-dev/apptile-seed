#import "AppDelegate.h"

#import "CrashHandler.h"
#import "StartupHandler.h"
#import "apptileSeed-Swift.h"
#import "SplashScreenViewController.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTI18nUtil.h>
#import <React/RCTEventEmitter.h>

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

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Setting up CrashHandlers
  [CrashHandler setupSignalHandlers];
  
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
  } else if ([moEngageDataCenterString isEqualToString:@"data_center_3"]) {
    moEngageDataCenter = MoEngageDataCenterData_center_03;
  } else {
    moEngageDataCenter = MoEngageDataCenterData_center_default;
  }
  
  MoEngageSDKConfig* sdkConfig = [[MoEngageSDKConfig alloc] initWithAppId:moEngageAppId dataCenter: moEngageDataCenter];
  sdkConfig.consoleLogConfig = [[MoEngageConsoleLogConfig alloc] initWithIsLoggingEnabled:false loglevel:MoEngageLoggerTypeVerbose];
  [[MoEngageInitializer sharedInstance] initializeDefaultSDKConfig:sdkConfig andLaunchOptions:launchOptions];
#endif
  
  // storing launch option for later use while opening react native from startup handler
  self.storedLaunchOptions = launchOptions;
  
  // Set SplashScreenViewController as the initial screen
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  SplashScreenViewController *splashScreenVC = [[SplashScreenViewController alloc] init];
  self.window.rootViewController = splashScreenVC;
  [self.window makeKeyAndVisible];
  
  return YES;
}


// Function to start React Native manually after startup operations
- (void)startReactNativeApp:(UIApplication *)application withOptions:(NSDictionary *)launchOptions
{
  NSLog(@"[ApptileStartupProcess] Starting React Native...");
  
  // Use stored launchOptions if not provided
  if (!launchOptions) {
    launchOptions = self.storedLaunchOptions;
  }
  
  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];
  [self showNativeSplash];
  
  if (result) {
    NSLog(@"[ApptileStartupProcess] React Native started successfully.");
  } else {
    NSLog(@"[ApptileStartupProcess] Failed to start React Native.");
  }
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
  if (self.splash != NULL) {
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
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  // Get the path to the Documents directory
  NSArray<NSURL *> *documentDirectories = [[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask];
  NSURL *documentsDirectory = [documentDirectories firstObject];
  
  // Construct the local bundle path
  NSURL *bundlesDir = [documentsDirectory URLByAppendingPathComponent:@"bundles"];
  NSURL *jsBundleFile = [bundlesDir URLByAppendingPathComponent:@"main.jsbundle"];
  
  if ([[NSFileManager defaultManager] fileExistsAtPath:[jsBundleFile path]]) {
    if ([BundleTrackerPrefs isBrokenBundle]) {
      NSLog(@"[ApptileStartupProcess] ⚠️ Previous local bundle failed. ✅ Using embedded bundle.");
      [BundleTrackerPrefs resetBundleState];
      return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    } else {
      [BundleTrackerPrefs resetBundleState];
      NSLog(@"[ApptileStartupProcess] ✅ Using local bundle: %@", [jsBundleFile path]);
      return jsBundleFile;
    }
  }
  
  NSLog(@"[ApptileStartupProcess] ⚠️ No local bundle found. ✅ Using embedded bundle.");
  [BundleTrackerPrefs resetBundleState];
  
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
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

#if ENABLE_MOENGAGE
//Remote notification Registration callback methods only if MoEngageAppDelegateProxyEnabled is NO
- (void)application:(UIApplication*)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData*)deviceToken {
  [[MoEngageSDKMessaging sharedInstance] setPushToken:deviceToken];
}

-(void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [[MoEngageSDKMessaging sharedInstance]didFailToRegisterForPush];
}

// UserNotifications Framework Callback
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
     willPresentNotification:(UNNotification *)notification
       withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler{

         //This is to only to display Alert and enable notification sound
         completionHandler((UNNotificationPresentationOptionSound
                     | UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionBadge));
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)())completionHandler{

           //Call only if MoEngageAppDelegateProxyEnabled is NO
           [[MoEngageSDKMessaging sharedInstance] userNotificationCenter:center didReceive:response];

           //Custom Handling of notification if Any
           completionHandler();
}


// I don't the purpose of this moengage, but just keeping to close migration
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  completionHandler(UIBackgroundFetchResultNewData);

  [[MoEngageSDKMessaging sharedInstance] didReceieveNotificationInApplication:application withInfo:userInfo];
}
#endif
@end
