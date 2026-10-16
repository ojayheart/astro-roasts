import Foundation

public struct BirthData: Codable, Hashable, Sendable {
    public var name: String
    /// The birth instant (UTC). When `timeKnown` is false this is local noon.
    public var instant: Date
    public var timeKnown: Bool
    public var latitude: Double
    public var longitude: Double
    public var timeZoneID: String
    public var placeName: String
    public var countryName: String
    public init(name: String, instant: Date, timeKnown: Bool, latitude: Double, longitude: Double, timeZoneID: String, placeName: String, countryName: String) {
        self.name = name; self.instant = instant; self.timeKnown = timeKnown; self.latitude = latitude
        self.longitude = longitude; self.timeZoneID = timeZoneID; self.placeName = placeName; self.countryName = countryName
    }
    public var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .gmt }
    public var birthPlace: String { countryName.isEmpty ? placeName : "\(placeName), \(countryName)" }

    /// Builds from civil date/time in the birthplace's time zone (historical offsets via the tz database).
    public static func make(name: String, year: Int, month: Int, day: Int, hour: Int?, minute: Int?, latitude: Double, longitude: Double, timeZoneID: String, placeName: String, countryName: String) -> BirthData? {
        var cal = Calendar(identifier: .gregorian)
        guard let tz = TimeZone(identifier: timeZoneID) else { return nil }
        cal.timeZone = tz
        var c = DateComponents(); c.year = year; c.month = month; c.day = day
        c.hour = hour ?? 12; c.minute = minute ?? 0
        guard let d = cal.date(from: c), cal.component(.day, from: d) == day else { return nil }
        return BirthData(name: name, instant: d, timeKnown: hour != nil, latitude: latitude, longitude: longitude, timeZoneID: timeZoneID, placeName: placeName, countryName: countryName)
    }
}

public enum AstroMath {
    public static func obliquity(jd: Double) -> Double {
        let T = (jd - 2451545.0) / 36525.0
        return 23.439291111 - 0.013004167 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T
    }
    /// Greenwich mean sidereal time in degrees.
    public static func gmst(jd: Double) -> Double {
        let T = (jd - 2451545.0) / 36525.0
        return norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000.0)
    }
    public static func ramc(jd: Double, longitude: Double) -> Double { norm(gmst(jd: jd) + longitude) }
    public static func midheaven(ramc: Double, eps: Double) -> Double {
        norm(atan2(sin(ramc * .pi / 180), cos(ramc * .pi / 180) * cos(eps * .pi / 180)) * 180 / .pi)
    }
    public static func ascendant(ramc: Double, latitude: Double, eps: Double) -> Double {
        let r = ramc * .pi / 180, e = eps * .pi / 180, p = latitude * .pi / 180
        return norm(atan2(cos(r), -(sin(r) * cos(e) + tan(p) * sin(e))) * 180 / .pi)
    }
    /// Ecliptic (lon, lat) -> equatorial (RA, Dec), degrees.
    public static func equatorial(lon: Double, lat: Double, eps: Double) -> (ra: Double, dec: Double) {
        let l = lon * .pi / 180, b = lat * .pi / 180, e = eps * .pi / 180
        let ra = atan2(sin(l) * cos(e) - tan(b) * sin(e), cos(l)) * 180 / .pi
        let dec = asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)) * 180 / .pi
        return (norm(ra), dec)
    }
}

public struct NatalChart: Codable, Hashable, Sendable {
    public let birth: BirthData
    public let positions: [Int: Double]   // Body.rawValue -> longitude
    public let retrograde: [Int: Bool]
    public let ascendant: Double?
    public let midheaven: Double?

    public init(birth: BirthData) {
        self.birth = birth
        let eph = Ephemeris.shared
        let jd = JD.from(birth.instant)
        var pos: [Int: Double] = [:], retro: [Int: Bool] = [:]
        for b in Body.allCases { pos[b.rawValue] = eph.longitude(b, jd: jd); retro[b.rawValue] = eph.speed(b, jd: jd) < 0 }
        positions = pos; retrograde = retro
        if birth.timeKnown {
            let eps = AstroMath.obliquity(jd: jd)
            let ramc = AstroMath.ramc(jd: jd, longitude: birth.longitude)
            ascendant = AstroMath.ascendant(ramc: ramc, latitude: birth.latitude, eps: eps)
            midheaven = AstroMath.midheaven(ramc: ramc, eps: eps)
        } else { ascendant = nil; midheaven = nil }
    }

