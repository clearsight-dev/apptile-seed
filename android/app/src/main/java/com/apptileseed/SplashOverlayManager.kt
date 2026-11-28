package com.apptileseed

import android.app.Activity
import android.content.Context
import android.os.Build
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import com.bumptech.glide.Glide
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class SplashOverlayManager {
    companion object {
        private var splashOverlay: View? = null

        fun showOverlay(context: Context) {
            if (splashOverlay != null) return // Prevent duplicate overlays

            val activity = context as? Activity ?: return
            val rootView = activity.findViewById<ViewGroup>(android.R.id.content) ?: return

            // Draw the splash edge to edge (cutout area included) without hiding the
            // status bar. systemUiVisibility is a no-op on Android 15+, so go through
            // WindowCompat instead.
            WindowCompat.setDecorFitsSystemWindows(activity.window, false)
            WindowInsetsControllerCompat(activity.window, activity.window.decorView)
                .show(WindowInsetsCompat.Type.statusBars())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val layoutParams = activity.window.attributes
                layoutParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                activity.window.attributes = layoutParams
            }

            // Create ImageView dynamically.
            // The placeholder is the same resource loaded synchronously, so the
            // splash is painted on the very first frame instead of leaving the
            // white windowBackground exposed while Glide decodes off-thread.
            // For an animated splash Glide then swaps the static first frame
            // for the GIF once decoded.
            val splashView = ImageView(context).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                Glide.with(context)
                    .load(R.drawable.splash)
                    .placeholder(R.drawable.splash)
                    .centerCrop()
                    .into(this)
            }

            splashOverlay = splashView
            rootView.addView(
                splashView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
        }


        fun removeOverlay(context: Context) {
            val rootView = (context as? Activity)?.findViewById<ViewGroup>(android.R.id.content) ?: return
            splashOverlay?.let { rootView.removeView(it) }
            splashOverlay = null
        }

        /**
         * Drops the static reference without touching the view hierarchy.
         *
         * Used when the hosting activity is going away anyway: the overlay must
         * stay on screen through the handoff to the next activity, but the
         * static field must not outlive the activity it points at.
         */
        fun detachOverlay() {
            splashOverlay = null
        }
    }
}