package com.apptileseed

import android.app.Application

fun createMoengageIntegration(context: Application): MoengageIntegrationInterface {
  return MoengageIntegrationImpl(context);
}
