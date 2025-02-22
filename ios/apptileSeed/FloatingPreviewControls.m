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
    
    [NSLayoutConstraint activateConstraints:@[
      [self.widthAnchor constraintEqualToConstant:150],
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
    
    centerX = [self.centerXAnchor constraintEqualToAnchor:parentView.safeAreaLayoutGuide.leadingAnchor constant: 20];
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
    CGFloat containerHalfWidth = self.bounds.size.width / 2;
    CGFloat screenWidth = superBounds.size.width / 2;
    
    if (self.frame.origin.x < screenWidth * 0.5) {
      centerX.constant = -screenWidth / 2 + containerHalfWidth;
    } else {
      centerX.constant = screenWidth / 2 - containerHalfWidth;
    }
    
    [UIView animateWithDuration:0.4 animations:^{
      [self.superview layoutIfNeeded];
    }];
  }
}

@end
