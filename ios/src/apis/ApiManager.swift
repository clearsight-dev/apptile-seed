//
//  index.swift
//  apptileSeed
//
//  Created by Vadivazhagan on 02/03/25.
//
import Alamofire
import Foundation

final class NetworkLogger: EventMonitor, @unchecked Sendable {
    let queue = DispatchQueue(label: "com.apptile.networklogger", qos: .background)

    func requestDidResume(_ request: Request) {
        Logger.info("Request Started: \(request.cURLDescription())")
    }

    func requestDidFinish(_ request: Request) {
        Logger.info("Request Finished: \(request.description)")
    }

    func request(_: DataRequest, didParseResponse response: DataResponse<Data?, AFError>) {
        Logger.info("Response Received: \(response.response?.statusCode ?? 0)")
    }
}

// MARK: - API Error Handling

enum APIError: Error {
    case missingBaseURL
    case invalidResponse
}

// MARK: - APIClient (Singleton)

class APIClient {
    static let shared = APIClient()

    private var baseURL: String?

    private let session: Session

    private init() {
        let logger = NetworkLogger()
        let configuration = URLSessionConfiguration.default
        session = Session(configuration: configuration, eventMonitors: [logger])
    }

    func initialize(baseURL: String) {
        self.baseURL = baseURL
    }

    private var defaultHeaders: HTTPHeaders {
        ["Content-Type": "application/json"]
    }

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        parameters: [String: Any]? = nil,
        headers: HTTPHeaders? = nil,
        responseType _: T.Type
    ) async throws -> T {
        guard let baseURL = baseURL, !baseURL.isEmpty else {
            throw APIError.missingBaseURL
        }

        let url = baseURL + endpoint

        return try await withCheckedThrowingContinuation { continuation in
            session.request(
                url, method: method, parameters: parameters,
                encoding: JSONEncoding.default, headers: headers ?? defaultHeaders
            )
            .validate()
            .responseDecodable(of: T.self) { response in
                switch response.result {
                case let .success(data):
                    continuation.resume(returning: data)
                case let .failure(error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}

// MARK: - ApiService Protocol

protocol ApiService {
  func getManifest(appId: String, forkName: String) async throws -> ManifestResponse
    func downloadFile(from url: String) async throws -> URL
}

// MARK: - ApptileApiClient Singleton

class ApptileApiClient: ApiService {
    static let shared = ApptileApiClient()
    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

  func getManifest(appId: String, forkName: String) async throws -> ManifestResponse {
        return try await apiClient.request(
            endpoint: "/app/\(appId)/\(forkName)/manifest?frameworkVersion=0.17.0",
            responseType: ManifestResponse.self
        )
    }

    func downloadFile(from url: String) async throws -> URL {
        return try await withCheckedThrowingContinuation { continuation in
            let destination: DownloadRequest.Destination = { _, _ in
                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                return (tempURL, [.removePreviousFile, .createIntermediateDirectories])
            }

            AF.download(url, to: destination)
                .validate()
                .response { response in
                    if let fileURL = response.fileURL {
                        continuation.resume(returning: fileURL)
                    } else if let error = response.error {
                        continuation.resume(throwing: error)
                    }
                }
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
