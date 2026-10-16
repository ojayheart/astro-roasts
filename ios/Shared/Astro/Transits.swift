import Foundation

public struct TransitHit: Identifiable, Hashable, Codable, Sendable {
    public var id: String { "\(transiting.rawValue)-\(aspect.rawValue)-\(natal.kind.rawValue)-\(natal.body?.rawValue ?? -1)" }
    public let transiting: Body
    public let aspect: AspectKind
    public let natal: NatalPoint
    public let orb: Double        // degrees from exact at the sampled moment
    public let natalLongitude: Double
    public var weight: Double {   // how much it should matter in a "top transit" ranking
        let planetWeight: Double = switch transiting {
        case .pluto, .neptune, .uranus, .saturn: 5
        case .jupiter: 4
        case .mars: 3
        case .sun, .venus, .mercury: 2
        case .moon, .node: 1
        }
        let natalWeight: Double = switch natal.kind {
        case .asc, .mc: 1.4
        case .body: [Body.sun, .moon].contains(natal.body!) ? 1.5 : 1.0
        }
        return (planetWeight * natalWeight) / (1 + orb * 2)
    }
}

public struct ChartEvent: Identifiable, Hashable, Codable, Sendable {
    public enum Kind: String, Codable, Sendable { case newMoon, firstQuarter, fullMoon, lastQuarter, ingress, stationRetrograde, stationDirect, transit }
    public var id: String { "\(kind.rawValue)-\(Int(date.timeIntervalSince1970))-\(title)" }
    public let kind: Kind
    public let date: Date
    public let title: String
    public let subtitle: String
    public let personal: Bool
}

public struct Situation: Identifiable, Hashable, Codable, Sendable {
    public var id: String { hit.id }
    public let hit: TransitHit
    public let start: Date
    public let end: Date
    public let peak: Date
}

public enum MoonPhaseName: String, Sendable {
    case new = "New Moon", waxingCrescent = "Waxing crescent", firstQuarter = "First quarter", waxingGibbous = "Waxing gibbous"
    case full = "Full Moon", waningGibbous = "Waning gibbous", lastQuarter = "Last quarter", waningCrescent = "Waning crescent"
}

public enum Sky {
    private static var eph: Ephemeris { .shared }

    public static func elongation(_ jd: Double) -> Double { norm(eph.longitude(.moon, jd: jd) - eph.longitude(.sun, jd: jd)) }
    public static func illumination(_ date: Date) -> Double { (1 - cos(elongation(JD.from(date)) * .pi / 180)) / 2 }
    public static func phase(_ date: Date) -> MoonPhaseName {
        let e = elongation(JD.from(date))
        switch e {
        case ..<6.5, 353.5...: return .new
        case ..<83.5: return .waxingCrescent
        case ..<96.5: return .firstQuarter
        case ..<173.5: return .waxingGibbous
        case ..<186.5: return .full
        case ..<263.5: return .waningGibbous
        case ..<276.5: return .lastQuarter
        default: return .waningCrescent
        }
    }

    /// Bisection for the moment a monotonic-ish function crosses zero between two JDs.
    public static func root(_ f: (Double) -> Double, _ lo: Double, _ hi: Double) -> Double {
        var a = lo, b = hi, fa = f(a)
        for _ in 0..<40 {
            let m = (a + b) / 2, fm = f(m)
            if (fa < 0) == (fm < 0) { a = m; fa = fm } else { b = m }
        }
        return (a + b) / 2
    }

    /// Exact moment of an aspect between a transiting body and a fixed natal longitude, searched around `near`.
    public static func exactMoment(transiting: Body, aspect: AspectKind, natalLongitude: Double, near date: Date, windowDays: Double = 3) -> Date? {
        let jd0 = JD.from(date)
        let targets: [Double] = aspect == .conjunction || aspect == .opposition ? [aspect.angle] : [aspect.angle, -aspect.angle]
        func f(_ jd: Double, _ t: Double) -> Double { angDiff(eph.longitude(transiting, jd: jd) - natalLongitude, t) }
        var best: Date?
        var bestDist = Double.infinity
        for t in targets {
            var prev = jd0 - windowDays, pv = f(prev, t)
            var jd = prev + 0.25
            while jd <= jd0 + windowDays {
                let v = f(jd, t)
                if (pv < 0) != (v < 0), abs(pv - v) < 90 {
                    let r = root({ f($0, t) }, prev, jd)
                    if abs(r - jd0) < bestDist { bestDist = abs(r - jd0); best = JD.date(r) }
                }
                prev = jd; pv = v; jd += 0.25
            }
        }
        return best
    }

    /// Aspects between transiting planets at `date` and natal points.
    public static func hits(natal: NatalChart, on date: Date, maxOrb: Double = 2.0, bodies: [Body] = Body.planets + [.node]) -> [TransitHit] {
        let jd = JD.from(date)
        var out: [TransitHit] = []
        for tb in bodies {
            let tl = eph.longitude(tb, jd: jd)
            for (np, nl) in natal.points() {
                if tb == .moon && np.body == .moon { continue }
                let orbLimit: Double = switch tb {
                case .moon: min(maxOrb, 1.2)
                case .sun, .mercury, .venus: min(maxOrb, 1.5)
                default: maxOrb
                }
                if let (kind, orb) = AspectKind.between(tl, nl, orb: orbLimit) {
                    if tb == .node && kind != .conjunction { continue }
                    if let nb = np.body, nb == tb && kind == .conjunction { continue }
                    out.append(TransitHit(transiting: tb, aspect: kind, natal: np, orb: orb, natalLongitude: nl))
                }
            }
        }
        return out.sorted { $0.weight > $1.weight }
    }

