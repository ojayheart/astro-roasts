import Foundation

public enum APIError: LocalizedError {
    case badStatus(Int, String?), network(String), notFound, rateLimited, decode, unauthorized, wrongCode
    public var errorDescription: String? {
        switch self {
        case .badStatus(let c, let m): return m ?? "The server said no (\(c))."
        case .network(let m): return "Couldn't reach the cosmos: \(m)"
        case .notFound: return "We couldn't find that roast."
        case .rateLimited: return "Too many roasts too fast. Give Saturn a minute."
        case .decode: return "The server answered in riddles."
        case .unauthorized: return "Please sign in again."
        case .wrongCode: return "That code didn't work. Check it and try again."
        }
    }
}

public struct GeneratePerson: Codable, Sendable {
    public var name: String, gender: String, date: String, time: String?, birthPlace: String
    public init(name: String, gender: String, date: String, time: String?, birthPlace: String) { self.name = name; self.gender = gender; self.date = date; self.time = time; self.birthPlace = birthPlace }
}

public final class RoastAPI: @unchecked Sendable {
    public static let shared = RoastAPI()
    public var baseURL: URL
    private let session: URLSession
    init() {
        let env = ProcessInfo.processInfo.environment["ASTROROAST_API"] ?? UserDefaults.standard.string(forKey: "apiBase")
        baseURL = URL(string: env ?? "https://astroroast.com")!
        let cfg = URLSessionConfiguration.default; cfg.timeoutIntervalForRequest = 25
        session = URLSession(configuration: cfg)
    }

    static func ymd(_ b: BirthData) -> (String, String?) {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = b.timeZone
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute], from: b.instant)
        let date = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
        return (date, b.timeKnown ? String(format: "%02d:%02d", c.hour!, c.minute!) : nil)
    }
    public static func person(_ b: BirthData, gender: String) -> GeneratePerson {
        let (d, t) = ymd(b); return GeneratePerson(name: b.name, gender: gender, date: d, time: t, birthPlace: b.birthPlace)
    }

    private func send(_ path: String, method: String = "GET", body: Encodable? = nil, token: String? = nil) async throws -> Data {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONEncoder().encode(AnyEncodable(body)); req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        req.setValue("AstroRoast-iOS/1.0", forHTTPHeaderField: "User-Agent")
        do {
            let (data, resp) = try await session.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 404 { throw APIError.notFound }
            if code == 429 { throw APIError.rateLimited }
            if code == 401 { throw APIError.unauthorized }
            guard (200..<300).contains(code) else {
                let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                throw APIError.badStatus(code, msg)
            }
            return data
        } catch let e as APIError { throw e } catch { throw APIError.network(error.localizedDescription) }
    }

    /// Starts a solo roast. Returns the roast id.
    public func generate(person: GeneratePerson, email: String? = nil) async throws -> String {
        struct Body: Encodable { let name, gender, date: String; let time: String?; let birthPlace: String; let email: String? }
        let data = try await send("api/generate", method: "POST", body: Body(name: person.name, gender: person.gender, date: person.date, time: person.time, birthPlace: person.birthPlace, email: email))
        guard let id = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["id"] as? String else { throw APIError.decode }
        return id
    }
    /// Starts a couple (2) or family (3–6) roast.
    public func generateGroup(kind: String, people: [GeneratePerson], relationship: String?) async throws -> String {
        struct Body: Encodable { let kind: String; let people: [GeneratePerson]; let relationship: String? }
        let data = try await send("api/generate", method: "POST", body: Body(kind: kind, people: people, relationship: relationship))
        guard let id = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["id"] as? String else { throw APIError.decode }
        return id
    }
    public func fetch(id: String) async throws -> RoastPayload {
        let data = try await send("api/roast/\(id)")
        do { return try JSONDecoder().decode(RoastPayload.self, from: data) }
        catch {
            // status "error" responses are just {"status":"error"}
            if let s = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["status"] as? String, s == "error" {
                return RoastPayload(id: id, name: "", status: "error")
            }
            throw APIError.decode
        }
    }
    /// Asks the server to mark a roast paid after an App Store purchase (server verifies the signed transaction).
    public func unlock(roastID: String, signedTransaction: String) async throws -> Bool {
        struct Body: Encodable { let roastId: String; let signedTransaction: String }
        let data = try await send("api/ios/v1/unlock", method: "POST", body: Body(roastId: roastID, signedTransaction: signedTransaction))
        return ((try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["unlocked"] as? Bool) ?? false
    }
    // MARK: accounts (email + code)

    public func authStart(email: String) async throws {
        struct Body: Encodable { let email: String }
        _ = try await send("api/ios/v1/auth/start", method: "POST", body: Body(email: email))
    }
    /// Returns the session token for this email.
    public func authVerify(email: String, code: String) async throws -> String {
        struct Body: Encodable { let email, code: String }
        do {
            let data = try await send("api/ios/v1/auth/verify", method: "POST", body: Body(email: email, code: code))
            guard let t = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["token"] as? String else { throw APIError.decode }
            return t
        } catch APIError.unauthorized { throw APIError.wrongCode }
    }
    public func listRoasts(token: String) async throws -> [CloudRoast] {
        struct Reply: Decodable { let roasts: [CloudRoast] }
        let data = try await send("api/ios/v1/roasts", token: token)
        do { return try JSONDecoder().decode(Reply.self, from: data).roasts } catch { throw APIError.decode }
    }
    public func claim(roastID: String, token: String) async throws {
        struct Body: Encodable { let roastId: String }
        _ = try await send("api/ios/v1/roasts/claim", method: "POST", body: Body(roastId: roastID), token: token)
    }
    public func deleteAccount(token: String) async throws {
        _ = try await send("api/ios/v1/account", method: "DELETE", token: token)
    }

    public static func roastID(from text: String) -> String? {
        let re = try! NSRegularExpression(pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
        guard let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)), let r = Range(m.range, in: text) else { return nil }
        return String(text[r]).lowercased()
    }
}

struct AnyEncodable: Encodable {
    let value: Encodable
    init(_ v: Encodable) { value = v }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
