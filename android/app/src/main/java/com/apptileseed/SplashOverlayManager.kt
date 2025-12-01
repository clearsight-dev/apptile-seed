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

class SplashOverlayManager {
    companion object {
        private var splashOverlay: View? = null

        fun showOverlay(context: Context) {
            if (splashOverlay != null) return // Prevent duplicate overlays

            val activity = context as? Activity ?: return
            val rootView = activity.findViewById<ViewGroup>(android.R.id.content) ?: return

            // Ensure splash image is drawn in cutout area
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val layoutParams = activity.window.attributes
                layoutParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                activity.window.attributes = layoutParams
                activity.window.decorView.systemUiVisibility =
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            }

            // Create ImageView dynamically
            val splashView = ImageView(context).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                Glide.with(context).load(R.drawable.splash).into(this)
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
    }
}