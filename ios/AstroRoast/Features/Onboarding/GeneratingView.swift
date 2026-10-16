import SwiftUI
import AstroKit

struct GeneratingView: View {
    @Environment(AppModel.self) private var model
    @State private var tick = Timer.publish(every: 5.5, on: .main, in: .common).autoconnect()
    @State private var shownPct = 0.0

    var body: some View {
        let pct = Double(AppModel.pct(model.roast ?? RoastPayload(id: "", name: "", status: "generating"), since: model.generationStart))
        ZStack {
            ScreenBackground(glow: true)
            VStack(spacing: 22) {
                Spacer().frame(height: 18)
                HStack { MonoLabel("File · \(model.profileName)"); Spacer(); if model.demo { MonoLabel("Sample", color: Palette.emberSoft) } }.padding(.horizontal, 24)
                if let chart = model.natal { ChartWheel(chart: chart, progress: shownPct / 100).padding(.horizontal, 28) }
                VStack(spacing: 8) {
                    Text("\(Int(shownPct))%").font(.display(60, .semibold)).tracking(-2).foregroundStyle(Palette.text).monospacedDigit().contentTransition(.numericText())
                    Text(AppModel.statuses[model.statusIndex]).font(.system(size: 17)).multilineTextAlignment(.center).foregroundStyle(Palette.text).frame(maxWidth: 300, minHeight: 48)
                        .id(model.statusIndex).transition(.asymmetric(insertion: .opacity.animation(.easeIn(duration: 0.5)), removal: .identity))
                }
                if let c = model.natal {
                    VStack(spacing: 0) {
                        row("Sun", "\(Zodiac.label(c.lon(.sun)))", visible: shownPct > 25)
                        row("Moon", "\(Zodiac.label(c.lon(.moon)))", visible: shownPct > 45)
                        row("Rising", c.ascendant.map { Zodiac.label($0) } ?? "Unknown, we'll guess", visible: shownPct > 60)
                    }.padding(.horizontal, 24)
                }
                Spacer(minLength: 0)
                if let e = model.generationError {
                    VStack(spacing: 10) {
                        Text(e).font(.system(size: 14)).foregroundStyle(Palette.emberSoft).multilineTextAlignment(.center)
                        Button("Try again") { model.startGeneration() }.buttonStyle(.primary)
                    }.padding(.horizontal, 20)
                } else {
                    HStack(spacing: 12) {
                        Image(systemName: "bell").foregroundStyle(Palette.text)
                        Text("Leave if you like. It keeps cooking on your Lock Screen and you'll get a buzz when it's ready.").font(.system(size: 14)).foregroundStyle(Palette.text2)
                    }.padding(14).background(Palette.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.hairline)).padding(.horizontal, 20)
                }
            }.padding(.bottom, 14)
        }
        .onReceive(tick) { _ in withAnimation { model.cycleStatus() } }
        .task(id: pct) { withAnimation(.easeOut(duration: 1.2)) { shownPct = max(shownPct, pct) } }
        .onAppear { shownPct = max(shownPct, pct) }
    }
    func row(_ k: String, _ v: String, visible: Bool) -> some View {
        HStack { MonoLabel(k, size: 12, tracking: 1); Spacer(); Text(v.uppercased()).font(.mono(12)).tracking(1).foregroundStyle(Palette.text) }
            .padding(.vertical, 11).overlay(alignment: .top) { Hairline() }.opacity(visible ? 1 : 0).offset(y: visible ? 0 : 6).animation(.easeOut(duration: 0.6), value: visible)
    }
}