    /// Long-running aspects (slow planets + Mars) active around `date`, with start/peak/end dates.
    public static func situations(natal: NatalChart, around date: Date, lookBackDays: Int = 400, lookAheadDays: Int = 400, bodies: [Body] = [.jupiter, .saturn, .uranus, .neptune, .pluto]) -> [Situation] {
        let jd0 = JD.from(date)
        var out: [Situation] = []
        let orb = 2.0
        for tb in bodies {
            for (np, nl) in natal.points() {
                for kind in AspectKind.allCases where kind != .sextile {
                    // sample every 3 days; find windows with |diff|<=orb
                    var windows: [(Double, Double, Double, Double)] = [] // start, end, peakJD, minOrb
                    var openStart: Double?, minO = 99.0, peakJD = 0.0
                    var jd = jd0 - Double(lookBackDays)
                    let end = jd0 + Double(lookAheadDays)
                    while jd <= end {
                        let tl = eph.longitude(tb, jd: jd)
                        let o = abs(abs(angDiff(tl, nl)) - kind.angle)
                        if o <= orb {
                            if openStart == nil { openStart = jd; minO = 99 }
                            if o < minO { minO = o; peakJD = jd }
                        } else if let s = openStart {
                            windows.append((s, jd, peakJD, minO)); openStart = nil
                        }
                        jd += 3
                    }
                    if let s = openStart { windows.append((s, end, peakJD, minO)) }
                    // merge windows separated by < 60 days (retrograde loops)
                    var merged: [(Double, Double, Double, Double)] = []
                    for w in windows {
                        if let l = merged.last, w.0 - l.1 < 60 {
                            merged[merged.count - 1] = (l.0, w.1, w.3 < l.3 ? w.2 : l.2, min(w.3, l.3))
                        } else { merged.append(w) }
                    }
                    for w in merged where w.0 <= jd0 + 1 && w.1 >= jd0 - 1 && w.3 < 1.2 {
                        let hit = TransitHit(transiting: tb, aspect: kind, natal: np, orb: w.3, natalLongitude: nl)
                        out.append(Situation(hit: hit, start: JD.date(w.0), end: JD.date(w.1), peak: JD.date(w.2)))
                    }
                }
            }
        }
        return out.sorted { $0.hit.weight > $1.hit.weight }
    }

    /// Exact moon phase moments between two dates.
    public static func moonPhases(from: Date, to: Date) -> [ChartEvent] {
        var out: [ChartEvent] = []
        let jdA = JD.from(from), jdB = JD.from(to)
        for (i, target) in [0.0, 90.0, 180.0, 270.0].enumerated() {
            var jd = jdA
            var prev = angDiff(elongation(jd), target)
            while jd < jdB {
                jd += 0.25
                let v = angDiff(elongation(jd), target)
                if prev < 0, v >= 0, abs(v - prev) < 90 {
                    let r = root({ angDiff(elongation($0), target) }, jd - 0.25, jd)
                    let d = JD.date(r)
                    let sign = Zodiac.name(eph.longitude(.moon, jd: r))
                    let kind: ChartEvent.Kind = [.newMoon, .firstQuarter, .fullMoon, .lastQuarter][i]
                    let name = ["New Moon", "First quarter", "Full Moon", "Last quarter"][i]
                    out.append(ChartEvent(kind: kind, date: d, title: i == 0 || i == 2 ? "\(name) in \(sign)" : name, subtitle: sign, personal: false))
                }
                prev = v
            }
        }
        return out.sorted { $0.date < $1.date }
    }

    /// Sign ingresses and stations for the visible planets between two dates.
    public static func planetaryEvents(from: Date, to: Date) -> [ChartEvent] {
        var out: [ChartEvent] = []
        let jdA = JD.from(from), jdB = JD.from(to)
        for b in [Body.sun, .mercury, .venus, .mars, .jupiter, .saturn, .uranus, .neptune, .pluto] {
            var jd = jdA
            var prevSign = Zodiac.index(eph.longitude(b, jd: jd))
            var prevSpeed = eph.speed(b, jd: jd)
            let step = b == .sun || b == .mercury || b == .venus || b == .mars ? 0.5 : 1.0
            while jd < jdB {
                let next = jd + step
                let s = Zodiac.index(eph.longitude(b, jd: next))
                if s != prevSign {
                    // refine by bisection on sign index change
                    var a = jd, c = next
                    for _ in 0..<30 { let m = (a + c) / 2; if Zodiac.index(eph.longitude(b, jd: m)) == prevSign { a = m } else { c = m } }
                    let d = JD.date(c)
                    out.append(ChartEvent(kind: .ingress, date: d, title: "\(b.name) enters \(Zodiac.names[s])", subtitle: Zodiac.names[s], personal: false))
                    prevSign = s
                }
                let sp = eph.speed(b, jd: next)
                if b != .sun, (prevSpeed < 0) != (sp < 0) {
                    let r = root({ eph.speed(b, jd: $0) }, jd, next)
                    let d = JD.date(r)
                    let sign = Zodiac.name(eph.longitude(b, jd: r))
                    out.append(ChartEvent(kind: sp < 0 ? .stationRetrograde : .stationDirect, date: d, title: sp < 0 ? "\(b.name) turns retrograde" : "\(b.name) turns direct", subtitle: sign, personal: false))
                }
                prevSpeed = sp; jd = next
            }
        }
        return out.sorted { $0.date < $1.date }
    }

    public static func retrogradeBodies(on date: Date) -> [Body] {
        [Body.mercury, .venus, .mars, .jupiter, .saturn].filter { eph.speed($0, jd: JD.from(date)) < 0 }
    }
}
