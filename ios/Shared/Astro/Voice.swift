import Foundation

public struct DayReading: Identifiable, Hashable, Codable, Sendable {
    public var id: Date { day }
    public let day: Date                 // start of local day
    public let headline: String          // the one-liner
    public let body: String              // two sentences of detail
    public let driver: TransitHit?       // the transit behind the headline (nil on quiet days)
    public let moonSign: String
    public let phase: String
    public let vibe: String              // one word, e.g. "Smug"
    public let doList: [String]
    public let dontList: [String]
    public let neverList: [String]
    public let personal: Bool
    public let intensity: Double         // 0...1, used for the week strip
}

public enum Voice {
    // MARK: building blocks

    public static func domain(_ p: NatalPoint) -> String {
        switch p.kind {
        case .asc: return "your first impression"
        case .mc: return "your reputation"
        case .body:
            switch p.body! {
            case .sun: return "your ego"; case .moon: return "your feelings"; case .mercury: return "the way you talk"
            case .venus: return "your love life"; case .mars: return "your drive"; case .jupiter: return "your big plans"
            case .saturn: return "your boundaries"; case .uranus: return "your need for freedom"
            case .neptune: return "your delusions"; case .pluto: return "your control issues"; case .node: return "your destiny"
            }
        }
    }
    static func owned(_ p: NatalPoint) -> String { p.kind == .body ? "your \(p.body!.name)" : (p.kind == .asc ? "your Rising" : "your Midheaven") }

    private enum Tone { case hard, soft, fuse }
    private static func tone(_ a: AspectKind) -> Tone { a.isHard ? .hard : (a == .conjunction ? .fuse : .soft) }

    private static let templates: [Body: [Tone: [String]]] = [
        .moon: [
            .hard: ["Your mood is poking {N} with a stick.", "Today's feelings are loud, and they've found {N}."],
            .soft: ["Your mood is oddly helpful to {N}.", "You feel things, and {N} actually benefits."],
            .fuse: ["Your mood has moved in with {N}.", "Everything you feel is routed through {N} today."]],
        .sun: [
            .hard: ["The spotlight keeps swinging at {N}.", "You're under a lamp, and it's pointed at {N}."],
            .soft: ["The spotlight is kind to {N}.", "You look good and {N} gets the credit."],
            .fuse: ["The spotlight sits right on {N}.", "All eyes are on {N}. Dress accordingly."]],
        .mercury: [
            .hard: ["Your mouth is arguing with {N}.", "What you say and {N} are not on speaking terms."],
            .soft: ["Your words and {N} get along for once.", "Say the thing: {N} will back you up."],
            .fuse: ["Your thoughts are camping out in {N}.", "You can only think about {N}. Congratulations."]],
        .venus: [
            .hard: ["Your taste and {N} want different things.", "You want something you can't afford, and {N} agrees."],
            .soft: ["You're easy to like today, and {N} cashes in.", "Charm is cheap today. {N} gets it free."],
            .fuse: ["Venus is sitting on {N}. Charming, mildly dangerous.", "Everything is pleasant and {N} is the reason."]],
        .mars: [
            .hard: ["Your temper is picking a fight with {N}.", "Mars wants a fight and {N} is standing closest."],
            .soft: ["You have energy and, for once, it knows where {N} lives.", "Your drive and {N} are finally on the same team."],
            .fuse: ["Mars has moved in with {N}. Expect opinions.", "Your whole drive is pointed at {N}. Mind the furniture."]],
        .jupiter: [
            .hard: ["Your optimism overshoots {N} by a mile.", "Everything is possible and {N} is paying for it."],
            .soft: ["Luck leans toward {N} without being asked.", "Something good wanders into {N}."],
            .fuse: ["Jupiter has parked on {N}. Everything is too much, in a good way.", "{N} is getting the royal treatment."]],
        .saturn: [
            .hard: ["The landlord has notes about {N}.", "Reality is inspecting {N} with a clipboard."],
            .soft: ["Hard work pays {N} a small, honest wage.", "Boring discipline quietly fixes {N}."],
            .fuse: ["Saturn is standing on {N}. It will not move.", "{N} is going through an audit."]],
        .uranus: [
            .hard: ["Chaos is rewiring {N} without permission.", "{N} is about to receive a surprise."],
            .soft: ["A good surprise lands on {N}.", "{N} is allowed to change its mind."],
            .fuse: ["Uranus has plugged into {N}. Expect sparks.", "{N} is getting an unrequested upgrade."]],
        .neptune: [
            .hard: ["A fog is settling over {N}.", "{N} is being told a lovely lie."],
            .soft: ["{N} gets a soft, dreamy glow.", "Intuition is helping {N}, for free."],
            .fuse: ["Neptune is dissolving the edges of {N}.", "{N} is slightly out of focus. Nobody mind."]],
        .pluto: [
            .hard: ["Something in the basement is talking to {N}.", "{N} is being excavated."],
            .soft: ["A deep change quietly strengthens {N}.", "Pluto is on {N}'s side, which is rare."],
            .fuse: ["Pluto is renovating {N} from the foundation.", "{N} is being rebuilt. Wear a hard hat."]],
        .node: [.hard: ["Destiny is tapping {N} on the shoulder."], .soft: ["Destiny is tapping {N} on the shoulder."], .fuse: ["Destiny is tapping {N} on the shoulder."]]
    ]

