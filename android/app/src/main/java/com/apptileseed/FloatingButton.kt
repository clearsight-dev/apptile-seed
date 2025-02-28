package com.apptileseed // Change to your app's package name

import android.content.Context
import android.graphics.Color
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import androidx.core.view.GestureDetectorCompat
import kotlin.math.abs

class FloatingButton(context: Context) : FrameLayout(context) {
    
    private var clearButton: Button
    private var dragListener: GestureDetectorCompat
    private var lastX: Float = 0f
    private var lastY: Float = 0f
    private var initialX: Float = 0f
    private var initialY: Float = 0f
    private var delegate: FloatingButtonDelegate? = null

    // Extension property for corner radius
    private var radius: Float = 2f
        set(value) {
            field = value
            setBackgroundRadius(value)
        }
    
    // Utility function to convert dp to pixels
    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }
    
    interface FloatingButtonDelegate {
        fun resetToDefaultBundle()
    }
    
    init {
        // Set up container properties
        elevation = 8f
        setBackgroundColor(Color.parseColor("#E6808080")) // 50% gray with 90% opacity
        alpha = 0.9f
        val radius = dpToPx(20).toFloat()
        
        // Enable clickable for proper touch handling
        isClickable = true
        isFocusable = true

        // Create the button
        clearButton = Button(context).apply {
            text = "Clear Downloads"
            setTextColor(Color.WHITE)
            background = null  // Remove button background
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.CENTER
            }
            
            setOnClickListener {
                delegate?.resetToDefaultBundle()
            }
            
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.CENTER
            }
        }
        
        // Add button to container
        addView(clearButton)
        
        // Set up container layout parameters
        layoutParams = FrameLayout.LayoutParams(
            dpToPx(150),
            dpToPx(100)
        )
        
        // Set up drag gesture detection
        dragListener = GestureDetectorCompat(context, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean {
                return true
            }
        })
        
        // Apply the radius to the background
        this.radius = radius
        
        // Set up touch listener for entire surface
        setOnTouchListener { v, event ->
            onTouchEvent(event)
            true
        }
    }
    
    fun setDelegate(delegate: FloatingButtonDelegate) {
        this.delegate = delegate
    }
    
    // Handle touch events for dragging
    override fun onTouchEvent(event: MotionEvent): Boolean {
        dragListener.onTouchEvent(event)
        
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.rawX
                lastY = event.rawY
                initialX = x
                initialY = y
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val deltaX = event.rawX - lastX
                val deltaY = event.rawY - lastY
                x += deltaX
                y += deltaY
                lastX = event.rawX
                lastY = event.rawY
                return true
            }
            MotionEvent.ACTION_UP -> {
                snapToEdge()
                return true
            }
        }
        
        return super.onTouchEvent(event)
    }
    
    private fun snapToEdge() {
        val parent = parent as? ViewGroup ?: return
        val screenWidth = parent.width
        val screenHeight = parent.height

        // Calculate horizontal distances only
        val distFromLeft = x
        val distFromRight = screenWidth - (x + width)

        // Animation parameters
        val duration = 300L
        
        // Horizontal positioning
        when {
            // Tuck left
            distFromLeft < -10 -> {
                animate().x(-width + dpToPx(30).toFloat())
            }
            // Snap left
            distFromLeft <= distFromRight -> {
                animate().x(dpToPx(10).toFloat())
            }
            // Tuck right
            distFromRight < -10 -> {
                animate().x(screenWidth - dpToPx(30).toFloat())
            }
            // Snap right
            else -> {
                animate().x(screenWidth - width - dpToPx(10).toFloat())
            }
        }.setDuration(duration).apply {
            // Vertical constraints - keep within screen bounds
            val safeY = y.coerceIn(
                dpToPx(30).toFloat(),
                screenHeight - height - dpToPx(30).toFloat()
            )
            y(safeY)
        }.start()
    }
    
    // Auto-tuck the button to left edge after a delay
    fun autoTuck() {
        postDelayed({
            val parent = parent as? ViewGroup ?: return@postDelayed
            animate()
                .x(-width + dpToPx(30).toFloat())
                .setDuration(300)
                .start()
        }, 2000) // 2 second delay
    }
    
    private fun setBackgroundRadius(radius: Float) {
        background = android.graphics.drawable.GradientDrawable().apply {
            setColor(Color.parseColor("#E6808080")) // 50% gray with 90% opacity
            cornerRadius = radius
        }
    }
}