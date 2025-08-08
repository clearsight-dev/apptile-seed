package com.apptileseed
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.Log
import com.google.android.play.core.review.ReviewException
import com.google.android.play.core.review.ReviewManagerFactory
import com.google.android.play.core.review.model.ReviewErrorCode


class InAppReview(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var manager = ReviewManagerFactory.create(reactContext)

    override fun getName() = "InAppReview"

    @ReactMethod
    fun requestFlow() {
        val request = manager.requestReviewFlow()
        request.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val reviewInfo = task.result
                val activity = currentActivity ?: return@addOnCompleteListener
                val flow = manager.launchReviewFlow(activity, reviewInfo)
                flow.addOnCompleteListener {
                    Log.d("InAppReview", "Review flow is completed")
                }
            } else {
                val exception = task.exception
                if (exception is ReviewException) {
                    val reviewErrorCode = exception.errorCode
                    Log.e("InAppReview", "Review failed with error code: $reviewErrorCode")
                } else {
                    Log.e("InAppReview", "Unexpected exception: ${exception?.javaClass?.name} - ${exception?.message}")
                }
            }
        }
    }

}