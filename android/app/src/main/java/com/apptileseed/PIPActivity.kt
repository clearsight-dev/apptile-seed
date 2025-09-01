package com.apptileseed

import android.app.PictureInPictureUiState
import android.content.res.Configuration
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.ReactContext
import android.content.Intent
import com.facebook.react.defaults.DefaultReactActivityDelegate


class PIPActivity : ReactActivity() {
    private var hasStopped: Boolean = false
    override fun getMainComponentName(): String = "pipactivity"
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, false)

    fun resumeMainActivity() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }
        startActivity(intent)
        Log.d("PIPActivity", "PIP restored")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        hasStopped = false
        PIPModule.setPiPActivityInstance(this)
        Log.d("PIPActivity", "setPIPActivity called")
        super.onCreate(savedInstanceState)
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (!isInPictureInPictureMode) {
            if (!hasStopped) {
                val pipModule = PIPModule.getInstance()
                pipModule?.sendEvent("onPiPModeChanged", null)
            }
            finish()
            resumeMainActivity()
        }
    }
    override fun onDestroy() {
        val pipModule = PIPModule.getInstance()
        pipModule?.sendEvent("onPipModeDismissed", null)
        super.onDestroy();
    }
    override fun onStop() {
        super.onStop()
        hasStopped = true;
        PIPModule.setPiPActivityInstance(null)
    }

//    override fun onResume() {
//        super.onResume()
//        if (onCreateDone) {
//            val pipModule = PIPModule.getInstance()
//            pipModule?.sendEvent("onPiPModeChanged", null)
//        }
//        onCreateDone = true;
//    }
//    override fun onStop() {
//        super.onStop()
//        val pipModule = PIPModule.getInstance()
//        if (isFinishing) {
//            resumeMainActivity()
//            if (pipModule != null) {
//                pipModule.sendEvent("onPiPModeChanged", null)
//            } else {
//                // figure out how to log
//            }
//        }
//    }
}
