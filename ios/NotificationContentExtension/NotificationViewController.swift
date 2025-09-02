//
//  NotificationViewController.swift
//  NotificationContentExtension
//
//  Created by Gaurav Gautam on 11/02/25.
//

import UIKit
import UserNotifications
import UserNotificationsUI

#if ENABLE_MOENGAGE
    import MoEngageRichNotification
#endif

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    override func viewDidLoad() {

        // TODO(gaurav) get this from info.plist
        #if ENABLE_MOENGAGE
            MoEngageSDKRichNotification.setAppGroupID("group.com.discoverpilgrimindia.notification")
        #endif
    }

    func didReceive(_ notification: UNNotification) {
        #if ENABLE_MOENGAGE
            MoEngageSDKRichNotification.addPushTemplate(
                toController: self, withNotification: notification)
        #endif
    }

}
