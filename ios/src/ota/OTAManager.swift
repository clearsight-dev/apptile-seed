//
//  OTAManager.swift
//  apptileSeed
//
//  Native module for OTA updates and app restart on iOS.
//  Exposes restartApp() to React Native for fork switching.
//
//  Uses centralized OTA logic from OTAActions and RCTTriggerReloadCommandListeners
//  for restart (same approach as react-native-ota-hot-update).
//

import Foundation
import React

@objc(OTAManager)
class OTAManager: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }

    /// Restart the app with OTA update check.
    /// This is called from React Native when switching forks.
    /// The JS side has already updated the localBundleTracker.json with the new activeForkName.
    ///
    /// Flow:
    /// 1. JS updates activeForkName in localBundleTracker.json
    /// 2. JS calls restartApp()
    /// 3. Native checks for OTA update using OTAActions.checkAndDownloadOTAUpdate()
    /// 4. If update available, downloads new appConfig + bundle for the new fork
    /// 5. Triggers React Native reload via RCTTriggerReloadCommandListeners
    /// 6. React Native calls AppDelegate.bundleURL() which returns the new bundle
    /// 7. React Native starts fresh and reads new appConfig from Documents
    @objc
    func restartApp() {
        Logger.info("[OTAManager] restartApp called from JS")

        Task {
            await performOTACheckAndRestart()
        }
    }

    private func performOTACheckAndRestart() async {
        // Get base URL and app ID from Info.plist
        guard let baseURL = Bundle.main.object(forInfoDictionaryKey: "APPTILE_UPDATE_ENDPOINT") as? String,
              !baseURL.isEmpty else {
            Logger.error("[OTAManager] APPTILE_UPDATE_ENDPOINT not configured")
            await triggerReload()
            return
        }

        guard let appId = Bundle.main.object(forInfoDictionaryKey: "APP_ID") as? String,
              !appId.isEmpty, appId != "YOUR_APPTILE_APP_ID" else {
            Logger.error("[OTAManager] APP_ID not configured")
            await triggerReload()
            return
        }

        Logger.info("[OTAManager] Checking for OTA updates before restart...")

        // Use centralized OTA logic - this reads activeForkName from tracker
        // (which JS already updated) and downloads config + bundle for that fork
        let success = await OTAActions.checkAndDownloadOTAUpdate(baseURL: baseURL, appId: appId)

        if success {
            Logger.success("[OTAManager] OTA update downloaded, restarting with new bundle")
        } else {
            Logger.info("[OTAManager] No OTA update or download failed, restarting with current bundle")
        }

        await triggerReload()
    }

    private func triggerReload() async {
        await MainActor.run {
            Logger.info("[OTAManager] Triggering React Native reload...")
            // Uses RCTTriggerReloadCommandListeners which causes React Native to:
            // 1. Call AppDelegate.bundleURL() to get the bundle path
            // 2. Load the bundle (new or existing)
            // 3. Start fresh, reading appConfig from Documents
            RestartHandler.triggerReload()
        }
    }
}

