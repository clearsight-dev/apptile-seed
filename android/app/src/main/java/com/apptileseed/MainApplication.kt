package com.apptileseed

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JavaScriptExecutorFactory
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.react.modules.systeminfo.AndroidInfoHelpers
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.facebook.soloader.SoLoader

import io.csie.kudo.reactnative.v8.executor.V8ExecutorFactory;
import java.io.File

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              add(RNGetValuesPackage())
              add(RNApptilePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED

        override fun getJavaScriptExecutorFactory(): JavaScriptExecutorFactory =
            V8ExecutorFactory(
                applicationContext,
                packageName,
                AndroidInfoHelpers.getFriendlyDeviceName(),
                useDeveloperSupport
            )
            
        override fun getJSBundleFile(): String? {
            // Define the path to the JS bundle in the Documents directory
            val documentsDir = applicationContext.filesDir.absolutePath
            val bundlesDir = "$documentsDir/bundles"
            val jsBundleFile = File("$bundlesDir/index.android.bundle")

            // Check if the JS bundle file exists
            val url = if (jsBundleFile.exists()) {
                jsBundleFile.absolutePath
            } else {
                super.getJSBundleFile() // Fallback to default if the file does not exist
            }
            return url;
        }
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    createCleverTapIntegration(this).initialize(intent);
    SoLoader.init(this, false)
    // disable RTL
    val sharedI18nUtilInstance = I18nUtil.getInstance()
    sharedI18nUtilInstance.forceRTL(this, false)
    sharedI18nUtilInstance.allowRTL(this, false)

    createMoengageIntegration(this).initialize();

    createKlaviyoIntegration(this).initialize();

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)

    val app = applicationContext as MainApplication

    createCleverTapIntegration(this).startup(intent, app);
  }
}
