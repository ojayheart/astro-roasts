import SwiftUI
import AstroKit

struct WarmupView: View {
    @Environment(AppModel.self) private var model
    @State private var level = NotificationPrefs.Level.big

    var body: some View {
        ZStack {
            ScreenBackground(glow: true)
            VStack(alignment: .leading, spacing: 20) {
                Spacer().frame(height: 28)
                VStack(alignment: .leading, spacing: 10) {
                    RevealLines([("We'll be", .solid), ("brief.", .ember)], size: 58)
                    Text("Two notifications a week, tops. Only when the sky would actually change your plans. Your daily line lives on your Lock Screen, no buzzing needed.").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3)
                }
                VStack(spacing: 8) {
                    NotifSample(title: "Mercury goes retrograde Thursday", body: "Back up your phone. Do not back up to your ex.", when: "Tue")
                    NotifSample(title: "Your Sunday roast is ready", body: "1 min 24. Contains a sandwich-related prophecy.", when: "Sun").opacity(0.7)
                }
                VStack(spacing: 0) {
                    ForEach(Array(NotificationPrefs.Level.allCases.enumerated()), id: \.offset) { i, l in
                        Button { withAnimation(.snappy) { level = l } } label: {
                            HStack(spacing: 14) {
                                ZStack { Circle().stroke(level == l ? Palette.moon : Palette.line, lineWidth: 1.5).frame(width: 20, height: 20); if level == l { Circle().fill(Palette.moon).frame(width: 10, height: 10) } }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(["Only the big ones", "Big ones + Coven clashes", "Never. Widget only."][i]).font(.system(size: 15)).foregroundStyle(Palette.text)
                                    Text(["Retrogrades, eclipse-sized moons, your major transits. About 2 a week.", "Also when your people's charts collide with yours.", "We'll sit quietly on your Lock Screen. Promise."][i]).font(.system(size: 12)).foregroundStyle(Palette.text3).multilineTextAlignment(.leading)
                                }
                                Spacer()
                            }.padding(.horizontal, 16).padding(.vertical, 12)
                        }
                        if i < 2 { Hairline() }
                    }
                }.background(Palette.surface, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Palette.hairline))
                Spacer()
                Button(level == .never ? "Continue" : "Allow notifications") {
                    Task {
                        model.state.notifications.level = level
                        if level != .never { _ = await Notifications.requestAuthorization() }
                        model.afterWarmup()
                    }
                }.buttonStyle(.primary)
                Button("Not now") { model.state.notifications.level = .never; model.afterWarmup() }.font(.system(size: 15)).foregroundStyle(Palette.text3).frame(maxWidth: .infinity).frame(height: 36)
            }.padding(.horizontal, 20).padding(.bottom, 8)
        }
    }
}

struct NotifSample: View {
    let title: String, message: String, when: String
    init(title: String, body: String, when: String) { self.title = title; self.message = body; self.when = when }
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 8).fill(Palette.ground).frame(width: 34, height: 34).overlay(RoundedRectangle(cornerRadius: 8).stroke(Palette.line)).overlay(Rectangle().fill(Palette.ember).frame(width: 8, height: 8))
            VStack(alignment: .leading, spacing: 2) {
                HStack { Text(title).font(.system(size: 13, weight: .semibold)); Spacer(); Text(when).font(.system(size: 11)).foregroundStyle(Palette.text3) }
                Text(message).font(.system(size: 13)).foregroundStyle(Palette.text2)
            }
        }.padding(12).background(Palette.surface2, in: RoundedRectangle(cornerRadius: 18, style: .continuous)).foregroundStyle(Palette.text)
    }
}