    private static let advice: [Body: [Tone: [String]]] = [
        .moon: [.hard: ["Eat something. It is probably hunger."], .soft: ["Make a plan and let the day cooperate."], .fuse: ["Follow the feeling for one hour, then decide."]],
        .sun: [.hard: ["Don't make big announcements."], .soft: ["Ask for the thing you want."], .fuse: ["Be seen. Wear the good jumper."]],
        .mercury: [.hard: ["Draft it, delete it, sleep on it."], .soft: ["Have the conversation you've been rehearsing."], .fuse: ["Write it down before it leaves your head."]],
        .venus: [.hard: ["Don't buy anything and don't text anyone."], .soft: ["Make a date with someone who replies in full sentences."], .fuse: ["Treat yourself to something small."]],
        .mars: [.hard: ["Put the phone in another room around two."], .soft: ["Do the hard task before lunch."], .fuse: ["Burn it off with a long walk."]],
        .jupiter: [.hard: ["Say \"let me check\" at least once."], .soft: ["Ask for the raise."], .fuse: ["Say yes to one thing, not four."]],
        .saturn: [.hard: ["Do the boring thing. It is the whole assignment."], .soft: ["Small steady work beats a grand gesture."], .fuse: ["Define the boundary out loud."]],
        .uranus: [.hard: ["Leave a gap in your schedule. You'll need it."], .soft: ["Try the weird option."], .fuse: ["Change one habit on purpose."]],
        .neptune: [.hard: ["Check the facts before you fall in love with them."], .soft: ["Let yourself daydream for ten minutes."], .fuse: ["Don't sign anything blurry."]],
        .pluto: [.hard: ["Don't try to win. Just notice."], .soft: ["Let one old thing go."], .fuse: ["Look at the thing you've been avoiding."]],
        .node: [.hard: [""], .soft: [""], .fuse: [""]]
    ]

    private static let doDont: [Body: (hard: ([String], [String], [String]), soft: ([String], [String], [String]))] = [
        .moon: (hard: (["Snacks", "An early night"], ["Big feelings in writing", "Group chats"], ["Reply to the ex"]),
                soft: (["A long walk", "Calling your mum"], ["Overthinking it"], ["Skip dinner"])),
        .sun: (hard: (["Stay low", "Let someone else talk"], ["Make announcements"], ["Argue with your boss"]),
               soft: (["Ask for what you want", "Wear the good jumper"], ["Hide"], ["Say \"I'm fine\""])),
        .mercury: (hard: (["Drafts folder", "Voice notes you won't send"], ["Hit send", "\"Quick call?\""], ["Reply to the ex"]),
                   soft: (["Hard conversations", "Writing it down"], ["Rambling"], ["Reply all"])),
        .venus: (hard: (["Window shopping", "Long baths"], ["Online shopping", "Texting an ex"], ["Check their Instagram"]),
                 soft: (["Dinner with someone fun", "A small treat"], ["Settling"], ["Cancel on yourself"])),
        .mars: (hard: (["Exercise", "Finishing a task"], ["Replying while annoyed", "Driving angry"], ["Reply to the ex"]),
                soft: (["Hard tasks before lunch", "Starting the project"], ["Wasting it"], ["Pick a fight for fun"])),
        .jupiter: (hard: (["Reading the small print"], ["Agreeing to everything", "Big purchases"], ["Book a flight you can't afford"]),
                   soft: (["Asking for the raise", "Saying yes"], ["Playing small"], ["Skip the party"])),
        .saturn: (hard: (["Admin", "The boring thing"], ["Shortcuts"], ["Ignore the deadline"]),
                  soft: (["Steady work", "Routine"], ["Panic"], ["Quit today"])),
        .uranus: (hard: (["A free evening", "Backups"], ["Rigid plans"], ["Sign anything today"]),
                  soft: (["The odd option", "A new route home"], ["The usual"], ["Resist all change"])),
        .neptune: (hard: (["Fact-checking", "Sleep"], ["Signing things", "Lending money"], ["Fall for the story"]),
                   soft: (["Daydreaming", "Music"], ["Rushing"], ["Drink to feel better"])),
        .pluto: (hard: (["Noticing", "Therapy talk"], ["Power struggles"], ["Win an argument"]),
                 soft: (["Letting something go", "Deep clean"], ["Gripping tighter"], ["Revisit the drama"])),
        .node: (hard: ([""], [""], [""]), soft: ([""], [""], [""]))
    ]

