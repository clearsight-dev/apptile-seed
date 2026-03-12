package com.apptileseed.src.actions

import android.content.Context
import android.util.Log
import com.apptileseed.BuildConfig
import com.apptileseed.R
import com.apptileseed.src.apis.ApptileApiClient
import com.apptileseed.src.models.ManifestResponse
import com.apptileseed.src.ota.OTAErrorCode
import com.apptileseed.src.ota.OTAToast
import com.apptileseed.src.utils.APPTILE_LOG_TAG
import com.apptileseed.src.utils.BundleTrackerPrefs
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.util.zip.ZipInputStream

const val BUNDLE_TRACKER_FILE_NAME = "localBundleTracker.json"
const val APP_CONFIG_FILE_NAME = "appConfig.json"
const val FRAMEWORK_VERSION = "0.17.0"

data class ForceUpdateResult(
    val updateRequired: Boolean,
    val storeUrl: String? = null
)

object Actions {

    fun copyBundledAssetsToDocuments(context: Context) {
        try {
            val filesToCopy = listOf(APP_CONFIG_FILE_NAME, BUNDLE_TRACKER_FILE_NAME)

            for (fileName in filesToCopy) {
                val destFile = File(context.filesDir, fileName)
                if (!destFile.exists()) {
                    try {
                        context.assets.open(fileName).use { input ->
                            destFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        Log.d(APPTILE_LOG_TAG, "Copied $fileName from assets to filesDir")
                    } catch (e: Exception) {
                        Log.e(APPTILE_LOG_TAG, "Failed to copy $fileName: ${e.message}")
                        val errorCode = if (fileName == APP_CONFIG_FILE_NAME) {
                            OTAErrorCode.ASSET_COPY_CONFIG_FAILED
                        } else {
                            OTAErrorCode.ASSET_COPY_TRACKER_FAILED
                        }
                        OTAToast.show(context, errorCode)
                    }
                } else {
                    Log.d(APPTILE_LOG_TAG, "$fileName already exists in filesDir")
                }
            }
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to copy assets: ${e.message}")
        }
    }

    fun getActiveForkName(context: Context): String {
        val fallbackFork = try {
            context.getString(R.string.APPTILE_APP_FORK)
        } catch (e: Exception) {
            "main"
        }

        return try {
            val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
            if (!trackerFile.exists()) {
                Log.d(APPTILE_LOG_TAG, "Tracker file not found, using fallback fork: $fallbackFork")
                return fallbackFork
            }

            val content = trackerFile.readText()
            val mapType = object : TypeToken<MutableMap<String, Any>>() {}.type
            val tracker: MutableMap<String, Any> = Gson().fromJson(content, mapType)
            val forkName = tracker["activeForkName"] as? String

            if (forkName.isNullOrEmpty()) {
                Log.d(APPTILE_LOG_TAG, "activeForkName missing, adding fallback: $fallbackFork")
                tracker["activeForkName"] = fallbackFork
                try {
                    trackerFile.writeText(Gson().toJson(tracker))
                } catch (e: Exception) {
                    Log.e(APPTILE_LOG_TAG, "Failed to update tracker with fork: ${e.message}")
                }
                fallbackFork
            } else {
                Log.d(APPTILE_LOG_TAG, "Active fork from tracker: $forkName")
                forkName
            }
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Error reading tracker file: ${e.message}")
            OTAToast.show(context, OTAErrorCode.TRACKER_READ_FAILED)
            fallbackFork
        }
    }

    suspend fun checkForNavtiveForceUpdate(context: Context): ForceUpdateResult {
        return try {
            val appId = context.getString(R.string.APP_ID)
            if (appId.isNullOrEmpty() || appId == "YOUR_APPTILE_APP_ID") {
                Log.w(APPTILE_LOG_TAG, "APP_ID not configured, skipping force update check")
                return ForceUpdateResult(false)
            }

            val forkName = getActiveForkName(context)
            ApptileApiClient.init(context)
            val manifest: ManifestResponse = ApptileApiClient.service.getManifest(appId, forkName, FRAMEWORK_VERSION)

            val currentBuild = BuildConfig.VERSION_CODE
            val minimumBuild = manifest.latestBuildNumberAndroid

            Log.d(APPTILE_LOG_TAG, "Force update check: current=$currentBuild, minimum=$minimumBuild")

            if (minimumBuild != null && currentBuild < minimumBuild) {
                Log.w(APPTILE_LOG_TAG, "🚨 Force Update Required")
                OTAToast.show(context, OTAErrorCode.FORCE_UPDATE_REQUIRED)
                ForceUpdateResult(true, manifest.playStorePermanentLink)
            } else {
                ForceUpdateResult(false)
            }
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Force update check failed (fail-open): ${e.message}")
            ForceUpdateResult(false)
        }
    }

    private fun getLocalCommitId(context: Context): Long? {
        return try {
            val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
            if (!trackerFile.exists()) return null

            val content = trackerFile.readText()
            val mapType = object : TypeToken<Map<String, Any>>() {}.type
            val tracker: Map<String, Any> = Gson().fromJson(content, mapType)
            (tracker["publishedCommitId"] as? Number)?.toLong()
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to read local commitId: ${e.message}")
            null
        }
    }

    private fun getLocalBundleId(context: Context): Long? {
        return try {
            val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
            if (!trackerFile.exists()) return null

            val content = trackerFile.readText()
            val mapType = object : TypeToken<Map<String, Any>>() {}.type
            val tracker: Map<String, Any> = Gson().fromJson(content, mapType)
            (tracker["androidBundleId"] as? Number)?.toLong()
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to read local bundleId: ${e.message}")
            null
        }
    }

    fun updateTracker(context: Context, commitId: Long, bundleId: Long?) {
        try {
            val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
            val mapType = object : TypeToken<MutableMap<String, Any>>() {}.type
            val tracker: MutableMap<String, Any> = if (trackerFile.exists()) {
                Gson().fromJson(trackerFile.readText(), mapType)
            } else {
                mutableMapOf()
            }

            tracker["publishedCommitId"] = commitId
            if (bundleId != null) {
                tracker["androidBundleId"] = bundleId
            }

            trackerFile.writeText(Gson().toJson(tracker))
            Log.d(APPTILE_LOG_TAG, "Tracker updated: commitId=$commitId, bundleId=$bundleId")
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to update tracker: ${e.message}")
            OTAToast.show(context, OTAErrorCode.TRACKER_WRITE_FAILED)
        }
    }

    suspend fun downloadAppConfig(context: Context, manifest: ManifestResponse): Boolean {
        val timestamp = System.currentTimeMillis()
        val tempFile = File(context.filesDir, "appConfig_${timestamp}.tmp")

        return try {
            val appId = context.getString(R.string.APP_ID)
            val baseUrl = context.getString(R.string.APPTILE_UPDATE_ENDPOINT)
            val configUrl = if (!manifest.url.isNullOrEmpty()) {
                manifest.url
            } else {
                "$baseUrl/$appId/${manifest.forkName}/main/${manifest.publishedCommitId}.json"
            }
            Log.d(APPTILE_LOG_TAG, "Downloading appConfig from: $configUrl")

            val response = ApptileApiClient.service.downloadFile(configUrl)
            val destFile = File(context.filesDir, APP_CONFIG_FILE_NAME)

            tempFile.outputStream().use { output ->
                response.byteStream().use { input ->
                    input.copyTo(output)
                }
            }

            if (tempFile.length() == 0L) {
                Log.e(APPTILE_LOG_TAG, "Downloaded config is empty")
                OTAToast.show(context, OTAErrorCode.CONFIG_VERIFY_FAILED)
                return false
            }

            val moved = tempFile.renameTo(destFile)
            if (!moved) {
                Log.e(APPTILE_LOG_TAG, "Failed to move config to destination")
                OTAToast.show(context, OTAErrorCode.CONFIG_MOVE_FAILED)
                return false
            }

            Log.d(APPTILE_LOG_TAG, "AppConfig downloaded successfully")
            true
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to download appConfig: ${e.message}")
            OTAToast.show(context, OTAErrorCode.CONFIG_DOWNLOAD_FAILED)
            false
        } finally {
            if (tempFile.exists()) {
                tempFile.delete()
                Log.d(APPTILE_LOG_TAG, "Cleaned up temp config file")
            }
        }
    }

    private suspend fun downloadBundle(context: Context, bundleUrl: String): Boolean {
        val bundlesDir = File(context.filesDir, "bundles")
        if (!bundlesDir.exists()) {
            val created = bundlesDir.mkdirs()
            if (!created) {
                Log.e(APPTILE_LOG_TAG, "Failed to create bundles directory")
                OTAToast.show(context, OTAErrorCode.BUNDLE_DIR_CREATE_FAILED)
                return false
            }
        }

        val timestamp = System.currentTimeMillis()
        val tempZipFile = File(bundlesDir, "bundle_${timestamp}.zip")

        return try {
            Log.d(APPTILE_LOG_TAG, "Downloading bundle from: $bundleUrl")

            val response = ApptileApiClient.service.downloadFile(bundleUrl)

            // Download the zip file
            tempZipFile.outputStream().use { output ->
                response.byteStream().use { input ->
                    input.copyTo(output)
                }
            }

            if (tempZipFile.length() == 0L) {
                Log.e(APPTILE_LOG_TAG, "Downloaded bundle zip is empty")
                OTAToast.show(context, OTAErrorCode.BUNDLE_VERIFY_FAILED)
                return false
            }

            Log.d(APPTILE_LOG_TAG, "Bundle zip downloaded, extracting...")

            // Extract the zip file
            val extracted = extractBundleFromZip(context, tempZipFile, bundlesDir)
            if (!extracted) {
                Log.e(APPTILE_LOG_TAG, "Failed to extract bundle from zip")
                // Toast already shown in extractBundleFromZip
                return false
            }

            Log.d(APPTILE_LOG_TAG, "Bundle downloaded and extracted successfully")
            true
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to download bundle: ${e.message}")
            OTAToast.show(context, OTAErrorCode.BUNDLE_DOWNLOAD_FAILED)
            false
        } finally {
            if (tempZipFile.exists()) {
                tempZipFile.delete()
                Log.d(APPTILE_LOG_TAG, "Cleaned up temp zip file")
            }
        }
    }

    private fun extractBundleFromZip(context: Context, zipFile: File, destDir: File): Boolean {
        return try {
            ZipInputStream(zipFile.inputStream()).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    val fileName = entry.name
                    // Look for the bundle file (index.android.bundle or similar)
                    if (!entry.isDirectory && (fileName.endsWith(".bundle") || fileName == "index.android.bundle")) {
                        val destFile = File(destDir, "index.android.bundle")
                        destFile.outputStream().use { output ->
                            zis.copyTo(output)
                        }
                        zis.closeEntry()

                        // Verify extracted bundle is not empty
                        if (destFile.length() == 0L) {
                            Log.e(APPTILE_LOG_TAG, "Extracted bundle is empty")
                            OTAToast.show(context, OTAErrorCode.BUNDLE_EXTRACT_EMPTY)
                            destFile.delete()
                            return false
                        }

                        Log.d(APPTILE_LOG_TAG, "Extracted bundle: $fileName -> ${destFile.absolutePath} (${destFile.length()} bytes)")
                        return true
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
            Log.e(APPTILE_LOG_TAG, "No bundle file found in zip")
            OTAToast.show(context, OTAErrorCode.BUNDLE_VERIFY_FAILED)
            false
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to extract zip: ${e.message}")
            OTAToast.show(context, OTAErrorCode.BUNDLE_UNZIP_FAILED)
            false
        }
    }

    suspend fun checkAndDownloadOTAUpdate(context: Context): Boolean {
        return try {
            val appId = context.getString(R.string.APP_ID)
            if (appId.isNullOrEmpty() || appId == "YOUR_APPTILE_APP_ID") {
                Log.w(APPTILE_LOG_TAG, "APP_ID not configured, skipping OTA check")
                return false
            }

            val forkName = getActiveForkName(context)
            ApptileApiClient.init(context)

            val manifest = try {
                ApptileApiClient.service.getManifest(appId, forkName, FRAMEWORK_VERSION)
            } catch (e: Exception) {
                Log.e(APPTILE_LOG_TAG, "Failed to fetch manifest: ${e.message}")
                OTAToast.show(context, OTAErrorCode.MANIFEST_FETCH_FAILED)
                return false
            }

            val localCommitId = getLocalCommitId(context)
            val publishedCommitId = manifest.publishedCommitId

            Log.d(APPTILE_LOG_TAG, "OTA check: local=$localCommitId, remote=$publishedCommitId")

            if (localCommitId != null && localCommitId == publishedCommitId) {
                Log.d(APPTILE_LOG_TAG, "No OTA update needed")
                return false
            }

            Log.d(APPTILE_LOG_TAG, "🔄 OTA update available, downloading...")

            val configDownloaded = downloadAppConfig(context, manifest)
            if (!configDownloaded) return false

            val androidBundle = manifest.artefacts.find { it.type == "android-jsbundle" }
            var bundleId: Long? = null

            if (androidBundle != null) {
                val localBundleId = getLocalBundleId(context)
                if (localBundleId != androidBundle.id) {
                    Log.d(APPTILE_LOG_TAG, "Bundle update needed: local=$localBundleId, remote=${androidBundle.id}")
                    val bundleDownloaded = downloadBundle(context, androidBundle.cdnlink)
                    if (!bundleDownloaded) {
                        // Bundle download failed, don't update tracker
                        return false
                    }
                } else {
                    Log.d(APPTILE_LOG_TAG, "Bundle is up to date (id=${androidBundle.id}), skipping download")
                }
                bundleId = androidBundle.id
            }

            updateTracker(context, publishedCommitId, bundleId)
            Log.d(APPTILE_LOG_TAG, "✅ OTA update completed")
            true
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "OTA check failed (fail-open): ${e.message}")
            false
        }
    }

    /**
     * Detects if the APK has been upgraded (VERSION_CODE changed).
     * If so, clears the OTA bundle directory so that getJSBundleFile()
     * falls back to the newer embedded bundle shipped with the APK.
     */
    fun handleAppUpgrade(context: Context) {
        val currentVersionCode = BuildConfig.VERSION_CODE
        val lastKnownVersionCode = BundleTrackerPrefs.getLastKnownVersionCode()

        if (lastKnownVersionCode == currentVersionCode) {
            Log.d(APPTILE_LOG_TAG, "No APK upgrade detected (versionCode=$currentVersionCode)")
            return
        }

        Log.w(APPTILE_LOG_TAG, "🔄 APK upgrade detected: $lastKnownVersionCode -> $currentVersionCode")

        // Delete old OTA bundle so the app falls back to the embedded bundle
        val bundlesDir = File(context.filesDir, "bundles")
        if (bundlesDir.exists()) {
            val deleted = bundlesDir.deleteRecursively()
            Log.d(APPTILE_LOG_TAG, "Deleted OTA bundles directory: $deleted")
        }

        BundleTrackerPrefs.setLastKnownVersionCode(currentVersionCode)
        Log.d(APPTILE_LOG_TAG, "✅ APK upgrade cleanup complete")
    }

    suspend fun startApptileAppProcess(
        context: Context,
        onForceUpdate: (storeUrl: String?) -> Unit,
        onProceed: () -> Unit
    ) {
        Log.d(APPTILE_LOG_TAG, "========== APPTILE STARTUP PROCESS ==========")

        handleAppUpgrade(context)
        copyBundledAssetsToDocuments(context)

        val forceUpdateResult = checkForNavtiveForceUpdate(context)
        if (forceUpdateResult.updateRequired) {
            Log.w(APPTILE_LOG_TAG, "Force update required, redirecting to store")
            onForceUpdate(forceUpdateResult.storeUrl)
            return
        }

        checkAndDownloadOTAUpdate(context)

        Log.d(APPTILE_LOG_TAG, "Proceeding to app")
        onProceed()
    }
}
