//
//  ApiManager.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 02/03/25.
//

import Foundation

// MARK: - API Error Handling

enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError(Error)
    case invalidResponse
    case decodingError(Error)
    case downloadFailed
    case emptyResponse
    case missingConfig(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .downloadFailed:
            return "File download failed"
        case .emptyResponse:
            return "Empty response received"
        case .missingConfig(let key):
            return "Missing config: \(key)"
        }
    }
}

// MARK: - Data Models

struct CodeArtefact: Codable {
    let id: Int64
    let type: String
    let cdnlink: String
    let tag: String
}

struct ManifestResponse: Codable {
    let id: Int
    let appId: Int
    let frameworkVersion: String
    let forkName: String
    let title: String
    let publishedCommitId: Int64
    let createdAt: String
    let updatedAt: String
    let deletedAt: String?
    let url: String
    let artefacts: [CodeArtefact]
    let latestBuildNumberIos: Int?
    let appStorePermanentLink: String?
}

// MARK: - OTA API Client

final class OTAApiClient {
    static let shared = OTAApiClient()

    private let session: URLSession
    private let frameworkVersion = "0.17.0"

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    // MARK: - Fetch Manifest

    func fetchManifest(baseURL: String, appId: String, forkName: String) async -> Result<ManifestResponse, APIError> {
        let endpoint = "\(baseURL)/app/\(appId)/\(forkName)/manifest?frameworkVersion=\(frameworkVersion)"

        guard let url = URL(string: endpoint) else {
            Logger.error("Invalid manifest URL: \(endpoint)")
            return .failure(.invalidURL)
        }

        Logger.info("Fetching manifest from: \(endpoint)")

        do {
            let (data, response) = try await session.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse else {
                Logger.error("Invalid response type")
                return .failure(.invalidResponse)
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                Logger.error("Manifest fetch failed with status: \(httpResponse.statusCode)")
                return .failure(.invalidResponse)
            }

            guard !data.isEmpty else {
                Logger.error("Empty manifest response")
                return .failure(.emptyResponse)
            }

            let decoder = JSONDecoder()
            let manifest = try decoder.decode(ManifestResponse.self, from: data)
            Logger.info("Manifest fetched successfully. CommitId: \(manifest.publishedCommitId)")
            return .success(manifest)

        } catch let error as DecodingError {
            Logger.error("Failed to decode manifest: \(error)")
            return .failure(.decodingError(error))
        } catch {
            Logger.error("Network error fetching manifest: \(error.localizedDescription)")
            return .failure(.networkError(error))
        }
    }

    // MARK: - Download File

    func downloadFile(from urlString: String, to destinationPath: String) async -> Result<String, APIError> {
        guard let url = URL(string: urlString) else {
            Logger.error("Invalid download URL: \(urlString)")
            return .failure(.invalidURL)
        }

        Logger.info("Downloading file from: \(urlString)")

        do {
            let (tempURL, response) = try await session.download(from: url)

            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                Logger.error("Download failed with invalid response")
                return .failure(.invalidResponse)
            }

            // Move to destination
            let destinationURL = URL(fileURLWithPath: destinationPath)

            // Remove existing file if present
            if FileManager.default.fileExists(atPath: destinationPath) {
                try FileManager.default.removeItem(atPath: destinationPath)
            }

            // Create parent directory if needed
            let parentDir = destinationURL.deletingLastPathComponent()
            if !FileManager.default.fileExists(atPath: parentDir.path) {
                try FileManager.default.createDirectory(at: parentDir, withIntermediateDirectories: true)
            }

            try FileManager.default.moveItem(at: tempURL, to: destinationURL)

            // Verify file is not empty
            let attributes = try FileManager.default.attributesOfItem(atPath: destinationPath)
            let fileSize = attributes[.size] as? Int64 ?? 0

            if fileSize == 0 {
                Logger.error("Downloaded file is empty")
                try? FileManager.default.removeItem(atPath: destinationPath)
                return .failure(.emptyResponse)
            }

            Logger.info("File downloaded successfully: \(destinationPath) (\(fileSize) bytes)")
            return .success(destinationPath)

        } catch {
            Logger.error("Download error: \(error.localizedDescription)")
            return .failure(.networkError(error))
        }
    }
}
