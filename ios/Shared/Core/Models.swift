import Foundation

public struct RoastPayload: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var status: String
    public var sunSign: String?
    public var moonSign: String?
    public var rising: String?
    public var mercurySign: String?
    public var venusSign: String?
    public var marsSign: String?
    public var jupiterSign: String?
    public var saturnSign: String?
    public var teaser: String?
    public var fullText: String?
    public var callouts: [String]?
    public var paid: Bool
    public var stagePct: Int?
    public var kind: String?
    public var subjectNames: [String]?
    public var amountMinorUnits: Int?
    public var isDemo: Bool? = nil
    public var createdAt: String? = nil
    public init(id: String, name: String, status: String, sunSign: String? = nil, moonSign: String? = nil, rising: String? = nil, teaser: String? = nil, fullText: String? = nil, callouts: [String]? = nil, paid: Bool = false, stagePct: Int? = nil, kind: String? = "solo", isDemo: Bool? = nil) {
        self.id = id; self.name = name; self.status = status; self.sunSign = sunSign; self.moonSign = moonSign; self.rising = rising
        self.teaser = teaser; self.fullText = fullText; self.callouts = callouts; self.paid = paid; self.stagePct = stagePct; self.kind = kind; self.isDemo = isDemo
    }
    public var isReady: Bool { status == "ready" }
    public var paragraphs: [String] { ((paid ? fullText : nil) ?? teaser ?? "").components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty } }
}

public struct Person: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID = UUID()
    public var birth: BirthData
    public var role: String            // Me / Boss / Ex / Crush / Mum / Friend / Flatmate / Cat...
    public var overlaySource: Bool = false   // toggled on in the Month overlay
    public var roastID: String? = nil
    public var name: String { birth.name }
    public var chart: NatalChart { NatalChart(birth: birth) }
    public init(birth: BirthData, role: String) { self.birth = birth; self.role = role }
}

public enum ReceiptRating: String, Codable, CaseIterable, Sendable { case spotOn = "Spot on", rudeButTrue = "Rude but true", wrong = "Wrong" }

public struct NotificationPrefs: Codable, Hashable, Sendable {
    public enum Level: Int, Codable, CaseIterable, Sendable { case big = 0, bigPlusCoven = 1, never = 2 }
    public var level: Level = .big
    public var quietStart: Int = 22   // hour
    public var quietEnd: Int = 8
    public init() {}
}

public struct CalendarPrefs: Codable, Hashable, Sendable {
    public var enabled = false
    public var calendarID: String? = nil
    public var moons = true, retrogrades = true, transits = true, coven = false
    public init() {}
}

public struct AppState: Codable, Sendable {
    public var profile: BirthData?
    public var gender: String = "non-binary"
    public var onboardingDone = false
    public var timeAssumed = false
    public var currentRoast: RoastPayload?
    public var roasts: [RoastPayload] = []
    public var people: [Person] = []
    public var receipts: [String: ReceiptRating] = [:]   // "yyyy-MM-dd" -> rating
    public var openedDays: [String] = []                 // "yyyy-MM-dd" for streaks
    public var notifications = NotificationPrefs()
    public var calendar = CalendarPrefs()
    public var unlockedRoastIDs: [String] = []
    public var mutedTransitBodies: [Int] = []
    public var roastedDays: [String: String] = [:]       // "yyyy-MM-dd" -> roast text for that day
    public init() {}
}

public enum DayKey {
    public static func key(_ d: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

public struct CloudBirth: Codable, Hashable, Sendable {
    public var name: String
    public var gender: String?
    public var date: String          // yyyy-MM-dd
    public var time: String?         // HH:mm
    public var place: String         // "Leeds, United Kingdom"
}
/// A roast that belongs to a signed-in email, with the owner's birth details so a profile can be restored without retyping.
public struct CloudRoast: Codable, Hashable, Identifiable, Sendable {
    public var roast: RoastPayload
    public var birth: CloudBirth
    public var id: String { roast.id }

    /// Roasts worth showing: failed ones have no text and can't be opened.
    public static func visible(_ all: [CloudRoast]) -> [CloudRoast] { all.filter { $0.roast.status != "error" } }

    /// One entry per person, solo roasts first. The same person is often roasted several times under slightly different names
    /// ("Oliver", "Oliver Hart"), so people are matched by birth moment and place, and the fullest name wins.
    public static func people(_ all: [CloudRoast]) -> [CloudRoast] {
        func key(_ c: CloudRoast) -> String { [c.birth.date, c.birth.time ?? "", c.birth.place.lowercased()].joined(separator: "|") }
        let solo = all.filter { ($0.roast.kind ?? "solo") == "solo" }
        let pool = solo.isEmpty ? all : solo + all.filter { ($0.roast.kind ?? "solo") != "solo" }
        var best: [String: CloudRoast] = [:], order: [String] = []
        for c in pool {
            let k = key(c)
            if let cur = best[k] { if c.birth.name.count > cur.birth.name.count { best[k] = c } } else { best[k] = c; order.append(k) }
        }
        return order.compactMap { best[$0] }
    }
}
