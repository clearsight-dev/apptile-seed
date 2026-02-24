//
//  OTAActions.swift
//  apptileSeed
//
//  OTA update actions with toast error handling
//  Follows the same structure as Android implementation
//

import Foundation
import ZIPFoundation

let BUNDLE_TRACKER_FILE_NAME = "localBundleTracker.json"
let APP_CONFIG_FILE_NAME = "appConfig.json"
let FRAMEWORK_VERSION = "0.17.0"

struct ForceUpdateResult {
    let updateRequired: Bool
    let storeUrl: String?

    init(updateRequired: Bool, storeUrl: String? = nil) {
        self.updateRequired = updateRequired
        self.storeUrl = storeUrl
    }
}

final class OTAActions {

    // MARK: - Copy Bundled Assets to Documents

    static func copyBundledAssetsToDocuments() {
        let filesToCopy = [APP_CONFIG_FILE_NAME, BUNDLE_TRACKER_FILE_NAME]

        for fileName in filesToCopy {
            let destPath = FileUtils.documentsDirectory.appendingPathComponent(fileName).path

            if !FileManager.default.fileExists(atPath: destPath) {
                let success = FileUtils.copyAssetToDocuments(assetFileName: fileName, destinationFileName: fileName)
                if !success {
                    Logger.error("Failed to copy \(fileName) from assets")
                    let errorCode: OTAErrorCode = fileName == APP_CONFIG_FILE_NAME
                        ? .ASSET_COPY_CONFIG_FAILED
                        : .ASSET_COPY_TRACKER_FAILED
                    OTAToast.show(errorCode)
                } else {
                    Logger.info("Copied \(fileName) from assets to documents")
                }
            } else {
                Logger.info("\(fileName) already exists in documents")
            }
        }
    }

    // MARK: - Get Active Fork Name

    static func getActiveForkName() -> String {
        let fallbackFork = Bundle.main.object(forInfoDictionaryKey: "APPTILE_APP_FORK") as? String ?? "main"

        let trackerPath = FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path

        guard FileManager.default.fileExists(atPath: trackerPath) else {
            Logger.info("Tracker file not found, using fallback fork: \(fallbackFork)")
            return fallbackFork
        }

        guard let content = FileUtils.readFileContent(filePath: trackerPath),
              let data = content.data(using: .utf8),
              var tracker = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            Logger.error("Error reading tracker file")
            OTAToast.show(.TRACKER_READ_FAILED)
            return fallbackFork
        }

        if let forkName = tracker["activeForkName"] as? String, !forkName.isEmpty {
            Logger.info("Active fork from tracker: \(forkName)")
            return forkName
        }

        // Fork name missing, add fallback to tracker
        Logger.info("activeForkName missing, adding fallback: \(fallbackFork)")
        tracker["activeForkName"] = fallbackFork

        if let jsonData = try? JSONSerialization.data(withJSONObject: tracker, options: .prettyPrinted) {
            _ = FileUtils.saveFile(data: jsonData, filePath: trackerPath)
        }

