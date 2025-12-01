package com.apptileseed

import android.app.ActivityOptions
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AlertDialog
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
                // Start the process and get the result: Pair<Boolean, String?>
                // first: true if MainActivity start should be prevented
                // second: app store URL if update is needed, null otherwise
                val startupResult = Actions.startApptileAppProcess(appId, this@LauncherActivity)
                val shouldPreventMainActivityStart = startupResult.first
                val updateUrl = startupResult.second

                if (!shouldPreventMainActivityStart) {
                    startMainActivity()
                    Log.i(APPTILE_LOG_TAG, "Startup Process completed, starting MainActivity.")
                } else {
                    // If a newer build requires update, log and do *not* start MainActivity.
                    // The user will likely need to update the app via the store.
                    Log.w(APPTILE_LOG_TAG, "Startup Process detected a required app update (build number). MainActivity will not be started. Please update the app.")
                    // Show an undismissible update dialog, passing the URL from the manifest
                    showUpdateRequiredDialog(updateUrl)
                }

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

    private fun showUpdateRequiredDialog(updateUrl: String?) {
        // Use the provided URL, or a default message if URL is missing
        val actualUpdateUrl = if (!updateUrl.isNullOrBlank()) {
            updateUrl
        } else {
            Log.w(APPTILE_LOG_TAG, "App Store URL not found in manifest for update dialog.")
            "https://play.google.com/store" // Example fallback
            // Alternatively, we can disable the button if no URL
            // null
        }

        val builder = AlertDialog.Builder(this)
            .setTitle("Update Required")
            .setMessage("An app update is available. Please update your app to continue using it with the best experience.")
            .setCancelable(false) // Prevent dismissing with back button

        // Only add the button if we have a valid URL
        if (actualUpdateUrl != null) {
            builder.setPositiveButton("Update") { dialog, which ->
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(actualUpdateUrl))
                try {
                    startActivity(intent)
                } catch (e: android.content.ActivityNotFoundException) {
                    Log.e(APPTILE_LOG_TAG, "Could not open update URL: $actualUpdateUrl", e)
                    // Optionally show a Toast message to the user
                }
                finish() // Finish the activity after attempting to redirect
            }
        } else {
            // If no URL, maybe just show an OK button that finishes the app?
            builder.setPositiveButton("OK") { dialog, which ->
                 finish()
            }
        }

        builder.show()
    }
}