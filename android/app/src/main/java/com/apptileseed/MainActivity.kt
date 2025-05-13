package com.apptileseed

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
import java.io.File

class MainActivity : ReactActivity() {
    private var isJSLoaded = false
    private var isMinSplashDurationPlayed = false
    val minSplashDuration = 2.0f
    val maxSplashduration = 20.0f
    private var nativeSplashView: ImageView? = null

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "apptileSeed"

    private fun showNativeSplash() {
        // This makes sure the splash image is drawn in the cutout area
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val layoutParams = window.attributes
            layoutParams.layoutInDisplayCutoutMode = LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = layoutParams

            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }

        val image: ImageView = ImageView(this.applicationContext)

        this.nativeSplashView = image
        Glide.with(this).load(R.drawable.splash).centerCrop().into(image)

        val frameLayout = FrameLayout(this)

        frameLayout.addView(image)
        val rootFrlayout = this.window.decorView.findViewById<FrameLayout>(android.R.id.content)
        rootFrlayout.addView(frameLayout)

        val minDelayMs = (minSplashDuration * 1000).toLong()
        Handler(Looper.getMainLooper()).postDelayed({
            isMinSplashDurationPlayed = true
            this.deleteSplashImage()
        }, minDelayMs)

        val maxDelayMs = (maxSplashduration * 1000).toLong()
        Handler(Looper.getMainLooper()).postDelayed({
            isMinSplashDurationPlayed = true
            isJSLoaded = true
            this.deleteSplashImage()
        }, maxDelayMs)
    }


    // Called only from javascript side through RNApptile module.
    // This function doesn't actually remove the splash but makes
    // an attempt.
    open fun removeSplash() {
        this.isJSLoaded = true
        this.deleteSplashImage()
    }

    // Removes the splash image if both javascript thread has asked
    // to remove it and the minimum play duration has passed
    private fun deleteSplashImage() {
        if (this.nativeSplashView != null && this.isMinSplashDurationPlayed && this.isJSLoaded) {
            val view: ImageView = this.nativeSplashView!!
            if (view.parent != null) {
                val viewGroup: ViewGroup = view.parent as ViewGroup
                viewGroup.removeView(view)
            }
        }
    }

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        showNativeSplash()

        window.decorView.post {
            addFloatingButton()
        }
    }

    private fun addFloatingButton() {
        // Get the main content view
        val rootView = findViewById<ViewGroup>(android.R.id.content)

        // Create floating button
        val floatingButton = FloatingButton(this).apply {
//        setDelegate(this@MainActivity)
        }

        // Add floating button to the root view
        rootView.addView(floatingButton)

        // Position the button initially
        floatingButton.post {
            val layoutParams = floatingButton.layoutParams as FrameLayout.LayoutParams
            layoutParams.leftMargin = 10
            layoutParams.topMargin =
                resources.displayMetrics.heightPixels / 2 - floatingButton.height / 2
            floatingButton.layoutParams = layoutParams
        }
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
}
