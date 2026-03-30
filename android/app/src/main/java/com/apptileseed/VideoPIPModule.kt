package com.apptileseed

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.os.Build
import android.util.Log
import android.util.Rational
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class VideoPIPModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        instance = this
    }

    companion object {
        private const val TAG = "VideoPIPModule"
        private var instance: VideoPIPModule? = null
        private var videoPipActivity: VideoPIPActivity? = null

        fun getInstance(): VideoPIPModule? = instance

        fun setVideoPiPActivityInstance(activity: VideoPIPActivity?) {
            this.videoPipActivity = activity
        }
    }

    override fun getName(): String = "VideoPIPModule"

    fun sendEvent(eventName: String, params: Any?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private var listenerCount = 0

    @ReactMethod
    fun startVideoPIPActivity(videoUrl: String, seekToMs: Double, promise: Promise) {
        val seekToMsLong = seekToMs.toLong()
        Log.d(TAG, "startVideoPIPActivity called with url: $videoUrl, seekToMs: $seekToMsLong")
        videoPipActivity?.let {
            Log.d(TAG, "ignoring request to start video pip activity - already running")
        } ?: run {
            val intent = Intent(reactApplicationContext, VideoPIPActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION
            if (videoUrl.isNotEmpty()) {
                intent.putExtra(VideoPIPActivity.EXTRA_VIDEO_URL, videoUrl)
            }
            if (seekToMsLong > 0) {
                intent.putExtra(VideoPIPActivity.EXTRA_SEEK_TO_MS, seekToMsLong)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun endVideoPIPActivity(promise: Promise) {
        Log.d(TAG, "endVideoPIPActivity called")
        videoPipActivity?.let {
            videoPipActivity = null
            it.finish()
            Log.d(TAG, "Video PIP Activity finished")
            promise.resolve(true)
        } ?: run {
            promise.reject("VIDEO_PIP_ACTIVITY_NOT_FOUND", "Video PIP activity is not running")
            Log.e(TAG, "Video PIP activity is not running")
        }
    }

    @ReactMethod
    fun enterPictureInPictureMode(width: Int, height: Int, promise: Promise) {
        val activity: Activity? = currentActivity
        val aspectRatio = Rational(width, height)
        if (activity is VideoPIPActivity) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .build()
                activity.enterPictureInPictureMode(params)
                Log.d(TAG, "Entered PiP mode")
            } else {
                Log.e(TAG, "PIP not supported on this Android version")
            }
        } else {
            Log.e(TAG, "Current activity is not VideoPIPActivity")
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun isPipSupported(promise: Promise) {
        val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            reactApplicationContext.packageManager.hasSystemFeature(
                android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE
            )
        promise.resolve(supported)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
    }
}

