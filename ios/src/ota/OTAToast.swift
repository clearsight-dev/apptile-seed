//
//  OTAToast.swift
//  apptileSeed
//
//  Created for OTA error toast notifications
//

import Foundation
import UIKit

final class OTAToast {
    static var isEnabled: Bool = true
    
    private static var currentToast: UIView?
    
    static func show(_ errorCode: OTAErrorCode) {
        guard isEnabled else { return }
        
        DispatchQueue.main.async {
            showToast(message: "\(errorCode.rawValue) : App Update failed")
        }
    }
    
    private static func showToast(message: String) {
        // Remove existing toast if any
        currentToast?.removeFromSuperview()
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first(where: { $0.isKeyWindow }) else {
            Logger.error("OTAToast: Could not find key window")
            return
        }
        
        // Create toast container
        let toastContainer = UIView()
        toastContainer.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        toastContainer.layer.cornerRadius = 10
        toastContainer.clipsToBounds = true
        toastContainer.translatesAutoresizingMaskIntoConstraints = false
        
        // Create label
        let toastLabel = UILabel()
        toastLabel.text = message
        toastLabel.textColor = .white
        toastLabel.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        toastLabel.textAlignment = .center
        toastLabel.numberOfLines = 0
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        
        toastContainer.addSubview(toastLabel)
        window.addSubview(toastContainer)
        
        currentToast = toastContainer
        
        // Constraints
        NSLayoutConstraint.activate([
            toastLabel.topAnchor.constraint(equalTo: toastContainer.topAnchor, constant: 12),
            toastLabel.bottomAnchor.constraint(equalTo: toastContainer.bottomAnchor, constant: -12),
            toastLabel.leadingAnchor.constraint(equalTo: toastContainer.leadingAnchor, constant: 16),
            toastLabel.trailingAnchor.constraint(equalTo: toastContainer.trailingAnchor, constant: -16),
            
            toastContainer.centerXAnchor.constraint(equalTo: window.centerXAnchor),
            toastContainer.bottomAnchor.constraint(equalTo: window.safeAreaLayoutGuide.bottomAnchor, constant: -50),
            toastContainer.leadingAnchor.constraint(greaterThanOrEqualTo: window.leadingAnchor, constant: 20),
            toastContainer.trailingAnchor.constraint(lessThanOrEqualTo: window.trailingAnchor, constant: -20)
        ])
        
        // Animate in
        toastContainer.alpha = 0
        UIView.animate(withDuration: 0.3) {
            toastContainer.alpha = 1
        }
        
        // Animate out after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            UIView.animate(withDuration: 0.3, animations: {
                toastContainer.alpha = 0
            }) { _ in
                toastContainer.removeFromSuperview()
                if currentToast === toastContainer {
                    currentToast = nil
                }
            }
        }
        
        Logger.info("OTAToast: \(message)")
    }
}

