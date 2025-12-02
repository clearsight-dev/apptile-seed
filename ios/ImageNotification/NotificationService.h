//
//  NotificationService.h
//  ImageNotification
//
//  Created by Gaurav Gautam on 28/01/25.
//

#import <UserNotifications/UserNotifications.h>

@interface NotificationService : UNNotificationServiceExtension

#if ENABLE_KLAVIYO
@property(nonatomic, strong) dispatch_queue_t queue;
#endif

@end
