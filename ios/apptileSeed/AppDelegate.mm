#import "AppDelegate.h"

#import <ImageIO/ImageIO.h>

#define ENABLE_NATIVE_SPLASH 1
// Fallback minimum when GIF_SPLASH_DURATION is missing from Info.plist.
#define MIN_SPLASH_DURATION 1
// Matches MainActivity.maxSplashDuration on Android. Purely a safety net for a
// JS boot that never signals ready — must stay well clear of a slow cold start.
#define MAX_SPLASH_DURATION 20

#import "CrashHandler.h"
#import "SplashScreenViewController.h"
#import "StartupHandler.h"
#import "apptileSeed-Swift.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTI18nUtil.h>
#import <React/RCTLinkingManager.h>

#if ENABLE_FIREBASE_ANALYTICS || ENABLE_KLAVIYO
#import <Firebase.h>
#endif

#if ENABLE_FBSDK
#import <AuthenticationServices/AuthenticationServices.h>
#import <SafariServices/SafariServices.h>
#import <FBSDKCoreKit/FBSDKCoreKit.h>
#import <FBSDKCoreKit/FBSDKCoreKit-Swift.h>
#endif

#if ENABLE_MOENGAGE
#import <MoEngageSDK/MoEngageSDK.h>
#import <ReactNativeMoEngage/MoEngageInitializer.h>
#endif

#if ENABLE_APPSFLYER
#import <AppsFlyerAttribution.h>
#import <AppsFlyerLib/AppsFlyerLib.h>
#endif

#if ENABLE_CLEVERTAP
#import <CleverTap.h>
#import <CleverTapReactManager.h>
#import <UserNotifications/UserNotifications.h>
#endif

#if ENABLE_KLAVIYO
#import <KlaviyoSwift/KlaviyoSwift-Swift.h>
#endif

@interface AppDelegate ()
- (BOOL)deliverDeepLinkURL:(NSURL *)url;
- (void)deepLinkListenerDidBecomeReady:(NSNotification *)note;
- (void)removeNativeSplashIfReady;
- (void)attachNativeSplash;
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  // Setting up CrashHandlers
  [CrashHandler setupSignalHandlers];

#if ENABLE_CLEVERTAP
  // Enable CleverTap debug logging
  [CleverTap setDebugLevel:CleverTapLogDebug];

  [CleverTap autoIntegrate];
  [[CleverTapReactManager sharedInstance]
      applicationDidLaunchWithOptions:launchOptions];

  // Log CleverTap initialization info
  NSLog(@"CleverTap: SDK initialized");
  NSString *cleverTapID = [[CleverTap sharedInstance] profileGetCleverTapID];
  NSLog(@"CleverTap: Initial Profile ID: %@", cleverTapID);
#endif
  self.jsLoaded = NO;
  self.deepLinkListenerReady = NO;
  // Registered before anything can start React Native, so a deeplink arriving during
  // startup is never missed. See deliverDeepLinkURL:.
  [[NSNotificationCenter defaultCenter]
      addObserver:self
         selector:@selector(deepLinkListenerDidBecomeReady:)
             name:@"ApptileDeepLinkListenerReadyNotification"
           object:nil];
  self.minDurationPassed = NO;
  self.moduleName = @"apptileSeed";
  self.initialProps = @{};

  [[RCTI18nUtil sharedInstance] allowRTL:NO];
  [[RCTI18nUtil sharedInstance] forceRTL:NO];

#if ENABLE_FIREBASE_ANALYTICS || ENABLE_KLAVIYO
  [FIRApp configure];
  NSLog(@"🔥 Firebase initialized");
#endif

#if ENABLE_KLAVIYO
  // Set the notification center delegate to receive push notifications
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;
  NSLog(@"🎹 Klaviyo: UNUserNotificationCenter delegate set");
#endif

#if ENABLE_FBSDK
  [[FBSDKApplicationDelegate sharedInstance] application:application
                           didFinishLaunchingWithOptions:launchOptions];
  [FBSDKApplicationDelegate.sharedInstance initializeSDK];
#endif