        return fallbackFork
    }

    // MARK: - Get Local Commit ID

    private static func getLocalCommitId() -> Int64? {
        let trackerPath = FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path

        guard FileManager.default.fileExists(atPath: trackerPath),
              let content = FileUtils.readFileContent(filePath: trackerPath),
              let data = content.data(using: .utf8),
              let tracker = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return (tracker["publishedCommitId"] as? NSNumber)?.int64Value
    }

    // MARK: - Get Local Bundle ID

    private static func getLocalBundleId() -> Int64? {
        let trackerPath = FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path

        guard FileManager.default.fileExists(atPath: trackerPath),
              let content = FileUtils.readFileContent(filePath: trackerPath),
              let data = content.data(using: .utf8),
              let tracker = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return (tracker["iosBundleId"] as? NSNumber)?.int64Value
    }

    // MARK: - Update Tracker

    static func updateTracker(commitId: Int64, bundleId: Int64?) {
        let trackerPath = FileUtils.documentsDirectory.appendingPathComponent(BUNDLE_TRACKER_FILE_NAME).path

        var tracker: [String: Any]

        if let content = FileUtils.readFileContent(filePath: trackerPath),
           let data = content.data(using: .utf8),
           let existing = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            tracker = existing
        } else {
            tracker = [:]
        }

        tracker["publishedCommitId"] = commitId
        if let bundleId = bundleId {
            tracker["iosBundleId"] = bundleId
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: tracker, options: .prettyPrinted) else {
            Logger.error("Failed to serialize tracker data")
            OTAToast.show(.TRACKER_WRITE_FAILED)
            return
        }

        if FileUtils.saveFile(data: jsonData, filePath: trackerPath) {
            Logger.info("Tracker updated: commitId=\(commitId), bundleId=\(String(describing: bundleId))")
        } else {
            Logger.error("Failed to update tracker")
            OTAToast.show(.TRACKER_WRITE_FAILED)
        }
    }
    
    // MARK: - Check For Native Force Update

    static func checkForNativeForceUpdate(baseURL: String, appId: String) async -> ForceUpdateResult {
        guard !appId.isEmpty, appId != "YOUR_APPTILE_APP_ID" else {
            Logger.warn("APP_ID not configured, skipping force update check")
            return ForceUpdateResult(updateRequired: false)
        }

        let forkName = getActiveForkName()

        let result = await OTAApiClient.shared.fetchManifest(baseURL: baseURL, appId: appId, forkName: forkName)

        guard case .success(let manifest) = result else {
            Logger.error("Failed to fetch manifest for force update check")
            // Fail-open: don't block app if manifest fetch fails
            return ForceUpdateResult(updateRequired: false)
        }

        guard let currentBuildString = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String,
              let currentBuild = Int(currentBuildString),
              let minimumBuild = manifest.latestBuildNumberIos else {
            return ForceUpdateResult(updateRequired: false)
        }

        Logger.info("Force update check: current=\(currentBuild), minimum=\(minimumBuild)")

        if currentBuild < minimumBuild {
            Logger.warn("🚨 Force Update Required")
            OTAToast.show(.FORCE_UPDATE_REQUIRED)
            return ForceUpdateResult(updateRequired: true, storeUrl: manifest.appStorePermanentLink)
        }

        return ForceUpdateResult(updateRequired: false)
    }

    // MARK: - Download App Config

    static func downloadAppConfig(manifest: ManifestResponse, baseURL: String, appId: String) async -> Bool {
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        let tempFile = FileUtils.documentsDirectory.appendingPathComponent("appConfig_\(timestamp).tmp")
        let destFile = FileUtils.documentsDirectory.appendingPathComponent(APP_CONFIG_FILE_NAME)

        // Build config URL - use manifest.url if available, otherwise construct it
        let configUrl: String
        if !manifest.url.isEmpty {
            configUrl = manifest.url
        } else {
            configUrl = "\(baseURL)/\(appId)/\(manifest.forkName)/main/\(manifest.publishedCommitId).json"
        }

        Logger.info("Downloading appConfig from: \(configUrl)")

        let result = await OTAApiClient.shared.downloadFile(from: configUrl, to: tempFile.path)

        defer {
            // Cleanup temp file if it still exists
            if FileManager.default.fileExists(atPath: tempFile.path) {
                _ = FileUtils.deleteFile(filePath: tempFile.path)
                Logger.info("Cleaned up temp config file")
            }
        }

        switch result {
        case .failure(let error):
            Logger.error("Failed to download appConfig: \(error.localizedDescription)")
            OTAToast.show(.CONFIG_DOWNLOAD_FAILED)
            return false

        case .success(let downloadedPath):
            // Verify file is not empty
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: downloadedPath),
                  let size = attrs[.size] as? Int64, size > 0 else {
                Logger.error("Downloaded config is empty")
                OTAToast.show(.CONFIG_VERIFY_FAILED)
                return false
            }

            // Move temp to final (renameTo in Android)
            do {
                // Remove existing file first
                if FileManager.default.fileExists(atPath: destFile.path) {
                    try FileManager.default.removeItem(at: destFile)
                }
                try FileManager.default.moveItem(at: tempFile, to: destFile)
            } catch {
                Logger.error("Failed to move config to destination: \(error)")
                OTAToast.show(.CONFIG_MOVE_FAILED)
                return false
            }

            Logger.info("AppConfig downloaded successfully")
            return true
        }
    }

    // MARK: - Download Bundle

    private static func downloadBundle(bundleUrl: String) async -> Bool {
        let bundlesDir = FileUtils.documentsDirectory.appendingPathComponent("bundles")

        // Create bundles directory if needed
        if !FileManager.default.fileExists(atPath: bundlesDir.path) {
            do {
                try FileManager.default.createDirectory(at: bundlesDir, withIntermediateDirectories: true)
            } catch {
                Logger.error("Failed to create bundles directory: \(error)")
                OTAToast.show(.BUNDLE_DIR_CREATE_FAILED)
                return false
            }
        }

        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        let tempZipFile = bundlesDir.appendingPathComponent("bundle_\(timestamp).zip")

        defer {
            // Cleanup temp file
            if FileManager.default.fileExists(atPath: tempZipFile.path) {
                _ = FileUtils.deleteFile(filePath: tempZipFile.path)
                Logger.info("Cleaned up temp zip file")
            }
        }

        Logger.info("Downloading bundle from: \(bundleUrl)")

        let result = await OTAApiClient.shared.downloadFile(from: bundleUrl, to: tempZipFile.path)

        switch result {
        case .failure(let error):
            Logger.error("Failed to download bundle: \(error.localizedDescription)")
            OTAToast.show(.BUNDLE_DOWNLOAD_FAILED)
            return false

        case .success(let downloadedPath):
            // Verify zip is not empty
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: downloadedPath),
                  let size = attrs[.size] as? Int64, size > 0 else {
                Logger.error("Downloaded bundle zip is empty")
                OTAToast.show(.BUNDLE_VERIFY_FAILED)
                return false
            }

            Logger.info("Bundle zip downloaded (\(size) bytes), extracting...")

            // Extract the zip file
            let extracted = extractBundleFromZip(zipPath: tempZipFile.path, destDir: bundlesDir.path)
            if !extracted {
                Logger.error("Failed to extract bundle from zip")
                // Toast already shown in extractBundleFromZip
                return false
            }

            Logger.info("Bundle downloaded and extracted successfully")
            return true
        }
    }

    // MARK: - Extract Bundle From Zip

    private static func extractBundleFromZip(zipPath: String, destDir: String) -> Bool {
        do {
            let zipURL = URL(fileURLWithPath: zipPath)
            let tempExtractDir = FileUtils.documentsDirectory.appendingPathComponent("temp_extract_\(UUID().uuidString)")

            defer {
                // Cleanup temp extract directory
                if FileManager.default.fileExists(atPath: tempExtractDir.path) {
                    try? FileManager.default.removeItem(at: tempExtractDir)
                }
            }

            // Extract to temp directory first
            try FileManager.default.createDirectory(at: tempExtractDir, withIntermediateDirectories: true)
            try FileManager.default.unzipItem(at: zipURL, to: tempExtractDir)

            // Find the bundle file (main.jsbundle or similar)
            guard let bundleFile = findBundleFile(in: tempExtractDir.path) else {
                Logger.error("No bundle file found in zip")
                OTAToast.show(.BUNDLE_VERIFY_FAILED)
                return false
            }

            let destFile = URL(fileURLWithPath: destDir).appendingPathComponent("main.jsbundle")

            // Remove existing bundle if present
            if FileManager.default.fileExists(atPath: destFile.path) {
                try FileManager.default.removeItem(at: destFile)
            }

            // Move bundle file to destination
            try FileManager.default.moveItem(atPath: bundleFile, toPath: destFile.path)

            // Verify extracted bundle is not empty
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: destFile.path),
                  let size = attrs[.size] as? Int64, size > 0 else {
                Logger.error("Extracted bundle is empty")
                OTAToast.show(.BUNDLE_EXTRACT_EMPTY)
                try? FileManager.default.removeItem(at: destFile)
                return false
            }

            Logger.info("Extracted bundle: \(bundleFile) -> \(destFile.path) (\(size) bytes)")
            return true

        } catch {
            Logger.error("Failed to extract zip: \(error)")
            OTAToast.show(.BUNDLE_UNZIP_FAILED)
            return false
        }
    }

    // MARK: - Find Bundle File

    private static func findBundleFile(in directory: String) -> String? {
        guard let contents = try? FileManager.default.contentsOfDirectory(atPath: directory) else {
            return nil
        }

        for item in contents {
            let itemPath = (directory as NSString).appendingPathComponent(item)
            var isDirectory: ObjCBool = false

            if FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory) {
                if isDirectory.boolValue {
                    // Recursively search subdirectories
                    if let found = findBundleFile(in: itemPath) {
                        return found
                    }
                } else if item == "main.jsbundle" || item.hasSuffix(".jsbundle") {
                    return itemPath
                }
            }
        }
        return nil
    }

    // MARK: - Check And Download OTA Update

    static func checkAndDownloadOTAUpdate(baseURL: String, appId: String) async -> Bool {
        guard !appId.isEmpty, appId != "YOUR_APPTILE_APP_ID" else {
            Logger.warn("APP_ID not configured, skipping OTA check")
            return false
        }

        let forkName = getActiveForkName()

        // Fetch manifest
        let result = await OTAApiClient.shared.fetchManifest(baseURL: baseURL, appId: appId, forkName: forkName)

        guard case .success(let manifest) = result else {
            if case .failure(let error) = result {
                Logger.error("Failed to fetch manifest: \(error.localizedDescription)")
            }
            OTAToast.show(.MANIFEST_FETCH_FAILED)
            return false
        }

        let localCommitId = getLocalCommitId()
        let publishedCommitId = manifest.publishedCommitId

        Logger.info("OTA check: local=\(String(describing: localCommitId)), remote=\(publishedCommitId)")

        // Check if update is needed
        if let localCommitId = localCommitId, localCommitId == publishedCommitId {
            Logger.info("No OTA update needed")
            return false
        }

        Logger.info("🔄 OTA update available, downloading...")

        // Download config
        let configDownloaded = await downloadAppConfig(manifest: manifest, baseURL: baseURL, appId: appId)
        if !configDownloaded {
            return false
        }

        // Download bundle if available and ID has changed
        var bundleId: Int64? = nil
        if let iosBundle = manifest.artefacts.first(where: { $0.type == "ios-jsbundle" }) {
            let localBundleId = getLocalBundleId()
            if localBundleId != iosBundle.id {
                Logger.info("Bundle update needed: local=\(String(describing: localBundleId)), remote=\(iosBundle.id)")
                let bundleDownloaded = await downloadBundle(bundleUrl: iosBundle.cdnlink)
                if !bundleDownloaded {
                    // Bundle download failed, don't update tracker
                    return false
                }
            } else {
                Logger.info("Bundle is up to date (id=\(iosBundle.id)), skipping download")
            }
            bundleId = iosBundle.id
        }

        // Update tracker with both commitId and bundleId
        updateTracker(commitId: publishedCommitId, bundleId: bundleId)
        Logger.info("✅ OTA update completed")
        return true
    }

    // MARK: - Start Apptile App Process

    static func startApptileAppProcess(
        onForceUpdate: @escaping (String?) -> Void,
        onProceed: @escaping () -> Void
    ) {
        Task {
            Logger.info("========== APPTILE STARTUP PROCESS ==========")

            // Check if previous bundle was broken and rollback if needed
            if BundleTrackerPrefs.isBrokenBundle() {
                Logger.warn("Previous bundle status: failed, starting rollback")
                OTAToast.show(.ROLLBACK_TRIGGERED)
                Actions.rollBackUpdates()
            }

            // Copy bundled assets to documents
            copyBundledAssetsToDocuments()

            // Get required config
            guard let baseURL = Bundle.main.object(forInfoDictionaryKey: "APPTILE_UPDATE_ENDPOINT") as? String,
                  !baseURL.isEmpty else {
                Logger.error("APPTILE_UPDATE_ENDPOINT is missing in Info.plist")
                OTAToast.show(.MISSING_UPDATE_ENDPOINT)
                await MainActor.run { onProceed() }
                return
            }

            guard let appId = Bundle.main.object(forInfoDictionaryKey: "APP_ID") as? String,
                  !appId.isEmpty else {
                Logger.error("APP_ID is missing in Info.plist")
                OTAToast.show(.MISSING_APP_ID)
                await MainActor.run { onProceed() }
                return
            }

            // Check for force update
            let forceUpdateResult = await checkForNativeForceUpdate(baseURL: baseURL, appId: appId)
            if forceUpdateResult.updateRequired {
                Logger.warn("Force update required, redirecting to store")
                await MainActor.run { onForceUpdate(forceUpdateResult.storeUrl) }
                return
            }

            // Check and download OTA update
            _ = await checkAndDownloadOTAUpdate(baseURL: baseURL, appId: appId)

            Logger.info("Proceeding to app")
            await MainActor.run { onProceed() }
        }
    }
}

