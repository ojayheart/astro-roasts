import XCTest
@testable import AstroKit

final class EngineTests: XCTestCase {
    struct Vectors: Decodable {
        struct Pos: Decodable { let jd: Double; let lon: [Double] }
        struct Ang: Decodable { let jd, lat, lon, asc, mc: Double }
        struct Ph: Decodable { let target: Int; let jd: Double }
        let positions: [Pos]; let angles: [Ang]; let phases: [Ph]
    }
    func vectors() throws -> Vectors {
        let url = Bundle(for: EngineTests.self).url(forResource: "vectors", withExtension: "json")!
        return try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }

    func testPositionsMatchSwissEphemeris() throws {
        var worst = 0.0
        for p in try vectors().positions {
            for (i, b) in Body.allCases.enumerated() {
                let d = abs(angDiff(Ephemeris.shared.longitude(b, jd: p.jd), p.lon[i]))
                worst = max(worst, d)
                XCTAssertLessThan(d, 0.01, "\(b.name) at jd \(p.jd)")
            }
        }
        print("worst longitude error (deg):", worst)
    }

    func testAscendantAndMidheavenMatchSwiss() throws {
        for a in try vectors().angles {
            let eps = AstroMath.obliquity(jd: a.jd)
            let ramc = AstroMath.ramc(jd: a.jd, longitude: a.lon)
            XCTAssertLessThan(abs(angDiff(AstroMath.ascendant(ramc: ramc, latitude: a.lat, eps: eps), a.asc)), 0.05, "ASC \(a)")
            XCTAssertLessThan(abs(angDiff(AstroMath.midheaven(ramc: ramc, eps: eps), a.mc)), 0.05, "MC \(a)")
        }
    }

    func testMoonPhaseMoments() throws {
        for ph in try vectors().phases {
            let events = Sky.moonPhases(from: JD.date(ph.jd - 2), to: JD.date(ph.jd + 2))
            let kind: ChartEvent.Kind = [0: .newMoon, 90: .firstQuarter, 180: .fullMoon, 270: .lastQuarter][ph.target]!
            let found = events.first { $0.kind == kind }
            XCTAssertNotNil(found, "phase \(ph.target)")
            if let f = found { XCTAssertLessThan(abs(JD.from(f.date) - ph.jd) * 1440, 2.0, "minutes off for \(ph.target)") }
        }
    }

    func testHumanDesignWheelAnchors() {
        XCTAssertEqual(HumanDesign.wheel.count, 64)
        XCTAssertEqual(Set(HumanDesign.wheel).count, 64)
        XCTAssertEqual(HumanDesign.gateLine(0.5).0, 25)          // 0° Aries sits in gate 25
        XCTAssertEqual(HumanDesign.gateLine(302.1).0, 41)        // wheel starts at 2° Aquarius
        XCTAssertEqual(HumanDesign.channelList.count, 36)
        XCTAssertEqual(HumanDesign.centerOf.count, 64)
    }

    func testHumanDesignTablesAreConsistent() {
        // Every gate sits in exactly one center and appears in at least one channel; 36 channels = 72 gate slots (4 hub gates appear 3 times).
        var appearances: [Int: Int] = [:]
        for c in HumanDesign.channelList { appearances[c[0], default: 0] += 1; appearances[c[1], default: 0] += 1 }
        XCTAssertEqual(Set(appearances.keys), Set(1...64))
        XCTAssertEqual(appearances.values.reduce(0, +), 72)
        for g in [10, 20, 34, 57] { XCTAssertEqual(appearances[g], 3, "hub gate \(g)") }
        for (g, n) in appearances where ![10, 20, 34, 57].contains(g) { XCTAssertEqual(n, 1, "gate \(g)") }
        for c in HumanDesign.channelList { XCTAssertNotEqual(HumanDesign.centerOf[c[0]], HumanDesign.centerOf[c[1]], "channel \(c)") }
        var perCenter: [HDCenter: Int] = [:]
        for (_, c) in HumanDesign.centerOf { perCenter[c, default: 0] += 1 }
        XCTAssertEqual(perCenter[.head], 3); XCTAssertEqual(perCenter[.ajna], 6); XCTAssertEqual(perCenter[.throat], 11); XCTAssertEqual(perCenter[.g], 8)
        XCTAssertEqual(perCenter[.heart], 4); XCTAssertEqual(perCenter[.sacral], 9); XCTAssertEqual(perCenter[.spleen], 7); XCTAssertEqual(perCenter[.solar], 7); XCTAssertEqual(perCenter[.root], 9)
    }

    func testHumanDesignTypeRules() {
        func chart(_ gates: Set<Int>) -> HDChart {
            let ch = HumanDesign.channelList.filter { gates.contains($0[0]) && gates.contains($0[1]) }
            var d = Set<HDCenter>(); for c in ch { d.insert(HumanDesign.centerOf[c[0]]!); d.insert(HumanDesign.centerOf[c[1]]!) }
            return HDChart(activations: [], gates: gates, channels: ch, defined: d, type: "", authority: "", profile: "", strategy: "", designDate: Date())
        }
        // 34-20 connects Sacral to Throat -> Manifesting Generator; 5-15 (Sacral-G) alone -> Generator; 21-45 (Heart-Throat) alone -> Manifestor; 11-56 (Ajna-Throat) -> Projector
        XCTAssertEqual(chart([34, 20]).defined, [.sacral, .throat])
        XCTAssertEqual(chart([5, 15]).defined, [.sacral, .g])
        XCTAssertEqual(chart([21, 45]).defined, [.heart, .throat])
        XCTAssertEqual(chart([11, 56]).defined, [.ajna, .throat])
    }

