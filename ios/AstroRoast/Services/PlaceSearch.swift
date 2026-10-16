import Foundation
import MapKit
import AstroKit

struct PlaceResult: Hashable, Codable {
    var name: String, country: String, lat: Double, lon: Double, tzID: String
    var label: String { country.isEmpty ? name : "\(name), \(country)" }
}

@MainActor @Observable
final class PlaceSearch: NSObject, MKLocalSearchCompleterDelegate {
    var query = "" { didSet { if query != oldValue { completer.queryFragment = query; if query.count < 2 { suggestions = [] } } } }
    var suggestions: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
    }
    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let r = Array(completer.results.filter { !$0.subtitle.contains("Search Nearby") }.prefix(4))
        Task { @MainActor in self.suggestions = r }
    }
    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {}

    /// Canned results for automated UI tests and the -demo flag (no network needed).
    static let canned: [PlaceResult] = [
        PlaceResult(name: "Leeds", country: "United Kingdom", lat: 53.80, lon: -1.55, tzID: "Europe/London"),
        PlaceResult(name: "Auckland", country: "New Zealand", lat: -36.85, lon: 174.76, tzID: "Pacific/Auckland"),
        PlaceResult(name: "New York", country: "United States", lat: 40.71, lon: -74.01, tzID: "America/New_York"),
        PlaceResult(name: "Hokitika", country: "New Zealand", lat: -42.72, lon: 170.97, tzID: "Pacific/Auckland")
    ]
    static var useCanned: Bool { CommandLine.arguments.contains("-demo") || CommandLine.arguments.contains("-cannedplaces") }
    var cannedMatches: [PlaceResult] { PlaceSearch.useCanned && query.count >= 2 ? PlaceSearch.canned.filter { $0.name.lowercased().hasPrefix(query.lowercased()) } : [] }

    /// Finds a place from the name we saved with a roast ("Leeds, United Kingdom"), including small towns and villages.
    static func geocode(_ text: String) async -> PlaceResult? {
        if useCanned {
            let first = text.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces).lowercased() } ?? ""
            if let hit = canned.first(where: { $0.name.lowercased() == first }) { return hit }
        }
        let req = MKLocalSearch.Request(); req.naturalLanguageQuery = text; req.resultTypes = .address
        guard let item = try? await MKLocalSearch(request: req).start().mapItems.first else { return nil }
        let pm = item.placemark
        return PlaceResult(name: pm.locality ?? pm.name ?? text, country: pm.country ?? "", lat: pm.coordinate.latitude, lon: pm.coordinate.longitude, tzID: item.timeZone?.identifier ?? pm.timeZone?.identifier ?? TimeZone.current.identifier)
    }

    func resolve(_ c: MKLocalSearchCompletion) async -> PlaceResult? {
        let req = MKLocalSearch.Request(completion: c)
        guard let item = try? await MKLocalSearch(request: req).start().mapItems.first else { return nil }
        let pm = item.placemark
        let name = pm.locality ?? pm.name ?? c.title
        return PlaceResult(name: name, country: pm.country ?? "", lat: pm.coordinate.latitude, lon: pm.coordinate.longitude, tzID: item.timeZone?.identifier ?? pm.timeZone?.identifier ?? TimeZone.current.identifier)
    }
}