    public static let moonMood: [String: (line: String, vibe: String, do_: [String], dont: [String], never: String)] = [
        "Aries": ("Moon in Aries: short fuse, fast forgiveness.", "Feral", ["Sprint at something"], ["Wait in a queue"], "Count to ten (you can't)"),
        "Taurus": ("Moon in Taurus: wants snacks and no surprises.", "Smug", ["A proper lunch", "Soft clothes"], ["Change plans"], "Move the sofa"),
        "Gemini": ("Moon in Gemini: twelve tabs open, none of them finished.", "Chatty", ["Text a friend", "Learn one fact"], ["Start a seventh project"], "Reply-all"),
        "Cancer": ("Moon in Cancer: nostalgic about last Tuesday.", "Soft", ["Cook something", "Call home"], ["Doomscroll old photos"], "Text the ex"),
        "Leo": ("Moon in Leo: would like to be noticed, please.", "Dramatic", ["Wear the bold thing", "Be generous"], ["Fish for compliments"], "Start a speech"),
        "Virgo": ("Moon in Virgo: reorganising things that were fine.", "Fussy", ["Tidy one drawer", "Make a list"], ["Fix other people"], "Alphabetise anything"),
        "Libra": ("Moon in Libra: cannot choose a restaurant.", "Charming", ["Pick one thing quickly", "Be nice"], ["Ask everyone's opinion"], "Say \"I don't mind\""),
        "Scorpio": ("Moon in Scorpio: knows what you did.", "Brooding", ["Keep a secret", "Dig into something"], ["Test people"], "Read their old messages"),
        "Sagittarius": ("Moon in Sagittarius: booking flights in its head.", "Restless", ["Go outside", "Say yes"], ["Promise anything"], "Book the flight"),
        "Capricorn": ("Moon in Capricorn: competent, slightly cold, quietly proud.", "Smug", ["Get ahead of the week", "Be useful"], ["Skip lunch"], "Cancel rest"),
        "Aquarius": ("Moon in Aquarius: loves humanity, avoids humans.", "Detached", ["Do your own thing", "Help from afar"], ["Overshare"], "Explain your feelings as a system"),
        "Pisces": ("Moon in Pisces: crying at an advert, then at the sequel.", "Foggy", ["Music", "A nap"], ["Big decisions"], "Make a promise while sad")
    ]

    public static func agent(_ b: Body) -> String {
        switch b {
        case .mars: "Your drive"; case .venus: "Your taste"; case .mercury: "Your mouth"; case .moon: "Your mood"; case .sun: "The spotlight"
        case .jupiter: "Your optimism"; case .saturn: "The landlord"; case .uranus: "The chaos"; case .neptune: "The fog"; case .pluto: "The basement"; case .node: "Destiny"
        }
    }
    static let quietLines = ["Quiet sky. Do the laundry.", "Nothing major. Suspicious, honestly.", "Low drama. Enjoy it while it lasts.", "A good day to answer one email."]

    static let cycle: [Body: String] = [
        .moon: "about every month", .sun: "once a year", .mercury: "a few times a year", .venus: "about once a year",
        .mars: "about every two years", .jupiter: "about every twelve years", .saturn: "about every 29 years",
        .uranus: "maybe once or twice a lifetime", .neptune: "about once a lifetime", .pluto: "about once a lifetime", .node: "every 18 years"
    ]
    static let lastTimeJokes = ["You know what you did.", "Think about it.", "Don't pretend you don't remember.", "Check your camera roll.", "We have receipts."]

    // MARK: determinism

