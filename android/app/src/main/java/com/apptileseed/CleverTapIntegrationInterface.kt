package com.apptileseed

import android.content.Intent

interface CleverTapIntegrationInterface {
  fun initialize(intent: Intent)
  fun startup(intent: Intent, app: MainApplication)
}
