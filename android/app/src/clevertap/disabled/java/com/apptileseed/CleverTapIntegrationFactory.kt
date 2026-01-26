package com.apptileseed

import android.app.Application

fun createCleverTapIntegration(context: Application): CleverTapIntegrationInterface {
  return CleverTapIntegrationStub()
}
