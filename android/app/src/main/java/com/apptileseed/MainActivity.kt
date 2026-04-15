package com.apptileseed

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Rational
import android.view.TextureView
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
import android.graphics.Color
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import im.zego.zegoexpress.ZegoExpressEngine
import im.zego.zegoexpress.entity.ZegoCanvas
import im.zego.zegoexpress.entity.ZegoPlayerConfig
import im.zego.zegoexpress.constants.ZegoStreamResourceMode
import im.zego.zegoexpress.constants.ZegoViewMode

class MainActivity : ReactActivity() {
    private var isJSLoaded = false
    private var isMinSplashDurationPlayed = false
    private val minSplashDuration = BuildConfig.MIN_SPLASH_DURATION
    private val maxSplashDuration = 20.0f
    private var nativeSplashView: ImageView? = null

    // PIP — eligibility derived from PIPModule.activeStreamId (non-null = eligible).
    // Fixed 9:16 portrait aspect for live-selling streams.
    private val pipAspectWidth: Int = 9
    private val pipAspectHeight: Int = 16
    private var pipVideoView: TextureView? = null
    private var pipBoundStreamId: String? = null
    private var pipDismissedRebindPending = false
    private var pendingHidePipUiRunnable: Runnable? = null

    companion object {
        @Volatile
        private var instance: MainActivity? = null
        fun getInstance(): MainActivity? = instance
    }

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

        val TAG = "EDGE_TO_EDGE"
        val root = window.decorView

