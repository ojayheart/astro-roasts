import Foundation

public struct HDActivation: Hashable, Codable, Sendable { public let body: String; public let gate: Int; public let line: Int; public let design: Bool }
public enum HDCenter: String, CaseIterable, Codable, Sendable { case head = "Head", ajna = "Ajna", throat = "Throat", g = "G", heart = "Heart", sacral = "Sacral", spleen = "Spleen", solar = "Solar Plexus", root = "Root"
    public var isMotor: Bool { [.heart, .sacral, .solar, .root].contains(self) }
}
public struct HDChart: Codable, Sendable {
    public let activations: [HDActivation]
    public let gates: Set<Int>
    public let channels: [[Int]]
    public let defined: Set<HDCenter>
    public let type: String
    public let authority: String
    public let profile: String
    public let strategy: String
    public let designDate: Date
}

public enum HumanDesign {
    // Gate wheel starting at 2°00' Aquarius (302°), 5.625° per gate.
    static let wheel = [41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60]
    public static let centerOf: [Int: HDCenter] = {
        var m: [Int: HDCenter] = [:]
        func add(_ c: HDCenter, _ g: [Int]) { g.forEach { m[$0] = c } }
        add(.head, [64,61,63]); add(.ajna, [47,24,4,17,43,11]); add(.throat, [62,23,56,35,12,45,33,8,31,20,16])
        add(.g, [1,13,25,46,2,15,10,7]); add(.heart, [21,40,26,51]); add(.sacral, [5,14,29,59,9,3,42,27,34])
        add(.spleen, [48,57,44,50,32,28,18]); add(.solar, [36,22,37,6,49,55,30]); add(.root, [53,60,52,19,39,41,58,38,54])
        return m
    }()
    public static let channelList: [[Int]] = [[1,8],[2,14],[3,60],[4,63],[5,15],[6,59],[7,31],[9,52],[10,20],[10,34],[10,57],[11,56],[12,22],[13,33],[16,48],[17,62],[18,58],[19,49],[20,34],[20,57],[21,45],[23,43],[24,61],[25,51],[26,44],[27,50],[28,38],[29,46],[30,41],[32,54],[34,57],[35,36],[37,40],[39,55],[42,53],[47,64]]

    public static func gateLine(_ lon: Double) -> (Int, Int) {
        let x = norm(lon - 302) / 5.625
        let idx = Int(x) % 64
        let line = Int((x - Double(Int(x))) * 6) + 1
        return (wheel[idx], min(6, line))
    }

    static func designJD(birthJD: Double) -> Double {
        let eph = Ephemeris.shared
        let target = norm(eph.longitude(.sun, jd: birthJD) - 88)
        return Sky.root({ angDiff(eph.longitude(.sun, jd: $0), target) }, birthJD - 100, birthJD - 75)
    }

    public static func chart(for birth: BirthData) -> HDChart {
        let eph = Ephemeris.shared
        let jdB = JD.from(birth.instant)
        let jdD = designJD(birthJD: jdB)
        var acts: [HDActivation] = []
        func add(_ jd: Double, design: Bool) {
            func put(_ name: String, _ lon: Double) { let (g, l) = gateLine(lon); acts.append(HDActivation(body: name, gate: g, line: l, design: design)) }
            let sun = eph.longitude(.sun, jd: jd), node = eph.longitude(.node, jd: jd)
            put("Sun", sun); put("Earth", sun + 180); put("Moon", eph.longitude(.moon, jd: jd))
            put("North Node", node); put("South Node", node + 180)
            for b in [Body.mercury, .venus, .mars, .jupiter, .saturn, .uranus, .neptune, .pluto] { put(b.name, eph.longitude(b, jd: jd)) }
        }
        add(jdB, design: false); add(jdD, design: true)
        let gates = Set(acts.map { $0.gate })
        let channels = channelList.filter { gates.contains($0[0]) && gates.contains($0[1]) }
        var defined = Set<HDCenter>()
        for c in channels { defined.insert(centerOf[c[0]]!); defined.insert(centerOf[c[1]]!) }

        // connectivity through defined channels
        var adj: [HDCenter: Set<HDCenter>] = [:]
        for c in channels { let a = centerOf[c[0]]!, b = centerOf[c[1]]!; adj[a, default: []].insert(b); adj[b, default: []].insert(a) }
        func reach(from s: HDCenter) -> Set<HDCenter> {
            var seen: Set<HDCenter> = [s], q = [s]
            while let n = q.popLast() { for m in adj[n] ?? [] where !seen.contains(m) { seen.insert(m); q.append(m) } }
            return seen
        }
        let throatReach = defined.contains(.throat) ? reach(from: .throat) : []
        let throatToMotor = throatReach.contains { $0.isMotor }
        let type: String
        if defined.isEmpty { type = "Reflector" }
        else if defined.contains(.sacral) { type = throatToMotor ? "Manifesting Generator" : "Generator" }
        else { type = throatToMotor ? "Manifestor" : "Projector" }

        let authority: String
        if defined.isEmpty { authority = "Lunar" }
        else if defined.contains(.solar) { authority = "Emotional" }
        else if defined.contains(.sacral) { authority = "Sacral" }
        else if defined.contains(.spleen) { authority = "Splenic" }
        else if defined.contains(.heart) { authority = "Ego" }
        else if defined.contains(.g) { authority = "Self-projected" }
        else { authority = "Mental (outer authority)" }

        let ps = acts.first { $0.body == "Sun" && !$0.design }!, ds = acts.first { $0.body == "Sun" && $0.design }!
        let strategy: String = switch type {
        case "Generator": "Wait to respond"; case "Manifesting Generator": "Wait to respond, then inform"
        case "Manifestor": "Inform before you act"; case "Projector": "Wait for the invitation"
        default: "Wait a lunar cycle"
        }
        return HDChart(activations: acts, gates: gates, channels: channels, defined: defined, type: type, authority: authority,
                       profile: "\(ps.line)/\(ds.line)", strategy: strategy, designDate: JD.date(jdD))
    }

