//
//  SplashScreenViewController.m
//  apptileSeed
//
//  Created by Vadivazhagan on 02/04/25.
//

#import "SplashScreenViewController.h"
#import "AppDelegate.h"
#import "StartupHandler.h"

@implementation SplashScreenViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  [self showNativeSplash];
  [StartupHandler handleStartupProcess];
}

- (void)showNativeSplash {

  NSURL *pngURL = [[NSBundle mainBundle] URLForResource:@"splash" withExtension:@"png"];
  UIImage *splashImage = [UIImage imageWithContentsOfFile:[pngURL path]];

  UIImageView *imageView = [[UIImageView alloc] initWithFrame:self.view.bounds];
  imageView.image = splashImage;
  imageView.contentMode = UIViewContentModeScaleAspectFill;

  [self.view addSubview:imageView];
}

@end
