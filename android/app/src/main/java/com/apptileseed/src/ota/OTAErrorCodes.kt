package com.apptileseed.src.ota

enum class OTAErrorCode(val code: String, val message: String) {
    MISSING_UPDATE_ENDPOINT("OTA-001", "Config error"),
    MISSING_APP_ID("OTA-002", "Config error"),
    MISSING_FORK_NAME("OTA-003", "Config error"),

    MANIFEST_FETCH_FAILED("OTA-010", "Network error"),
    MANIFEST_PARSE_FAILED("OTA-011", "Data error"),

    TRACKER_READ_FAILED("OTA-020", "Storage error"),
    TRACKER_PARSE_FAILED("OTA-021", "Data error"),
    TRACKER_WRITE_FAILED("OTA-022", "Storage error"),

    ASSET_COPY_CONFIG_FAILED("OTA-030", "Setup error"),
    ASSET_COPY_TRACKER_FAILED("OTA-031", "Setup error"),

    CONFIG_DOWNLOAD_FAILED("OTA-040", "Download error"),
    CONFIG_VERIFY_FAILED("OTA-041", "Verify error"),
    CONFIG_MOVE_FAILED("OTA-042", "Storage error"),

    BUNDLE_DOWNLOAD_FAILED("OTA-050", "Download error"),
    BUNDLE_UNZIP_FAILED("OTA-051", "Extract error"),
    BUNDLE_VERIFY_FAILED("OTA-052", "Verify error"),
    BUNDLE_MOVE_FAILED("OTA-053", "Storage error"),

    ROLLBACK_TRIGGERED("OTA-060", "Recovery mode"),
    ROLLBACK_FAILED("OTA-061", "Recovery failed"),

    FORCE_UPDATE_REQUIRED("OTA-100", "Update required")
}