#if ENABLE_MOENGAGE
  NSString *moEngageAppId =
      [[NSBundle mainBundle] objectForInfoDictionaryKey:@"MOENGAGE_APPID"];
  NSString *moEngageDataCenterString =
      [[NSBundle mainBundle] objectForInfoDictionaryKey:@"MOENGAGE_DATACENTER"];
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

  MoEngageSDKConfig *sdkConfig =
      [[MoEngageSDKConfig alloc] initWithAppId:moEngageAppId
                                    dataCenter:moEngageDataCenter];
  sdkConfig.consoleLogConfig = [[MoEngageConsoleLogConfig alloc]
      initWithIsLoggingEnabled:false
                      loglevel:MoEngageLoggerTypeVerbose];
  [[MoEngageInitializer sharedInstance]
      initializeDefaultSDKConfig:sdkConfig
                andLaunchOptions:launchOptions];
#endif

  // storing launch option for later use while opening react native from startup
  // handler
  self.storedLaunchOptions = launchOptions;

  // Set SplashScreenViewController as the initial screen
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  SplashScreenViewController *splashScreenVC =
      [[SplashScreenViewController alloc] init];
  self.window.rootViewController = splashScreenVC;
  [self.window makeKeyAndVisible];
  [self attachNativeSplash];

  return YES;
}

// Function to start React Native manually after startup operations
- (void)startReactNativeApp:(UIApplication *)application
                withOptions:(NSDictionary *)launchOptions {
  NSLog(@"[ApptileStartupProcess] Starting React Native...");

  // Use stored launchOptions if not provided
  if (!launchOptions) {
    launchOptions = self.storedLaunchOptions;
  }

  BOOL result = [super application:application
      didFinishLaunchingWithOptions:launchOptions];
  [self showNativeSplash];

  if (result) {
    NSLog(@"[ApptileStartupProcess] React Native started successfully.");
  } else {
    NSLog(@"[ApptileStartupProcess] Failed to start React Native.");
  }
}

// One splash for the whole cold start, like the single Glide overlay on Android:
// created on the startup window the moment it is shown, kept above the window that
// RCTAppDelegate later creates for React Native, and removed only when JS is ready.
// A GIF splash is played natively from its first frame, so there is no static-PNG ->
// GIF restart, and no hand-off between separate splash views to flash through.
- (void)attachNativeSplash {
#ifdef ENABLE_NATIVE_SPLASH
  if (self.splash != nil) {
    return;
  }
  UIWindow *window = self.window;

  UIImageView *splashView = [[UIImageView alloc] initWithFrame:window.bounds];
  splashView.contentMode = UIViewContentModeScaleAspectFill;
  splashView.clipsToBounds = YES;
  splashView.autoresizingMask =
      UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  // Painted synchronously. For a GIF splash, splash.png is the GIF's first frame
  // (generated at setup), so this matches the launch screen exactly.
  NSURL *pngURL = [[NSBundle mainBundle] URLForResource:@"splash"
                                          withExtension:@"png"];
  if (pngURL != nil) {
    splashView.image = [UIImage imageWithContentsOfFile:[pngURL path]];
  }
  [window addSubview:splashView];
  self.splash = splashView;

  // RCTAppDelegate replaces self.window with a new window; hold this one and keep
  // it on top. Alerts presented from this window (mandatory update) are added
  // above this subview, so they still show.
  self.splashWindow = window;
  window.windowLevel = UIWindowLevelNormal + 1;

  // Play the GIF natively. ImageIO decodes frame by frame with the GIF's own
  // timing (holding every frame of a full-screen GIF in memory is not an option).
  // Only for apps whose configured splash is a GIF (APPTILE_SPLASH_IS_GIF, written at
  // setup): splash.gif is always in the bundle, as a placeholder for PNG-splash apps.
  BOOL splashIsGif = [[[NSBundle mainBundle]
      objectForInfoDictionaryKey:@"APPTILE_SPLASH_IS_GIF"] boolValue];
  NSURL *gifURL = splashIsGif ? [[NSBundle mainBundle] URLForResource:@"splash"
                                                        withExtension:@"gif"]
                              : nil;
  if (gifURL != nil) {
    self.stopSplashAnimation = NO;
    __weak UIImageView *weakSplashView = splashView;
    __weak AppDelegate *weakSelf = self;
    CGAnimateImageAtURLWithBlock(
        (__bridge CFURLRef)gifURL, nil,
        ^(size_t index, CGImageRef image, bool *stop) {
          AppDelegate *strongSelf = weakSelf;
          UIImageView *view = weakSplashView;
          if (strongSelf == nil || view == nil || strongSelf.stopSplashAnimation) {
            *stop = true;
            return;
          }
          view.image = [UIImage imageWithCGImage:image];
        });
  }

  // Same minimum as Android (GIF_SPLASH_DURATION, written to Info.plist at setup),
  // counted from launch; the maximum is a safety net for a JS boot that never
  // signals ready.
  double minDuration =
      [[[NSBundle mainBundle] objectForInfoDictionaryKey:@"GIF_SPLASH_DURATION"]
          doubleValue];
  if (minDuration <= 0) {
    minDuration = MIN_SPLASH_DURATION;
  }
  self.minDurationPassed = NO;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
                               (int64_t)(minDuration * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
                   self.minDurationPassed = YES;
                   [self removeNativeSplashIfReady];
                 });
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
                               (int64_t)(MAX_SPLASH_DURATION * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
                   self.minDurationPassed = YES;
                   self.jsLoaded = YES;
                   [self removeNativeSplashIfReady];
                 });
