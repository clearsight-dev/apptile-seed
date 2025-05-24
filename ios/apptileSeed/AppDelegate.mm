#import "AppDelegate.h"

#import "CrashHandler.h"
#import "StartupHandler.h"
#import "apptileSeed-Swift.h"
#import "../FloatingPreviewControls.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTI18nUtil.h>
#import <React/RCTLinkingManager.h>

#if ENABLE_FIREBASE_ANALYTICS
#import <Firebase.h>
#endif



@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  // Setting up CrashHandlers
  [CrashHandler setupSignalHandlers];

  self.jsLoaded = NO;
  self.minDurationPassed = NO;
  self.moduleName = @"apptileSeed";
  self.initialProps = @{};

  [[RCTI18nUtil sharedInstance] allowRTL:NO];
  [[RCTI18nUtil sharedInstance] forceRTL:NO];

#if ENABLE_FIREBASE_ANALYTICS
  [FIRApp configure];
#endif

  return [super application:application
      didFinishLaunchingWithOptions:launchOptions];
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
  NSURL *pngURL = [[NSBundle mainBundle] URLForResource:@"splash"
                                          withExtension:@"png"];
  NSURLRequest *requestPng = [NSURLRequest requestWithURL:pngURL];
  RCTImageSource *pngImageSource =
      [[RCTImageSource alloc] initWithURLRequest:requestPng
                                            size:CGSizeZero
                                           scale:1.0];
  RCTImageView *rctImageView = [[RCTImageView alloc] initWithBridge:bridge];
  rctImageView.imageSources = @[ pngImageSource ];
