//
//  FloatingPreviewControls.h
//  apptileSeed
//
//  Created by Gaurav Gautam on 22/02/25.
//

#ifndef FloatingPreviewControls_h
#define FloatingPreviewControls_h

#import <UIKit/UIKit.h>

@protocol FloatingPrviewControlsDelegate <NSObject>
- (void)resetToDefaultBundle;
@end

@interface FloatingPreviewControls: UIView

@property (nonatomic, weak) id<FloatingPrviewControlsDelegate> delegate;
- (instancetype)initWithParentView:(UIView *)parentView;

@end

#endif /* FloatingPreviewControls_h */
