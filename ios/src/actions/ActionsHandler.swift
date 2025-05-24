//
//  ActionsHandler.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 02/03/25.
//

import Foundation
import React

@objc(Actions)
class Actions: NSObject {
    static let APP_CONFIG_FILE_NAME = "appConfig.json"
    static let BUNDLE_TRACKER_FILE_NAME = "localBundleTracker.json"

    // MARK: - Startup Process Entry Point

    @objc static func startApptileAppProcess(
        _ completion: @escaping @convention(block) (Bool) -> Void
    ) {
        Task(priority: .background) {
            
            if BundleTrackerPrefs.isBrokenBundle() {
              Logger.warn("Previous bundle status: failed, starting rollback")
              rollBackUpdates()
            }
            
          
            guard let apptileUpdateEndpoint = Bundle.main.object(forInfoDictionaryKey: "APPTILE_UPDATE_ENDPOINT") as? String
                    else {
              Logger.error("APPTILE_UPDATE_ENDPOINT is missing or empty in Info.plist")
              completion(false)
              return
            }
                  
            APIClient.shared.initialize(baseURL: apptileUpdateEndpoint)

            guard let appId = getAppId(),
                  !appId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else {
                Logger.error("APP_ID is missing or empty in Info.plist")
                completion(false)
                return
            }

            Logger.info("Using App ID: \(appId)")

            if !isTrackerFilePresent() {
                guard copyInitialAssets() else {
                    Logger.error("Failed to copy initial assets.")
                    completion(false)
                    return
                }
            }

            let updateStatus = await performOTAUpdate(appId: appId)
            DispatchQueue.main.async {
                completion(updateStatus)
            }
        }
    }

    static func getAppId() -> String? {
        return Bundle.main.object(forInfoDictionaryKey: "APP_ID") as? String
    }

    private static func isTrackerFilePresent() -> Bool {
        let trackerFile = FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path
        return FileManager.default.fileExists(atPath: trackerFile)
    }

    private static func copyInitialAssets() -> Bool {
        let operations = [
            FileUtils.copyAssetToDocuments(assetFileName: APP_CONFIG_FILE_NAME, destinationFileName: APP_CONFIG_FILE_NAME),
            FileUtils.copyAssetToDocuments(assetFileName: BUNDLE_TRACKER_FILE_NAME, destinationFileName: BUNDLE_TRACKER_FILE_NAME),
        ]
        return operations.allSatisfy { $0 }
    }

    // MARK: OTA Handlers

    private static func performOTAUpdate(appId: String) async -> Bool {
        guard let manifest = await fetchManifest(appId: appId) else {
            Logger.error("Failed to fetch manifest.")
            return false
        }

        guard let trackerData = readTrackerFile() else {
            Logger.error("Failed to read tracker file.")
            return false
        }
      
        Logger.info("Current Local tracker data ✅ : \(trackerData)")
      
        return await handleUpdateIfNeeded(manifest: manifest, trackerData: trackerData, appId: appId)
    }

    static func fetchManifest(appId: String) async -> ManifestResponse? {
        do {
          guard let appForkName = Bundle.main.object(forInfoDictionaryKey: "APPTILE_APP_FORK") as? String else {
            Logger.error("APPTILE_APP_FORK is missing or empty in Info.plist")
            return nil
          }
          return try await ApptileApiClient.shared.getManifest(appId: appId, forkName: appForkName)
        } catch {
            Logger.error("Failed to fetch manifest: \(error.localizedDescription)")
            return nil
        }
    }

