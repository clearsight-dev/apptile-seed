//
//  RestartHandler.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 13/03/25.
//

import Foundation
import React

class RestartHandler {
    static func loadDownloadedBundleAndRestart() {
        guard let window = getAppWindow() else {
            Logger.error("Failed to find the app window")
            return
        }

        if let bundlePath = getDownloadedBundlePath(),
           FileManager.default.fileExists(atPath: bundlePath.path)
        {
            Logger.success("Loading downloaded bundle from: \(bundlePath.path)")
            restartReactNativeApp(bundleURL: bundlePath, window: window)
        } else {
            Logger.warn("Downloaded bundle not found, falling back to default")
            loadDefaultBundleAndRestart()
        }
    }

    static func loadDefaultBundleAndRestart() {
        guard let window = getAppWindow() else {
            Logger.error("Failed to find the app window")
            return
        }

        let defaultBundleURL = getDefaultBundleURL()
        restartReactNativeApp(bundleURL: defaultBundleURL, window: window)
    }

    private static func restartReactNativeApp(bundleURL: URL, window: UIWindow) {
        Logger.info("Restarting React Native app")

        let rootView = RCTRootView(
            bundleURL: bundleURL,
            moduleName: "apptileSeed",
            initialProperties: nil,
            launchOptions: nil
        )

        let newRootVC = UIViewController()
        newRootVC.view = rootView

        // Smooth UI update to avoid flickering
        window.rootViewController = newRootVC
        window.makeKeyAndVisible()
    }

    private static func getAppWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }

    private static func getDownloadedBundlePath() -> URL? {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent("bundles/main.jsbundle")
    }

    private static func getDefaultBundleURL() -> URL {
        #if DEBUG
            return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index", fallbackResource: nil)
        #else
            return Bundle.main.url(forResource: "main", withExtension: "jsbundle")!
        #endif
    }
}
