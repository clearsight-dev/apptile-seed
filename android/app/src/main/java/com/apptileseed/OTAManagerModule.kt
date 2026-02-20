package com.apptileseed

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.jakewharton.processphoenix.ProcessPhoenix

/**
 * React Native bridge module for OTA-related operations.
 * Uses ProcessPhoenix for a full process restart.
 */
class OTAManagerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "OTAManager"
    }

    override fun getName(): String = "OTAManager"

    /**
     * Restart the app using ProcessPhoenix for a full process restart.
     * The startup flow will handle OTA updates automatically.
     */
    @ReactMethod
    fun restartApp() {
        Log.d(TAG, "Triggering ProcessPhoenix restart")
        currentActivity?.let { activity ->
            ProcessPhoenix.triggerRebirth(activity)
        } ?: run {
            ProcessPhoenix.triggerRebirth(reactApplicationContext)
        }
    }
}

