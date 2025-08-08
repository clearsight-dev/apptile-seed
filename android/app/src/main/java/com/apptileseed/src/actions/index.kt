package com.apptileseed.src.actions

import android.content.Context
import android.content.Intent
import android.util.Log
import com.apptileseed.BuildConfig
import com.apptileseed.MainActivity
import com.apptileseed.MainApplication
import com.apptileseed.R
import com.apptileseed.src.apis.ApptileApiClient
import com.apptileseed.src.utils.APPTILE_LOG_TAG
import com.apptileseed.src.utils.BundleTrackerPrefs
import com.apptileseed.src.utils.copyAssetToDocuments
import com.apptileseed.src.utils.copyDirectoryContents
import com.apptileseed.src.utils.deleteFile
import com.apptileseed.src.utils.moveFile
import com.apptileseed.src.utils.readFileContent
import com.apptileseed.src.utils.saveFile
import com.apptileseed.src.utils.unzip
import com.apptileseed.src.utils.verifyFileIntegrity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

object Actions {
    const val APP_CONFIG_FILE_NAME = "appConfig.json"
    const val BUNDLE_TRACKER_FILE_NAME = "localBundleTracker.json"

    private suspend fun fetchManifest(appId: String, context: Context) = withContext(Dispatchers.IO) {
        try {
            val forkName = context.getString(R.string.APPTILE_APP_FORK)
            ApptileApiClient.service.getManifest(appId, forkName, "0.17.0") // hardcoding framework version
//              ApptileApiClient.service.getManifest(appId)
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Failed to fetch manifest: ${e.message}", e)
            null
        }
    }

    private suspend fun downloadAndVerify(
        url: String, tempPath: String, expectedHash: String
    ): Boolean {
        val downloadResponse = ApptileApiClient.service.downloadFile(url)

        if (downloadResponse.contentLength() == 0L) {
            Log.e(APPTILE_LOG_TAG, "Download failed: Empty response")
            return false
        }

        if (!saveFile(downloadResponse, tempPath)) {
            Log.e(APPTILE_LOG_TAG, "Failed to save downloaded file")
            return false
        }

        if (!verifyFileIntegrity(tempPath, expectedHash)) {
            Log.e(APPTILE_LOG_TAG, "Integrity check failed")
            deleteFile(tempPath)
            return false
        }

        return true
    }

    private suspend fun updateAppConfig(
        context: Context, appId: String, latestCommitId: Long
    ): Boolean {
        val fetchUrl = context.getString(R.string.APPTILE_UPDATE_ENDPOINT)
        val downloadUrl = "$fetchUrl/$appId/main/main/$latestCommitId.json"
        val tempAppConfigPath = File(context.filesDir, "tempConfig.json").absolutePath
        val documentAppConfigPath = File(context.filesDir, APP_CONFIG_FILE_NAME).absolutePath

        return try {
            if (!downloadAndVerify(
                    downloadUrl, tempAppConfigPath, "this_is_dummy_hash"
                )
            ) return false
            deleteFile(documentAppConfigPath)
            moveFile(tempAppConfigPath, documentAppConfigPath)
            updateTrackerFile(context, latestCommitId, null)
            Log.d(APPTILE_LOG_TAG, "AppConfig updated successfully")
            true
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Error updating AppConfig: ${e.message}", e)
            false
        } finally {
            Log.d(APPTILE_LOG_TAG, "Cleaning up temp app config path")
            deleteFile(tempAppConfigPath)
        }
    }