    static func pick<T>(_ a: [T], seed: Int) -> T { a[abs(seed) % a.count] }
    public static func seed(_ day: Date, _ extra: Int = 0) -> Int {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .gmt
        let c = cal.dateComponents([.year, .month, .day], from: day)
        return (c.year ?? 0) &* 372 &+ (c.month ?? 0) &* 31 &+ (c.day ?? 0) &+ extra
    }

    // MARK: public API

    static let pluralDomains: Set<String> = ["your feelings", "your big plans", "your boundaries", "your delusions", "your control issues"]
    public static func sentence(for hit: TransitHit, seed s: Int) -> String {
        let t = tone(hit.aspect)
        let tpl = pick(templates[hit.transiting]?[t] ?? ["Something is happening to {N}."], seed: s)
        let d = domain(hit.natal)
        var out = tpl.replacingOccurrences(of: "{N}", with: d)
        if tpl.hasPrefix("{N}"), pluralDomains.contains(d) {
            let head = String(out.prefix(d.count)); var rest = String(out.dropFirst(d.count))
            for (a, b) in [(" is ", " are "), (" gets ", " get "), (" benefits", " benefit"), (" has ", " have "), (" sits", " sit"), (" its ", " their ")] { rest = rest.replacingOccurrences(of: a, with: b) }
            out = head + rest
        }
        return out.prefix(1).uppercased() + out.dropFirst()
    }

    /// Exact moment of a hit's aspect, searched over a window that suits the planet's speed.
    public static func exactMoment(of hit: TransitHit, near date: Date) -> Date? {
        let window: Double = switch hit.transiting {
        case .moon: 1.5; case .sun, .mercury, .venus, .mars, .node: 6; case .jupiter: 40; case .saturn: 90; default: 220 }
        return Sky.exactMoment(transiting: hit.transiting, aspect: hit.aspect, natalLongitude: hit.natalLongitude, near: date, windowDays: window)
    }
    public static func adviceLine(for hit: TransitHit, seed s: Int) -> String {
        pick(advice[hit.transiting]?[tone(hit.aspect)] ?? [""], seed: s)
    }
    public static func hitTitle(_ hit: TransitHit) -> String {
        "\(hit.transiting.glyph) \(hit.aspect.symbol) \(hit.natal.kind == .body ? hit.natal.body!.glyph : hit.natal.glyph)"
    }
    public static func hitName(_ hit: TransitHit) -> String {
        "\(hit.transiting.name) \(hit.aspect.symbol) your \(hit.natal.name)"
    }
    /// The day's roast: headline, detail, lists.
    public static func reading(natal: NatalChart, on date: Date, calendar: Calendar = .current, muted: Set<Body> = []) -> DayReading {
        let day = calendar.startOfDay(for: date)
        let noon = day.addingTimeInterval(12 * 3600)
        let sd = seed(day, Int(Zodiac.index(natal.lon(.sun))))
        let eph = Ephemeris.shared
        let moonSign = Zodiac.name(eph.longitude(.moon, date: noon))
        let phase = Sky.phase(noon).rawValue
        let mood = moonMood[moonSign]!

        // pick the most meaningful hit of the day (slow outranks Moon)
        let all = Sky.hits(natal: natal, on: noon, maxOrb: 1.6).filter { !muted.contains($0.transiting) }
        let strong = all.filter { $0.transiting != .moon && $0.weight >= 1.6 }
        // A slow transit stays on top for days. If it was already yesterday's headline, give another one a turn so the week doesn't repeat itself.
        var primary = strong.first
        if let p0 = primary, strong.count > 1 {
            let yNoon = calendar.date(byAdding: .day, value: -1, to: noon)!
            let yStrong = Sky.hits(natal: natal, on: yNoon, maxOrb: 1.6).filter { !muted.contains($0.transiting) && $0.transiting != .moon && $0.weight >= 1.6 }
            if yStrong.first?.id == p0.id { primary = strong.first(where: { $0.id != p0.id }) ?? p0 }
        }
        let main = primary ?? all.first(where: { $0.transiting == .moon && $0.weight >= 1.2 })

        if let hit = main {
            let t = tone(hit.aspect)
            let head = sentence(for: hit, seed: sd)
            let adv = adviceLine(for: hit, seed: sd)
            let dd = doDont[hit.transiting] ?? doDont[.moon]!
            let lists = (t == .hard || t == .fuse) ? dd.hard : dd.soft
            let detail = "\(hitName(hit)) is \(hit.orb < 0.3 ? "exact" : "within \(String(format: "%.1f", hit.orb))°") today. \(adv)"
            return DayReading(day: day, headline: head, body: detail, driver: hit, moonSign: moonSign, phase: phase, vibe: vibeFor(hit, mood: mood.vibe),
                              doList: Array(lists.0.prefix(2)), dontList: Array(lists.1.prefix(2)), neverList: [pick(lists.2, seed: sd)],
                              personal: true, intensity: min(1, 0.45 + hit.weight / 8))
        }
        let q = pick(quietLines, seed: sd)
        return DayReading(day: day, headline: q, body: "\(mood.line) \(phase) today.", driver: nil, moonSign: moonSign, phase: phase, vibe: mood.vibe,
                          doList: Array(mood.do_.prefix(2)), dontList: Array(mood.dont.prefix(2)), neverList: [mood.never], personal: false, intensity: 0.18)
    }

