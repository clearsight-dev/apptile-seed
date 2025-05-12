package com.apptileseed

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.Point
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat

/**
 * FloatingButton - A floating control button that mimics iOS FloatingPreviewControls
 * Provides a draggable circular button that shows a menu with Home and Refresh options
 */
class FloatingButton(private val context: Context) : FrameLayout(context) {
    // UI elements
    private var circleView: CardView
    private var clearButton: View // This is the main interactive part in collapsed state

    // Dimensions
    private val collapsedSize = dpToPx(50)
    private val menuGap = dpToPx(5) // 10dp gap between button and menu
    private val edgeSpacing = dpToPx(5) // 5dp spacing from edge of screen (matching iOS)

    // State
    private var isExpanded = false
    private var menuView: ViewGroup? = null
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var initialX = 0f
    private var initialY = 0f
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private val clickDragThreshold = dpToPx(5) // Threshold to distinguish click from drag

    // Delegate for callbacks
    private var delegate: FloatingButtonDelegate? = null

    // Interface for delegate callbacks
    interface FloatingButtonDelegate {
        fun resetToDefaultBundle()
        fun refreshBundle()
    }

    init {
        // Set up the main container
        layoutParams = LayoutParams(collapsedSize, collapsedSize)
        // Set rounded corners for the container
        background = GradientDrawable().apply {
            setColor(Color.argb(230, 0, 0, 0)) // 90% opacity black
            cornerRadius = dpToPx(10).toFloat()
        }
        ViewCompat.setElevation(this, dpToPx(5).toFloat())

        clipChildren = false
        isClickable = true

        // Create the main clear button (collapsed state) - This acts as the primary click target
        clearButton = View(context).apply {
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
            background = null // Transparent background, relies on parent's background
            isClickable = true // This button will handle the click to toggle
            isFocusable = true
            // Do NOT set click listener here - we'll handle clicks in onTouchEvent
        }

        // Create circle view (visual indicator)
        circleView = CardView(context).apply {
            layoutParams = LayoutParams(dpToPx(30), dpToPx(30)).apply {
                gravity = Gravity.CENTER
            }
            radius = dpToPx(15).toFloat()
            setCardBackgroundColor(Color.WHITE)

            // Add shadow to circle
            cardElevation = dpToPx(3).toFloat()
            maxCardElevation = dpToPx(5).toFloat()
        }

        // Add views to container
        addView(circleView) // Circle is the visual cue
        addView(clearButton) // Clear button is the touch target on top

        // Initial positioning
        post {
            val parent = parent as? ViewGroup ?: return@post
            val screenWidth = parent.width
            val screenHeight = parent.height

            // Position at right side, 40% from top
            x = (screenWidth - collapsedSize - edgeSpacing).toFloat()
            y = (screenHeight * 0.4f - collapsedSize / 2).toFloat()
        }
    }

    // Convert dp to pixels
    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    // Set the delegate for callbacks
    fun setDelegate(delegate: FloatingButtonDelegate) {
        this.delegate = delegate
    }

    // Go home action
    private fun goHome() {
        delegate?.resetToDefaultBundle()
        toggleExpandedState() // This will hide the menu
    }

    // Refresh app action
    private fun refreshApp() {
        delegate?.refreshBundle()
        toggleExpandedState() // This will hide the menu
    }

    // Toggle between expanded and collapsed states
    private fun toggleExpandedState() {
        isExpanded = !isExpanded
        Log.d("FloatingButton", "Toggle expanded state: $isExpanded")

        if (isExpanded) {
            showMenu()
        } else {
            hideMenu()
        }
    }

