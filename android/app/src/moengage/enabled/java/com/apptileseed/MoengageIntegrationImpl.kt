package com.apptileseed

import android.app.Application
import com.moengage.core.MoEngage
import com.moengage.core.DataCenter
import com.moengage.core.config.NotificationConfig
import com.moengage.react.MoEInitializer

class MoengageIntegrationImpl(private val context: Application) : MoengageIntegrationInterface {
  override fun initialize() {
    val moEngageAppId = context.getString(R.string.moengage_app_id)
    val moEngageDataCenterString = context.getString(R.string.moengage_datacenter)
    val moEngageDataCenter = when (moEngageDataCenterString) {
      "data_center_1" -> DataCenter.DATA_CENTER_1
      "data_center_2" -> DataCenter.DATA_CENTER_2
      "data_center_3" -> DataCenter.DATA_CENTER_3
      "data_center_4" -> DataCenter.DATA_CENTER_4
      else -> DataCenter.DATA_CENTER_1
    }

    val moEngage = MoEngage.Builder( context, moEngageAppId, moEngageDataCenter)
      .configureNotificationMetaData(
          NotificationConfig(
            R.mipmap.ic_launcher_round, 
            R.mipmap.ic_launcher_round
            )
          )
    MoEInitializer.initializeDefaultInstance(context, moEngage, true)
  }
}
