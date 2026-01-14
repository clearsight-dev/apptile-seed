package com.apptileseed

import android.app.Application
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.moengage.core.MoEngage
import com.moengage.core.DataCenter
import com.moengage.core.config.NotificationConfig
import com.moengage.react.MoEInitializer
import java.io.File

private const val LOG_TAG = "🟣 [MoEngage]"
private const val BUNDLE_TRACKER_FILE_NAME = "localBundleTracker.json"

class MoengageIntegrationImpl(private val context: Application) : MoengageIntegrationInterface {

  // Hardcoded mapping of fork names to MoEngage App IDs (same as iOS)
  private val forkToAppIdMapping = mapOf(
    "uae-ar" to "4UEOHG1LNXTSOVLGLON9V1F6",
    "uae-en" to "4UEOHG1LNXTSOVLGLON9V1F6",
    "saudi-en" to "GUTDCLUF9DDMMDXH9Q9C8MYC",
    "saudi-ar" to "GUTDCLUF9DDMMDXH9Q9C8MYC",
    "main" to "XUO5YVKB3VBC5XIAHBJDK3ZA",
    "kuwait-ar" to "XUO5YVKB3VBC5XIAHBJDK3ZA"
  )

  override fun initialize() {
    // Get activeForkName from bundleTracker and map to MoEngage appId
    val activeForkName = getActiveForkName()
    val moEngageAppId = getMoEngageAppIdForFork(activeForkName)

    // All forks use data_center_2
    val moEngageDataCenter = DataCenter.DATA_CENTER_2

    Log.d(LOG_TAG, "Initializing with activeForkName: $activeForkName, appId: $moEngageAppId, dataCenter: data_center_2")

    val moEngage = MoEngage.Builder(context, moEngageAppId, moEngageDataCenter)
      .configureNotificationMetaData(
          NotificationConfig(
            R.mipmap.ic_launcher_round,
            R.mipmap.ic_launcher_round
            )
          )
    MoEInitializer.initializeDefaultInstance(context, moEngage, true)
  }

  private fun getActiveForkName(): String {
    val defaultFork = try {
      context.getString(R.string.APPTILE_APP_FORK)
    } catch (e: Exception) {
      "main"
    }

    return try {
      // First try to read from filesDir (for OTA updated bundles)
      val trackerFile = File(context.filesDir, BUNDLE_TRACKER_FILE_NAME)
      var trackerContent: String? = null

      if (trackerFile.exists()) {
        trackerContent = trackerFile.readText()
        Log.d(LOG_TAG, "Reading bundleTracker from filesDir: ${trackerFile.absolutePath}")
      } else {
        // If not in filesDir, try reading from assets (for fresh installs)
        try {
          trackerContent = context.assets.open(BUNDLE_TRACKER_FILE_NAME).bufferedReader().use { it.readText() }
          Log.d(LOG_TAG, "Reading bundleTracker from assets")
        } catch (e: Exception) {
          Log.d(LOG_TAG, "bundleTracker not found in assets: ${e.message}")
        }
      }

      if (trackerContent != null) {
        val mapType = object : TypeToken<Map<String, Any>>() {}.type
        val tracker: Map<String, Any> = Gson().fromJson(trackerContent, mapType)
        val forkName = tracker["activeForkName"] as? String

        if (!forkName.isNullOrEmpty()) {
          Log.d(LOG_TAG, "Found activeForkName: $forkName")
          return forkName
        }
      }

      Log.d(LOG_TAG, "No activeForkName found, using default: $defaultFork")
      defaultFork
    } catch (e: Exception) {
      Log.e(LOG_TAG, "Error reading bundleTracker: ${e.message}")
      defaultFork
    }
  }

  private fun getMoEngageAppIdForFork(forkName: String): String {
    val appId = forkToAppIdMapping[forkName]
    if (appId == null) {
      Log.d(LOG_TAG, "Unknown fork '$forkName', falling back to 'main' appId")
      return forkToAppIdMapping["main"] ?: "XUO5YVKB3VBC5XIAHBJDK3ZA"
    }
    return appId
  }
}
