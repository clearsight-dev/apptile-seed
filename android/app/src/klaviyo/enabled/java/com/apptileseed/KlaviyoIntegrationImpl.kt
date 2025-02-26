package com.apptileseed

import android.content.Context
import com.klaviyo.analytics.Klaviyo

class KlaviyoIntegrationImpl(private val context: Context) : KlaviyoIntegrationInterface {
    override fun initialize() {
        val klaviyoCompanyId = context.getString(R.string.klaviyo_company_id)

        Klaviyo.initialize(klaviyoCompanyId, context);
    }
}