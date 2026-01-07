package com.apptileseed

import android.app.Application
import android.util.Log
import com.apptileseed.src.apis.ApptileApiClient
import com.apptileseed.src.utils.APPTILE_LOG_TAG
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader


class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
            add(RNGetValuesPackage())
            add(RNApptilePackage())
            add(InAppReviewPackage())
            add(PIPPackage())
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        ApptileApiClient.init(this)

        SoLoader.init(this, OpenSourceMergedSoMapping)
        val sharedI18nUtilInstance = I18nUtil.instance
        sharedI18nUtilInstance.forceRTL(this, false)
        sharedI18nUtilInstance.allowRTL(this, false)

        createMoengageIntegration(this@MainApplication).initialize()

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
    }
}
