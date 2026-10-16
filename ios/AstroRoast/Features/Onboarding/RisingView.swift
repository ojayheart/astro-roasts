import SwiftUI
import AstroKit

struct RisingView: View {
    @Environment(AppModel.self) private var model
    @State private var pick = 0
    static let roasts: [String: String] = [
        "Aries": "You walk in like you're about to kick the door off its hinges, then ask where the loo is.",
        "Taurus": "You look calm. You are calculating how far the nearest snack is.",
        "Gemini": "People think you're friendly. You're taking notes for a podcast nobody asked for.",
        "Cancer": "You look like the host. You are already worried about whether everyone's eaten.",
        "Leo": "You enter rooms like they were waiting. They were. Now please stop doing the hair thing.",
        "Virgo": "You walk into a room already editing it. People think you're calm. You're quietly proofreading.",
        "Libra": "You're lovely to everyone, and it takes you forty minutes to pick a table. Conflict gives you hives.",
        "Scorpio": "You say little and your eyes do the rest. People confess things to you in queues.",
        "Sagittarius": "You arrive late, laughing, with a story that started in another country.",
        "Capricorn": "You look 40 at 19, and you'll look 40 at 60. Respectable. Slightly tired.",
        "Aquarius": "You seem friendly and wholly detached. Everyone is fond of you and no one has your address.",
        "Pisces": "You look like you're in a film nobody else is in. Lovely, but who's driving?"
    ]
    var body: some View {
        let c = model.natal?.risingCandidates()
        ZStack {
            ScreenBackground(glow: true)
            VStack(alignment: .leading, spacing: 18) {
                TopBar(title: "No birth time · no problem", back: { withAnimation(.snappy) { model.route = .birth } })
                RevealLines([("Two options.", .solid), ("Which one's", .solid), ("you?", .ember)], size: 40).padding(.top, 12)
                Text("Your Sun and Moon are certain. Your rising sign depends on the time, so here are both.").font(.system(size: 14)).foregroundStyle(Palette.text2).lineSpacing(3)
                if let c {
                    ForEach(0..<2, id: \.self) { i in
                        let sign = i == 0 ? c.early : c.late
                        Button { withAnimation(.snappy) { pick = i } } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { Text("\(sign) rising").font(.display(19, .bold)); Spacer(); MonoLabel(i == 0 ? "Before ~\(Self.t(c.flipLocalMinutes))" : "After ~\(Self.t(c.flipLocalMinutes))", size: 10, tracking: 1.4) }
                                Text(Self.roasts[sign] ?? "").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3).multilineTextAlignment(.leading)
                                Text(pick == i ? "That's the one. Locked in." : "Tap if this sounds more like you").font(.system(size: 13)).foregroundStyle(pick == i ? Palette.emberSoft : Palette.text3)
                            }
                            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                            .background(pick == i ? Palette.surface2 : Palette.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(pick == i ? Palette.moon : Palette.hairline, lineWidth: pick == i ? 1.5 : 1))
                        }.foregroundStyle(Palette.text)
                    }
                }
                Spacer()
                Button("Continue as \(c.map { pick == 0 ? $0.early : $0.late } ?? "…") rising") { model.chooseRising(early: pick == 0) }.buttonStyle(.primary)
                Text("Not proof, just a strong hunch with jokes. Find your real time later and we'll quietly update everything.").font(.system(size: 12)).foregroundStyle(Palette.text3).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            }.padding(.horizontal, 20).padding(.bottom, 12)
        }
        .onAppear { if model.natal?.risingCandidates() == nil { model.chooseRising(early: true) } }
    }
    static func t(_ minutes: Int) -> String { String(format: "%d:%02d", minutes / 60, minutes % 60) }
}