    func testDailyHeadlineDoesNotRepeatDayAfterDay() throws {
        let b = BirthData.make(name: "T", year: 1997, month: 6, day: 14, hour: 6, minute: 42, latitude: 53.80, longitude: -1.55, timeZoneID: "Europe/London", placeName: "Leeds", countryName: "United Kingdom")!
        let n = NatalChart(birth: b)
        let start = Date(timeIntervalSince1970: 1_792_000_000)
        let heads = (0..<7).map { Voice.reading(natal: n, on: Calendar.current.date(byAdding: .day, value: $0, to: start)!).headline }
        for i in 1..<heads.count { XCTAssertNotEqual(heads[i], heads[i - 1], "day \(i) repeats day \(i - 1)") }
    }

    func testChartAndDesignDate() throws {
        let b = BirthData.make(name: "T", year: 1997, month: 6, day: 14, hour: 6, minute: 42, latitude: 53.80, longitude: -1.55, timeZoneID: "Europe/London", placeName: "Leeds", countryName: "United Kingdom")!
        let n = NatalChart(birth: b)
        XCTAssertEqual(n.sunSign, "Gemini"); XCTAssertEqual(n.moonSign, "Libra"); XCTAssertEqual(n.risingSign, "Cancer")
        let hd = HumanDesign.chart(for: b)
        let days = b.instant.timeIntervalSince(hd.designDate) / 86400
        XCTAssertTrue((86...91).contains(days), "design date \(days) days before birth")
        XCTAssertEqual(hd.activations.count, 26)
    }

    func testReadingIsDeterministicAndPopulated() throws {
        let b = BirthData.make(name: "T", year: 1997, month: 6, day: 14, hour: 6, minute: 42, latitude: 53.80, longitude: -1.55, timeZoneID: "Europe/London", placeName: "Leeds", countryName: "United Kingdom")!
        let n = NatalChart(birth: b)
        let d = Date(timeIntervalSince1970: 1_792_000_000)
        let r1 = Voice.reading(natal: n, on: d), r2 = Voice.reading(natal: n, on: d)
        XCTAssertEqual(r1, r2)
        XCTAssertFalse(r1.headline.isEmpty); XCTAssertFalse(r1.doList.isEmpty)
        XCTAssertFalse(r1.headline.contains("{N}"))
    }
}

final class CalendarPlanTests: XCTestCase {
    func natal() -> NatalChart {
        NatalChart(birth: BirthData.make(name: "T", year: 1997, month: 6, day: 14, hour: 6, minute: 42, latitude: 53.80, longitude: -1.55, timeZoneID: "Europe/London", placeName: "Leeds", countryName: "United Kingdom")!)
    }
    func testPlanHonoursTogglesAndIsSorted() {
        var prefs = CalendarPrefs(); prefs.moons = true; prefs.retrogrades = false; prefs.transits = false; prefs.coven = false
        let moons = CalendarPlan.plan(natal: natal(), prefs: prefs, people: [])
        XCTAssertFalse(moons.isEmpty)
        XCTAssertTrue(moons.allSatisfy { $0.title.hasPrefix("☽") })
        XCTAssertEqual(moons.map(\.date), moons.map(\.date).sorted())
        prefs.moons = false; prefs.retrogrades = true; prefs.transits = true
        let rest = CalendarPlan.plan(natal: natal(), prefs: prefs, people: [])
        XCTAssertTrue(rest.allSatisfy { !$0.title.hasPrefix("☽") })
        prefs = CalendarPrefs(); prefs.moons = false; prefs.retrogrades = false; prefs.transits = false; prefs.coven = false
        XCTAssertTrue(CalendarPlan.plan(natal: natal(), prefs: prefs, people: []).isEmpty)
    }
    func testICSIsWellFormed() {
        let events = [CalendarPlan.Planned(date: Date(timeIntervalSince1970: 1_793_000_000), title: "☽ Full Moon in Taurus, again", notes: "Line one;\nline two, with a comma"),
                      CalendarPlan.Planned(date: Date(timeIntervalSince1970: 1_794_000_000), title: "Mercury goes retrograde", notes: "Back up your phone.")]
        let ics = CalendarPlan.ics(planned: events)
        XCTAssertTrue(ics.hasPrefix("BEGIN:VCALENDAR\r\n")); XCTAssertTrue(ics.hasSuffix("END:VCALENDAR"))
        XCTAssertEqual(ics.components(separatedBy: "BEGIN:VEVENT").count - 1, 2); XCTAssertEqual(ics.components(separatedBy: "END:VEVENT").count - 1, 2)
        XCTAssertTrue(ics.contains("DTSTART;VALUE=DATE:")); XCTAssertTrue(ics.contains("TRANSP:TRANSPARENT"))
        XCTAssertTrue(ics.contains("SUMMARY:☽ Full Moon in Taurus\\, again"), "commas must be escaped")
        XCTAssertTrue(ics.contains("DESCRIPTION:Line one\\;\\nline two\\, with a comma"), "semicolons, newlines and commas must be escaped")
        XCTAssertFalse(ics.contains("\n\n"))
    }
}
