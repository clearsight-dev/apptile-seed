//
//  BundleTracker.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 02/03/25.
//

import Foundation

@objc final class BundleTrackerPrefs: NSObject {
    private static let prefs = UserDefaults.standard
    private static let keyBundleLoadStatus = "is_bundle_broken"

    @objc static func isBrokenBundle() -> Bool {
        return prefs.bool(forKey: keyBundleLoadStatus)
    }

    @objc @discardableResult
    static func resetBundleState() -> Bool {
        Logger.info("Resetting bundle state")
        prefs.set(false, forKey: keyBundleLoadStatus)
        return prefs.synchronize()
    }

    @objc @discardableResult
    static func markCurrentBundleBroken() -> Bool {
        Logger.info("Marking bundle as broken")
        prefs.set(true, forKey: keyBundleLoadStatus)
        return prefs.synchronize()
    }
}
