package com.apptileseed

import android.app.Application
import android.content.Context
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
import com.facebook.react.modules.systeminfo.AndroidInfoHelpers
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.facebook.soloader.SoLoader
import io.csie.kudo.reactnative.v8.executor.V8ExecutorFactory
import java.io.File
import java.io.InputStreamReader
import org.json.JSONObject
import java.io.FileInputStream

class MainApplication : Application(), ReactApplication {
    private val systemDefaultExceptionHandler = Thread.getDefaultUncaughtExceptionHandler()

    companion object {
        @JvmStatic
        var shouldShowFloatingButton: Boolean = false
            private set

        @JvmStatic
        var previewAppConfigPath: String? = null // Path for appConfig.json from previewTracker
            private set
    }

    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
            add(RNGetValuesPackage())
            add(RNApptilePackage())
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

        // This method is now correctly overriding the one from DefaultReactNativeHost
        override fun getJSBundleFile(): String? {
            val currentAppContext =
                this.application // Use the application context from DefaultReactNativeHost

            Log.d(APPTILE_LOG_TAG, "getJSBundleFile: Entered")
            val previewTrackerFileName = "previewTracker.json"
            var previewBundlePathFromJson: String? = null
            var usePreviewBundleFromFile = false

            // Function to process the JSON content from an InputStream
            fun processJsonStream(inputStream: java.io.InputStream, source: String): Boolean {
                var bundlePathFound = false
                try {
                    InputStreamReader(inputStream).use { reader ->
                        val jsonString = reader.readText()
                        Log.d(
                            APPTILE_LOG_TAG,
                            "getJSBundleFile: '$previewTrackerFileName' content from $source: '$jsonString'"
                        )
                        if (jsonString.isNotBlank()) {
                            val jsonObject = JSONObject(jsonString)
                            if (jsonObject.length() > 0) {
                                // Check for previewBundle
                                if (jsonObject.has("previewBundle")) {
                                    val path = jsonObject.getString("previewBundle")
                                    Log.d(
                                        APPTILE_LOG_TAG,
                                        "getJSBundleFile: Found 'previewBundle' key in $source with value: '$path'"
                                    )
                                    if (path.isNotBlank()) {
                                        previewBundlePathFromJson = path
                                        bundlePathFound = true // Mark as found for return value
                                    } else {
                                        Log.d(
                                            APPTILE_LOG_TAG,
                                            "getJSBundleFile: 'previewBundle' key in $source is blank."
                                        )
                                    }
                                } else {
                                    Log.d(
                                        APPTILE_LOG_TAG,
                                        "getJSBundleFile: 'previewBundle' key missing in $source."
                                    )
                                }

                                // Check for previewAppConfig
                                if (jsonObject.has("previewAppConfig")) {
                                    val appConfigPath = jsonObject.getString("previewAppConfig")
                                    Log.d(
                                        APPTILE_LOG_TAG,
                                        "getJSBundleFile: Found 'previewAppConfig' key in $source with value: '$appConfigPath'"
                                    )
                                    if (appConfigPath.isNotBlank()) {
                                        previewAppConfigPath = appConfigPath // Store the path
                                    } else {
                                        Log.d(
                                            APPTILE_LOG_TAG,
                                            "getJSBundleFile: 'previewAppConfig' key in $source is blank."
                                        )
                                        previewAppConfigPath = null // Reset if blank
                                    }
                                } else {
                                    Log.d(
                                        APPTILE_LOG_TAG,
                                        "getJSBundleFile: 'previewAppConfig' key missing in $source."
                                    )
                                    previewAppConfigPath = null // Reset if missing
                                }

                            } else {
                                Log.d(
                                    APPTILE_LOG_TAG,
                                    "getJSBundleFile: '$previewTrackerFileName' from $source is empty JSON."
                                )
                                previewAppConfigPath = null // Reset if empty JSON
                            }
                        } else {
                            Log.d(
                                APPTILE_LOG_TAG,
                                "getJSBundleFile: '$previewTrackerFileName' from $source is blank."
                            )
                            previewAppConfigPath = null // Reset if blank file
                        }
                    }
                } catch (e: Exception) {
                    Log.e(
                        APPTILE_LOG_TAG,
                        "getJSBundleFile: Error reading or parsing '$previewTrackerFileName' from $source.",
                        e
                    )
                    previewAppConfigPath = null // Reset on error
                }
                return bundlePathFound // Return true if previewBundle path was processed
            }

            // 1. Attempt to read from app's internal filesDir (documents directory)
            val documentsFile = File(currentAppContext.filesDir, previewTrackerFileName)
            Log.d(
                APPTILE_LOG_TAG,
                "getJSBundleFile: Attempting to read '$previewTrackerFileName' from Documents: ${documentsFile.absolutePath}"
            )
            if (documentsFile.exists()) {
                try {
                    FileInputStream(documentsFile).use { stream ->
                        if (processJsonStream(stream, "Documents")) {
                            usePreviewBundleFromFile = true
                            Log.d(
                                APPTILE_LOG_TAG,
                                "getJSBundleFile: Successfully used '$previewTrackerFileName' from Documents."
                            )
                        }
                    }
                } catch (e: Exception) {
                    Log.e(
                        APPTILE_LOG_TAG,
                        "getJSBundleFile: Error opening '$previewTrackerFileName' from Documents.",
                        e
                    )
                }
            } else {
                Log.d(
                    APPTILE_LOG_TAG,
                    "getJSBundleFile: '$previewTrackerFileName' not found in Documents."
                )
            }

            // 2. If not found or not successfully used from documents, attempt to read from assets
            if (!usePreviewBundleFromFile) {
                Log.d(
                    APPTILE_LOG_TAG,
                    "getJSBundleFile: Attempting to read '$previewTrackerFileName' from Assets as fallback."
                )
                try {
                    currentAppContext.assets.open(previewTrackerFileName).use { stream ->
                        if (processJsonStream(stream, "Assets")) {
                            usePreviewBundleFromFile = true
                            Log.d(
                                APPTILE_LOG_TAG,
                                "getJSBundleFile: Successfully used '$previewTrackerFileName' from Assets."
                            )
                        }
                    }
                } catch (e: java.io.FileNotFoundException) {
                    Log.d(
                        APPTILE_LOG_TAG,
                        "getJSBundleFile: '$previewTrackerFileName' not found in Assets either."
                    )
                } catch (e: Exception) {
                    Log.e(
                        APPTILE_LOG_TAG,
                        "getJSBundleFile: Error reading or parsing '$previewTrackerFileName' from Assets.",
                        e
                    )
                }
            }

            Log.d(
                APPTILE_LOG_TAG,
                "getJSBundleFile: After trying Documents and Assets. usePreviewBundleFromFile = $usePreviewBundleFromFile, previewBundlePathFromJson = $previewBundlePathFromJson, previewAppConfigPath = $previewAppConfigPath"
            )

            if (usePreviewBundleFromFile && previewBundlePathFromJson != null) {
                val pathToCheck = previewBundlePathFromJson!!
                // For bundles written by JS to documents dir, they won't start with "assets://"
                // and File(pathToCheck).exists() should work directly.
                val previewFile = File(pathToCheck)
                Log.d(APPTILE_LOG_TAG, "getJSBundleFile: Checking preview path: '$pathToCheck'")

                // If path is absolute (likely from Documents) or starts with assets:// (from APK assets)
                if (previewFile.exists() || (pathToCheck.startsWith("assets://") && checkAssetExists(
                        currentAppContext,
                        pathToCheck
                    ))
                ) {
                    Log.d(
                        APPTILE_LOG_TAG,
                        "getJSBundleFile: Preview path '$pathToCheck' is valid. Using it. Setting shouldShowFloatingButton = true"
                    )
                    shouldShowFloatingButton = true
                    Log.d(APPTILE_LOG_TAG, "getJSBundleFile: returning path: '$pathToCheck'")
                    return pathToCheck
                } else {
                    Log.w(
                        APPTILE_LOG_TAG,
                        "getJSBundleFile: Preview path '$pathToCheck' is invalid/not found. Setting shouldShowFloatingButton = false"
                    )
                    shouldShowFloatingButton = false
                    // NOTE: User removed alert logic, so no shouldShowFallbackAlert = true here.
                }
            } else {
                Log.d(
                    APPTILE_LOG_TAG,
                    "getJSBundleFile: Not using preview bundle from file. Current shouldShowFloatingButton = $shouldShowFloatingButton"
                )
                shouldShowFloatingButton = false
            }

            Log.d(APPTILE_LOG_TAG, "getJSBundleFile: Proceeding to default bundle logic.")

            val documentsDir = currentAppContext.filesDir.absolutePath
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
                            Log.d(APPTILE_LOG_TAG, "✅ Using default local bundle: $path")
                        }
                    }
                }

                else -> {
                    Log.d(
                        APPTILE_LOG_TAG,
                        "⚠️ No default local bundle found. ✅ Using embedded bundle."
                    )
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

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            BundleTrackerPrefs.markCurrentBundleBroken()
            systemDefaultExceptionHandler?.uncaughtException(thread, throwable)
        }

        SoLoader.init(this, false)
        val sharedI18nUtilInstance = I18nUtil.getInstance()
        sharedI18nUtilInstance.forceRTL(this, false)
        sharedI18nUtilInstance.allowRTL(this, false)

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
        ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
    }

    fun resetReactNativeHost() {
        reactNativeHost.clear()
        Log.i(APPTILE_LOG_TAG, "Cleared ReactNativeHost")

        val newInstanceManager = reactNativeHost.reactInstanceManager
        Log.i(APPTILE_LOG_TAG, "Recreated ReactInstanceManager: $newInstanceManager")
    }

    // Helper function to check if an asset exists, to be used with paths like "assets://..."
    private fun checkAssetExists(context: Context, assetPath: String): Boolean {
        if (!assetPath.startsWith("assets://")) return false
        val actualAssetPath = assetPath.substring("assets://".length)
        try {
            context.assets.open(actualAssetPath).use { /* Do nothing, just check if openable */ }
            return true
        } catch (e: java.io.IOException) {
            return false
        }
    }
}