    // Show the menu with animation
    @SuppressLint("NewApi")
    private fun showMenu() {
        if (menuView != null) return // Menu already showing

        // Get screen dimensions
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val windowMetrics = windowManager.currentWindowMetrics
        val screenWidth = windowMetrics.bounds.width()
        val screenHeight = windowMetrics.bounds.height()

        // Get button position in window coordinates
        val buttonPosition = IntArray(2)
        getLocationOnScreen(buttonPosition)
        val buttonX = buttonPosition[0]
        val buttonY = buttonPosition[1]
        val buttonWidth = width
        val buttonHeight = height

        // Create menu view with 75% opacity black background (matching iOS)
        val menuBackgroundColor = Color.argb(191, 0, 0, 0) // 75% opacity black
        
        // Create a flat drawable for consistent rendering across all elements
        val menuBackground = GradientDrawable().apply {
            setColor(menuBackgroundColor)
            cornerRadius = dpToPx(10).toFloat()
        }
        
        val localMenuView = FrameLayout(context).apply {
            background = menuBackground
            elevation = dpToPx(5).toFloat()
            // Prevent menu from capturing touch events meant for items inside or dragging the main button
            isClickable = false
            isFocusable = false
        }

        // Create container for menu items
        val menuItemsContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL // Horizontal layout for menu items
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
            }
            // Use transparent background to let parent color show through
            background = null
            setBackgroundColor(Color.TRANSPARENT)
            // Padding inside the menu card
            setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10))
        }
        localMenuView.addView(menuItemsContainer)

        // Calculate menu dimensions (more dynamically based on items)
        val itemSize = dpToPx(60) // Individual item visual size
        val itemMargin = dpToPx(5) // Margin between items

        // Create Home menu item with the new outlined icon
        val homeMenuItem = createMenuItem("Home", R.drawable.ic_outlined_home)
        homeMenuItem.setOnClickListener { goHome() }
        val homeParams = LinearLayout.LayoutParams(itemSize, itemSize)
        homeParams.marginEnd = itemMargin
        menuItemsContainer.addView(homeMenuItem, homeParams)

        // Create Refresh menu item with the new outlined icon
        val refreshMenuItem = createMenuItem("Refresh", R.drawable.ic_outlined_refresh)
        refreshMenuItem.setOnClickListener { refreshApp() }
        val refreshParams = LinearLayout.LayoutParams(itemSize, itemSize)
        refreshParams.marginStart = itemMargin
        menuItemsContainer.addView(refreshMenuItem, refreshParams)

        // Measure the menuItemsContainer to get its actual dimensions
        menuItemsContainer.measure(
            MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
            MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        )
        val menuWidth = menuItemsContainer.measuredWidth
        val menuHeight = menuItemsContainer.measuredHeight

        // Calculate menu position relative to button
        var menuX: Float
        var menuY: Float

        val isOnRightSide = x + width / 2 > context.resources.displayMetrics.widthPixels / 2

        if (isOnRightSide) {
            menuX = x + width - menuWidth
            if (menuX < edgeSpacing) menuX = edgeSpacing.toFloat()
        } else {
            menuX = x
            if (menuX + menuWidth > context.resources.displayMetrics.widthPixels - edgeSpacing) {
                menuX = (context.resources.displayMetrics.widthPixels - menuWidth - edgeSpacing).toFloat()
            }
        }

        val shouldShowAbove = y + height / 2 > context.resources.displayMetrics.heightPixels / 2

        if (shouldShowAbove) {
            menuY = y - menuHeight - menuGap
            if (menuY < edgeSpacing) menuY = edgeSpacing.toFloat()
        } else {
            menuY = y + height + menuGap
            if (menuY + menuHeight > context.resources.displayMetrics.heightPixels - edgeSpacing) {
                menuY = (context.resources.displayMetrics.heightPixels - menuHeight - edgeSpacing).toFloat()
            }
        }

        Log.d("FloatingButton", "Menu calculated size: ($menuWidth, $menuHeight)")
        Log.d("FloatingButton", "Menu position: ($menuX, $menuY), should show above: $shouldShowAbove, menu gap: $menuGap")

        val rootView = rootView as ViewGroup
        // Important: Set the layout params for the menuView itself *before* adding to root view
        val menuCardLayoutParams = FrameLayout.LayoutParams(menuWidth, menuHeight)
        localMenuView.layoutParams = menuCardLayoutParams
        rootView.addView(localMenuView)

        localMenuView.x = menuX
        localMenuView.y = menuY

        localMenuView.alpha = 0f
        localMenuView.animate()
            .alpha(1f)
            .setDuration(300)
            .start()
        
        // Save reference to menu view
        this.menuView = localMenuView
    }
    
    // Create a menu item with icon and text - transparent to match menu
    private fun createMenuItem(title: String, iconRes: Int): LinearLayout {
        return LinearLayout(context).apply {
            // Use completely transparent background
            background = null
            setBackgroundColor(Color.TRANSPARENT)
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            isClickable = true // Make the LinearLayout clickable
            isFocusable = true

            // Padding within the item itself
            setPadding(dpToPx(4), dpToPx(8), dpToPx(4), dpToPx(8))
            
            // Create a transparent ripple effect when clicked
            val outValue = android.util.TypedValue()
            context.theme.resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, outValue, true)
            foreground = ContextCompat.getDrawable(context, outValue.resourceId)

            addView(ImageView(context).apply {
                layoutParams = LinearLayout.LayoutParams(
                    dpToPx(22),
                    dpToPx(22)
                ).apply {
                    bottomMargin = dpToPx(4)
                }
                setImageResource(iconRes)
                setColorFilter(Color.WHITE) // Icon color
                // Use transparent background
                background = null
            })

            addView(TextView(context).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                text = title
                setTextColor(Color.WHITE) // Text color
                textSize = 10f // Text size
                gravity = Gravity.CENTER // Center text within TextView if it wraps
                // Use transparent background
                background = null
            })
        }
    }

    // Hide the menu with animation
    private fun hideMenu() {
        val currentMenu = menuView ?: return // No menu to hide

        // Animate fade out
        currentMenu.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction {
                // Remove from parent after animation
                val parent = currentMenu.parent as? ViewGroup
                parent?.removeView(currentMenu)
                menuView = null
            }
            .start()
    }

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
        // Always intercept touch events to handle drags
        return true
    }