    public func lon(_ b: Body) -> Double { positions[b.rawValue] ?? 0 }
    public var sunSign: String { Zodiac.name(lon(.sun)) }
    public var moonSign: String { Zodiac.name(lon(.moon)) }
    public var risingSign: String? { ascendant.map { Zodiac.name($0) } }

    /// For unknown birth time: both candidate rising signs (earliest/latest possible time on that civil day) and the
    /// local time at which the rising sign flips. Nil when time is known or the day doesn't straddle a sign change.
    public func risingCandidates() -> (early: String, late: String, flipLocalMinutes: Int)? {
        guard !birth.timeKnown else { return nil }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = birth.timeZone
        let start = cal.startOfDay(for: birth.instant)
        let eph = Ephemeris.shared; _ = eph
        func asc(_ minutes: Int) -> Double {
            let jd = JD.from(start.addingTimeInterval(Double(minutes) * 60))
            let eps = AstroMath.obliquity(jd: jd)
            return AstroMath.ascendant(ramc: AstroMath.ramc(jd: jd, longitude: birth.longitude), latitude: birth.latitude, eps: eps)
        }
        // Scan the day; the ascendant sweeps all 12 signs, so return the two signs around local noon-ish (most plausible
        // daytime births are unknowable): report signs at 06:00 and the one that follows it, plus the flip minute.
        var prev = Zodiac.index(asc(0))
        var flips: [(Int, Int, Int)] = []
        for m in stride(from: 1, to: 1440, by: 1) {
            let i = Zodiac.index(asc(m))
            if i != prev { flips.append((m, prev, i)); prev = i }
        }
        guard let f = flips.first(where: { $0.0 >= 360 }) ?? flips.first else { return nil }
        return (Zodiac.names[f.1], Zodiac.names[f.2], f.0)
    }
}

public enum AspectKind: Int, CaseIterable, Codable, Sendable {
    case conjunction = 0, sextile = 60, square = 90, trine = 120, opposition = 180
    public var angle: Double { Double(rawValue) }
    public var symbol: String { switch self { case .conjunction: "☌"; case .sextile: "✶"; case .square: "□"; case .trine: "△"; case .opposition: "☍" } }
    public var name: String { switch self { case .conjunction: "conjunct"; case .sextile: "sextile"; case .square: "square"; case .trine: "trine"; case .opposition: "opposite" } }
    public var isHard: Bool { self == .square || self == .opposition }
    public static func between(_ a: Double, _ b: Double, orb: Double) -> (AspectKind, Double)? {
        let sep = abs(angDiff(a, b))
        for k in AspectKind.allCases {
            let o = abs(sep - k.angle)
            if o <= orb { return (k, o) }
        }
        return nil
    }
}

public struct NatalPoint: Hashable, Codable, Sendable {
    public enum Kind: String, Codable, Sendable { case body, asc, mc }
    public let kind: Kind
    public let body: Body?
    public var name: String { switch kind { case .body: body!.name; case .asc: "Rising"; case .mc: "Midheaven" } }
    public var glyph: String { switch kind { case .body: body!.glyph; case .asc: "Asc"; case .mc: "MC" } }
    public static func of(_ b: Body) -> NatalPoint { .init(kind: .body, body: b) }
    public static let asc = NatalPoint(kind: .asc, body: nil)
    public static let mc = NatalPoint(kind: .mc, body: nil)
}

extension NatalChart {
    public func points() -> [(NatalPoint, Double)] {
        var out: [(NatalPoint, Double)] = Body.planets.map { (.of($0), lon($0)) }
        if let a = ascendant { out.append((.asc, a)) }
        if let m = midheaven { out.append((.mc, m)) }
        return out
    }
}
