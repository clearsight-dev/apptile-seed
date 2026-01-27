package com.apptileseed

import android.app.Application
import android.util.Log
import com.clevertap.android.sdk.ActivityLifecycleCallback
import com.clevertap.android.sdk.CleverTapAPI
import com.clevertap.react.CleverTapRnAPI

class CleverTapIntegrationImpl(private val context: Application) : CleverTapIntegrationInterface {
  override fun initialize() {
    // Register ActivityLifecycleCallback for automatic session tracking
    // This must be called before super.onCreate() in Application
    ActivityLifecycleCallback.register(context)

    // Set debug level for development (remove in production)
    CleverTapAPI.setDebugLevel(CleverTapAPI.LogLevel.DEBUG)

    // Initialize React Native integration (required for v3.0.0+)
    // This attaches the CleverTapListenerProxy for proper callback handling
    CleverTapRnAPI.initReactNativeIntegration(context)

    // Get the default CleverTap instance
    val cleverTapInstance = CleverTapAPI.getDefaultInstance(context)

    if (cleverTapInstance != null) {
      Log.d("CleverTap", "CleverTap SDK initialized successfully")
      Log.d("CleverTap", "CleverTap ID: ${cleverTapInstance.cleverTapID}")
    } else {
      Log.e("CleverTap", "Failed to initialize CleverTap SDK")
    }
  }
}