#endif
}

// Called once React Native has started. The splash is already on screen (see
// attachNativeSplash); just listen for JS to say it is ready.
- (void)showNativeSplash {
#ifdef ENABLE_NATIVE_SPLASH
  // Register for a notification sent from RNApptile that is
  // originated from javascript side in order to remove splash
  NSString *JSReadyNotification = @"JSReadyNotification";
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(jsDidLoad:)
                                               name:JSReadyNotification
                                             object:nil];
#endif
}

- (void)jsDidLoad:(NSNotification *)note {
  self.jsLoaded = YES;
#ifdef ENABLE_NATIVE_SPLASH
  [self removeNativeSplashIfReady];
#endif
}

// Mirrors MainActivity.deleteSplashImage on Android: the splash comes down only
// once JS has signalled ready AND the minimum play duration has elapsed.
- (void)removeNativeSplashIfReady {
#ifdef ENABLE_NATIVE_SPLASH
  if (self.splash == nil || !self.jsLoaded || !self.minDurationPassed) {
    return;
  }
  UIView *splashView = self.splash;
  UIWindow *splashWindow = self.splashWindow;
  self.splash = nil;
  self.splashWindow = nil;

  [UIView animateWithDuration:0.2
      animations:^{
        splashView.alpha = 0;
      }
      completion:^(BOOL finished) {
        self.stopSplashAnimation = YES;
        [splashView removeFromSuperview];
        // Hide the startup window only once React Native has its own window;
        // otherwise it still hosts SplashScreenViewController (e.g. behind the
        // mandatory-update alert).
        if (splashWindow != nil && splashWindow != self.window) {
          splashWindow.hidden = YES;
        }
      }];
#endif
}

// Javascript has subscribed to Linking's 'url' event, so anything we held back can
// now actually be delivered. Posted by RNApptile.markDeepLinkListenerReady.
- (void)deepLinkListenerDidBecomeReady:(NSNotification *)note {
  self.deepLinkListenerReady = YES;

  if (self.pendingDeepLinkURL == nil) {
    return;
  }

  NSURL *url = self.pendingDeepLinkURL;
  self.pendingDeepLinkURL = nil;
  NSLog(@"[Deeplink] JS is listening now, delivering held url: %@", url);
  [RCTLinkingManager application:[UIApplication sharedApplication]
                        openURL:url
                        options:@{}];
}

// Single funnel for every incoming deeplink (custom scheme, universal link, push
// notification). React Native is started asynchronously by StartupHandler, and even
// once the bridge exists RCTLinkingManager doesn't forward 'url' events until
// javascript has subscribed to them - urls delivered before that are posted as a
// notification that nobody observes and are gone for good, which is how cold-start
// deeplinks end up dumping the user on the home screen. So hold the url until
// javascript tells us it is listening.
- (BOOL)deliverDeepLinkURL:(NSURL *)url {
  if (url == nil) {
    return NO;
  }

  if (!self.deepLinkListenerReady) {
    NSLog(@"[Deeplink] JS is not listening yet, holding url: %@", url);
    self.pendingDeepLinkURL = url;
    return YES;
  }

  return [RCTLinkingManager application:[UIApplication sharedApplication]
                                openURL:url
                                options:@{}];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
  return [self bundleURL];
}

- (NSURL *)bundleURL {
  return [self getBundleURL];
}

