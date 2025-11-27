//
//  NotificationService.m
//  ImageNotification
//
//  Created by Gaurav Gautam on 13/01/25.
//

#import "NotificationService.h"

#if ENABLE_MOENGAGE
#import <MoEngageRichNotification/MoEngageRichNotification.h>
#endif

#if ENABLE_ONESIGNAL
#import <OneSignalExtension/OneSignalExtension.h>
#endif

@interface NotificationService ()

@property (nonatomic, strong) void (^contentHandler)(UNNotificationContent *contentToDeliver);
@property (nonatomic, strong) UNMutableNotificationContent *bestAttemptContent;
@property (nonatomic, strong) UNNotificationRequest *receivedRequest;

@end

#if ENABLE_KLAVIYO

@implementation NotificationService

- (instancetype)init {
  self = [super init];
  if (self) {
    _queue = dispatch_queue_create("notification-service-extension",
                                   DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (void)didReceiveNotificationRequest:(UNNotificationRequest *)request
                   withContentHandler:
                       (void (^)(UNNotificationContent *))contentHandler {
  dispatch_async(self.queue, ^{
    self.contentHandler = contentHandler;
    self.bestAttemptContent = [request.content mutableCopy];

    if (self.bestAttemptContent) {
      // Modify the notification content here...
      self.bestAttemptContent.title = [NSString stringWithFormat:@"%@", self.bestAttemptContent.title ?: [NSBundle mainBundle].infoDictionary[@"APPTILE_DEFAULT_NOTIFICATION_TITLE"]];

      // Check for image attachment
      NSString *imageUrlString = request.content.userInfo[@"rich-media"];
      NSString *imageType = request.content.userInfo[@"rich-media-type"];
      if (imageUrlString && imageType) {
        NSURL *imageUrl = [NSURL URLWithString:imageUrlString];
        [self downloadImageFromURL:imageUrl
                              type:imageType
             withCompletionHandler:^(UNNotificationAttachment *attachment) {
               if (attachment) {
                 // Adding the image to the notification content
                 self.bestAttemptContent.attachments = @[ attachment ];
               }

               // Set a custom launch image (e.g., thumbnail)
               self.bestAttemptContent.launchImageName = @"thumbnailImage";

               // Call the content handler to complete the notification
               contentHandler(self.bestAttemptContent);
             }];
      } else {
        contentHandler(self.bestAttemptContent);
      }
    }
  });
}

- (void)downloadImageFromURL:(NSURL *)url
                        type:(NSString *)type
       withCompletionHandler:
           (void (^)(UNNotificationAttachment *))completionHandler {
  NSURLSessionDownloadTask *task = [[NSURLSession sharedSession]
      downloadTaskWithURL:url
        completionHandler:^(NSURL *_Nullable downloadedUrl,
                            NSURLResponse *_Nullable response,
                            NSError *_Nullable error) {
          dispatch_async(self.queue, ^{
            if (error) {
              NSLog(@"Error downloading image: %@", error);
              completionHandler(nil);
            } else if (downloadedUrl) {
              NSURL *urlPath = [NSURL fileURLWithPath:NSTemporaryDirectory()];
              NSString *uniqueURLEnding =
                  [NSString stringWithFormat:@"%@.%@",
                                             [NSProcessInfo processInfo]
                                                 .globallyUniqueString,
                                             type];
              urlPath = [urlPath URLByAppendingPathComponent:uniqueURLEnding];

              NSError *fileError;
              [[NSFileManager defaultManager] moveItemAtURL:downloadedUrl
                                                      toURL:urlPath
                                                      error:&fileError];

              if (fileError) {
                NSLog(@"Error: %@", fileError);
                completionHandler(nil);
                return;
              }

              NSError *attachmentError;
              UNNotificationAttachment *attachment = [UNNotificationAttachment
                  attachmentWithIdentifier:@"image"
                                       URL:urlPath
                                   options:nil
                                     error:&attachmentError];
              if (attachmentError) {
                NSLog(@"Error: %@", attachmentError);
                completionHandler(nil);
              } else {
                completionHandler(attachment);
              }

              [[NSFileManager defaultManager] removeItemAtURL:urlPath
                                                        error:nil];
            }
          });
        }];
  [task resume];
}

- (void)serviceExtensionTimeWillExpire {
  // Called just before the extension will be terminated by the system.
  // Use this as an opportunity to deliver your "best attempt" at modified
  // content, otherwise the original push payload will be used.
  if (self.contentHandler && self.bestAttemptContent) {
    self.contentHandler(self.bestAttemptContent);
  }
}

@end

#else

@implementation NotificationService

- (void)didReceiveNotificationRequest:(UNNotificationRequest *)request withContentHandler:(void (^)(UNNotificationContent * _Nonnull))contentHandler {
  self.contentHandler = contentHandler;
  self.bestAttemptContent = [request.content mutableCopy];

#if ENABLE_MOENGAGE
  @try {
    // TODO(gaurav) get this from info.plist of notification service
    [MoEngageSDKRichNotification setAppGroupID: @"group.com.discoverpilgrimindia.notification"];
    [MoEngageSDKRichNotification handleWithRichNotificationRequest:request withContentHandler:contentHandler];
  } @catch (NSException *exception) {
    NSLog(@"MoEngage : exception : %@",exception);
  }
#endif
  
#if ENABLE_ONESIGNAL
  self.receivedRequest = request;
  [OneSignalExtension didReceiveNotificationExtensionRequest:self.receivedRequest withMutableNotificationContent:self.bestAttemptContent withContentHandler:self.contentHandler];
#endif
}

- (void)serviceExtensionTimeWillExpire {
#if ENABLE_ONESIGNAL
  [OneSignalExtension serviceExtensionTimeWillExpireRequest:self.receivedRequest withMutableNotificationContent:self.bestAttemptContent];
#endif
  // Called just before the extension will be terminated by the system.
  // Use this as an opportunity to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
  self.contentHandler(self.bestAttemptContent);
}

@end


#endif