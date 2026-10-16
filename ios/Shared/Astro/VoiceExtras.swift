import Foundation

extension Voice {
    /// A longer roast of a single day (used by "Roast this day" and time travel).
    public static func dayRoast(natal: NatalChart, reading r: DayReading, calendar: Calendar = .current) -> String {
        let sd = seed(r.day, 11)
        var out: [String] = []
        if let h = r.driver {
            out.append("\(sentence(for: h, seed: sd)) \(adviceLine(for: h, seed: sd))")
            let when = h.orb < 0.3 ? "exact" : "within \(String(format: "%.1f", h.orb))°"
            out.append("\(hitName(h)) is \(when) on the day, which is why everything feels either urgent or personal. Often both.")
        } else {
            out.append(r.headline)
        }
        let moon = (moonMood[r.moonSign]?.line ?? "").replacingOccurrences(of: "Moon in \(r.moonSign): ", with: "")
        out.append("Meanwhile the Moon is in \(r.moonSign) (\(r.phase.lowercased())), so it's \(moon.prefix(1).lowercased() + moon.dropFirst())")
        out.append("Overall energy: \(r.vibe.lowercased()). Do: \(r.doList.joined(separator: ", ").lowercased()). Don't: \(r.dontList.joined(separator: ", ").lowercased()). Absolutely not: \((r.neverList.first ?? "").lowercased()).")
        return out.joined(separator: " ")
    }

    /// One third-person line about someone else's day, for the Coven overlay.
    public static func covenLine(name: String, hit: TransitHit, day: Date) -> String {
        let hard: [String] = ["\(name) is touchy today. Compliment something.", "\(name) will want to talk about feelings. Have snacks ready.", "\(name) is a lot today. Pick your battles and the restaurant."]
        let soft: [String] = ["\(name) is unusually agreeable. Ask now.", "Good day to plan something with \(name).", "\(name) is in a generous mood. Do not waste it."]
        let fuse: [String] = ["\(name) has main-character energy today. Let them.", "\(name) is somewhere deep inside their own head. Wave."]
        let pool = hit.aspect.isHard ? hard : (hit.aspect == .conjunction ? fuse : soft)
        return pick(pool, seed: seed(day, name.count))
    }

    /// Upcoming moments that matter for this person in the next `days` days.
    public static func upcoming(natal: NatalChart, from date: Date, days: Int = 24, limit: Int = 6, calendar: Calendar = .current) -> [ChartEvent] {
        let start = calendar.startOfDay(for: date), end = calendar.date(byAdding: .day, value: days, to: start)!
        var out: [ChartEvent] = []
        for e in Sky.moonPhases(from: start, to: end) where e.kind == .newMoon || e.kind == .fullMoon { out.append(e) }
        for e in Sky.planetaryEvents(from: start, to: end) where e.title.contains("turns") && (e.title.contains("Mercury") || e.title.contains("Venus") || e.title.contains("Mars")) { out.append(e) }
        var d = start
        var seen = Set<String>()
        while d < end {
            let noon = d.addingTimeInterval(12 * 3600)
            if let h = Sky.hits(natal: natal, on: noon, maxOrb: 0.35, bodies: Body.slow + [.mars, .venus, .mercury]).first(where: { $0.weight >= 3.6 }), !seen.contains(h.id) {
                seen.insert(h.id)
                let exact = Sky.exactMoment(transiting: h.transiting, aspect: h.aspect, natalLongitude: h.natalLongitude, near: noon, windowDays: 1.5) ?? noon
                out.append(ChartEvent(kind: .transit, date: exact, title: hitName(h), subtitle: sentence(for: h, seed: seed(d)), personal: true))
            }
            d = calendar.date(byAdding: .day, value: 1, to: d)!
        }
        return Array(out.sorted { $0.date < $1.date }.prefix(limit))
    }

    /// How the moon dial's "loud week" ring is drawn: days with a heavy personal hit.
    public static func intensity(natal: NatalChart, on date: Date) -> Double {
        let noon = Calendar.current.startOfDay(for: date).addingTimeInterval(12 * 3600)
        let hits = Sky.hits(natal: natal, on: noon, maxOrb: 1.2)
        return min(1, (hits.first(where: { $0.transiting != .moon })?.weight ?? 0) / 7)
    }
}
