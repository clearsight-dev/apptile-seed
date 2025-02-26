package com.apptileseed

import android.content.Context
import android.content.Intent

class CleverTapIntegrationStub(private val context: Context) : CleverTapIntegrationInterface {
  override fun initialize(intent: Intent) {}
  override fun startup(intent: Intent, app: MainApplication) {}
}
