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

    // Create the main clear button (collapsed state) - make it cover the entire
    // control area
    clearButton = [UIButton buttonWithType:UIButtonTypeCustom];
    clearButton.translatesAutoresizingMaskIntoConstraints = NO;
    clearButton.userInteractionEnabled = YES;
    clearButton.backgroundColor = [UIColor clearColor]; // Make it transparent

    // Create a custom circle view instead of using a system image
    UIView *circleView = [[UIView alloc] init];
    circleView.translatesAutoresizingMaskIntoConstraints = NO;
    circleView.backgroundColor = [UIColor whiteColor];
    circleView.layer.cornerRadius =
        15.0; // Half the width/height to make it a circle

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
      [circleView.centerXAnchor
          constraintEqualToAnchor:clearButton.centerXAnchor],
      [circleView.centerYAnchor
          constraintEqualToAnchor:clearButton.centerYAnchor]
    ]];

    // Add tap action
    [clearButton addTarget:self
                    action:@selector(toggleExpandedState)
          forControlEvents:UIControlEventTouchUpInside];

    // Add button to view hierarchy and ensure it's visible
    [self addSubview:clearButton];

    // Add a direct touch handler to the view to ensure taps are detected
    self.userInteractionEnabled = YES;

    // Add a tap gesture recognizer as backup
    UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc]
        initWithTarget:self
                action:@selector(handleButtonTap:)];
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

    // Home button - using custom type for better touch handling
    homeButton = [UIButton buttonWithType:UIButtonTypeCustom];
    homeButton.translatesAutoresizingMaskIntoConstraints = NO;
    [homeButton setImage:[UIImage systemImageNamed:@"house"]
                forState:UIControlStateNormal];
    [homeButton setTintColor:[UIColor whiteColor]];
    [homeButton setTitle:@"Home" forState:UIControlStateNormal];
    [homeButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    homeButton.titleLabel.font = [UIFont systemFontOfSize:14];
    homeButton.titleLabel.textAlignment = NSTextAlignmentCenter;
    
    // Make touch area larger than visual area
    homeButton.contentEdgeInsets = UIEdgeInsetsMake(10, 10, 10, 10);
    
    // Add multiple touch handlers for redundancy
    [homeButton addTarget:self action:@selector(homeButtonPressed:) forControlEvents:UIControlEventTouchUpInside];
    
    // Add additional tap gesture recognizer as backup
    UITapGestureRecognizer *homeButtonTap = [[UITapGestureRecognizer alloc]
        initWithTarget:self action:@selector(homeButtonTapped:)];
    [homeButton addGestureRecognizer:homeButtonTap];
    
    // Visual setup
    [homeButton setContentVerticalAlignment:UIControlContentVerticalAlignmentBottom];
    homeButton.titleEdgeInsets = UIEdgeInsetsMake(5, -40, -20, 0);
    homeButton.imageEdgeInsets = UIEdgeInsetsMake(-15, 0, 0, -40);
    
    // Add strong visual indicator
    homeButton.layer.borderWidth = 1.0;
    homeButton.layer.borderColor = [UIColor whiteColor].CGColor;
    homeButton.layer.cornerRadius = 8.0;
    
    [expandedView addSubview:homeButton];

    // Set up constraints

    widthConstraint =
        [self.widthAnchor constraintEqualToConstant:collapsedSize];
    heightConstraint =
        [self.heightAnchor constraintEqualToConstant:collapsedSize];

    [NSLayoutConstraint activateConstraints:@[
      widthConstraint, heightConstraint,

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
      [versionLabel.topAnchor constraintEqualToAnchor:expandedView.topAnchor
                                             constant:20],
      [versionLabel.centerXAnchor
          constraintEqualToAnchor:expandedView.centerXAnchor],

      // Home button
      [homeButton.centerXAnchor
          constraintEqualToAnchor:expandedView.centerXAnchor],
      [homeButton.topAnchor constraintEqualToAnchor:versionLabel.bottomAnchor
                                           constant:30],
      [homeButton.widthAnchor constraintEqualToConstant:100], // Wider button
      [homeButton.heightAnchor constraintEqualToConstant:100], // Taller button

      // No back button constraints needed
    ]];

    panGesture =
        [[UIPanGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handlePan:)];
    panGesture.cancelsTouchesInView =
        NO; // Allow touches to be delivered to subviews
    panGesture.delegate =
        self; // Set self as the delegate to control when gestures can begin
    [self addGestureRecognizer:panGesture];

    // Add a tap gesture to the entire control as fallback
    UITapGestureRecognizer *controlTapGesture = [[UITapGestureRecognizer alloc]
        initWithTarget:self
                action:@selector(handleControlTap:)];
    controlTapGesture.cancelsTouchesInView = NO;
    [self addGestureRecognizer:controlTapGesture];

    [parentView addSubview:self];

    centerX = [self.centerXAnchor
        constraintEqualToAnchor:parentView.safeAreaLayoutGuide.leadingAnchor
                       constant:(0.5 * collapsedSize) + 5];
    centerY = [self.centerYAnchor
        constraintEqualToAnchor:parentView.safeAreaLayoutGuide.centerYAnchor];

    [NSLayoutConstraint activateConstraints:@[ centerX, centerY ]];

    // Position the button initially snapped to the right edge
    CGFloat screenWidth = parentView.bounds.size.width;
    centerX.constant = screenWidth - (collapsedSize / 2) - 5;

    // Also ensure it's positioned within the vertical safe area
    CGFloat screenHeight = parentView.bounds.size.height;
    float topNavHeight = 100;
    float bottomNavHeight = 100;
    float verticalCenter = screenHeight * 0.4; // Position at 40% from the top

    // Convert from parent center-based coordinate to our centerY constraint
    centerY.constant = verticalCenter - (screenHeight / 2);
  }
  return self;
}

