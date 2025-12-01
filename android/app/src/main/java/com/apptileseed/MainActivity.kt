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
import com.apptileseed.src.utils.APPTILE_LOG_TAG
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.bumptech.glide.Glide

class MainActivity : ReactActivity() {
    private var isJSLoaded = false
    private var isMinSplashDurationPlayed = false
    private val minSplashDuration = 2.0f
    private val maxSplashDuration = 20.0f
    private var nativeSplashView: ImageView? = null

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "apptileSeed"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        showNativeSplash()
    }

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

        Glide.with(this)
            .load(R.drawable.splash)
            .centerCrop()
            .into(image)

        val frameLayout = FrameLayout(this)

        frameLayout.addView(image)
        val rootFrlayout = this.window.decorView.findViewById<FrameLayout>(android.R.id.content)
        rootFrlayout.addView(frameLayout)

        val minDelayMs = (minSplashDuration * 1000).toLong()
        Handler(Looper.getMainLooper()).postDelayed({
            isMinSplashDurationPlayed = true
            this.deleteSplashImage()
        }, minDelayMs)

        val maxDelayMs = (maxSplashDuration * 1000).toLong()
        Handler(Looper.getMainLooper()).postDelayed({
            isMinSplashDurationPlayed = true
            isJSLoaded = true
            this.deleteSplashImage()
        }, maxDelayMs)
    }

    // Called only from javascript side through RNApptile module.
    // This function doesn't actually remove the splash but makes
    // an attempt.
    fun removeSplash() {
        Log.d(APPTILE_LOG_TAG, "Splash overlay remove called from main activity")
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Log.d(APPTILE_LOG_TAG, "Intent received on MainActivity: $intent")
        Log.d(APPTILE_LOG_TAG, "Action: ${intent.action}")
        Log.d(APPTILE_LOG_TAG, "Data: ${intent.data}")
        Log.d(APPTILE_LOG_TAG, "Extras: ${intent.extras}")

        createKlaviyoIntegration(this).handlePush(intent);

        setIntent(intent) // Ensure React Native gets the new intent
    }
}
