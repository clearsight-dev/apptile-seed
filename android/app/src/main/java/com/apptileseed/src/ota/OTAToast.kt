package com.apptileseed.src.ota

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast

object OTAToast {
    var isEnabled: Boolean = true
    private const val TAG = "OTAToast"

    fun show(context: Context?, errorCode: OTAErrorCode) {
        if (!isEnabled || context == null) return

        try {
            Handler(Looper.getMainLooper()).post {
                try {
                    val message = "${errorCode.code} : App Update failed"
                    Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to show toast: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to post toast: ${e.message}")
        }
    }
}

