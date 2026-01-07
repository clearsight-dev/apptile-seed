package com.apptileseed

import android.app.ActivityOptions
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class LauncherActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SplashOverlayManager.showOverlay(this)
        startMainActivity()
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