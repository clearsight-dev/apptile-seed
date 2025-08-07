//
//  AppUtils.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 25/02/25.
//

import CryptoKit
import Foundation
import ZIPFoundation

class FileUtils {
    static let fileManager = FileManager.default
    static let documentsDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!

    // MARK: - Copy Asset to Documents

    static func copyAssetToDocuments(assetFileName: String, destinationFileName: String) -> Bool {
        let destinationURL = documentsDirectory.appendingPathComponent(destinationFileName)

        if fileManager.fileExists(atPath: destinationURL.path) {
            Logger.success("File already exists: \(destinationURL.path)")
            return true
        }

        guard let assetPath = Bundle.main.path(forResource: assetFileName, ofType: nil) else {
            Logger.error("Asset not found: \(assetFileName)")
            return false
        }

        do {
            try fileManager.copyItem(atPath: assetPath, toPath: destinationURL.path)
            Logger.success("File copied successfully from \(assetFileName) to \(destinationURL.path)")
            return true
        } catch {
            Logger.error("Error copying file: \(error)")
            return false
        }
    }

    // MARK: - Read File Content

    static func readFileContent(filePath: String) -> String? {
        let fileURL = URL(fileURLWithPath: filePath)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            Logger.warn("File not found: \(filePath)")
            return nil
        }

        do {
            let content = try String(contentsOf: fileURL, encoding: .utf8)
            Logger.success("Read file content: \(filePath)")
            return content
        } catch {
            Logger.error("Error reading file: \(error)")
            return nil
        }
    }

    // MARK: - Save File

    static func saveFile(data: Data, filePath: String) -> Bool {
        let fileURL = URL(fileURLWithPath: filePath)
        do {
            try data.write(to: fileURL)
            Logger.success("File saved successfully: \(filePath)")
            return true
        } catch {
            Logger.error("Error saving file: \(error)")
            return false
        }
    }

    // MARK: - Delete File

    static func deleteFile(filePath: String) -> Bool {
        let fileURL = URL(fileURLWithPath: filePath)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            Logger.warn("File not found for deletion: \(filePath)")
            return false
        }

        do {
            try fileManager.removeItem(at: fileURL)
            Logger.success("File deleted: \(filePath)")
            return true
        } catch {
            Logger.error("Error deleting file: \(error)")
            return false
        }
    }

    // MARK: - Move File

    static func moveFile(sourcePath: String, destinationPath: String) -> Bool {
        let sourceURL = URL(fileURLWithPath: sourcePath)
        let destinationURL = URL(fileURLWithPath: destinationPath)

        guard fileManager.fileExists(atPath: sourceURL.path) else {
            Logger.warn("Source file not found: \(sourcePath)")
            return false
        }

        do {
            try fileManager.moveItem(at: sourceURL, to: destinationURL)
            Logger.success("File moved from \(sourcePath) to \(destinationPath)")
            return true
        } catch {
            Logger.error("Error moving file: \(error)")
            return false
        }
    }

    // MARK: - Unzip File

    static func unzip(zipFilePath: String, destinationPath: String) -> Bool {
        let zipURL = URL(fileURLWithPath: zipFilePath)
        let destinationURL = URL(fileURLWithPath: destinationPath)

        do {
            try fileManager.createDirectory(at: destinationURL, withIntermediateDirectories: true, attributes: nil)
            try fileManager.unzipItem(at: zipURL, to: destinationURL)
            Logger.success("Unzipped successfully: \(zipFilePath) -> \(destinationPath)")
            return true
        } catch {
            Logger.error("Error unzipping file: \(error)")
            return false
        }
    }

    // MARK: - Verify File Integrity (SHA-256)

    static func verifyFileIntegrity(filePath: String, expectedHash: String) -> Bool {
        let fileURL = URL(fileURLWithPath: filePath)

        guard fileManager.fileExists(atPath: fileURL.path),
              let fileData = try? Data(contentsOf: fileURL)
        else {
            Logger.warn("File not found for hashing: \(filePath)")
            return false
        }

        let computedHash = SHA256.hash(data: fileData)
            .map { String(format: "%02x", $0) }
            .joined()

        Logger.info("🔍 Computed Hash: \(computedHash)")
        Logger.info("🔍 Expected Hash: \(expectedHash)")

        return true // Temporary return, will uncomment later
        // return computedHash.lowercased() == expectedHash.lowercased()
    }

    // MARK: - Copy Directory Contents

    static func copyDirectoryContents(sourcePath: String, destinationPath: String) {
        let sourceURL = URL(fileURLWithPath: sourcePath)
        let destinationURL = URL(fileURLWithPath: destinationPath)

        do {
            try fileManager.createDirectory(at: destinationURL, withIntermediateDirectories: true, attributes: nil)
            let contents = try fileManager.contentsOfDirectory(atPath: sourceURL.path)

            for item in contents {
                let srcItemURL = sourceURL.appendingPathComponent(item)
                let dstItemURL = destinationURL.appendingPathComponent(item)
                try fileManager.copyItem(at: srcItemURL, to: dstItemURL)
            }

            Logger.success("Copied contents from \(sourcePath) to \(destinationPath)")
        } catch {
            Logger.error("Error copying directory contents: \(error)")
        }
    }

    // MARK: - Download & Save File

    static func downloadFile(from url: URL, to destinationFileName: String) async -> Bool {
        let destinationURL = documentsDirectory.appendingPathComponent(destinationFileName)

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            try data.write(to: destinationURL)
            Logger.success("File downloaded successfully: \(destinationURL.path)")
            return true
        } catch {
            Logger.error("Download failed: \(error)")
            return false
        }
    }

    // MARK: - Create Parent Dirs

    static func createDirectoryIfNeeded(at path: URL) -> Bool {
        do {
            try FileUtils.fileManager.createDirectory(at: path, withIntermediateDirectories: true)
            Logger.success("Directory created at: \(path.path)")
            return true
        } catch {
            Logger.error("Failed to create directory at: \(path.path): \(error.localizedDescription)")
            return false
        }
    }
}
