//
//  FloatingPreviewControls.h
//  apptileSeed
//
//  Created by Gaurav Gautam on 22/02/25.
//

#ifndef FloatingPreviewControls_h
#define FloatingPreviewControls_h

#import <UIKit/UIKit.h>

@protocol FloatingPreviewControlsDelegate <NSObject>
- (void)resetToDefaultBundle;
// - (void)refreshBundle;
@end

@interface FloatingPreviewControls : UIView <UIGestureRecognizerDelegate>

@property(nonatomic, weak) id<FloatingPreviewControlsDelegate> delegate;
@property(nonatomic, assign, getter=isExpanded) BOOL isExpanded;

- (instancetype)initWithParentView:(UIView *)parentView;
- (void)toggleExpandedState;

@end

#endif /* FloatingPreviewControls_h */
