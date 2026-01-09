//
//  ActionsHandler.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 02/03/25.
//

import Foundation
import React
import UIKit

typealias OTACompletionHandler = (Bool, String?) -> Void

@objc(Actions)
class Actions: NSObject {

    // MARK: - Startup Process Entry Point
    // Matches Android's startApptileAppProcess signature

    @objc static func startApptileAppProcess(
        _ completion: @escaping @convention(block) (Bool, String?) -> Void
    ) {
        OTAActions.startApptileAppProcess(
            onForceUpdate: { storeUrl in
                completion(true, storeUrl)
            },
            onProceed: {
                completion(false, nil)
            }
        )
    }

    // MARK: - Rollback

    @objc @discardableResult
    static func rollBackUpdates() -> Bool {
        let filesToDelete = [
            FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path,
            FileUtils.documentsDirectory.appendingPathComponent(APP_CONFIG_FILE_NAME).path,
            FileUtils.documentsDirectory.appendingPathComponent("bundles").path,
        ]

        var allDeleted = true
        for filePath in filesToDelete {
            if FileManager.default.fileExists(atPath: filePath) {
                if !FileUtils.deleteFile(filePath: filePath) {
                    allDeleted = false
                }
            }
        }

        if allDeleted {
            Logger.info("✅ Rollback Successfully Completed")
            BundleTrackerPrefs.resetBundleState()
            return true
        } else {
            Logger.error("❌ Rollback Failed")
            OTAToast.show(.ROLLBACK_FAILED)
            return false
        }
    }

    // MARK: - Update Alert Display

    @objc static func showUpdateRequiredAlertWithUrl(_ urlString: String?) {
        DispatchQueue.main.async {
            guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let rootViewController = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                Logger.error("Could not find root view controller to present update alert.")
                return
            }

            let title = "Update Required"
            let message = "An app update is available. Please update your app to continue using it with the best experience."

            let alertController = UIAlertController(title: title, message: message, preferredStyle: .alert)

            var finalUrlString = urlString
            if finalUrlString == nil || finalUrlString!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Logger.warn("App Store URL missing in manifest for update alert. Using fallback.")
                finalUrlString = "https://apps.apple.com/"
            }

            let updateAction = UIAlertAction(title: "Update", style: .default) { _ in
                guard let finalUrl = URL(string: finalUrlString!) else {
                    Logger.error("Invalid App Store URL string: \(finalUrlString ?? "nil")")
                    return
                }

                if UIApplication.shared.canOpenURL(finalUrl) {
                    UIApplication.shared.open(finalUrl, options: [:]) { success in
                        Logger.info(success ? "Opened App Store URL successfully." : "Failed to open App Store URL.")
                    }
                } else {
                    Logger.error("Cannot open App Store URL: \(finalUrl.absoluteString)")
                }
            }

            alertController.addAction(updateAction)
            rootViewController.present(alertController, animated: true, completion: nil)
        }
    }
}