- (NSURL *)getBundleURL {
#if DEBUG
  return
      [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  // Get the path to the Documents directory
  NSArray<NSURL *> *documentDirectories =
      [[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory
                                             inDomains:NSUserDomainMask];
  NSURL *documentsDirectory = [documentDirectories firstObject];

  // Construct the local bundle path
  NSURL *bundlesDir =
      [documentsDirectory URLByAppendingPathComponent:@"bundles"];
  NSURL *jsBundleFile =
      [bundlesDir URLByAppendingPathComponent:@"main.jsbundle"];

  if ([[NSFileManager defaultManager] fileExistsAtPath:[jsBundleFile path]]) {
    if ([BundleTrackerPrefs isBrokenBundle]) {
      NSLog(@"[ApptileStartupProcess] ⚠️ Previous local bundle failed. ✅ Using "
            @"embedded bundle.");
      [BundleTrackerPrefs resetBundleState];
      return [[NSBundle mainBundle] URLForResource:@"main"
                                     withExtension:@"jsbundle"];
    } else {
      [BundleTrackerPrefs resetBundleState];
      NSLog(@"[ApptileStartupProcess] ✅ Using local bundle: %@",
            [jsBundleFile path]);
      return jsBundleFile;
    }
  }

  NSLog(@"[ApptileStartupProcess] ⚠️ No local bundle found. ✅ Using embedded "
        @"bundle.");
  [BundleTrackerPrefs resetBundleState];

  return [[NSBundle mainBundle] URLForResource:@"main"
                                 withExtension:@"jsbundle"];
#endif
}

- (BOOL)application:(UIApplication *)app
            openURL:(NSURL *)url
            options:
                (NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
#if ENABLE_FBSDK
  if ([[FBSDKApplicationDelegate sharedInstance] application:app
                                                     openURL:url
                                                     options:options]) {
    return YES;
  }
#endif

#if ENABLE_APPSFLYER
  [[AppsFlyerAttribution shared] handleOpenUrl:url options:options];
#endif
  return [self deliverDeepLinkURL:url];
}

- (BOOL)application:(UIApplication *)application
    continueUserActivity:(nonnull NSUserActivity *)userActivity
      restorationHandler:
          (nonnull void (^)(NSArray<id<UIUserActivityRestoring>> *_Nullable))
              restorationHandler {
#if ENABLE_APPSFLYER
  [[AppsFlyerAttribution shared] continueUserActivity:userActivity
                                   restorationHandler:restorationHandler];
#endif
  // Always exclude account.* subdomain (Google login) - open in browser
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    NSURL *url = userActivity.webpageURL;
    if (url && ([url.scheme isEqualToString:@"http"] || [url.scheme isEqualToString:@"https"])) {
      NSString *host = url.host;
      if ([host hasPrefix:@"account."]) {
        [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
        return YES;
      }
      {
        NSArray<NSString *> *disabledPaths = [[NSBundle mainBundle]
            objectForInfoDictionaryKey:@"DisabledDeepLinkPaths"];
        if (disabledPaths) {
          NSString *path = url.path;
          for (NSString *disabledPath in disabledPaths) {
            if ([path hasPrefix:disabledPath] || [path containsString:disabledPath]) {
              [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
              return YES;
            }
          }
        }
      }
#if INTENT_FILTERS
      NSString *path = url.path;
      // Only handle /, /products/, /collections/ in app
      if ([path isEqualToString:@"/"] ||
          [path hasPrefix:@"/products"] ||
          [path hasPrefix:@"/collections"]) {
        return [self deliverDeepLinkURL:url];
      } else {
        // Open other URLs in browser
        [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
        return YES;
      }
#endif
    }
  }
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb] &&
      userActivity.webpageURL != nil) {
    return [self deliverDeepLinkURL:userActivity.webpageURL];
  }

  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

#if ENABLE_CLEVERTAP
// Remote notification Registration callback methods for CleverTap
- (void)application:(UIApplication *)application
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  // Convert device token to string for logging
  const unsigned char *tokenBytes = (const unsigned char *)[deviceToken bytes];
  NSMutableString *tokenString = [NSMutableString stringWithCapacity:deviceToken.length * 2];
  for (NSUInteger i = 0; i < deviceToken.length; i++) {
    [tokenString appendFormat:@"%02x", tokenBytes[i]];
  }
  NSLog(@"CleverTap: APNs Device Token: %@", tokenString);

  // Set push token with CleverTap
  [[CleverTap sharedInstance] setPushToken:deviceToken];

  // Log CleverTap Profile ID
  NSString *cleverTapID = [[CleverTap sharedInstance] profileGetCleverTapID];
  NSLog(@"CleverTap: Profile CleverTap ID: %@", cleverTapID);
}

- (void)application:(UIApplication *)application
    didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  NSLog(@"CleverTap: Failed to register for remote notifications: %@", error.localizedDescription);
}

// UserNotifications Framework Callback - Handle foreground notifications
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:
             (void (^)(UNNotificationPresentationOptions options))
                 completionHandler {
  // Display notification with sound, banner, and badge
  if (@available(iOS 14.0, *)) {
    completionHandler(UNNotificationPresentationOptionSound |
                      UNNotificationPresentationOptionList |
                      UNNotificationPresentationOptionBanner |
                      UNNotificationPresentationOptionBadge);
  } else {
    completionHandler(UNNotificationPresentationOptionSound |
                      UNNotificationPresentationOptionAlert |
                      UNNotificationPresentationOptionBadge);
  }
}

// Handle notification tap/response
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
    didReceiveNotificationResponse:(UNNotificationResponse *)response
             withCompletionHandler:(void (^)())completionHandler {
  NSDictionary *userInfo = response.notification.request.content.userInfo;

  // Handle the notification with CleverTap and open deep links
  [CleverTap handlePushNotification:userInfo openDeepLinksInForeground:YES];

  completionHandler();
}

// Handle background/silent notifications
- (void)application:(UIApplication *)application
    didReceiveRemoteNotification:(NSDictionary *)userInfo
          fetchCompletionHandler:
              (void (^)(UIBackgroundFetchResult))completionHandler {
  // Handle push notification with CleverTap
  [[CleverTap sharedInstance] handleNotificationWithData:userInfo];

  completionHandler(UIBackgroundFetchResultNewData);
}
#endif

#if ENABLE_MOENGAGE
// Remote notification Registration callback methods only if
// MoEngageAppDelegateProxyEnabled is NO
- (void)application:(UIApplication *)application
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [[MoEngageSDKMessaging sharedInstance] setPushToken:deviceToken];
}

