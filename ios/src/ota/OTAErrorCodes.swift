//
//  OTAErrorCodes.swift
//  apptileSeed
//
//  Created for OTA error handling
//

import Foundation

enum OTAErrorCode: String {
    // Config errors
    case MISSING_UPDATE_ENDPOINT = "OTA-001"
    case MISSING_APP_ID = "OTA-002"
    case MISSING_FORK_NAME = "OTA-003"

    // Manifest errors
    case MANIFEST_FETCH_FAILED = "OTA-010"
    case MANIFEST_PARSE_FAILED = "OTA-011"

    // Tracker errors
    case TRACKER_READ_FAILED = "OTA-020"
    case TRACKER_PARSE_FAILED = "OTA-021"
    case TRACKER_WRITE_FAILED = "OTA-022"

    // Asset copy errors
    case ASSET_COPY_CONFIG_FAILED = "OTA-030"
    case ASSET_COPY_TRACKER_FAILED = "OTA-031"

    // Config download errors
    case CONFIG_DOWNLOAD_FAILED = "OTA-040"
    case CONFIG_VERIFY_FAILED = "OTA-041"
    case CONFIG_MOVE_FAILED = "OTA-042"

    // Bundle errors
    case BUNDLE_DIR_CREATE_FAILED = "OTA-049"
    case BUNDLE_DOWNLOAD_FAILED = "OTA-050"
    case BUNDLE_UNZIP_FAILED = "OTA-051"
    case BUNDLE_VERIFY_FAILED = "OTA-052"
    case BUNDLE_MOVE_FAILED = "OTA-053"
    case BUNDLE_EXTRACT_EMPTY = "OTA-054"

    // Rollback errors
    case ROLLBACK_TRIGGERED = "OTA-060"
    case ROLLBACK_FAILED = "OTA-061"

    // Force update
    case FORCE_UPDATE_REQUIRED = "OTA-100"

    var message: String {
        switch self {
        case .MISSING_UPDATE_ENDPOINT, .MISSING_APP_ID, .MISSING_FORK_NAME:
            return "Config error"
        case .MANIFEST_FETCH_FAILED:
            return "Network error"
        case .MANIFEST_PARSE_FAILED, .TRACKER_PARSE_FAILED:
            return "Data error"
        case .TRACKER_READ_FAILED, .TRACKER_WRITE_FAILED, .CONFIG_MOVE_FAILED, .BUNDLE_DIR_CREATE_FAILED, .BUNDLE_MOVE_FAILED:
            return "Storage error"
        case .ASSET_COPY_CONFIG_FAILED, .ASSET_COPY_TRACKER_FAILED:
            return "Setup error"
        case .CONFIG_DOWNLOAD_FAILED, .BUNDLE_DOWNLOAD_FAILED:
            return "Download error"
        case .CONFIG_VERIFY_FAILED, .BUNDLE_VERIFY_FAILED, .BUNDLE_EXTRACT_EMPTY:
            return "Verify error"
        case .BUNDLE_UNZIP_FAILED:
            return "Extract error"
        case .ROLLBACK_TRIGGERED:
            return "Recovery mode"
        case .ROLLBACK_FAILED:
            return "Recovery failed"
        case .FORCE_UPDATE_REQUIRED:
            return "Update required"
        }
    }
}

