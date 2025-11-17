package com.apptileseed

import android.content.Context
import android.content.Intent
import com.klaviyo.analytics.Klaviyo

class KlaviyoIntegrationImpl(private val context: Context) : KlaviyoIntegrationInterface {
    override fun handlePush(intent: Intent) {
        Klaviyo.handlePush(intent)
    }
}