    private suspend fun updateBundle(
        context: Context, bundleId: Long, bundleUrl: String?
    ): Boolean {
        if (bundleUrl == null) return false
        val tempBundlePath =
            File(context.filesDir, "tempBundles/bundle.zip").apply { parentFile?.mkdirs() }
        val tempBundleExtractPath =
            File(context.filesDir, "tempBundles/unzipped").apply { mkdirs() }
        val destinationBundlesPath = File(context.filesDir, "bundles")

        return try {
            if (!downloadAndVerify(
                    bundleUrl, tempBundlePath.absolutePath, "this_is_dummy_hash"
                )
            ) return false

            if (!unzip(tempBundlePath.absolutePath, tempBundleExtractPath.absolutePath)) {
                Log.e(APPTILE_LOG_TAG, "Failed to unzip the bundle")
                return false
            }

            if (destinationBundlesPath.exists()) {
                Log.d(
                    APPTILE_LOG_TAG,
                    "Deleting existing bundle files from : ${destinationBundlesPath.absolutePath}"
                )
                destinationBundlesPath.deleteRecursively()
            }

            destinationBundlesPath.mkdirs()
            copyDirectoryContents(tempBundleExtractPath, destinationBundlesPath)
            updateTrackerFile(context, null, bundleId)
            Log.d(APPTILE_LOG_TAG, "Bundle updated successfully")
            true
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "Error updating bundle: ${e.message}", e)
            false
        } finally {
            Log.d(APPTILE_LOG_TAG, "Cleaning up temp bundles path & temp extraction path")
            deleteFile(tempBundlePath.absolutePath)
            tempBundleExtractPath.deleteRecursively()
        }
    }

    private suspend fun updateTrackerFile(
        context: Context, latestCommitId: Long?, latestBundleId: Long?
    ) {
        val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
        val trackerData = readFileContent(trackerFile.absolutePath)

        trackerData?.let {
            val mapType = object : TypeToken<Map<String, Any>>() {}.type
            val existingTrackerData: MutableMap<String, Any> = Gson().fromJson(it, mapType)

            latestCommitId?.let { commitId -> existingTrackerData["publishedCommitId"] = commitId }
            latestBundleId?.let { bundleId -> existingTrackerData["androidBundleId"] = bundleId }

            val newTrackerConfig = Gson().toJson(existingTrackerData)
            Log.d(
                APPTILE_LOG_TAG, "Writing tracker config to local bundle tracker $newTrackerConfig"
            )
            trackerFile.writeText(newTrackerConfig)
        }
    }

    // Function to check for Over-The-Air updates
    // Returns a Pair: (Boolean -> update required?, String? -> app store URL)
    // true in Boolean means MainActivity start should be prevented
    private suspend fun checkForOTA(appId: String, context: Context): Pair<Boolean, String?> = withContext(Dispatchers.IO) {
        val manifest = fetchManifest(appId, context) ?: return@withContext Pair(false, null) // Return false, null URL if manifest fetch fails
        var updateRequired = false
        var updateUrl: String? = null

        val latestBuildNumberAndroid = manifest.latestBuildNumberAndroid
        if (latestBuildNumberAndroid == null) {
            Log.d(APPTILE_LOG_TAG, "OTA Check: No latestBuildNumberAndroid in manifest.")
            return@withContext Pair(updateRequired, updateUrl) // Return false, null URL if no Android build number
        }

        val currentBuildNumber = BuildConfig.VERSION_CODE

        // *** Core Check ***
        if (currentBuildNumber < latestBuildNumberAndroid) {
            Log.i(APPTILE_LOG_TAG, "OTA Check: Found newer build ($latestBuildNumberAndroid > $currentBuildNumber). App restart will be prevented.")
            // Indicate update needed, return the app store URL from manifest
            updateRequired = true
            updateUrl = manifest.playStorePermanentLink
            return@withContext Pair(updateRequired, updateUrl)
        }

        Log.d(APPTILE_LOG_TAG, "OTA Check: Current build ($currentBuildNumber) is up-to-date or newer than manifest ($latestBuildNumberAndroid). Checking bundle/commit.")

        // Continue with commit/bundle check ONLY if build number is sufficient
        val trackerData =
            readFileContent(File(context.filesDir, BUNDLE_TRACKER_FILE_NAME).absolutePath)

        trackerData?.let {
            val mapType = object : TypeToken<Map<String, Any>>() {}.type
            val parsedTrackerData: Map<String, Any>? = Gson().fromJson(it, mapType)

            val localCommitId = (parsedTrackerData?.get("publishedCommitId") as? Number)?.toLong()
            val latestCommitId = manifest.publishedCommitId

            val bundle = manifest.artefacts.find { it.type == "android-jsbundle" }
            val localBundleId = (parsedTrackerData?.get("androidBundleId") as? Number)?.toLong()
            val latestBundleId = bundle?.id
            val latestBundleUrl = bundle?.cdnlink

            Log.d(
                APPTILE_LOG_TAG,
                "OTA Check: latestCommitId=$latestCommitId, localCommitId=$localCommitId, " + "localAndroidBundleId=$localBundleId, latestAndroidBundleId=$latestBundleId"
            )

            if (latestCommitId != null && latestBundleId != null) {

                val shouldUpdateCommit = latestCommitId != localCommitId
                val shouldUpdateBundle =
                    latestBundleId != localBundleId && !latestBundleUrl.isNullOrBlank()

                if (shouldUpdateBundle || shouldUpdateCommit) {
                    val updateStatus = mutableListOf<Boolean>()
                    if (shouldUpdateCommit) updateStatus.add(
                        updateAppConfig(
                            context,
                            appId,
                            latestCommitId
                        )
                    )
                    if (shouldUpdateBundle) updateStatus.add(
                        updateBundle(
                            context, latestBundleId, latestBundleUrl
                        )
                    )

                    // dev roll to make sure published bundle is always working
                    if (updateStatus.all { status -> status }) {
                        applyUpdates(context)
                    } else {
                        Log.e(APPTILE_LOG_TAG, "Update failed. App restart skipped.")
                    }
                }

            }
        }

        // If we reach here, it means currentBuildNumber >= latestBuildNumberAndroid and bundle checks are done (or not needed)
        return@withContext Pair(updateRequired, updateUrl) // Indicate no build number update needed, null URL
    }

    private fun restartReactNativeApp(context: Context) {
        Log.d(APPTILE_LOG_TAG, "Restarting React Native app")
        val intent = Intent(context, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(intent)
        Runtime.getRuntime().exit(0)
    }

    private suspend fun applyUpdates(context: Context) {
        withContext(Dispatchers.Main) {
            Log.i(APPTILE_LOG_TAG, "Reinitialize React Native instance manager from apply updates")
            (context.applicationContext as? MainApplication)?.resetReactNativeHost()
        }
    }

    suspend fun rollBackUpdates(context: Context): Boolean {
        return try {
            val filesDir = context.filesDir

            val filesToDelete = listOf(
                File(filesDir, BUNDLE_TRACKER_FILE_NAME),
                File(filesDir, APP_CONFIG_FILE_NAME),
                File(filesDir, "bundles")
            )

            val deletionResults = filesToDelete.map { file ->
                val success =
                    if (file.isDirectory) file.deleteRecursively() else deleteFile(file.absolutePath)
                if (!success) Log.e(APPTILE_LOG_TAG, "Failed to delete: ${file.absolutePath}")
                success
            }

            return if (deletionResults.all { it }) {
                Log.d(APPTILE_LOG_TAG, "✅ Rollback Successfully Completed")
                BundleTrackerPrefs.resetBundleState()
                true
            } else {
                Log.e(APPTILE_LOG_TAG, "❌ Rollback Failed")
                false
            }
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "❌ Error while rolling back: ${e.message}", e)
            false
        }
    }

    /**
     * Orchestrates the startup process: copies initial assets if needed, checks for OTA updates,
     * and potentially applies them.
     *
     * @param appId The application ID.
     * @param context The application context.
     * @return Pair<Boolean, String?> True if checkForOTA determined MainActivity start should be prevented, String? is the potential update URL.
     */
    suspend fun startApptileAppProcess(appId: String, context: Context): Pair<Boolean, String?> =
        withContext(Dispatchers.IO) {
            // Default to no update needed, null URL
            var updateRequired = false
            var updateUrl = null
            var otaResult: Pair<Boolean, String?> = Pair(updateRequired, updateUrl)
            try {
                if (BundleTrackerPrefs.isBrokenBundle()) {
                    Log.d(
                        APPTILE_LOG_TAG, "Previous bundle status: failed, starting rollback"
                    )
                    rollBackUpdates(context)
                }

                val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
                if (!trackerFile.exists()) {
                    if (!listOf(
                            copyAssetToDocuments(
                                context, APP_CONFIG_FILE_NAME, APP_CONFIG_FILE_NAME
                            ), copyAssetToDocuments(
                                context, BUNDLE_TRACKER_FILE_NAME, BUNDLE_TRACKER_FILE_NAME
                            )
                        ).all { it }
                    ) {
                        Log.e(APPTILE_LOG_TAG, "Failed to copy initial assets.")
                        // Return false, null URL if asset copy fails
                        return@withContext Pair(updateRequired, updateUrl)
                    }
                }

                // Capture the result of checkForOTA
                otaResult = checkForOTA(appId, context)

            } catch (e: Exception) {
                Log.e(APPTILE_LOG_TAG, "Error starting app process: ${e.message}", e)
                // Return false, null URL in case of error during startup process
                otaResult = Pair(updateRequired, updateUrl)
            }
            return@withContext otaResult // Return the Pair result
        }
}