    static func vibeFor(_ hit: TransitHit, mood: String) -> String {
        switch (hit.transiting, tone(hit.aspect)) {
        case (.mars, .hard): return "Petty"
        case (.mars, _): return "Feral"
        case (.venus, .soft), (.venus, .fuse): return "Smitten"
        case (.venus, .hard): return "Greedy"
        case (.mercury, .hard): return "Snippy"
        case (.mercury, _): return "Chatty"
        case (.saturn, _): return "Dutiful"
        case (.jupiter, _): return "Smug"
        case (.uranus, _): return "Wired"
        case (.neptune, _): return "Foggy"
        case (.pluto, _): return "Intense"
        case (.sun, _): return "Seen"
        default: return mood
        }
    }

    /// When the same transit last happened (previous exact hit), for the "Why this?" screen.
    public static func previousExact(of hit: TransitHit, before date: Date) -> Date? {
        let cycleDays: Double = switch hit.transiting {
        case .moon: 32; case .sun: 370; case .mercury: 130; case .venus: 600; case .mars: 800
        case .jupiter: 4400; case .saturn: 11000; case .uranus: 30000; case .neptune: 60000; case .pluto: 90000; case .node: 7000
        }
        let jdNow = JD.from(date)
        let eph = Ephemeris.shared
        let targets: [Double] = hit.aspect == .conjunction || hit.aspect == .opposition ? [hit.aspect.angle] : [hit.aspect.angle, -hit.aspect.angle]
        let step = max(0.5, cycleDays / 4000)
        var best: Double?
        for t in targets {
            func f(_ jd: Double) -> Double { angDiff(eph.longitude(hit.transiting, jd: jd) - hit.natalLongitude, t) }
            var jd = jdNow - 6 * (hit.transiting == .moon ? 0.5 : 1)
            var fv = f(jd)
            while jd > jdNow - cycleDays {
                let n = jd - step; let nv = f(n)
                if (nv < 0) != (fv < 0), abs(nv - fv) < 90 {
                    let r = Sky.root(f, n, jd)
                    if r < jdNow - 3 { best = max(best ?? 0, r); break }
                }
                jd = n; fv = nv
            }
        }
        return best.map(JD.date)
    }
    public static func lastTimeJoke(seed s: Int) -> String { pick(lastTimeJokes, seed: s) }
    public static func cycleText(_ b: Body) -> String { cycle[b] ?? "" }

    // MARK: weekly roast (Sunday audio)
    public static func weekRoast(natal: NatalChart, startingAt date: Date, calendar: Calendar = .current) -> (title: String, paragraphs: [String], days: [DayReading]) {
        let start = calendar.startOfDay(for: date)
        let days = (0..<7).map { reading(natal: natal, on: calendar.date(byAdding: .day, value: $0, to: start)!, calendar: calendar) }
        let f = DateFormatter(); f.dateFormat = "EEEE"; f.calendar = calendar
        var paras: [String] = []
        paras.append("Here's your week, \(natal.birth.name). I'll be gentle. Mostly.")
        for d in days {
            let name = f.string(from: d.day)
            if let h = d.driver {
                paras.append("\(name). \(sentence(for: h, seed: seed(d.day, 3))) \(adviceLine(for: h, seed: seed(d.day, 3)))")
            } else {
                paras.append("\(name). \(moonMood[d.moonSign]?.line ?? "") Nothing from the planets, so it's on you.")
            }
        }
        let loud = days.max { $0.intensity < $1.intensity }!
        paras.append("Loudest day is \(f.string(from: loud.day)). Plan around it. That's the week. You're welcome.")
        return ("The week ahead, roasted", paras, days)
    }
}
