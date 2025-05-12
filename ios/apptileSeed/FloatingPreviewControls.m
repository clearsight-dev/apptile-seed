//
//  FloatingPreviewControls.m
//  apptileSeed
//
//  Created by Gaurav Gautam on 22/02/25.
//

#import <Foundation/Foundation.h>
#import <objc/runtime.h>

#import "FloatingPreviewControls.h"

@implementation FloatingPreviewControls {
  UIButton *clearButton;
  UIButton *homeButton;
  UIButton *refreshButton;
  UIButton *screenCaptureButton;
  UIButton *backButton;
  UIView *expandedView;
  NSLayoutConstraint *widthConstraint;
  NSLayoutConstraint *heightConstraint;
  UIPanGestureRecognizer *panGesture;
  NSLayoutConstraint *centerX;
  NSLayoutConstraint *centerY;
  UILabel *versionLabel;
}

- (instancetype)initWithParentView:(UIView *)parentView {
  self = [super init];
  if (self) {
    float collapsedSize = 50;
    float expandedSize = 300;
    
    self.translatesAutoresizingMaskIntoConstraints = NO;
    self.backgroundColor = [UIColor colorWithWhite:0.0 alpha:0.9];
    self.layer.cornerRadius = 10.0;
    self.clipsToBounds = YES;
    self.isExpanded = NO;
    
    // Create the main clear button (collapsed state) - make it cover the entire control area
    clearButton = [UIButton buttonWithType:UIButtonTypeCustom];
    clearButton.translatesAutoresizingMaskIntoConstraints = NO;
    clearButton.userInteractionEnabled = YES;
    clearButton.backgroundColor = [UIColor clearColor]; // Make it transparent
    
    // Create a custom circle view instead of using a system image
    UIView *circleView = [[UIView alloc] init];
    circleView.translatesAutoresizingMaskIntoConstraints = NO;
    circleView.backgroundColor = [UIColor whiteColor];
    circleView.layer.cornerRadius = 15.0; // Half the width/height to make it a circle
    
    // Add shadow to the circle
    circleView.layer.shadowColor = [UIColor blackColor].CGColor;
    circleView.layer.shadowOffset = CGSizeMake(0, 2);
    circleView.layer.shadowOpacity = 0.3;
    circleView.layer.shadowRadius = 3.0;
    
    [clearButton addSubview:circleView];
    
    // Constraints for the circle view
    [NSLayoutConstraint activateConstraints:@[
        [circleView.widthAnchor constraintEqualToConstant:30.0],
        [circleView.heightAnchor constraintEqualToConstant:30.0],
        [circleView.centerXAnchor constraintEqualToAnchor:clearButton.centerXAnchor],
        [circleView.centerYAnchor constraintEqualToAnchor:clearButton.centerYAnchor]
    ]];
    
    // Add tap action
    [clearButton addTarget:self action:@selector(toggleExpandedState) forControlEvents:UIControlEventTouchUpInside];
    
    // Add button to view hierarchy and ensure it's visible
    [self addSubview:clearButton];
    
    // Add a direct touch handler to the view to ensure taps are detected
    self.userInteractionEnabled = YES;
    
    // Add a tap gesture recognizer as backup
    UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleButtonTap:)];
    [clearButton addGestureRecognizer:tapGesture];
    
    // Debug the button's frame
    NSLog(@"Clear button frame: %@", NSStringFromCGRect(clearButton.frame));
    
    // Create expanded view (will be hidden initially)
    expandedView = [[UIView alloc] init];
    expandedView.translatesAutoresizingMaskIntoConstraints = NO;
    expandedView.backgroundColor = [UIColor clearColor];
    expandedView.alpha = 0;
    [self addSubview:expandedView];
    
    // Version label
    versionLabel = [[UILabel alloc] init];
    versionLabel.translatesAutoresizingMaskIntoConstraints = NO;
    versionLabel.text = @"App Version 2.0.7";
    versionLabel.textColor = [UIColor whiteColor];
    versionLabel.textAlignment = NSTextAlignmentCenter;
    versionLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    [expandedView addSubview:versionLabel];
    
    // Home button
    homeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    homeButton.translatesAutoresizingMaskIntoConstraints = NO;
    [homeButton setImage:[UIImage systemImageNamed:@"house"] forState:UIControlStateNormal];
    [homeButton setTintColor:[UIColor whiteColor]];
    [homeButton addTarget:self action:@selector(goHome) forControlEvents:UIControlEventTouchUpInside];
    [homeButton setTitle:@"Home" forState:UIControlStateNormal];
    homeButton.titleLabel.font = [UIFont systemFontOfSize:14];
    [homeButton setContentVerticalAlignment:UIControlContentVerticalAlignmentBottom];
    homeButton.titleEdgeInsets = UIEdgeInsetsMake(5, -50, -20, 0);
    homeButton.imageEdgeInsets = UIEdgeInsetsMake(-15, 0, 0, -50);
    [expandedView addSubview:homeButton];
    
    // Refresh button
    refreshButton = [UIButton buttonWithType:UIButtonTypeSystem];
    refreshButton.translatesAutoresizingMaskIntoConstraints = NO;
    [refreshButton setImage:[UIImage systemImageNamed:@"arrow.clockwise"] forState:UIControlStateNormal];
    [refreshButton setTintColor:[UIColor whiteColor]];
    [refreshButton setTitle:@"Refresh\nApp" forState:UIControlStateNormal];
    refreshButton.titleLabel.font = [UIFont systemFontOfSize:14];
    refreshButton.titleLabel.numberOfLines = 2;
    refreshButton.titleLabel.textAlignment = NSTextAlignmentCenter;
    [refreshButton setContentVerticalAlignment:UIControlContentVerticalAlignmentBottom];
    refreshButton.titleEdgeInsets = UIEdgeInsetsMake(5, -50, -20, 0);
    refreshButton.imageEdgeInsets = UIEdgeInsetsMake(-15, 0, 0, -50);
    [expandedView addSubview:refreshButton];
    
    // Screen Capture button
    screenCaptureButton = [UIButton buttonWithType:UIButtonTypeSystem];
    screenCaptureButton.translatesAutoresizingMaskIntoConstraints = NO;
    [screenCaptureButton setImage:[UIImage systemImageNamed:@"viewfinder"] forState:UIControlStateNormal];
    [screenCaptureButton setTintColor:[UIColor whiteColor]];
    [screenCaptureButton setTitle:@"Screen\nCapture" forState:UIControlStateNormal];
    screenCaptureButton.titleLabel.font = [UIFont systemFontOfSize:14];
    screenCaptureButton.titleLabel.numberOfLines = 2;
    screenCaptureButton.titleLabel.textAlignment = NSTextAlignmentCenter;
    [screenCaptureButton setContentVerticalAlignment:UIControlContentVerticalAlignmentBottom];
    screenCaptureButton.titleEdgeInsets = UIEdgeInsetsMake(5, -50, -20, 0);
    screenCaptureButton.imageEdgeInsets = UIEdgeInsetsMake(-15, 0, 0, -50);
    [expandedView addSubview:screenCaptureButton];
    
    // We're removing the back button as the original button will act as a toggle
    
    // Set up constraints
    
    widthConstraint = [self.widthAnchor constraintEqualToConstant:collapsedSize];
    heightConstraint = [self.heightAnchor constraintEqualToConstant:collapsedSize];
    
    [NSLayoutConstraint activateConstraints:@[
      widthConstraint,
      heightConstraint,
      
      // Clear button (collapsed state) - make it fill the entire control
      [clearButton.topAnchor constraintEqualToAnchor:self.topAnchor],
      [clearButton.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [clearButton.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
      [clearButton.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
      
      // Expanded view
      [expandedView.topAnchor constraintEqualToAnchor:self.topAnchor],
      [expandedView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [expandedView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
      [expandedView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
      
      // Version label
      [versionLabel.topAnchor constraintEqualToAnchor:expandedView.topAnchor constant:20],
      [versionLabel.centerXAnchor constraintEqualToAnchor:expandedView.centerXAnchor],
      
      // Home button
      [homeButton.centerXAnchor constraintEqualToAnchor:expandedView.centerXAnchor],
      [homeButton.topAnchor constraintEqualToAnchor:versionLabel.bottomAnchor constant:30],
      [homeButton.widthAnchor constraintEqualToConstant:80],
      [homeButton.heightAnchor constraintEqualToConstant:80],
      
      // Refresh button
      [refreshButton.leadingAnchor constraintEqualToAnchor:expandedView.leadingAnchor constant:30],
      [refreshButton.topAnchor constraintEqualToAnchor:homeButton.bottomAnchor constant:20],
      [refreshButton.widthAnchor constraintEqualToConstant:80],
      [refreshButton.heightAnchor constraintEqualToConstant:80],
      
      // Screen Capture button
      [screenCaptureButton.trailingAnchor constraintEqualToAnchor:expandedView.trailingAnchor constant:-30],
      [screenCaptureButton.topAnchor constraintEqualToAnchor:homeButton.bottomAnchor constant:20],
      [screenCaptureButton.widthAnchor constraintEqualToConstant:80],
      [screenCaptureButton.heightAnchor constraintEqualToConstant:80],
      
      // No back button constraints needed
    ]];
    
    panGesture = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
    panGesture.cancelsTouchesInView = NO; // Allow touches to be delivered to subviews
    panGesture.delegate = self; // Set self as the delegate to control when gestures can begin
    [self addGestureRecognizer:panGesture];
    
    // Add a tap gesture to the entire control as fallback
    UITapGestureRecognizer *controlTapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleControlTap:)];
    controlTapGesture.cancelsTouchesInView = NO;
    [self addGestureRecognizer:controlTapGesture];
    
    [parentView addSubview:self];
    
    centerX = [self.centerXAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.leadingAnchor constant: (0.5 * collapsedSize) + 5];
    centerY = [self.centerYAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.centerYAnchor];
    
    [NSLayoutConstraint activateConstraints:@[centerX, centerY]];
    
    // Position the button initially snapped to the right edge
    CGFloat screenWidth = parentView.bounds.size.width;
    centerX.constant = screenWidth - (collapsedSize/2) - 5;
    
    // Also ensure it's positioned within the vertical safe area
    CGFloat screenHeight = parentView.bounds.size.height;
    float topNavHeight = 100;
    float bottomNavHeight = 100;
    float verticalCenter = screenHeight * 0.4; // Position at 40% from the top
    
    // Convert from parent center-based coordinate to our centerY constraint
    centerY.constant = verticalCenter - (screenHeight/2);
  }
  return self;
}

- (void)goHome {
  [self.delegate resetToDefaultBundle];
  [self toggleExpandedState];
}

- (void)refreshApp {
  [self.delegate refreshBundle];
  [self toggleExpandedState];
}

- (void)toggleExpandedState {
  // Toggle the state
  self.isExpanded = !self.isExpanded;
  NSLog(@"Toggle expanded state: %d", self.isExpanded);
  
  // Constants for sizing
  float collapsedSize = 50;
  float expandedSize = 200;
  float menuGap = 5; // Gap between button and menu
  
  // Get the screen dimensions
  UIWindow *window = UIApplication.sharedApplication.windows.firstObject;
  CGRect screenBounds = window.bounds;
  
  // Get the button's position in window coordinates - more accurate positioning
  CGPoint buttonCenter = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  CGPoint buttonPositionInWindow = [self convertPoint:buttonCenter toView:nil];
  
  // Log the button position for debugging
  NSLog(@"Button center in window: (%.1f, %.1f)", buttonPositionInWindow.x, buttonPositionInWindow.y);
  
  if (self.isExpanded) {
    // Create a menu view
    UIView *menuView = [[UIView alloc] init];
    menuView.backgroundColor = [UIColor colorWithWhite:0.0 alpha:0.75]; // 75% opacity black
    menuView.layer.cornerRadius = 10.0; // Rounded corners
    
    // Add menuView to the window
    [window addSubview:menuView];
    
    // Create grid layout for menu items
    CGFloat itemSize = 60.0;  // Reduced size for each grid item
    CGFloat itemPadding = 12.0;  // Reduced padding between items
    CGFloat menuPadding = 10.0;  // Reduced padding inside the menu view
    int maxColumns = 3;  // Maximum columns in the grid
    
    // For now, we have 2 options - Home and Refresh
    int itemCount = 2;
    int columns = MIN(itemCount, maxColumns);  // Use only as many columns as needed
    int rows = (itemCount + maxColumns - 1) / maxColumns;  // Ceiling division
    
    // Calculate menu size based on content
    CGFloat menuWidth = menuPadding * 2 + columns * itemSize + (columns - 1) * itemPadding;
    CGFloat menuHeight = menuPadding * 2 + rows * itemSize + (rows - 1) * itemPadding;
    
    // Create Home button with custom vertical layout
    UIButton *homeMenuItem = [UIButton buttonWithType:UIButtonTypeCustom]; // Use custom type for better control
    homeMenuItem.frame = CGRectMake(menuPadding, menuPadding, itemSize, itemSize);
    
    // Configure icon with centered alignment
    UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration configurationWithPointSize:22.0]; // Slightly larger icon for better visibility
    UIImage *homeImage = [[UIImage systemImageNamed:@"house"] imageByApplyingSymbolConfiguration:config];
    
    // Create a vertical stack layout
    UIStackView *homeStack = [[UIStackView alloc] init];
    homeStack.axis = UILayoutConstraintAxisVertical;
    homeStack.alignment = UIStackViewAlignmentCenter;
    homeStack.distribution = UIStackViewDistributionFill;
    homeStack.spacing = 4.0; // Space between icon and text
    homeStack.translatesAutoresizingMaskIntoConstraints = NO;
    
    // Create image view for icon
    UIImageView *homeImageView = [[UIImageView alloc] initWithImage:homeImage];
    homeImageView.tintColor = [UIColor whiteColor];
    homeImageView.contentMode = UIViewContentModeScaleAspectFit;
    
    // Create label for text
    UILabel *homeLabel = [[UILabel alloc] init];
    homeLabel.text = @"Home";
    homeLabel.textColor = [UIColor whiteColor];
    homeLabel.font = [UIFont systemFontOfSize:10];
    homeLabel.textAlignment = NSTextAlignmentCenter;
    
    // Add to stack
    [homeStack addArrangedSubview:homeImageView];
    [homeStack addArrangedSubview:homeLabel];
    
    // Add stack to button area
    [homeMenuItem addSubview:homeStack];
    
    // Center stack in button
    [NSLayoutConstraint activateConstraints:@[
      [homeStack.centerXAnchor constraintEqualToAnchor:homeMenuItem.centerXAnchor],
      [homeStack.centerYAnchor constraintEqualToAnchor:homeMenuItem.centerYAnchor]
    ]];
    
    // Make the entire homeMenuItem clickable
    [homeMenuItem addTarget:self action:@selector(goHome) forControlEvents:UIControlEventTouchUpInside];
    
    // Create Refresh button with matching custom vertical layout
    UIButton *refreshMenuItem = [UIButton buttonWithType:UIButtonTypeCustom]; // Use custom type for better control
    refreshMenuItem.frame = CGRectMake(menuPadding + itemSize + itemPadding, menuPadding, itemSize, itemSize);
    
    // Use the same icon configuration for consistency
    UIImage *refreshImage = [[UIImage systemImageNamed:@"arrow.clockwise"] imageByApplyingSymbolConfiguration:config];
    
    // Create a similar vertical stack layout
    UIStackView *refreshStack = [[UIStackView alloc] init];
    refreshStack.axis = UILayoutConstraintAxisVertical;
    refreshStack.alignment = UIStackViewAlignmentCenter;
    refreshStack.distribution = UIStackViewDistributionFill;
    refreshStack.spacing = 4.0; // Same spacing as home button
    refreshStack.translatesAutoresizingMaskIntoConstraints = NO;
    
    // Create image view for icon
    UIImageView *refreshImageView = [[UIImageView alloc] initWithImage:refreshImage];
    refreshImageView.tintColor = [UIColor whiteColor];
    refreshImageView.contentMode = UIViewContentModeScaleAspectFit;
    
    // Create label for text
    UILabel *refreshLabel = [[UILabel alloc] init];
    refreshLabel.text = @"Refresh";
    refreshLabel.textColor = [UIColor whiteColor];
    refreshLabel.font = [UIFont systemFontOfSize:10];
    refreshLabel.textAlignment = NSTextAlignmentCenter;
    
    // Add to stack
    [refreshStack addArrangedSubview:refreshImageView];
    [refreshStack addArrangedSubview:refreshLabel];
    
    // Add stack to button area
    [refreshMenuItem addSubview:refreshStack];
    
    // Center stack in button
    [NSLayoutConstraint activateConstraints:@[
      [refreshStack.centerXAnchor constraintEqualToAnchor:refreshMenuItem.centerXAnchor],
      [refreshStack.centerYAnchor constraintEqualToAnchor:refreshMenuItem.centerYAnchor]
    ]];
    
    // Make the entire refreshMenuItem clickable
    [refreshMenuItem addTarget:self action:@selector(refreshApp) forControlEvents:UIControlEventTouchUpInside];
    
    // Add buttons to menu
    [menuView addSubview:homeMenuItem];
    [menuView addSubview:refreshMenuItem];
    
    // Position the menu relative to the button
    CGFloat menuX, menuY;
    // Use the calculated dimensions based on content instead of fixed size
    
    // Determine if button is on the left or right side of the screen
    BOOL isOnRightSide = buttonPositionInWindow.x > screenBounds.size.width / 2;
    
    if (isOnRightSide) {
      // Button is on the right side, align menu's right edge with button's right edge
      menuX = buttonPositionInWindow.x + collapsedSize/2 - menuWidth;
      
      // Ensure menu doesn't go off the left edge
      if (menuX < 5) {
        menuX = 5;
      }
    } else {
      // Button is on the left side, align menu's left edge with button's left edge
      menuX = buttonPositionInWindow.x - collapsedSize/2;
      
      // Ensure menu doesn't go off the right edge
      if (menuX + menuWidth > screenBounds.size.width - 5) {
        menuX = screenBounds.size.width - menuWidth - 5;
      }
    }
    
    // Calculate the button's exact bounds in window coordinates
    CGRect buttonBounds = self.bounds;
    CGRect buttonFrameInWindow = [self convertRect:buttonBounds toView:nil];
    CGFloat buttonTopInWindow = buttonFrameInWindow.origin.y;
    CGFloat buttonBottomInWindow = buttonFrameInWindow.origin.y + buttonFrameInWindow.size.height;
    
    // Determine if menu should appear above or below the button
    BOOL shouldShowAbove = buttonPositionInWindow.y > screenBounds.size.height / 2;
    
    if (shouldShowAbove) {
      // Position menu above the button with a gap of exactly 10px
      menuY = buttonTopInWindow - menuHeight - menuGap;
      
      // Ensure menu doesn't go off the top edge
      if (menuY < 5) {
        menuY = 5;
      }
    } else {
      // Position menu below the button with a gap of exactly 10px
      menuY = buttonBottomInWindow + menuGap;
      
      // Ensure menu doesn't go off the bottom edge
      if (menuY + menuHeight > screenBounds.size.height - 5) {
        menuY = screenBounds.size.height - menuHeight - 5;
      }
    }
    
    // Print debug info
    NSLog(@"Button frame in window: %@, Menu position: (%.1f, %.1f), Should show above: %d, Menu gap: %.1f", 
          NSStringFromCGRect(buttonFrameInWindow), menuX, menuY, shouldShowAbove, menuGap);
    
    // Set the menu frame and show with animation
    menuView.frame = CGRectMake(menuX, menuY, menuWidth, menuHeight);
    menuView.alpha = 0;
    
    [UIView animateWithDuration:0.3 animations:^{
      menuView.alpha = 1;
    }];
    
    // Add a shadow to the menu
    menuView.layer.shadowColor = [UIColor blackColor].CGColor;
    menuView.layer.shadowOffset = CGSizeMake(0, 3);
    menuView.layer.shadowOpacity = 0.3;
    menuView.layer.shadowRadius = 5.0;
    
    // Store reference to menuView for later removal
    objc_setAssociatedObject(self, "menuView", menuView, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  } else {
    // Collapse - remove the menu view
    UIView *menuView = objc_getAssociatedObject(self, "menuView");
    
    // Check if the menuView exists
    if (menuView) {
      [UIView animateWithDuration:0.3 animations:^{
        menuView.alpha = 0;
      } completion:^(BOOL finished) {
        // Remove menuView from window
        [menuView removeFromSuperview];
        
        // Clear the reference
        objc_setAssociatedObject(self, "menuView", nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      }];
    } else {
      NSLog(@"No menu view found to collapse");
    }
  }
}

- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer {
  // Check if this is our pan gesture and the menu is expanded
  if (gestureRecognizer == panGesture && self.isExpanded) {
    NSLog(@"Blocking pan gesture because menu is expanded");
    return NO; // Prevent the gesture from starting
  }
  return YES; // Allow other gestures and pan when not expanded
}

- (void)handlePan:(UIPanGestureRecognizer *)gesture {
  // Double check in case the delegate method doesn't catch it
  if (self.isExpanded) {
    NSLog(@"Ignoring pan gesture while menu is expanded");
    return;
  }
  
  CGPoint translation = [gesture translationInView:self.superview];
  centerX.constant += translation.x;
  centerY.constant += translation.y;
  
  [gesture setTranslation:CGPointZero inView:self.superview];
  
  if (gesture.state == UIGestureRecognizerStateEnded ||
      gesture.state == UIGestureRecognizerStateCancelled) {
    CGRect superBounds = self.superview.bounds;
    CGFloat screenWidth = superBounds.size.width;
    CGFloat screenHeight = superBounds.size.height;
    float buttonSize = self.isExpanded ? 300 : 50;
    
    // Determine if the button should snap to the left or right edge
    CGFloat distFromLeft = centerX.constant - (buttonSize/2);
    CGFloat distFromRight = screenWidth - (centerX.constant + (buttonSize/2));
    
    // Snap to left or right edge based on which is closer
    if (distFromLeft < distFromRight) {
      // Snap to left edge with a small gap
      centerX.constant = buttonSize/2 + 5;
    } else {
      // Snap to right edge with a small gap
      centerX.constant = screenWidth - buttonSize/2 - 5;
    }
    
    // Keep the button within the middle area of the screen, away from top and bottom navigation areas
    float topNavHeight = 100; // Approximate height for top navigation/status bar area
    float bottomNavHeight = 100; // Approximate height for bottom navigation/tab bar area
    
    // Calculate the safe area for vertical positioning
    float topLimit = -screenHeight/2 + topNavHeight;
    float bottomLimit = screenHeight/2 - bottomNavHeight;
    
    // Restrict from going into top navigation area
    if (centerY.constant - buttonSize/2 < topLimit) {
      centerY.constant = topLimit + buttonSize/2 + 5;
    }
    
    // Restrict from going into bottom navigation area
    if (centerY.constant + buttonSize/2 > bottomLimit) {
      centerY.constant = bottomLimit - buttonSize/2 - 5;
    }
    
    [UIView animateWithDuration:0.3 animations:^{
      [self.superview layoutIfNeeded];
    }];
  }
}

- (void)handleButtonTap:(UITapGestureRecognizer *)gesture {
  NSLog(@"Button tapped via gesture recognizer");
  [self toggleExpandedState];
}

- (void)handleControlTap:(UITapGestureRecognizer *)gesture {
  // Only handle taps that occur in the clearButton area
  CGPoint tapLocation = [gesture locationInView:self];
  if (CGRectContainsPoint(clearButton.frame, tapLocation)) {
    NSLog(@"Control tapped in button area - frame: %@, tap location: %@", 
          NSStringFromCGRect(clearButton.frame), NSStringFromCGPoint(tapLocation));
    [self toggleExpandedState];
  }
}

@end