    private static func readTrackerFile() -> [String: Any]? {
        let trackerFilePath = FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path
        guard let dataString = FileUtils.readFileContent(filePath: trackerFilePath),
              let jsonData = dataString.data(using: .utf8)
        else { return nil }

        do {
            return try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]
        } catch {
            Logger.error("Error parsing tracker data: \(error)")
            return nil
        }
    }

    private static func handleUpdateIfNeeded(manifest: ManifestResponse, trackerData: [String: Any], appId: String) async -> Bool {
        let localCommitId = (trackerData["publishedCommitId"] as? NSNumber)?.int64Value
        let localBundleId = (trackerData["iosBundleId"] as? NSNumber)?.int64Value

        let latestCommitId = manifest.publishedCommitId
        let latestBundle = manifest.artefacts.first { $0.type == "ios-jsbundle" }

        let latestBundleId = latestBundle?.id
        let latestBundleUrl = latestBundle?.cdnlink
  
      
        let shouldUpdateCommit = latestCommitId != localCommitId
        let shouldUpdateBundle = latestBundleId != localBundleId && !(latestBundleUrl?.isEmpty ?? true)

        var updateResults: [Bool] = []

        if shouldUpdateCommit {
            Logger.info("Starting App Config update...")
            updateResults.append(await Actions.updateAppConfig(appId: appId, latestCommitId: latestCommitId))
        }

        if shouldUpdateBundle {
            Logger.info("Starting Bundle update...")
            updateResults.append(await Actions.updateBundle(bundleId: latestBundleId!, bundleUrl: latestBundleUrl))
        }
      
// Disabling temp: Restarting app incase of update found
//        if updateResults.contains(true) {
//            DispatchQueue.main.async {
//                applyUpdates()
//            }
//        }

        return updateResults.allSatisfy { $0 }
    }

    static func updateAppConfig(appId: String, latestCommitId: Int64) async -> Bool {
        let fetchUrl = "https://appconfigs.apptile.io"
        let downloadUrl = "\(fetchUrl)/\(appId)/main/main/\(latestCommitId).json"
        let tempAppConfigPath = FileUtils.documentsDirectory.appendingPathComponent("tempConfig.json").path
        let documentAppConfigPath = FileUtils.documentsDirectory.appendingPathComponent(Actions.APP_CONFIG_FILE_NAME).path

        // Cleanup temp file in case of failure
        defer {
            FileUtils.deleteFile(filePath: tempAppConfigPath)
        }

        // Step 1: Download & Verify
        guard await downloadAndVerify(url: downloadUrl, tempPath: tempAppConfigPath, expectedHash: "this_is_dummy_hash") else {
            Logger.error("App Config download or verification failed.")
            return false
        }

        // Step 2: Delete Old AppConfig
        FileUtils.deleteFile(filePath: documentAppConfigPath)

        // Step 3: Move Temp to AppConfig
        guard FileUtils.moveFile(sourcePath: tempAppConfigPath, destinationPath: documentAppConfigPath) else {
            Logger.error("Failed to move app config from temp to document path.")
            return false
        }

        // Step 4: Update Tracker File
        await updateTrackerFile(latestCommitId: latestCommitId, latestBundleId: nil)

        Logger.info("App Config updated successfully ✅")
        return true
    }

    private static func updateBundle(bundleId: Int64, bundleUrl: String?) async -> Bool {
        guard let bundleUrl = bundleUrl, let url = URL(string: bundleUrl) else {
            Logger.error("Invalid bundle URL")
            return false
        }

        let fileManager = FileUtils.fileManager
        let tempBundlePath = FileUtils.documentsDirectory.appendingPathComponent("tempBundles/bundle.zip")
        let tempBundleExtractPath = FileUtils.documentsDirectory.appendingPathComponent("tempBundles/unzipped")
        let destinationBundlesPath = FileUtils.documentsDirectory.appendingPathComponent("bundles")

        // Cleanup temp files in case of failure
        defer {
            Logger.info("Cleaning up temp bundle and extraction paths.")
            FileUtils.deleteFile(filePath: tempBundlePath.path)
            FileUtils.deleteFile(filePath: tempBundleExtractPath.path)
        }

        // Step 1: Create Directories
        guard FileUtils.createDirectoryIfNeeded(at: tempBundlePath.deletingLastPathComponent()) &&
            FileUtils.createDirectoryIfNeeded(at: tempBundleExtractPath)
        else {
            Logger.error("Failed to create temp directories.")
            return false
        }

        // Step 2: Download and Verify
        guard await downloadAndVerify(url: bundleUrl, tempPath: tempBundlePath.path, expectedHash: "this_is_dummy_hash") else {
            Logger.error("Bundle download or verification failed.")
            return false
        }

        // Step 3: Unzip the Bundle
        guard FileUtils.unzip(zipFilePath: tempBundlePath.path, destinationPath: tempBundleExtractPath.path) else {
            Logger.error("Failed to unzip bundle.")
            return false
        }

        // Step 4: Delete Existing Bundle Folder
        FileUtils.deleteFile(filePath: destinationBundlesPath.path)

        // Step 5: Move Unzipped Contents to Destination
        guard FileUtils.createDirectoryIfNeeded(at: destinationBundlesPath) else {
            Logger.error("Failed to create destination bundle path.")
            return false
        }
        FileUtils.copyDirectoryContents(sourcePath: tempBundleExtractPath.path, destinationPath: destinationBundlesPath.path)

        // Step 6: Update Tracker File
        await updateTrackerFile(latestCommitId: nil, latestBundleId: bundleId)

        Logger.info("Bundle updated successfully ✅")
        return true
    }

    static func downloadAndVerify(url: String, tempPath: String, expectedHash: String) async -> Bool {
        do {
            let downloadedPath = try await ApptileApiClient.shared.downloadFile(from: url).path

            defer {
                FileUtils.deleteFile(filePath: downloadedPath)
                Logger.info("Temp file deleted: \(downloadedPath)")
            }

            guard FileUtils.moveFile(sourcePath: downloadedPath, destinationPath: tempPath) else {
                Logger.error("Failed to move downloaded file to temp path")
                return false
            }

            guard FileUtils.verifyFileIntegrity(filePath: tempPath, expectedHash: expectedHash) else {
                Logger.error("Integrity check failed")
                FileUtils.deleteFile(filePath: tempPath)
                return false
            }

            return true
        } catch {
            Logger.error("Download error: \(error.localizedDescription)")
            return false
        }
    }

    static func updateTrackerFile(latestCommitId: Int64?, latestBundleId: Int64?) async {
        let trackerFilePath = FileUtils.documentsDirectory.appendingPathComponent(Actions.BUNDLE_TRACKER_FILE_NAME).path

        // Step 1: Read Tracker File Content
        guard let trackerContent = FileUtils.readFileContent(filePath: trackerFilePath),
              let data = trackerContent.data(using: .utf8),
              var trackerData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            Logger.info("Tracker file is empty or unreadable. Skipping update.")
            return
        }

        // Step 2: Update Tracker Data
        trackerData["publishedCommitId"] = latestCommitId ?? trackerData["publishedCommitId"]
        trackerData["iosBundleId"] = latestBundleId ?? trackerData["iosBundleId"]

        // Step 3: Serialize and Save Updated Data
        guard let jsonData = try? JSONSerialization.data(withJSONObject: trackerData, options: .prettyPrinted) else {
            Logger.error("Failed to serialize updated tracker data.")
            return
        }

        guard FileUtils.saveFile(data: jsonData, filePath: trackerFilePath) else {
            Logger.error("Failed to save updated tracker data.")
            return
        }
        Logger.info("Tracker file updated successfully ✅ : \(trackerData)")
    }

    // MARK: Update Handlers

    static func applyUpdates() {
        Logger.info("Applying Updates...")
        RestartHandler.loadDownloadedBundleAndRestart()
    }

    @objc static func rollBackUpdates() -> Bool {
        let filesToDelete = [
            FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path,
            FileUtils.documentsDirectory.appendingPathComponent(APP_CONFIG_FILE_NAME).path,
            FileUtils.documentsDirectory.appendingPathComponent("bundles").path,
        ]

        let isDeletedSuccessfully = filesToDelete.allSatisfy { FileUtils.deleteFile(filePath: $0) }

        if isDeletedSuccessfully {
            Logger.info("✅ Rollback Successfully Completed")
            BundleTrackerPrefs.resetBundleState()
            return true
        } else {
            Logger.error("❌ Rollback Failed")
            return false
        }
    }
}
