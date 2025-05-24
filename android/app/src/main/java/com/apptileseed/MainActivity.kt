package com.apptileseed

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
import android.widget.FrameLayout
import android.widget.ImageView
import com.bumptech.glide.Glide
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import androidx.appcompat.app.AlertDialog
import java.io.File
import com.apptileseed.src.utils.APPTILE_LOG_TAG

class MainActivity : ReactActivity() {
    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "apptileSeed"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        SplashOverlayManager.showOverlay(this)

        window.decorView.post {
            addFloatingButton()
        }
    }

    fun removeSplash() {
        Log.d(APPTILE_LOG_TAG, "Splash overlay remove called from main activity ")
        SplashOverlayManager.removeOverlay(this)
    }

    //Floating button setup
    private var floatingButton: FloatingButton? = null
    private fun addFloatingButton() {
        // Check the flag from MainApplication
        if (!MainApplication.shouldShowFloatingButton) {
            Log.d(APPTILE_LOG_TAG, "FloatingButton will not be shown as per MainApplication.shouldShowFloatingButton.")
            // If a button was previously added and needs to be removed (e.g., if this method could be called multiple times with changing flag)
            floatingButton?.let {
                (it.parent as? ViewGroup)?.removeView(it)
                floatingButton = null
                Log.d(APPTILE_LOG_TAG, "Previously existing FloatingButton removed.")
            }
            return
        }

        // If button already exists (e.g. activity recreated but flag still true), don't add another.
        if (floatingButton != null && floatingButton?.parent != null) {
            Log.d(APPTILE_LOG_TAG, "FloatingButton already added.")
            return
        }

        // Get the main content view
        val rootView = findViewById<ViewGroup>(android.R.id.content)

        // Create floating button
        val newFloatingButton = FloatingButton(this).apply {
        // setDelegate(this@MainActivity)
        }

        // Add floating button to the root view
        rootView.addView(newFloatingButton)

        // Position the button initially
        newFloatingButton.post {
            val layoutParams = newFloatingButton.layoutParams as FrameLayout.LayoutParams
            layoutParams.leftMargin = 10
            layoutParams.topMargin =
                resources.displayMetrics.heightPixels / 2 - newFloatingButton.height / 2
            newFloatingButton.layoutParams = layoutParams
        }

        floatingButton = newFloatingButton
    }

    fun resetToDefaultBundle() {
        val documentsDir = applicationContext.filesDir.absolutePath
        val bundlesDir = "$documentsDir/bundles"
        val jsBundleFile = File("$bundlesDir/index.android.bundle")

        try {
            if (jsBundleFile.exists()) {
                jsBundleFile.delete()
            }
            reactNativeHost.reactInstanceManager.recreateReactContextInBackground()
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to delete bundle: ${e.localizedMessage}")
        }
    }

    fun refreshBundle() {
        try {
            // Refresh the React Native bundle without deleting the bundle file
            reactNativeHost.reactInstanceManager.recreateReactContextInBackground()
            Log.d("MainActivity", "Refreshing React Native bundle")
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to refresh bundle: ${e.localizedMessage}")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Log.d(APPTILE_LOG_TAG, "Intent received on MainActivity: $intent")
        Log.d(APPTILE_LOG_TAG, "Action: ${intent.action}")
        Log.d(APPTILE_LOG_TAG, "Data: ${intent.data}")
        Log.d(APPTILE_LOG_TAG, "Extras: ${intent.extras}")

        setIntent(intent) // Ensure React Native gets the new intent
    }
}