override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.action) {
        MotionEvent.ACTION_DOWN -> {
            // Save initial positions for all interactions, even if expanded
            initialX = x
            initialY = y
            initialTouchX = event.rawX
            initialTouchY = event.rawY
            lastTouchX = event.rawX
            lastTouchY = event.rawY
            isDragging = false

            // Request parent not to intercept touch events
            parent?.requestDisallowInterceptTouchEvent(true)
            return true
        }

        MotionEvent.ACTION_MOVE -> {
            // If menu is expanded, don't allow dragging, only handle toggle clicks
            if (isExpanded) {
                return true
            }
            
            // Calculate how far we've moved from the initial touch point
            val deltaX = Math.abs(event.rawX - initialTouchX)
            val deltaY = Math.abs(event.rawY - initialTouchY)

            // Check if we've moved enough to consider it a drag
            if (!isDragging && (Math.abs(deltaX) > clickDragThreshold || Math.abs(deltaY) > clickDragThreshold)) {
                isDragging = true
                Log.d("FloatingButton", "Started dragging")
            }

            if (isDragging) {
                // Calculate movement delta from the last position
                val moveDeltaX = event.rawX - lastTouchX
                val moveDeltaY = event.rawY - lastTouchY

                // Update position
                x += moveDeltaX
                y += moveDeltaY

                // Keep button within parent bounds
                val parentView = parent as? ViewGroup
                if (parentView != null) {
                    x = x.coerceIn(0f, (parentView.width - width).toFloat())
                    y = y.coerceIn(0f, (parentView.height - height).toFloat())
                }

                // Update last touch position
                lastTouchX = event.rawX
                lastTouchY = event.rawY

                Log.d("FloatingButton", "Dragging to: (${x}, ${y})")
            }
            return true
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            // Allow parent to handle touch events again
            parent?.requestDisallowInterceptTouchEvent(false)

            if (isDragging) {
                // If we were dragging, snap to edge
                snapToEdge()
                isDragging = false
                Log.d("FloatingButton", "Drag ended, snapping to edge")
                return true
            } else {
                // If not dragging, this was a click
                toggleExpandedState()
                if (isExpanded) {
                    Log.d("FloatingButton", "Button clicked, showing menu")
                } else {
                    Log.d("FloatingButton", "Button clicked, hiding menu")
                }
                performClick() // For accessibility
                return true
            }
        }
    }
    return super.onTouchEvent(event)
}

    // Snap the button to the nearest edge after dragging
    private fun snapToEdge() {
        val parentView = parent as? ViewGroup ?: return
        val screenWidth = parentView.width
        val buttonWidth = width

        // Determine if the button should snap to the left or right edge
        val distFromLeft = x
        val distFromRight = screenWidth - (x + buttonWidth)

        val targetX = if (distFromLeft < distFromRight) {
            edgeSpacing.toFloat() // Left edge with 5dp padding
        } else {
            (screenWidth - buttonWidth - edgeSpacing).toFloat() // Right edge with 5dp padding
        }

        // Define threshold boundaries for top and bottom navigation areas
        val topNavHeight = dpToPx(100) // Approximate height for top navigation/status bar area
        val bottomNavHeight = dpToPx(100) // Approximate height for bottom navigation/tab bar area
        
        // Calculate the safe area for vertical positioning
        val topLimit = dpToPx(topNavHeight / 2).toFloat()
        val bottomLimit = (parentView.height - height - bottomNavHeight / 2).toFloat()
        
        // Restrict from going into top navigation area
        var targetY = y
        if (y < topLimit) {
            targetY = topLimit + edgeSpacing.toFloat()
        }
        
        // Restrict from going into bottom navigation area
        if (y + height > bottomLimit) {
            targetY = bottomLimit - height - edgeSpacing.toFloat()
        }

        // Animate to target position
        animate()
            .x(targetX)
            .y(targetY)
            .setDuration(300)
            .start()

        Log.d("FloatingButton", "Snapping to: ($targetX, $targetY)")
    }
}