        Log.d(TAG, "Setting up Inset Listener. SDK_INT: ${Build.VERSION.SDK_INT}")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }

        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val navBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val density = v.resources.displayMetrics.density
            val navBarHeightDp = navBars.bottom / density

            Log.d(TAG, "Inset Received! Bottom Px: ${navBars.bottom}, Bottom Dp: $navBarHeightDp")

            val inPip = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode

            if (Build.VERSION.SDK_INT >= 35) {
                window.navigationBarColor = Color.TRANSPARENT
                if (navBarHeightDp > 35 && !inPip) {
                    v.setPadding(0, 0, 0, navBars.bottom)
                    val controller = WindowInsetsControllerCompat(window, v)
                    controller.isAppearanceLightNavigationBars = true
                } else {
                    v.setPadding(0, 0, 0, 0)
                }
            }
            ViewCompat.onApplyWindowInsets(v, insets)
        }

        // Handle push notification when app is launched from notification (cold start)
        intent?.let {
            Log.d(APPTILE_LOG_TAG, "Initial intent received on MainActivity: $it")
            Log.d(APPTILE_LOG_TAG, "Action: ${it.action}")
            Log.d(APPTILE_LOG_TAG, "Data: ${it.data}")
            Log.d(APPTILE_LOG_TAG, "Extras: ${it.extras}")
            createKlaviyoIntegration(this).handlePush(it)
        }
    }

    private fun showNativeSplash() {
        // Skip splash if already in PIP (e.g. activity recreated mid-PIP)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode) {
            isMinSplashDurationPlayed = true
            isJSLoaded = true
            return
        }

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

    override fun onStart() {
        super.onStart()
        instance = this
    }

    override fun onResume() {
        super.onResume()
        // Emit JS rebind event on expand (pipBoundStreamId set) or reopen-after-dismiss.
        val needsRebind = (pipBoundStreamId != null && !isInPictureInPictureMode) ||
                pipDismissedRebindPending
        if (needsRebind) {
            val wasExpand = pipBoundStreamId != null
            pipBoundStreamId = null
            pipDismissedRebindPending = false
            PIPModule.getInstance()?.sendEvent("onMainActivityPipModeChanged", false)
            if (wasExpand) {
                scheduleHidePipUi()
            } else {
                restoreReactRootVisibility()
            }
        }
    }

    override fun onPause() {
        super.onPause()
    }

    override fun onStop() {
        super.onStop()
        // Dismiss path: onStop fires while still in PIP → user tapped X.
        // Expand path never goes through onStop.
        if (pipBoundStreamId != null) {
            stopStreamOnPipDismiss()
        }
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    // --- PIP: params & entry ---------------------------------------------------

    /** Updates PictureInPictureParams based on current stream state. */
    fun refreshPipParams() {
        val eligible = !PIPModule.activeStreamId.isNullOrBlank()
        val hint = PIPModule.sourceRectHint
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Stream cleared while in PIP → dismiss the ghost PIP window.
            if (!eligible && isInPictureInPictureMode) {
                dismissPipOnStreamEnd()
                return
            }
            try {
                val builder = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(pipAspectWidth, pipAspectHeight))
                if (hint != null && !hint.isEmpty) {
                    builder.setSourceRectHint(hint)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    builder.setAutoEnterEnabled(eligible)
                    builder.setSeamlessResizeEnabled(true)
                }
                setPictureInPictureParams(builder.build())
            } catch (e: Exception) {
                Log.e("PIP", "Failed to apply PIP params", e)
            }
        }
    }

    /** Explicit PIP entry fallback — auto-enter is unreliable on many devices. */
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (PIPModule.activeStreamId.isNullOrBlank()) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (isInPictureInPictureMode) return
        try {
            val builder = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(pipAspectWidth, pipAspectHeight))
            PIPModule.sourceRectHint?.takeIf { !it.isEmpty }?.let {
                builder.setSourceRectHint(it)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setSeamlessResizeEnabled(true)
            }
            enterPictureInPictureMode(builder.build())
        } catch (e: Exception) {
            Log.e("PIP", "Failed to enter PIP from onUserLeaveHint", e)
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        // Re-evaluate window insets so nav-bar padding is removed in PIP / restored on exit
        ViewCompat.requestApplyInsets(window.decorView)
        if (isInPictureInPictureMode) {
            enterNativePipUi()
        } else {
            exitNativePipUi()
            // JS event NOT emitted here — can't distinguish expand vs dismiss yet.
            // onResume handles expand; onStop handles dismiss.
        }
    }

    // --- PIP: native UI swap ---------------------------------------------------

    /** Hide React root, show native TextureView bound to the live Zego stream. */
    private fun enterNativePipUi() {
        val streamId = PIPModule.activeStreamId
        if (streamId.isNullOrBlank()) return
        val rootContent = window.decorView.findViewById<FrameLayout>(android.R.id.content) ?: return

        // Cancel any pending hide from a previous exit cycle
        pendingHidePipUiRunnable?.let {
            window.decorView.removeCallbacks(it)
            pendingHidePipUiRunnable = null
        }

        // Hide React root (INVISIBLE preserves layout for fast restore)
        for (i in 0 until rootContent.childCount) {
            val child = rootContent.getChildAt(i)
            if (child !== pipVideoView) child.visibility = View.INVISIBLE
        }

        // Lazily create and add the PIP TextureView
        val view = pipVideoView ?: TextureView(this).also {
            it.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            pipVideoView = it
        }
        if (view.parent == null) rootContent.addView(view)
        view.visibility = View.VISIBLE

        // Bind stream after layout pass so SurfaceTexture is ready
        view.post {
            try {
                val engine = ZegoExpressEngine.getEngine() ?: return@post
                val canvas = ZegoCanvas(view)
                canvas.viewMode = ZegoViewMode.getZegoViewMode(1) // AspectFill
                val cfg = ZegoPlayerConfig()
                cfg.resourceMode = ZegoStreamResourceMode.getZegoStreamResourceMode(0) // Default
                engine.startPlayingStream(streamId, canvas, cfg)
                pipBoundStreamId = streamId
            } catch (e: Throwable) {
                Log.e("PIP", "Failed to bind stream in PIP", e)
            }
        }
    }

    /** Keep pipVideoView visible during OS exit animation for seamless handoff. */
    private fun exitNativePipUi() {
        // Visual swap is deferred to scheduleHidePipUi (called from onResume)
    }

    /** Deferred hide — gives JS time to rebind before we reveal React root. */
    private fun scheduleHidePipUi() {
        pendingHidePipUiRunnable?.let { window.decorView.removeCallbacks(it) }
        val runnable = Runnable {
            restoreReactRootVisibility()
            pendingHidePipUiRunnable = null
        }
        pendingHidePipUiRunnable = runnable
        window.decorView.postDelayed(runnable, 350)
    }

    /** Hide PIP TextureView and make React root visible again. */
    private fun restoreReactRootVisibility() {
        val rootContent = window.decorView.findViewById<FrameLayout>(android.R.id.content) ?: return
        pipVideoView?.visibility = View.GONE
        for (i in 0 until rootContent.childCount) {
            val child = rootContent.getChildAt(i)
            if (child !== pipVideoView) child.visibility = View.VISIBLE
        }
    }

    /** Stop the Zego stream after user dismissed PIP via X button. */
    private fun stopStreamOnPipDismiss() {
        val streamId = pipBoundStreamId ?: PIPModule.activeStreamId
        if (!streamId.isNullOrBlank()) {
            try {
                ZegoExpressEngine.getEngine()?.stopPlayingStream(streamId)
            } catch (e: Throwable) {
                Log.e("PIP", "Failed to stop stream on PIP dismiss", e)
            }
        }
        pipBoundStreamId = null
        pipDismissedRebindPending = true
    }

    /** Stream ended while in PIP — stop playback, clean up, and dismiss the PIP window. */
    private fun dismissPipOnStreamEnd() {
        Log.d("PIP", "Stream ended while in PIP — dismissing ghost PIP")
        // Stop the bound stream
        val streamId = pipBoundStreamId
        if (!streamId.isNullOrBlank()) {
            try {
                ZegoExpressEngine.getEngine()?.stopPlayingStream(streamId)
            } catch (e: Throwable) {
                Log.e("PIP", "Failed to stop stream on stream-end dismiss", e)
            }
        }
        pipBoundStreamId = null
        pipDismissedRebindPending = true
        // Hide PIP video and restore React root so onResume has clean state
        restoreReactRootVisibility()
        // Move task to back — this causes the system to remove the PIP overlay
        moveTaskToBack(true)
    }
}
