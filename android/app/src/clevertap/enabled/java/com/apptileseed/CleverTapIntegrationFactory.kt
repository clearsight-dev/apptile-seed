package com.apptileseed

import android.content.Context
import android.content.Intent

fun createCleverTapIntegration(context: Context): CleverTapIntegrationInterface {
  return CleverTapIntegrationImpl(context);
}
