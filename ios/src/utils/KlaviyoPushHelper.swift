//
//  KlaviyoPushHelper.swift
//  apptileSeed
//
//  Created by Mohammed Aman Khan on 05/11/25.
//

// #if ENABLE_KLAVIYO
import UserNotifications
import KlaviyoSwift

@objc(KlaviyoPushHelper)
/// Helper class to act as a swift layer between react native's objective c code and Klaviyo SDK's swift code
class PushNotificationsHelper: NSObject {

  /// Sets the APNs push token with the Klaviyo SDK.
  /// This should be called from `application:didRegisterForRemoteNotificationsWithDeviceToken:`
  /// - Parameter deviceToken: The APNs device token received from the system
  @objc
  static func setPushToken(deviceToken: Data) {
    KlaviyoSDK().set(pushToken: deviceToken)
  }

  /// Handles an incoming push notification response (when user taps on notification).
  /// Forwards to Klaviyo SDK to track "Opened Push" events.
  /// - Parameters:
  ///   - response: The notification response from the system
  ///   - completionHandler: Completion handler to call when processing is done
  ///   - deepLinkHandler: Optional handler for deep link URLs contained in the notification
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
// #endif
