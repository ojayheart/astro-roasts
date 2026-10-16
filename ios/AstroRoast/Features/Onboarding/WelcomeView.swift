import SwiftUI
import AstroKit

/// Mirrors the website hero: the hand-drawn wheel turning behind a centred headline, lines sliding up in turn, then the sub-line fading in.
struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    @State private var showSignIn = false
    @State private var lines = false
    @State private var fade = false
    @State private var unit: CGFloat = 0   // natural width of the widest headline line at 100pt, measured once

    var body: some View {
        GeometryReader { g in
            let w = g.size.width
            let size = unit > 0 ? min((w - 48) / unit * 100, 64) : 30
            let lineH = size * 0.86
            ZStack {
                Palette.ground.ignoresSafeArea()
                AstroWheelView().frame(width: w * 1.5, height: w * 1.5).position(x: w / 2, y: g.size.height / 2)

                // top bar
                HStack(spacing: 8) { Rectangle().fill(Palette.ember).frame(width: 8, height: 8); MonoLabel("Astro Roast") }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24).position(x: w / 2, y: 28)

                // headline, locked to the vertical centre
                VStack(spacing: 0) {
                    line("Stop blaming", .solid, size: size, lineH: lineH, i: 0)
                    line("your moon", .outline, size: size, lineH: lineH, i: 1)
                    line("sign.", .ember, size: size, lineH: lineH, i: 2)
                }
                .position(x: w / 2, y: g.size.height * 0.46)
                .accessibilityElement(children: .combine).accessibilityLabel("Stop blaming your moon sign.")

                Text("Astrology and Human Design, read back to you honestly, with jokes. Deeper insight into yourself, lighter mood. Five minutes.")
                    .font(.system(size: 15, weight: .light)).foregroundStyle(Palette.text2).multilineTextAlignment(.center).lineSpacing(4)
                    .frame(maxWidth: 320).opacity(fade ? 1 : 0)
                    .position(x: w / 2, y: g.size.height * 0.46 + lineH * 1.5 + 64)

                VStack(spacing: 10) {
                    Button("Let's begin") { withAnimation(.snappy) { model.route = .birth } }.buttonStyle(.primary)
                    Button("I already have roasts") { showSignIn = true }.font(.system(size: 15)).foregroundStyle(Palette.text2).frame(height: 40)
                }
                .padding(.horizontal, 24).opacity(fade ? 1 : 0)
                .frame(maxHeight: .infinity, alignment: .bottom).padding(.bottom, 8)

                // hidden measurer for the fit-to-width headline size
                Text("STOP BLAMING").font(.display(100)).tracking(-4).fixedSize().hidden()
                    .background(GeometryReader { p in Color.clear.onAppear { unit = p.size.width } })
                    .frame(width: 0, height: 0)
            }
        }
        .onAppear {
            withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 1.2).delay(0.4)) { lines = true }
            withAnimation(.easeOut(duration: 1).delay(1.4)) { fade = true }
        }
        .sheet(isPresented: $showSignIn) { SignInSheet().presentationDetents([.large]).presentationBackground(Palette.surface) }
    }

    @ViewBuilder func line(_ t: String, _ style: RevealLines.Style, size: CGFloat, lineH: CGFloat, i: Int) -> some View {
        Group {
            switch style {
            case .outline: OutlinedText(t.uppercased(), font: .display(size), tracking: -size * 0.04)
            case .ember: Text(t.uppercased()).font(.display(size)).tracking(-size * 0.04).foregroundStyle(Palette.ember)
            case .solid: Text(t.uppercased()).font(.display(size)).tracking(-size * 0.04).foregroundStyle(Palette.text)
            }
        }
        .lineLimit(1).fixedSize()
        .frame(height: lineH).offset(y: lines ? 0 : lineH * 1.1).clipped()
        .animation(.timingCurve(0.22, 1, 0.36, 1, duration: 1.2).delay(0.4 + Double(i) * 0.2), value: lines)
    }
}
