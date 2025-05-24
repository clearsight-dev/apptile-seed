package com.apptileseed

import android.app.ActivityOptions
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.apptileseed.src.actions.Actions
import com.apptileseed.src.utils.APPTILE_LOG_TAG
import kotlinx.coroutines.launch


class LauncherActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d(APPTILE_LOG_TAG, "Launcher activity onCreate called")
        super.onCreate(savedInstanceState)

        SplashOverlayManager.showOverlay(this)
        lifecycleScope.launch {
            try {
                Log.d(APPTILE_LOG_TAG, "Running in: ${Thread.currentThread().name}")
                Log.i(APPTILE_LOG_TAG, "Starting Startup Process")

                val appId = getString(R.string.APP_ID)
                Actions.startApptileAppProcess(appId, this@LauncherActivity)

                startMainActivity()
                Log.i(APPTILE_LOG_TAG, "Startup Process completed")
            } catch (e: Exception) {
                Log.e(APPTILE_LOG_TAG, "Startup Process failed", e)
            }
        }
    }

    private fun startMainActivity() {
        Log.d(APPTILE_LOG_TAG, "starting main activity")

        val mainIntent = Intent(this, MainActivity::class.java).apply {
            // forwarding everything received in current activity to main activity
            putExtras(intent.extras ?: Bundle())
            data = intent.data
            action = intent.action
            categories?.forEach { addCategory(it) }
        }

        val options = ActivityOptions.makeCustomAnimation(this, 0, 0).toBundle()

        startActivity(mainIntent, options)
        SplashOverlayManager.removeOverlay(this)
        finish()
    }
}