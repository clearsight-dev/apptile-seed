package com.apptileseed

import android.app.ActivityOptions
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.apptileseed.src.actions.Actions
import kotlinx.coroutines.launch

class LauncherActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If MainActivity is already alive (e.g. in PIP), bring it forward instead
        // of re-running splash + startup (which would render inside the PIP window).
        // Forward any deep link data and push notification extras so they reach
        // MainActivity.onNewIntent() and React Native's Linking module.
        val existingMain = MainActivity.getInstance()
        if (existingMain != null) {
            val mainIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                data = intent.data
                action = intent.action
                intent.extras?.let { putExtras(it) }
            }
            startActivity(mainIntent)
            finish()
            return
        }

        SplashOverlayManager.showOverlay(this)

        lifecycleScope.launch {
            Actions.startApptileAppProcess(
                context = this@LauncherActivity,
                onForceUpdate = { storeUrl -> showForceUpdateDialog(storeUrl) },
                onProceed = { startMainActivity() }
            )
        }
    }

    private fun showForceUpdateDialog(storeUrl: String?) {
        AlertDialog.Builder(this)
            .setTitle("Update Required")
            .setMessage("A new version of this app is available. Please update to continue.")
            .setCancelable(false)
            .setPositiveButton("Update") { _, _ ->
                openPlayStore(storeUrl)
            }
            .show()
    }

    private fun openPlayStore(storeUrl: String?) {
        val url = storeUrl ?: "https://play.google.com/store/apps/details?id=${packageName}"
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (e: Exception) {
            // Fallback if Play Store not available
        }
        finish()
    }

    private fun startMainActivity() {
        val mainIntent = Intent(this, MainActivity::class.java).apply {
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