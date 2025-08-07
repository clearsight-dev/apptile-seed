//
//  logTags.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 02/03/25.
//
import Foundation

enum LogLevel: String {
    case debug = "🐛 DEBUG"
    case info = "ℹ️ INFO"
    case warn = "⚠️ WARN"
    case error = "❌ ERROR"
    case success = "✅ SUCCESS"
}

@objcMembers
class Logger: NSObject {
    static func debug(_ message: String) {
        log(message, level: .debug)
    }

    static func info(_ message: String) {
        log(message, level: .info)
    }

    static func warn(_ message: String) {
        log(message, level: .warn)
    }

    static func success(_ message: String) {
        log(message, level: .success)
    }

    static func error(_ message: String) {
        log(message, level: .error)
    }

    private static func log(_ message: String, level: LogLevel) {
        let formattedMessage = "[ApptileStartupProcess] \(level.rawValue): \(message)"
        NSLog(formattedMessage)
    }
}
