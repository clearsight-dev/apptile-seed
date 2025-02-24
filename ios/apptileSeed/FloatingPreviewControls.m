//
//  FloatingPreviewControls.m
//  apptileSeed
//
//  Created by Gaurav Gautam on 22/02/25.
//

#import <Foundation/Foundation.h>

#import "FloatingPreviewControls.h"

@implementation FloatingPreviewControls {
  UIButton *homeButton;
  UIPanGestureRecognizer *panGesture;
  NSLayoutConstraint *centerX;
  NSLayoutConstraint *centerY;
}

- (instancetype)initWithParentView:(UIView *)parentView {
  self = [super init];
  if (self) {
    self.translatesAutoresizingMaskIntoConstraints = NO;
    self.backgroundColor = [UIColor colorWithRed:0.5 green:0.5 blue:0.5 alpha:0.7];
    self.layer.cornerRadius = 16.0;
    self.clipsToBounds = YES;
    
    homeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [homeButton setTitle:@"Clear Downloads" forState:UIControlStateNormal];
    [homeButton setTitleColor:[UIColor colorWithRed:0.0 green:0.5 blue:1.0 alpha:1.0] forState:UIControlStateNormal];
    homeButton.translatesAutoresizingMaskIntoConstraints = NO;
    
    [homeButton addTarget:self
                   action:@selector(goHome)
         forControlEvents:UIControlEventTouchUpInside];
    [self addSubview:homeButton];
    
    float containerWidth = 150;
    
    [NSLayoutConstraint activateConstraints:@[
      [self.widthAnchor constraintEqualToConstant:containerWidth],
      [self.heightAnchor constraintEqualToConstant:100],
      [homeButton.centerXAnchor constraintEqualToAnchor:self.centerXAnchor],
      [homeButton.centerYAnchor constraintEqualToAnchor:self.centerYAnchor],
    ]];
    
    panGesture = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
    panGesture.cancelsTouchesInView = YES;
    [self addGestureRecognizer:panGesture];
    
    [parentView addSubview:self];
    
    centerX = [self.centerXAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.leadingAnchor constant: (0.5 * containerWidth) + 10];
    centerY = [self.centerYAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.centerYAnchor];
    
    [NSLayoutConstraint activateConstraints:@[centerX, centerY]];
    
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;
      strongSelf->centerX.constant = -(0.5 * containerWidth) + 15;
      
      // tuck the controls with a delay
      [UIView animateWithDuration:0.3 animations:^{
        [strongSelf.superview layoutIfNeeded];
      }];
    });
  }
  return self;
}

- (void)goHome {
  [self.delegate resetToDefaultBundle];
}

- (void)handlePan:(UIPanGestureRecognizer *)gesture {
  CGPoint translation = [gesture translationInView:self.superview];
  centerX.constant += translation.x;
  centerY.constant += translation.y;
  
  [gesture setTranslation:CGPointZero inView:self.superview];
  
  if (gesture.state == UIGestureRecognizerStateEnded ||
      gesture.state == UIGestureRecognizerStateCancelled) {
    CGRect superBounds = self.superview.bounds;
    CGFloat screenWidth = superBounds.size.width;
    CGFloat screenHeight = superBounds.size.height;
    
    // Distance of left edge of floating view from left edge of screen
    CGFloat distFromLeft = self.frame.origin.x;
    // Distance of right edge of floating view from right edge of screen
    CGFloat distFromRight = screenWidth - (self.frame.origin.x + self.frame.size.width);
    CGFloat distFromTop = self.frame.origin.y;
    CGFloat distFromBottom = screenHeight - (self.frame.origin.y + self.frame.size.height);
    
    // snap or tuck when interacting with left or right edge
    if (distFromLeft < -10) {
      // tuck on left
      centerX.constant = -(0.5 * self.bounds.size.width) + 15;
    } else if (distFromLeft <= distFromRight) {
      // snap to left
      centerX.constant = (self.bounds.size.width * 0.5) + 10;
    } else if (distFromRight < -10) {
      // tuck on right
      centerX.constant = screenWidth + (0.5 * self.bounds.size.width) - 15;
    } else {
      // snap to right
      centerX.constant = screenWidth - (0.5 * self.bounds.size.width) - 10;
    }
    
    // pull outside the view and hide if interacting with top or bottom edge
    if (distFromTop < -20) {
      // The centerY anchor for the container is bound to the the parentview's center.
      // So distance has to be calcualted from the center upwards
      // centerY.constant = -(0.5 * self.superview.bounds.size.height) + (0.5 * self.bounds.size.height) + 10;
      centerY.constant = -(0.5 * self.superview.bounds.size.height) - (0.5 * self.bounds.size.height) - 15;
    } else if (distFromBottom < -20) {
      centerY.constant = (0.5 * self.superview.bounds.size.height) + (0.5 * self.bounds.size.height) + 15;
    }
    
    [UIView animateWithDuration:0.3 animations:^{
      [self.superview layoutIfNeeded];
    }];
  }
}

@end
