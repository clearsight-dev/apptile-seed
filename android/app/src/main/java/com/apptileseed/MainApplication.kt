package com.apptileseed

import android.app.Application
import android.util.Log
import com.apptileseed.src.apis.ApptileApiClient
import com.apptileseed.src.utils.APPTILE_LOG_TAG
import com.apptileseed.src.utils.BundleTrackerPrefs
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
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.facebook.react.modules.systeminfo.AndroidInfoHelpers
import com.facebook.soloader.SoLoader
import io.csie.kudo.reactnative.v8.executor.V8ExecutorFactory
import java.io.File


class MainApplication : Application(), ReactApplication {
    private val systemDefaultExceptionHandler = Thread.getDefaultUncaughtExceptionHandler()


    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
            // Packages that cannot be autolinked yet can be added manually here, for example:
            add(RNGetValuesPackage())
            add(RNApptilePackage())
            add(InAppReviewPackage())
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED

        override fun getJavaScriptExecutorFactory(): JavaScriptExecutorFactory = V8ExecutorFactory(
            applicationContext,
            packageName,
            AndroidInfoHelpers.getFriendlyDeviceName(),
            useDeveloperSupport
        )

        override fun getJSBundleFile(): String? {
            val documentsDir = applicationContext.filesDir.absolutePath
            val bundlesDir = "$documentsDir/bundles"
            val jsBundleFile = File("$bundlesDir/index.android.bundle")

            return when {
                jsBundleFile.exists() -> {
                    if (BundleTrackerPrefs.isBrokenBundle()) {
                        Log.d(
                            APPTILE_LOG_TAG,
                            "⚠️ Previous local bundle failed. ✅ Using embedded bundle."
                        )
                        BundleTrackerPrefs.resetBundleState()
                        super.getJSBundleFile()
                    } else {
                        BundleTrackerPrefs.resetBundleState()
                        jsBundleFile.absolutePath.also { path ->
                            Log.d(APPTILE_LOG_TAG, "✅ Using local bundle: $path")
                        }
                    }
                }

                else -> {
                    Log.d(APPTILE_LOG_TAG, "⚠️ No local bundle found. ✅ Using embedded bundle.")
                    BundleTrackerPrefs.resetBundleState()
                    super.getJSBundleFile()
                }
            }
        }
    }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        ApptileApiClient.init(this)
        BundleTrackerPrefs.init(this)

        // Capturing unCaught Errors & resetting the bundle & app config
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            BundleTrackerPrefs.markCurrentBundleBroken()
            systemDefaultExceptionHandler?.uncaughtException(thread, throwable)
        }

//        createCleverTapIntegration(this).initialize(intent);
        SoLoader.init(this, false)
        // disable RTL
        val sharedI18nUtilInstance = I18nUtil.getInstance()
        sharedI18nUtilInstance.forceRTL(this, false)
        sharedI18nUtilInstance.allowRTL(this, false)

        createMoengageIntegration(this@MainApplication).initialize()

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            load()
        }
        ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
    }

    fun resetReactNativeHost() {
        reactNativeHost.clear()
        Log.i(APPTILE_LOG_TAG, "Cleared ReactNativeHost")

        // Force reinitialization by accessing the instance again
        val newInstanceManager = reactNativeHost.reactInstanceManager
        Log.i(APPTILE_LOG_TAG, "Recreated ReactInstanceManager: $newInstanceManager")

    }
//    fun onNewIntent(intent: Intent) {
//        super.onNewIntent(intent)
//
//        val app = applicationContext as MainApplication
//
//        createCleverTapIntegration(this).startup(intent, app);
//    }
}