- (void)application:(UIApplication *)application
    didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [[MoEngageSDKMessaging sharedInstance] didFailToRegisterForPush];
}

// UserNotifications Framework Callback
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:
             (void (^)(UNNotificationPresentationOptions options))
                 completionHandler {

  // This is to only to display Alert and enable notification sound
  completionHandler((UNNotificationPresentationOptionSound |
                     UNNotificationPresentationOptionBanner |
                     UNNotificationPresentationOptionBadge));
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
    didReceiveNotificationResponse:(UNNotificationResponse *)response
             withCompletionHandler:(void (^)())completionHandler {

  // Call only if MoEngageAppDelegateProxyEnabled is NO
  [[MoEngageSDKMessaging sharedInstance] userNotificationCenter:center
                                                     didReceive:response];

  // Custom Handling of notification if Any
  completionHandler();
}

// I don't the purpose of this moengage, but just keeping to close migration
- (void)application:(UIApplication *)application
    didReceiveRemoteNotification:(NSDictionary *)userInfo
          fetchCompletionHandler:
              (void (^)(UIBackgroundFetchResult))completionHandler {
  completionHandler(UIBackgroundFetchResultNewData);

  [[MoEngageSDKMessaging sharedInstance]
      didReceieveNotificationInApplication:application
                                  withInfo:userInfo];
}
#endif

#if ENABLE_KLAVIYO
// iOS Installation Step: Register device token with Klaviyo SDK
- (void)application:(UIApplication *)application
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  // Forward the APNs token to Klaviyo SDK for push notification registration
  [KlaviyoPushHelper setPushTokenWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application
    didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  NSLog(@"Klaviyo: Failed to register for remote notifications: %@", error.localizedDescription);
}
#endif

#if ENABLE_KLAVIYO
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  __block BOOL helperCalledCompletion = NO;

  // Forward the response to the Swift helper. Selector exposed to ObjC:
  // +[PushNotificationsHelper handleReceivingPushWithResponse:completionHandler:deepLinkHandler:]
  [KlaviyoPushHelper handleReceivingPushWithResponse:response
                                         completionHandler:^{
                                           helperCalledCompletion = YES;
                                           completionHandler();
                                         }
                                           deepLinkHandler:^(NSURL * _Nonnull url) {
                                             // Forward deep link to React Native
                                             [self deliverDeepLinkURL:url];
                                           }];

  // Fallback to ensure completion is called if helper doesn't invoke it
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    if (!helperCalledCompletion) {
      completionHandler();
    }
  });
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler
{
  if (@available(iOS 14.0, *)) {
    completionHandler(UNNotificationPresentationOptionList | UNNotificationPresentationOptionBanner);
  } else {
    completionHandler(UNNotificationPresentationOptionAlert);
  }
}
#endif
@end
