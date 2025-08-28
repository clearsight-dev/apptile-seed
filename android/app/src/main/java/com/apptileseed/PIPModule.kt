package com.apptileseed

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.os.Build
import android.util.Log
import android.util.Rational
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class PIPModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        instance = this;
    }

    companion object {
        private var instance: PIPModule? = null
        private var pipActivity: PIPActivity? = null;
        fun getInstance(): PIPModule? {
            return instance;
        }

        fun setPiPActivityInstance(activity: PIPActivity?) {
            this.pipActivity = activity;
        }
    }

    fun sendEvent(eventName: String, params: Any?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private var listenerCount = 0

    override fun getName(): String {
        return "PIPModule"
    }

    @ReactMethod
    fun startPIPActivity(promise: Promise) {
        Log.d("PIPModule", "startPIPActivity called")
        pipActivity?.let {
            Log.d("PIPModule", "ignoring request to start pip activity")
        } ?: run {
            val intent = Intent(reactApplicationContext, PIPActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION
            reactApplicationContext.startActivity(intent)
            promise.resolve(null);
        }

    }

    @ReactMethod
    fun endPIPActivity(promise: Promise) {
        Log.d("PIPModule", "endPIPActivity called")
        pipActivity?.let {
            pipActivity = null // Clear the reference to avoid memory leaks
            val intent = Intent(reactApplicationContext, PIPActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION
            reactApplicationContext.startActivity(intent)
            Log.d("PIPModule", "PIP Activity finished, MainActivity resumed")
            promise.resolve(true)
        } ?: run {
            promise.reject("PIP_ACTIVITY_NOT_FOUND", "PIP activity is not running")
            Log.e("PIPModule", "Current activity is not PIPActivity")
        }
        val activity = currentActivity
        if (activity is PIPActivity) {
            activity.runOnUiThread {
                try {
                    // Finish PIPActivity
                    activity.finish()
                    // Resume MainActivity
                    val mainActivityIntent = Intent(activity, MainActivity::class.java)
                    mainActivityIntent.addFlags(
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                Intent.FLAG_ACTIVITY_NEW_TASK
                    )
                    activity.startActivity(mainActivityIntent)
                    promise.resolve(true)
                    Log.d("PIPModule", "PIP Activity finished, MainActivity resumed")
                } catch (e: Exception) {
                    promise.reject("PIP_ACTIVITY_ERROR", "Error while ending PIP activity: ${e.message}")
                    Log.e("PIPModule", "Error while ending PIP activity", e)
                }
            }
        } else {
            promise.reject("PIP_ACTIVITY_NOT_FOUND", "PIP activity is not running")
            Log.e("PIPModule", "Current activity is not PIPActivity")
        }
    }


    @ReactMethod
    fun enterPictureInPictureMode(width: Int, height: Int, promise: Promise) {
        val activity: Activity? = currentActivity
        val aspectRatio = Rational(width, height)
        if (activity is PIPActivity) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
//                    Its too much trouble to figure out how to send this from react-native right now
//                    .setSourceRectHint(visibleRect)
//                    .setAutoEnterEnabled(true)
                    .build();
                activity.enterPictureInPictureMode(params)
            } else {
                Log.e("PIPModule", "PIP not supported on this Android version.")
            }
        } else {
            Log.e("PIPModule", "Current activity is not PIPActivity.")
        }
        promise.resolve(null);
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
