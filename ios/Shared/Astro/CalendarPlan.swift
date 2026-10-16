import Foundation

public enum CalendarPlan {
    public static let marker = "[astroroast]"

    public struct Planned: Hashable { public let date: Date; public let title: String; public let notes: String; public init(date: Date, title: String, notes: String) { self.date = date; self.title = title; self.notes = notes } }

    /// What we'd add for the next `days` days, honoring the toggles.
    public static func plan(natal: NatalChart, prefs: CalendarPrefs, people: [Person], days: Int = 90) -> [Planned] {
        let cal = Calendar.current, start = cal.startOfDay(for: Date()), end = cal.date(byAdding: .day, value: days, to: start)!
        var out: [Planned] = []
        if prefs.moons { for e in Sky.moonPhases(from: start, to: end) where e.kind == .newMoon || e.kind == .fullMoon { out.append(Planned(date: e.date, title: "☽ " + e.title, notes: e.kind == .fullMoon ? "Something you said in May comes back." : "Plant something. Not a grudge.")) } }
        if prefs.retrogrades {
            for e in Sky.planetaryEvents(from: start, to: end) where e.kind == .stationRetrograde || e.kind == .stationDirect || (e.kind == .ingress && e.title.hasPrefix("Sun")) {
                guard e.kind == .ingress || e.title.contains("Mercury") || e.title.contains("Venus") || e.title.contains("Mars") else { continue }
                out.append(Planned(date: e.date, title: e.title, notes: e.kind == .stationRetrograde ? "Back up your phone. Do not back up to your ex." : (e.kind == .stationDirect ? "Texts make sense again. Mostly." : "A new season. Nobody asked.")))
            }
        }
        if prefs.transits {
            var d = start, seen = Set<String>()
            while d < end {
                let noon = d.addingTimeInterval(12 * 3600)
                if let h = Sky.hits(natal: natal, on: noon, maxOrb: 0.35, bodies: AstroKit.Body.slow + [.mars, .venus, .mercury]).first(where: { $0.weight >= 3.6 }), !seen.contains(h.id) {
                    seen.insert(h.id)
                    out.append(Planned(date: Voice.exactMoment(of: h, near: noon) ?? noon, title: "\(Voice.hitTitle(h)) \(Voice.hitName(h))", notes: "\(Voice.sentence(for: h, seed: Voice.seed(d))) \(Voice.adviceLine(for: h, seed: Voice.seed(d)))"))
                }
                d = cal.date(byAdding: .day, value: 1, to: d)!
            }
        }
        if prefs.coven {
            for p in people.filter(\.overlaySource) {
                var d = start; let chart = p.chart
                while d < end {
                    let noon = d.addingTimeInterval(12 * 3600)
                    if let h = Sky.hits(natal: chart, on: noon, maxOrb: 0.3, bodies: AstroKit.Body.slow + [.mars]).first(where: { $0.weight >= 4.2 }) {
                        out.append(Planned(date: noon, title: "\(p.name): \(Voice.hitName(h))", notes: Voice.covenLine(name: p.name, hit: h, day: d)))
                        d = cal.date(byAdding: .day, value: 12, to: d)!
                    } else { d = cal.date(byAdding: .day, value: 1, to: d)! }
                }
            }
        }
        return out.sorted { $0.date < $1.date }
    }

    /// RFC 5545 export for Google Calendar / Outlook import.
    public static func ics(planned: [Planned]) -> String {
        func esc(_ s: String) -> String { s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: ",", with: "\\,").replacingOccurrences(of: ";", with: "\\;").replacingOccurrences(of: "\n", with: "\\n") }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        func d(_ date: Date) -> String { let c = cal.dateComponents([.year, .month, .day], from: date); return String(format: "%04d%02d%02d", c.year!, c.month!, c.day!) }
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AstroRoast//iOS//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:AstroRoast"]
        for p in planned {
            let next = cal.date(byAdding: .day, value: 1, to: p.date)!
            lines += ["BEGIN:VEVENT", "UID:\(d(p.date))-\(abs(p.title.hashValue))@astroroast.com", "DTSTAMP:\(d(Date()))T000000Z", "DTSTART;VALUE=DATE:\(d(p.date))", "DTEND;VALUE=DATE:\(d(next))", "SUMMARY:\(esc(p.title))", "DESCRIPTION:\(esc(p.notes))", "TRANSP:TRANSPARENT", "END:VEVENT"]
        }
        lines.append("END:VCALENDAR")
        return lines.joined(separator: "\r\n")
    }
}