    public static func typeRoast(_ type: String) -> String {
        switch type {
        case "Generator": return "You're a Generator: built to respond. You've been told your whole life to \"take initiative\" and it has never once worked."
        case "Manifesting Generator": return "You're a Manifesting Generator: fast, multi-tasking, and permanently skipping steps you then have to go back for."
        case "Manifestor": return "You're a Manifestor: built to start things, and mildly annoyed that everyone wants to be informed first."
        case "Projector": return "You're a Projector: built to guide people. You've been doing it unsolicited since about 2003."
        default: return "You're a Reflector: a mirror for your whole environment. You're fine. You're also whoever you stood next to last."
        }
    }
    public static func strategyRoast(_ type: String) -> String {
        switch type {
        case "Projector": return "Your strategy is \"wait for the invitation\", which you treat as a gentle suggestion."
        case "Generator": return "Your strategy is \"wait to respond\". Yes, even to the ex. Especially to the ex."
        case "Manifesting Generator": return "Your strategy is \"respond, then inform\". People hate surprises. You are the surprise."
        case "Manifestor": return "Your strategy is \"inform\". A text beats a fait accompli, who knew."
        default: return "Your strategy is to wait a whole lunar cycle before deciding anything. Revolutionary, for you."
        }
    }
    public static func authorityRoast(_ a: String) -> String {
        switch a {
        case "Emotional": return "Your authority is emotional, so any decision made at the peak of a mood is wrong. Sleep on it. Twice."
        case "Sacral": return "Your authority is your gut: it says uh-huh or uh-uh, never a paragraph. Stop asking it for a second opinion."
        case "Splenic": return "Your authority is splenic: one quiet hunch, in the moment, never repeated. Stop asking it for a second opinion."
        case "Ego": return "Your authority is the Heart: what you want, and what you can actually keep promising."
        case "Self-projected": return "Your authority is your own voice: you find out what you think by saying it out loud to someone patient."
        case "Lunar": return "Your authority is the Moon: take a month. Nobody has ever regretted waiting."
        default: return "Your authority is your sounding board: talk it through with someone who isn't invested."
        }
    }
    public static func centerRoast(_ c: HDCenter, defined: Bool) -> String {
        switch (c, defined) {
        case (.head, false): return "Open Head: other people's questions move in rent-free. Not your circus."
        case (.head, true): return "Defined Head: you have a pressure to figure things out. You will pass it on."
        case (.ajna, false): return "Open Ajna: you adopt whichever opinion was loudest. You'll call it yours."
        case (.ajna, true): return "Defined Ajna: you have a way of thinking and you will explain it forever."
        case (.throat, false): return "Open Throat: you talk when you're nervous and say nothing when you shouldn't."
        case (.throat, true): return "Defined Throat: you have a voice and it knows it."
        case (.g, false): return "Open G: you change with the room. Fine, until the room is a mistake."
        case (.g, true): return "Defined G: you know who you are and you'll mention it."
        case (.heart, false): return "Open Heart: you keep proving something to someone who stopped caring."
        case (.heart, true): return "Defined Heart: you keep your word, and expect everyone else to."
        case (.sacral, false): return "Open Sacral: you don't know when to stop. Please nap."
        case (.sacral, true): return "Defined Sacral: you have stamina and use it on the wrong things."
        case (.spleen, false): return "Open Spleen: you hang on to people and places long past their sell-by date."
        case (.spleen, true): return "Defined Spleen: your gut warns you once. Listen the first time."
        case (.solar, false): return "Open Solar Plexus: you absorb everyone's feelings and think they're yours."
        case (.solar, true): return "Defined Solar Plexus: your mood has weather. Don't text during storms."
        case (.root, false): return "Open Root: other people's urgency lives in you. Nothing is actually urgent."
        case (.root, true): return "Defined Root: you handle pressure in a very annoyingly calm way."
        }
    }
}
