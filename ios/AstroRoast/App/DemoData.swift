import Foundation
import AstroKit

/// Sample content for screenshots and the "Try a sample" path. Launch with `-demo` to use it.
enum DemoData {
    static let birth = BirthData.make(name: "Mara", year: 1997, month: 6, day: 14, hour: 6, minute: 42, latitude: 53.80, longitude: -1.55, timeZoneID: "Europe/London", placeName: "Leeds", countryName: "United Kingdom")!

    static func state() -> AppState {
        var s = AppState()
        s.profile = birth; s.onboardingDone = true; s.gender = "woman"
        let sam = BirthData.make(name: "Sam", year: 1995, month: 11, day: 3, hour: 18, minute: 10, latitude: 51.5, longitude: -0.13, timeZoneID: "Europe/London", placeName: "London", countryName: "United Kingdom")!
        let mum = BirthData.make(name: "Mum", year: 1968, month: 2, day: 21, hour: 3, minute: 30, latitude: 53.48, longitude: -2.24, timeZoneID: "Europe/London", placeName: "Manchester", countryName: "United Kingdom")!
        var a = Person(birth: sam, role: "Partner"); a.overlaySource = true
        s.people = [a, Person(birth: mum, role: "Mum")]
        s.currentRoast = roast(for: birth, paid: false)
        s.roasts = [s.currentRoast!]
        return s
    }

    static func roast(for b: BirthData, paid: Bool) -> RoastPayload {
        let n = NatalChart(birth: b)
        let text = fullText(for: b.name)
        let paras = text.components(separatedBy: "\n\n")
        return RoastPayload(id: "demo", name: b.name, status: "ready", sunSign: n.sunSign, moonSign: n.moonSign, rising: n.risingSign ?? "Cancer",
                            teaser: paras.prefix(5).joined(separator: "\n\n") + " -", fullText: text,
                            callouts: ["Emotionally, you are a panic room with excellent soft furnishings.", "You don't hold grudges. You curate them."],
                            paid: paid, stagePct: 100, kind: "solo", isDemo: true)
    }

    static func fullText(for name: String) -> String {
        """
        Right. Sit down, \(name). Gemini Sun, Libra Moon, Cancer rising: that is a person who arrives like the host, charms the room like a diplomat, and then goes home to cry in a very well-decorated kitchen. The Cancer rising is the front door: warm, a bit protective, always asking if you've eaten. The Gemini Sun is the voice inside saying "but what if we also did a podcast". The Libra Moon is the one quietly holding a spreadsheet of everyone's feelings and refusing to publish it.

        Let's start with the Moon, because it's the one running the place. Libra Moon means peace is a physical need, like water or Wi-Fi. You will agree to a restaurant you hate to avoid eleven seconds of tension, and then you'll be quietly cross about it until Thursday. You say "honestly I don't mind" with the face of someone who very much minds. Emotionally, you are a panic room with excellent soft furnishings.

        Venus is in Cancer, which is lovely and also a problem. You love like a lighthouse: warm, constant, a bit lonely, and absolutely will not leave the rock. You keep the cinema ticket from the first date. You remember what they ordered. Mars is in Virgo, so your anger arrives as a list: dated, itemised, delivered calmly, and somehow worse than shouting. You don't hold grudges. You curate them.

        Mercury sits just behind the Sun in Gemini, which means your mind is fast, funny and never finishes a sentence it started in the shower. You can talk to anyone for forty minutes and not mention a single true thing about yourself. People leave feeling understood. You leave feeling like you've been to a very friendly deposition.

        Saturn in Aries is the part nobody sees: a hard little voice that says "you should have done more by now", usually at 2am, usually about nothing. Jupiter in Aquarius is the optimist upstairs insisting you can start again, any time, as anyone. Both are right. That's the whole problem.

        Here is the plot. Everyone thinks you're the easy one: easy to talk to, easy to please, easy to be around. You've spent years letting them. The chart's question is simple: what would you ask for if you weren't worried about the cost to the room? Whatever you just thought of, that's the homework. Say it out loud to someone patient before Thursday, and let them be mildly inconvenienced.

        You are, annoyingly, a lovely person. Please stop apologising for it.
        """
    }
}
