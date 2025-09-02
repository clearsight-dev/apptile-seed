import React
import ReactAppDependencyProvider
import React_RCTAppDelegate
import UIKit

#if ENABLE_FIREBASE_ANALYTICS
    import Firebase
#endif

#if ENABLE_FBSDK
    import AuthenticationServices
    import SafariServices
    import FBSDKCoreKit
#endif

#if ENABLE_MOENGAGE
    import ReactNativeMoEngage
    import MoEngageSDK
#endif

#if ENABLE_APPSFLYER
    import AppsFlyerLib
    import AppsFlyerAttribution
#endif

#if ENABLE_CLEVERTAP
    import CleverTapReactManager
    import CleverTap
#endif

// Don't remove these flags. Used by build script
let ENABLE_NATIVE_SPLASH = 1
let MIN_SPLASH_DURATION: TimeInterval = 1.0
let MAX_SPLASH_DURATION: TimeInterval = 7.0

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    // Properties for splash functionality
    var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    var splash: RCTImageView?
    var minDurationPassed: Bool = false
    var jsLoaded: Bool = false

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {

        #if ENABLE_CLEVERTAP
            CleverTap.autoIntegrate()
            CleverTapReactManager.sharedInstance()?.applicationDidLaunch(withOptions: launchOptions)
        #endif

        self.jsLoaded = false
        self.minDurationPassed = false
        self.launchOptions = launchOptions

        // Disable RTL
        RCTI18nUtil.sharedInstance().allowRTL(false)
        RCTI18nUtil.sharedInstance().forceRTL(false)

        #if ENABLE_FIREBASE_ANALYTICS
            FirebaseApp.configure()
        #endif

        #if ENABLE_FBSDK
            FBSDKApplicationDelegate.sharedInstance?.application(
                application, didFinishLaunchingWithOptions: launchOptions)
            FBSDKApplicationDelegate.sharedInstance?.initializeSDK()
        #endif

        #if ENABLE_MOENGAGE
            guard
                let moEngageAppId = Bundle.main.object(forInfoDictionaryKey: "MOENGAGE_APPID")
                    as? String,
                let moEngageDataCenterString = Bundle.main.object(
                    forInfoDictionaryKey: "MOENGAGE_DATACENTER") as? String
            else {
                fatalError("MoEngage configuration missing in Info.plist")
            }

            let moEngageDataCenter: MoEngageDataCenter

            // TODO(gaurav) add the rest of the cases
            switch moEngageDataCenterString {
            case "data_center_1":
                moEngageDataCenter = .data_center_01
            case "data_center_2":
                moEngageDataCenter = .data_center_02
            default:
                moEngageDataCenter = .data_center_default
            }

            let sdkConfig = MoEngageSDKConfig(appId: moEngageAppId, dataCenter: moEngageDataCenter)
            sdkConfig.consoleLogConfig = MoEngageConsoleLogConfig(
                isLoggingEnabled: false, logLevel: .verbose)
            MoEngageInitializer.sharedInstance().initializeDefaultSDKConfig(
                sdkConfig, andLaunchOptions: launchOptions)
        #endif

        // Setup React Native
        let delegate = ReactNativeDelegate()
        let factory = RCTReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()

        self.reactNativeDelegate = delegate
        self.reactNativeFactory = factory

        window = UIWindow(frame: UIScreen.main.bounds)

        // Call super's implementation
        let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)

        factory.startReactNative(
            withModuleName: "apptileSeed",
            in: window,
            launchOptions: launchOptions
        )

        showNativeSplash()

        return result
    }

    func showNativeSplash() {
        #if ENABLE_NATIVE_SPLASH
            // Register for a notification sent from RNApptile that is
            // originated from javascript side in order to remove splash
            let jsReadyNotification = "JSReadyNotification"
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(jsDidLoad(_:)),
                name: NSNotification.Name(jsReadyNotification),
                object: nil
            )

            guard let bridge = reactNativeFactory?.bridge else { return }

            // Load the splash image or first frame of gif from bundle
            if let pngURL = Bundle.main.url(forResource: "splash", withExtension: "png") {
                let requestPng = URLRequest(url: pngURL)
                let pngImageSource = RCTImageSource(
                    urlRequest: requestPng, size: CGSize.zero, scale: 1.0)
                let rctImageView = RCTImageView(bridge: bridge)
                rctImageView.imageSources = [pngImageSource]

                #if ENABLE_NATIVE_SPLASH_WITH_GIF
                    // Load the gif from the bundle
                    if let gifURL = Bundle.main.url(forResource: "splash", withExtension: "gif") {
                        let request = URLRequest(url: gifURL)
                        let imageSource = RCTImageSource(
                            urlRequest: request, size: CGSize.zero, scale: 1.0)

                        // Replace first frame with gif after 500ms (required for LaunchScreen.storyboard fadeout animation)
                        let delayInSeconds: TimeInterval = 0.5
                        DispatchQueue.main.asyncAfter(deadline: .now() + delayInSeconds) {
                            if self.splash != nil {
                                self.splash?.removeFromSuperview()
                                self.splash?.imageSources = [imageSource]
                                if let rootView = self.window?.rootViewController?.view {
                                    rootView.addSubview(self.splash!)
                                }
                            }
                        }
                    }
                #endif

                // Attempt to remove splash after minimum play duration
                let minSplashDuration = MIN_SPLASH_DURATION + 0.5
                DispatchQueue.main.asyncAfter(deadline: .now() + minSplashDuration) {
                    self.minDurationPassed = true
                    if self.splash != nil && self.jsLoaded == true {
                        self.splash?.removeFromSuperview()
                        self.splash = nil
                    }
                }

                // Remove the splash after max duration if its not removed yet
                let maxSplashDuration = MAX_SPLASH_DURATION + 0.5
                DispatchQueue.main.asyncAfter(deadline: .now() + maxSplashDuration) {
                    if self.splash != nil {
                        self.splash?.removeFromSuperview()
                        self.splash = nil
                    }
                }

                // Append the splash image or gif to the window
                rctImageView.frame = window?.frame ?? UIScreen.main.bounds
                rctImageView.resizeMode = .cover
                self.splash = rctImageView

                if let rootView = window?.rootViewController?.view {
                    rootView.addSubview(rctImageView)
                }
            }
        #endif
    }

    @objc func jsDidLoad(_ notification: Notification) {
        #if ENABLE_NATIVE_SPLASH
            self.jsLoaded = true
            if self.splash != nil && self.minDurationPassed == true {
                self.splash?.removeFromSuperview()
                self.splash = nil
            }
        #endif
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {

        #if ENABLE_FBSDK
            if FBSDKApplicationDelegate.sharedInstance?.application(
                app, open: url, options: options) == true
            {
                return true
            }
        #endif

        #if ENABLE_APPSFLYER
            AppsFlyerAttribution.shared().handleOpen(url, options: options)
        #endif

        return RCTLinkingManager.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {

        #if ENABLE_APPSFLYER
            AppsFlyerAttribution.shared().continue(
                userActivity, restorationHandler: restorationHandler)
        #endif

        return RCTLinkingManager.application(
            application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return self.bundleURL()
    }

    override func bundleURL() -> URL? {
        #if DEBUG
            return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
            // Get the path to the Documents directory
            guard
                let documentsDirectory = FileManager.default.urls(
                    for: .documentDirectory, in: .userDomainMask
                ).first
            else {
                return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
            }

            // Create the file URL for main.jsbundle inside the bundles subdirectory
            let docBundlesDirectory = documentsDirectory.appendingPathComponent("bundles")
            let mainJSBundleURL = docBundlesDirectory.appendingPathComponent("main.jsbundle")

            // Check if the file exists at the specified URL
            if !FileManager.default.fileExists(atPath: mainJSBundleURL.path) {
                return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
            }

            return mainJSBundleURL
        #endif
    }
}