#endif
#ifdef ENABLE_NATIVE_SPLASH_WITH_GIF
  // Load the gif from the bundle
  NSURL *gifURL = [[NSBundle mainBundle] URLForResource:@"splash"
                                          withExtension:@"gif"];
  NSURLRequest *request = [NSURLRequest requestWithURL:gifURL];
  RCTImageSource *imageSource =
      [[RCTImageSource alloc] initWithURLRequest:request
                                            size:CGSizeZero
                                           scale:1.0];

  // Replace first frame with gif after 500ms (required for
  // LaunchScreen.storyboard fadeout animation)
  NSTimeInterval delayInSeconds = 0.5;
  dispatch_time_t popTime = dispatch_time(
      DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
  dispatch_after(popTime, dispatch_get_main_queue(), ^(void) {
    if (self.splash != NULL) {
      [self.splash removeFromSuperview];
      [self.splash setImageSources:@[ imageSource ]];
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

- (void)jsDidLoad:(NSNotification *)note {
#ifdef ENABLE_NATIVE_SPLASH
  self.jsLoaded = YES;
  if (self.splash != NULL) {
    [self.splash removeFromSuperview];
    self.splash = NULL;
  }
#endif
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
  return [self getBundleURL];
}

- (NSURL *)getBundleURL {
  // --- Start: Logic for previewTracker.json ---
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSArray<NSURL *> *documentDirectories =
      [fileManager URLsForDirectory:NSDocumentDirectory
                          inDomains:NSUserDomainMask];
  NSURL *documentsDirectory = [documentDirectories firstObject];
  NSURL *previewTrackerURL =
      [documentsDirectory URLByAppendingPathComponent:@"previewTracker.json"];

  if ([fileManager fileExistsAtPath:[previewTrackerURL path]]) {
    NSError *readError = nil;
    NSData *trackerData = [NSData dataWithContentsOfURL:previewTrackerURL
                                                options:0
                                                  error:&readError];
    if (trackerData && !readError) {
      NSError *jsonError = nil;
      NSDictionary *trackerInfo =
          [NSJSONSerialization JSONObjectWithData:trackerData
                                          options:0
                                            error:&jsonError];
      if (trackerInfo && [trackerInfo isKindOfClass:[NSDictionary class]] &&
          !jsonError) {
        NSString *bundlePathString = trackerInfo[@"previewBundle"];
        if (bundlePathString &&
            [bundlePathString isKindOfClass:[NSString class]] &&
            bundlePathString.length > 0) {
          NSURL *bundleURL = [NSURL URLWithString:bundlePathString];
          if (bundleURL && [fileManager fileExistsAtPath:[bundleURL path]]) {
            NSLog(@"[ApptilePreview] ✅ Using preview bundle from "
                  @"previewTracker.json: %@",
                  [bundleURL path]);
            // Optionally, if using BundleTrackerPrefs, you might want to reset
            // or set its state here For now, directly returning the preview
            // bundle.
            
            // Add floating controls when the view is ready (with a slight delay to ensure the React view is loaded)
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
              [self addFloatingPreviewControls];
            });
            
            return bundleURL;
          } else {
            NSLog(@"[ApptilePreview] ⚠️ Preview bundle specified in "
                  @"previewTracker.json not found at: %@",
                  bundlePathString);
          }
        } else {
          NSLog(@"[ApptilePreview] ℹ️ 'previewBundle' not found or invalid in "
                @"previewTracker.json.");
        }
      } else if (jsonError) {
        NSLog(@"[ApptilePreview] ⚠️ Error parsing previewTracker.json: %@",
              jsonError.localizedDescription);
      }
    } else if (readError) {
      NSLog(@"[ApptilePreview] ⚠️ Error reading previewTracker.json: %@",
            readError.localizedDescription);
    }
  }
  // --- End: Logic for previewTracker.json ---

#if DEBUG
  // Remove any existing floating controls since we're not in preview mode
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.floatingControls) {
      [self.floatingControls removeFromSuperview];
      self.floatingControls = nil;
    }
  });
  
  return
      [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else

  // Get the path to the Documents directory
  // NSArray<NSURL *> *documentDirectories = [[NSFileManager defaultManager]
  // URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask]; NSURL
  // *documentsDirectory = [documentDirectories firstObject];

  // Construct the local bundle path
  NSURL *bundlesDir =
      [documentsDirectory URLByAppendingPathComponent:@"bundles"];
  NSURL *jsBundleFile =
      [bundlesDir URLByAppendingPathComponent:@"main.jsbundle"];

  if ([fileManager fileExistsAtPath:[jsBundleFile path]]) {
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

- (void)addFloatingPreviewControls {
  if (self.floatingControls) {
    [self.floatingControls removeFromSuperview];
    self.floatingControls = nil;
  }
  
  UIView *rootView = self.window.rootViewController.view;
  if (!rootView) {
    NSLog(@"[ApptilePreview] ⚠️ Cannot add floating controls - root view not available");
    return;
  }
  
  FloatingPreviewControls *controls = [[FloatingPreviewControls alloc] initWithParentView:rootView];
  controls.delegate = self;
  [rootView addSubview:controls];
  self.floatingControls = controls;
  
  NSLog(@"[ApptilePreview] ✅ Added floating preview controls");
}

#pragma mark - FloatingPreviewControlsDelegate

- (void)resetToDefaultBundle {
  NSLog(@"[ApptilePreview] 🔄 Resetting to default bundle");
  
  // Clear preview tracker
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSArray<NSURL *> *documentDirectories = [fileManager URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask];
  NSURL *documentsDirectory = [documentDirectories firstObject];
  NSURL *previewTrackerURL = [documentsDirectory URLByAppendingPathComponent:@"previewTracker.json"];
  
  if ([fileManager fileExistsAtPath:[previewTrackerURL path]]) {
    // Create an empty previewTracker.json with previewMode: false
    NSDictionary *emptyTracker = @{@"previewMode": @NO};
    NSError *writeError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:emptyTracker options:NSJSONWritingPrettyPrinted error:&writeError];
    
    if (jsonData && !writeError) {
      [jsonData writeToURL:previewTrackerURL atomically:YES];
      NSLog(@"[ApptilePreview] ✅ Reset previewTracker.json");
    }
  }
  
  // Restart the app
  exit(0);
}

@end
