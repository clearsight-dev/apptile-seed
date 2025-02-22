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
    [homeButton setTitle:@"R" forState:UIControlStateNormal];
    [homeButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    homeButton.backgroundColor = [UIColor colorWithRed:0.0 green:0.5 blue:1.0 alpha:1.0];
    homeButton.layer.cornerRadius = 25;
    homeButton.clipsToBounds = YES;
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
      [homeButton.widthAnchor constraintEqualToConstant:60],
      [homeButton.widthAnchor constraintEqualToConstant:60]
    ]];
    
    panGesture = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
    panGesture.cancelsTouchesInView = YES;
    [self addGestureRecognizer:panGesture];
    
    [parentView addSubview:self];
    
    centerX = [self.centerXAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.leadingAnchor constant: -(0.5 * containerWidth) + 10];
    centerY = [self.centerYAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.centerYAnchor];
    
    [NSLayoutConstraint activateConstraints:@[centerX, centerY]];
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
    
    // Distance of left edge of floating view from left edge of screen
    CGFloat distFromLeft = self.frame.origin.x;
    // Distance of right edge of floating view from right edge of screen
    CGFloat distFromRight = screenWidth - (self.frame.origin.x + self.frame.size.width);
    CGFloat distFromTop = self.frame.origin.y;
    
    if (distFromLeft < -10) {
      // tuck on left
      centerX.constant = -(0.5 * self.bounds.size.width) + 10;
    } else if (distFromLeft <= distFromRight) {
      centerX.constant = (self.bounds.size.width * 0.5) + 10;
    } else if (distFromRight < -10) {
      // tuck on right
      centerX.constant = screenWidth + (0.5 * self.bounds.size.width * 0.5) + 25;
    } else {
      centerX.constant = screenWidth - (0.5 * self.bounds.size.width) - 10;
    }
    
    // Do not tuck on top edge because view will become inaccessible
    // due to system menu
    if (distFromTop < (self.bounds.size.height + 10)) {
      // The centerY anchor for the container is bound to the the parentview's center.
      // So distance has to be calcualted from the center upwards
      centerY.constant = -(0.5 * self.superview.bounds.size.height) + (0.5 * self.bounds.size.height) + 10;
    }
    
    [UIView animateWithDuration:0.3 animations:^{
      [self.superview layoutIfNeeded];
    }];
  }
}

@end