// Home button interaction methods
- (void)homeButtonPressed:(UIButton *)sender {
  NSLog(@"Home button pressed via target-action");
  [self goHome];
}

- (void)homeButtonTapped:(UITapGestureRecognizer *)gesture {
  NSLog(@"Home button tapped via gesture recognizer");
  [self goHome];
}

// Menu item interaction methods
- (void)homeMenuItemPressed:(UIButton *)sender {
  NSLog(@"Home menu item pressed");
  [self goHome];
}

- (void)homeMenuItemTapped:(UITapGestureRecognizer *)gesture {
  NSLog(@"Home menu item tapped via gesture");
  [self goHome];
}

// Visual feedback methods
- (void)homeButtonHighlight:(UIButton *)sender {
  sender.alpha = 0.7;
  sender.backgroundColor = [UIColor colorWithWhite:1.0 alpha:0.3];
}

- (void)homeButtonUnhighlight:(UIButton *)sender {
  sender.alpha = 1.0;
  sender.backgroundColor = [UIColor colorWithWhite:1.0 alpha:0.1];
}

- (void)goHome {
  NSLog(@"Go Home action triggered");

  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory,
                                                       NSUserDomainMask, YES);
  NSString *documentsDirectory = [paths objectAtIndex:0];

  // Delete appConfig.json
  NSString *appConfigPath =
      [documentsDirectory stringByAppendingPathComponent:@"appConfig.json"];
  if ([fileManager fileExistsAtPath:appConfigPath]) {
    NSError *deleteError = nil;
    if ([fileManager removeItemAtPath:appConfigPath error:&deleteError]) {
      NSLog(@"Successfully deleted appConfig.json");
    } else {
      NSLog(@"Failed to delete appConfig.json: %@",
            deleteError.localizedDescription);
    }
  } else {
    NSLog(@"appConfig.json does not exist, no need to delete.");
  }

  // Overwrite previewTracker.json with previewMode: false
  NSString *previewTrackerPath = [documentsDirectory
      stringByAppendingPathComponent:@"previewTracker.json"];
  
  // Create a dictionary with previewMode set to NO
  NSDictionary *previewTrackerDict = @{@"previewMode": @NO};
  
  // Convert to JSON data
  NSError *jsonError = nil;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:previewTrackerDict
                                                    options:NSJSONWritingPrettyPrinted
                                                      error:&jsonError];
  if (jsonError) {
    NSLog(@"Error creating JSON data: %@", jsonError.localizedDescription);
    return;
  }
  
  // Write the JSON data to file
  NSError *writeError = nil;
  if ([jsonData writeToFile:previewTrackerPath options:NSDataWritingAtomic error:&writeError]) {
    NSLog(@"Successfully wrote previewMode:false to previewTracker.json");
  } else {
    NSLog(@"Failed to write to previewTracker.json: %@",
          writeError.localizedDescription);
  }

  // First make sure the menu is hidden - this is important because the menu is added to the window
  // and not as a child of this control
  // Instead of calling hideMenu, directly remove any menu view
  UIView *menuView = objc_getAssociatedObject(self, "menuView");
  if (menuView) {
    NSLog(@"Removing menu view directly");
    [menuView removeFromSuperview];
    objc_setAssociatedObject(self, "menuView", nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  
  // Also try to find and remove any menu views that might be in the window
  for (UIWindow *window in [UIApplication sharedApplication].windows) {
    for (UIView *subview in window.subviews) {
      // Look for any views that might be our menu
      if ([NSStringFromClass([subview class]) isEqualToString:@"UIView"] && 
          subview.layer.cornerRadius == 10.0 &&
          [subview.backgroundColor isEqual:[UIColor colorWithWhite:0.0 alpha:0.75]]) {
        NSLog(@"Found and removing a potential menu view from window");
        [subview removeFromSuperview];
      }
    }
  }
  
  // Attempt to remove the floating controls directly by accessing the AppDelegate
  id appDelegate = [UIApplication sharedApplication].delegate;
  if ([appDelegate respondsToSelector:@selector(floatingControls)]) {
    id floatingControls = [appDelegate valueForKey:@"floatingControls"];
    if (floatingControls) {
      NSLog(@"Removing floating preview controls directly");
      [floatingControls removeFromSuperview];
      [appDelegate setValue:nil forKey:@"floatingControls"];
    }
  }

  // Process file operations and restart the app properly
  NSLog(@"Restarting app...");
  dispatch_async(dispatch_get_main_queue(), ^{
    // First attempt to hide ourselves
    [self removeFromSuperview];
    
    // Force an update to the UI before we restart
    // This ensures the loading indicator is shown and floating controls are removed
    [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];
    
    // Try RNRestart first (cleanest method)
    Class restartClass = NSClassFromString(@"RNRestart");
    BOOL rnRestartAvailable = (restartClass && [restartClass respondsToSelector:@selector(restart)]);
    
    if (rnRestartAvailable) {
      NSLog(@"Using RNRestart to restart the app");
      // Clear the floating controls reference in app delegate before restart
      if ([appDelegate respondsToSelector:@selector(setFloatingControls:)]) {
        [appDelegate performSelector:@selector(setFloatingControls:) withObject:nil];
      }
      [restartClass performSelector:@selector(restart)];
    } else {
      NSLog(@"RNRestart not available, using proper restart sequence");
      
      // Get the main application object
      UIApplication *app = [UIApplication sharedApplication];
      
      // Create a restart intent
      NSString *bundleID = [[NSBundle mainBundle] bundleIdentifier];
      NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"%@://", bundleID]];
      
      // Post notification first to prepare React Native for restart
      [[NSNotificationCenter defaultCenter]
          postNotificationName:@"RCTJavaScriptWillStartLoadingNotification"
                        object:nil];
      
      // Since this is iOS, we don't have a direct way to restart the app programmatically
      // without using external frameworks. However, we can try the URL scheme approach
      // and then fall back to a more reliable method if needed.
      
      // First try to use a Custom URL scheme
      if ([app canOpenURL:url]) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [app openURL:url options:@{} completionHandler:^(BOOL success) {
            if (!success) {
              // If URL scheme fails, use alternative restart
              [self performAlternativeRestart:app];
            }
          }];
        });
      } else {
        // If URL scheme is not available, try alternative restart
        [self performAlternativeRestart:app];
      }
    }
  });
}

