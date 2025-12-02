//
//  KlaviyoPushHelper.swift
//  apptileSeed
//
//  Created by Mohammed Aman Khan on 05/11/25.
//

#if ENABLE_KLAVIYO
import UserNotifications
import KlaviyoSwift

@objc(KlaviyoPushHelper)
/// Helper class to act as a swift layer between react native's objective c code and Klaviyo SDK's swift code
class PushNotificationsHelper: NSObject {
  @objc
  static func handleReceivingPush(
    response: UNNotificationResponse,
    completionHandler: @escaping () -> Void,
    deepLinkHandler: ((URL) -> Void)? = nil
  ) {
    let handled = KlaviyoSDK().handle(
      notificationResponse: response,
      withCompletionHandler: completionHandler,
      deepLinkHandler: deepLinkHandler
    )
    if !handled {
      completionHandler()
    }
  }
}
#endif
