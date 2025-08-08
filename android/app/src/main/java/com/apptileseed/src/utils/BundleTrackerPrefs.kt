package com.apptileseed.src.utils

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

object BundleTrackerPrefs {
    private const val PREFS_NAME = "apptile"
    private const val KEY_BUNDLE_LOAD_STATUS = "is_bundle_broken"

    private lateinit var preferences: SharedPreferences

    fun init(context: Context) {
        preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun isBrokenBundle(): Boolean {
        return preferences.getBoolean(KEY_BUNDLE_LOAD_STATUS, false)
    }

    fun resetBundleState(): Boolean {
        Log.d(APPTILE_LOG_TAG, "Resetting bundle state")
        return preferences.edit().putBoolean(KEY_BUNDLE_LOAD_STATUS, false).commit()
    }

    fun markCurrentBundleBroken(): Boolean {
        Log.e(APPTILE_LOG_TAG, "Marking bundle as broken")
        return preferences.edit().putBoolean(KEY_BUNDLE_LOAD_STATUS, true).commit()
    }
}
