import Foundation

public struct DraftResult: Sendable {
    public enum Verdict: String, Sendable { case send = "Send", rewrite = "Rewrite", bin = "Bin it" }
    public let verdict: Verdict
    public let reasons: [String]
    public let tags: [String]
    public let rewrite: String
    public let betterDay: Date?
    public let betterDayReason: String?
}

/// Rule-based message check: tone heuristics + today's Mars/Mercury weather. Runs entirely on device.
public enum DraftCheck {
    static let filler = ["no pressure", "honestly", "just saying", "like really", "really really", "to be honest", "i just wanted to", "sorry to bug you", "no worries if not"]
    static let aggressive = ["whatever", "fine.", "as i said", "per my last", "k.", "you always", "you never", "obviously"]

    public static func analyze(_ raw: String, natal: NatalChart?, recipient: Person?, now: Date = Date(), calendar: Calendar = .current) -> DraftResult {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = text.lowercased()
        var score = 0.0; var reasons: [String] = []; var tags: [String] = []

        let q = text.filter { $0 == "?" }.count, ex = text.filter { $0 == "!" }.count
        if q >= 2 { score += 1.3; reasons.append("Two question marks and \"no pressure\" is pressure in a trench coat.".replacingOccurrences(of: "Two question marks and \"no pressure\" is pressure in a trench coat.", with: lower.contains("no pressure") ? "Two question marks and \"no pressure\" is pressure in a trench coat." : "Several question marks is a lot of asking in one go.")) }
        if lower.contains("no pressure") { score += 1.0; if q < 2 { reasons.append("\"No pressure\" is, statistically, pressure.") } }
        if ex >= 3 { score += 0.8; reasons.append("That many exclamation marks reads as shouting with a smile.") }
        let caps = text.split(separator: " ").filter { $0.count > 2 && $0 == $0.uppercased() && $0.contains(where: \.isLetter) }
        if caps.count >= 2 { score += 1.2; reasons.append("Capital letters: the text equivalent of a raised voice.") }
        if lower.contains("we need to talk") { score += 1.4; reasons.append("\"We need to talk\" is how every horror film starts.") }
        for a in aggressive where lower.contains(a) { score += 1.0; reasons.append("\"\(a.trimmingCharacters(in: .punctuationCharacters))\" lands colder than you mean it."); break }
        let words = text.split(whereSeparator: \.isWhitespace).count
        if words > 70 { score += 1.2; reasons.append("That's an essay. They'll read the first line and the last.") }
        else if words > 45 { score += 0.6; reasons.append("Long for a text. Trim a sentence.") }
        let hour = calendar.component(.hour, from: now)
        if hour >= 23 || hour < 5 { score += 1.4; reasons.append("It's \(hour % 12 == 0 ? 12 : hour % 12)\(hour < 12 ? "am" : "pm"). Nothing sent now improves by morning.") ; tags.append("LATE") }
        if let r = recipient, r.role.lowercased() == "ex" { score += 0.8; reasons.append("It's an ex. The bar is lower and the stakes are higher."); tags.append("EX") }
        if ["miss you", "still love", "why did you", "i can't stop"].contains(where: lower.contains) { score += 1.2; reasons.append("This is a feeling, not a message. Write it, don't send it.") }

        var betterDay: Date?; var betterReason: String?
        if let natal {
            let today = calendar.startOfDay(for: now)
            let noon = today.addingTimeInterval(12 * 3600)
            let hit = Sky.hits(natal: natal, on: noon, maxOrb: 1.8, bodies: [.mars, .mercury]).first(where: { $0.aspect.isHard })
            if let hit { score += 0.9; tags.append("\(hit.transiting.glyph)\(hit.aspect.symbol)"); reasons.append("\(Voice.hitName(hit)) until \(untilText(natal: natal, hit: hit, from: today, calendar: calendar)): everything you type arrives about 30% more intense than you meant it.") }
            if score >= 1.5 {
                for d in 1...6 {
                    let day = calendar.date(byAdding: .day, value: d, to: today)!
                    let n = day.addingTimeInterval(12 * 3600)
                    let bad = Sky.hits(natal: natal, on: n, maxOrb: 1.8, bodies: [.mars, .mercury]).first(where: { $0.aspect.isHard })
                    if bad == nil { betterDay = day; betterReason = hit == nil ? "Calmer sky for you, and no deadline on a feeling." : "\(hit!.transiting.name) stops leaning on your \(hit!.natal.name) by then."; break }
                }
            }
        }
        if let s = recipient?.chart.sunSign, score >= 1.5 { reasons.append("\(recipient!.name)'s \(s) Sun prefers a plan to a cliffhanger.") }

        let verdict: DraftResult.Verdict = score >= 4.2 ? .bin : (score >= 1.5 ? .rewrite : .send)
        return DraftResult(verdict: verdict, reasons: Array(reasons.prefix(4)), tags: tags, rewrite: rewrite(text), betterDay: betterDay, betterDayReason: betterReason)
    }

    static func untilText(natal: NatalChart, hit: TransitHit, from day: Date, calendar: Calendar) -> String {
        for d in 1...10 {
            let n = calendar.date(byAdding: .day, value: d, to: day)!.addingTimeInterval(12 * 3600)
            if !Sky.hits(natal: natal, on: n, maxOrb: 1.8, bodies: [hit.transiting]).contains(where: { $0.natal == hit.natal && $0.aspect == hit.aspect }) { return calendar.date(byAdding: .day, value: d, to: day)!.formatted(.dateTime.weekday(.wide)) }
        }
        return "next week"
    }

    /// Deterministic clean-up: strips filler, collapses punctuation, keeps it to two sentences, replaces the cliffhanger.
    public static func rewrite(_ text: String) -> String {
        var t = text.replacingOccurrences(of: "\n", with: " ")
        for f in filler { t = t.replacingOccurrences(of: f, with: "", options: .caseInsensitive) }
        t = t.replacingOccurrences(of: "we need to talk properly", with: "can we find time to talk this week", options: .caseInsensitive)
        t = t.replacingOccurrences(of: "we need to talk", with: "can we find time to talk this week", options: .caseInsensitive)
        while t.contains("??") { t = t.replacingOccurrences(of: "??", with: "?") }
        while t.contains("!!") { t = t.replacingOccurrences(of: "!!", with: "!") }
        t = t.replacingOccurrences(of: " ,", with: ",").replacingOccurrences(of: "  ", with: " ").replacingOccurrences(of: " x", with: "")
        let parts = t.components(separatedBy: CharacterSet(charactersIn: ".!?")).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        var kept: [String] = parts.count > 2 ? [parts[0], parts[parts.count - 1]] : parts
        kept = kept.map { $0.prefix(1).uppercased() + $0.dropFirst() }
        var out = kept.joined(separator: ". ")
        if !out.hasSuffix("?") && !out.hasSuffix(".") && !out.hasSuffix("!") { out += text.contains("?") ? "?" : "." }
        if text.lowercased().contains("talk") && !out.lowercased().contains("friday") { out += " Free Friday?" }
        return out
    }
}