// Helper method for alternative app restart mechanisms when RNRestart is not available
- (void)performAlternativeRestart:(UIApplication *)app {
  NSLog(@"Using direct React Native restart approach");
  
  // Try to reload React Native directly using the RCTBridge
  Class RCTBridgeClass = NSClassFromString(@"RCTBridge");
  if (RCTBridgeClass && [RCTBridgeClass respondsToSelector:@selector(currentBridge)]) {
    id bridge = [RCTBridgeClass performSelector:@selector(currentBridge)];
    if (bridge && [bridge respondsToSelector:@selector(reload)]) {
      NSLog(@"Reloading RCTBridge");
      [bridge performSelector:@selector(reload)];
      return;
    }
  }
  
  // If direct reload fails, try to access the React instance manager through the AppDelegate
  id appDelegate = [UIApplication sharedApplication].delegate;
  if (appDelegate && [appDelegate respondsToSelector:@selector(bridge)]) {
    id bridge = [appDelegate performSelector:@selector(bridge)];
    if (bridge && [bridge respondsToSelector:@selector(reload)]) {
      NSLog(@"Reloading bridge from AppDelegate");
      [bridge performSelector:@selector(reload)];
      return;
    }
  }
  
  // As a very last resort, use a controlled exit
  NSLog(@"All restart methods failed, using clean exit");
  
  // Send termination notification so app can clean up
  [[NSNotificationCenter defaultCenter] 
      postNotificationName:UIApplicationWillTerminateNotification 
                    object:nil];
  
  // Final delay to ensure notification is processed
  dispatch_async(dispatch_get_main_queue(), ^{
    exit(0);
  });
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
  CGPoint buttonCenter =
      CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  CGPoint buttonPositionInWindow = [self convertPoint:buttonCenter toView:nil];

  // Log the button position for debugging
  NSLog(@"Button center in window: (%.1f, %.1f)", buttonPositionInWindow.x,
        buttonPositionInWindow.y);

  if (self.isExpanded) {
    // Create a menu view
    UIView *menuView = [[UIView alloc] init];
    menuView.backgroundColor =
        [UIColor colorWithWhite:0.0 alpha:0.75]; // 75% opacity black
    menuView.layer.cornerRadius = 10.0;          // Rounded corners

    // Add menuView to the window
    [window addSubview:menuView];

    // Create grid layout for menu items
    CGFloat itemSize = 60.0;    // Reduced size for each grid item
    CGFloat itemPadding = 12.0; // Reduced padding between items
    CGFloat menuPadding = 10.0; // Reduced padding inside the menu view
    int maxColumns = 3;         // Maximum columns in the grid

    // For now, we have 1 option - Home
    int itemCount = 1;
    int columns =
        MIN(itemCount, maxColumns); // Use only as many columns as needed
    int rows = (itemCount + maxColumns - 1) / maxColumns; // Ceiling division

    // Calculate menu size based on content
    CGFloat menuWidth = menuPadding + (columns * itemSize) +
                        MAX(0, (columns - 1)) * itemPadding + menuPadding;
    CGFloat menuHeight = menuPadding + (rows * itemSize) +
                         MAX(0, (rows - 1)) * itemPadding + menuPadding;

    // Create Home menu item with custom vertical layout - using CustomButton for better tap detection
    UIButton *homeMenuItem = [UIButton buttonWithType:UIButtonTypeCustom];
    // Make hitbox slightly larger than visual area
    homeMenuItem.frame = CGRectMake(menuPadding-5, menuPadding-5, itemSize+10, itemSize+10);
    // Add clear background color to visualize the hitbox area
    homeMenuItem.backgroundColor = [UIColor colorWithWhite:1.0 alpha:0.1];

    // Use a symbol configuration for better icon sizing and weight
    UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration
        configurationWithPointSize:itemSize * 0.4
                            weight:UIImageSymbolWeightRegular];
    UIImage *homeImage = [[UIImage systemImageNamed:@"house"]
        imageByApplyingSymbolConfiguration:config];

    // Create a vertical stack view for icon and text
    UIStackView *homeStack = [[UIStackView alloc] init];
    homeStack.axis = UILayoutConstraintAxisVertical;
    homeStack.alignment = UIStackViewAlignmentCenter;
    homeStack.distribution = UIStackViewDistributionFill;
    homeStack.spacing = 4.0; // Spacing between icon and text
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
      [homeStack.centerXAnchor
          constraintEqualToAnchor:homeMenuItem.centerXAnchor],
      [homeStack.centerYAnchor
          constraintEqualToAnchor:homeMenuItem.centerYAnchor]
    ]];

    // Make the entire homeMenuItem clickable with multiple handlers for redundancy
    [homeMenuItem addTarget:self action:@selector(homeMenuItemPressed:) forControlEvents:UIControlEventTouchUpInside];
    [homeMenuItem addTarget:self action:@selector(homeMenuItemPressed:) forControlEvents:UIControlEventTouchDown];
    
    // Add visual feedback for touches
    [homeMenuItem addTarget:self action:@selector(homeButtonHighlight:) forControlEvents:UIControlEventTouchDown];
    [homeMenuItem addTarget:self action:@selector(homeButtonUnhighlight:) forControlEvents:UIControlEventTouchUpOutside];
    [homeMenuItem addTarget:self action:@selector(homeButtonUnhighlight:) forControlEvents:UIControlEventTouchCancel];
    
    // Add a tap gesture recognizer as backup
    UITapGestureRecognizer *menuItemTap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(homeMenuItemTapped:)];
    [homeMenuItem addGestureRecognizer:menuItemTap];

    // Add buttons to menu
    [menuView addSubview:homeMenuItem];

    // Position the menu relative to the button
    CGFloat menuX, menuY;
    // Use the calculated dimensions based on content instead of fixed size

    // Determine if button is on the left or right side of the screen
    BOOL isOnRightSide = buttonPositionInWindow.x > screenBounds.size.width / 2;

    if (isOnRightSide) {
      // Button is on the right side, align menu's right edge with button's
      // right edge
      menuX = buttonPositionInWindow.x + collapsedSize / 2 - menuWidth;

      // Ensure menu doesn't go off the left edge
      if (menuX < 5) {
        menuX = 5;
      }
    } else {
      // Button is on the left side, align menu's left edge with button's left
      // edge
      menuX = buttonPositionInWindow.x - collapsedSize / 2;

      // Ensure menu doesn't go off the right edge
      if (menuX + menuWidth > screenBounds.size.width - 5) {
        menuX = screenBounds.size.width - menuWidth - 5;
      }
    }

    // Calculate the button's exact bounds in window coordinates
    CGRect buttonBounds = self.bounds;
    CGRect buttonFrameInWindow = [self convertRect:buttonBounds toView:nil];
    CGFloat buttonTopInWindow = buttonFrameInWindow.origin.y;
    CGFloat buttonBottomInWindow =
        buttonFrameInWindow.origin.y + buttonFrameInWindow.size.height;

    // Determine if menu should appear above or below the button
    BOOL shouldShowAbove =
        buttonPositionInWindow.y > screenBounds.size.height / 2;

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

    menuView.frame = CGRectMake(menuX, menuY, menuWidth, menuHeight);

    // Add menu to the window (so it can appear outside the bounds of the
    // control)
    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    if (window) {
      [window addSubview:menuView];
    } else {
      NSLog(@"Could not find keyWindow to add menuView");
      // Fallback to adding to parentView if window is not available (less
      // ideal)
      [self.superview addSubview:menuView];
    }

    // Animate the appearance of the menu
    menuView.alpha = 0;
    [UIView animateWithDuration:0.3
                     animations:^{ // Slower animation for smoother appearance
                       menuView.alpha = 1;
                     }];

    // Add shadow for better visual separation
    menuView.layer.shadowColor = [UIColor blackColor].CGColor;
    menuView.layer.shadowOffset = CGSizeMake(0, 3);
    menuView.layer.shadowOpacity = 0.3;
    menuView.layer.shadowRadius = 5.0;

    // Store reference to menuView for later removal
    objc_setAssociatedObject(self, "menuView", menuView,
                             OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  } else {
    // Collapse - remove the menu view
    UIView *menuView = objc_getAssociatedObject(self, "menuView");

    // Check if the menuView exists
    if (menuView) {
      [UIView animateWithDuration:0.3
          animations:^{
            menuView.alpha = 0;
          }
          completion:^(BOOL finished) {
            // Remove menuView from window
            [menuView removeFromSuperview];

            // Clear the reference
            objc_setAssociatedObject(self, "menuView", nil,
                                     OBJC_ASSOCIATION_RETAIN_NONATOMIC);
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
    CGFloat distFromLeft = centerX.constant - (buttonSize / 2);
    CGFloat distFromRight = screenWidth - (centerX.constant + (buttonSize / 2));

    // Snap to left or right edge based on which is closer
    if (distFromLeft < distFromRight) {
      // Snap to left edge with a small gap
      centerX.constant = buttonSize / 2 + 5;
    } else {
      // Snap to right edge with a small gap
      centerX.constant = screenWidth - buttonSize / 2 - 5;
    }

    // Keep the button within the middle area of the screen, away from top and
    // bottom navigation areas
    float topNavHeight =
        100; // Approximate height for top navigation/status bar area
    float bottomNavHeight =
        100; // Approximate height for bottom navigation/tab bar area

    // Calculate the safe area for vertical positioning
    float topLimit = -screenHeight / 2 + topNavHeight;
    float bottomLimit = screenHeight / 2 - bottomNavHeight;

    // Restrict from going into top navigation area
    if (centerY.constant - buttonSize / 2 < topLimit) {
      centerY.constant = topLimit + buttonSize / 2 + 5;
    }

    // Restrict from going into bottom navigation area
    if (centerY.constant + buttonSize / 2 > bottomLimit) {
      centerY.constant = bottomLimit - buttonSize / 2 - 5;
    }

    [UIView animateWithDuration:0.3
                     animations:^{
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
          NSStringFromCGRect(clearButton.frame),
          NSStringFromCGPoint(tapLocation));
    [self toggleExpandedState];
  }
}

@end
