import Foundation

public enum AppGroup {
    public static let id = "group.com.astroroast.app"
    public static var directory: URL {
        if let u = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) { return u }
        let u = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }
    static var stateURL: URL { directory.appendingPathComponent("state.json") }
}

public enum Persistence {
    public static func load() -> AppState {
        guard let data = try? Data(contentsOf: AppGroup.stateURL) else { return AppState() }
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .secondsSince1970
        return (try? dec.decode(AppState.self, from: data)) ?? AppState()
    }
    public static func save(_ s: AppState) {
        let enc = JSONEncoder(); enc.dateEncodingStrategy = .secondsSince1970
        if let d = try? enc.encode(s) { try? d.write(to: AppGroup.stateURL, options: .atomic) }
    }
}
