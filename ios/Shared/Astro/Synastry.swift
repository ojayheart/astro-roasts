import Foundation

public struct SynastryResult: Sendable {
    public let compat: Int          // 0...100
    public let chaos: Int           // 0...100
    public let categories: [(title: String, line: String, score: Double)]
    public let fight: String        // who starts the fight
    public let apologises: String
    public let dishes: String
}

public enum Synastry {
    static let set: [Body] = [.sun, .moon, .mercury, .venus, .mars]
    static func pairScore(_ a: NatalChart, _ b: NatalChart, _ pairs: [(Body, Body)]) -> Double {
        var total = 0.0
        for (x, y) in pairs {
            let limit: Double = (x == .sun || x == .moon || y == .sun || y == .moon) ? 8 : 6
            if let (k, orb) = AspectKind.between(a.lon(x), b.lon(y), orb: limit) {
                let w = 1 - orb / limit
                switch k { case .trine, .sextile: total += 1.0 * w; case .conjunction: total += 0.55 * w; case .square: total -= 1.0 * w; case .opposition: total -= 0.8 * w }
            }
        }
        return total
    }
    static func heat(_ c: NatalChart) -> Double {
        var h = 0.0
        for (b, w) in [(Body.mars, 3.0), (.sun, 1.5), (.moon, 1.0), (.mercury, 0.6)] { if [0, 4, 8, 7].contains(Zodiac.index(c.lon(b))) { h += w } }
        return h
    }
    static func soothe(_ c: NatalChart) -> Double {
        var h = 0.0
        for (b, w) in [(Body.venus, 2.5), (.moon, 2.0), (.sun, 1.0)] { if [6, 11, 3, 1].contains(Zodiac.index(c.lon(b))) { h += w } }
        return h
    }
    static func tidy(_ c: NatalChart) -> Double {
        var h = 0.0
        for b in [Body.sun, .moon, .mercury, .venus, .mars] { if [5, 9, 1].contains(Zodiac.index(c.lon(b))) { h += 1 } }
        return h
    }
    static func line(_ s: Double, _ bad: String, _ mid: String, _ good: String) -> String { s <= -0.6 ? bad : (s >= 0.6 ? good : mid) }

    public static func compute(_ a: NatalChart, _ b: NatalChart, aName: String, bName: String) -> SynastryResult {
        let love = pairScore(a, b, [(.venus, .mars), (.mars, .venus), (.venus, .venus), (.sun, .moon), (.moon, .sun), (.moon, .venus), (.venus, .moon)])
        let ident = pairScore(a, b, [(.sun, .sun), (.sun, .mars), (.mars, .sun)])
        let mood = pairScore(a, b, [(.moon, .moon), (.moon, .mars), (.mars, .moon)])
        let talk = pairScore(a, b, [(.mercury, .mercury), (.mercury, .sun), (.sun, .mercury), (.mercury, .moon), (.moon, .mercury)])
        let fight = pairScore(a, b, [(.mars, .mars), (.mars, .mercury), (.mercury, .mars), (.sun, .mars)])
        let cats: [(String, String, Double)] = [
            ("Love & pleasure", line(love, "Sparks, yes. Also smoke alarms.", "Warm, workable, a bit of a slow burn.", "Annoyingly good. Please get a room."), love),
            ("Basic identities", line(ident, "You each think the other is a bit much.", "Different people, same flat.", "You're the same species. Rare."), ident),
            ("Moods & emotions", line(mood, "One of you is weather. The other is a house.", "You'll mostly be fine by Thursday.", "You calm each other down. Sickening."), mood),
            ("Talking", line(talk, "You speak different languages, both English.", "Communication: functional, with subtitles.", "You finish each other's sentences. Both of you hate it."), talk),
            ("Fighting", line(fight, "Arguments with a lot of footnotes.", "A civil row every six weeks. Tidy.", "You fight like it's a sport and shake hands after."), -fight)
        ]
        let hardSum = max(0, -(love + ident + mood + talk) * 0.5 + max(0, -fight))
        let softSum = max(0, love + ident + mood + talk)
        let compat = Int(max(12, min(94, 48 + 9 * softSum - 7 * hardSum + (love * 3))))
        let chaos = Int(max(8, min(97, 26 + 15 * hardSum + 6 * abs(fight))))
        let ha = heat(a), hb = heat(b)
        let sa = soothe(a), sb = soothe(b)
        let ta = tidy(a), tb = tidy(b)
        return SynastryResult(compat: compat, chaos: chaos, categories: cats,
                              fight: ha == hb ? "Both of you. Obviously." : (ha > hb ? aName : bName),
                              apologises: sa == sb ? "Neither. It's a cold war." : (sa > sb ? aName : bName),
                              dishes: ta == tb ? "Nobody. The sink knows." : (ta > tb ? aName : bName))
    }
}
