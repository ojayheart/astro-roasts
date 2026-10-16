import SwiftUI
import AstroKit

struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    @State private var showAdopt = false

    var body: some View {
        ZStack {
            ScreenBackground(glow: true)
            WheelArt(opacity: 0.14).scaleEffect(1.55).offset(y: 120)
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HStack(spacing: 8) { Rectangle().fill(Palette.ember).frame(width: 8, height: 8); MonoLabel("Astro Roast") }
                    Spacer()
                    MonoLabel("Est. by Saturn")
                }
                Spacer()
                RevealLines([("Stop", .solid), ("blaming", .solid), ("your moon", .outline), ("sign.", .ember)], size: 66)
                Text("A radically honest, surgically precise teardown of your exact natal chart. We see your patterns. We know your delusions.")
                    .font(.system(size: 16, weight: .light)).foregroundStyle(Palette.text2).lineSpacing(4).frame(maxWidth: 310, alignment: .leading).padding(.top, 26)
                Spacer()
                VStack(spacing: 12) {
                    Button("Face it") { withAnimation(.snappy) { model.route = .birth } }.buttonStyle(.primary)
                    Button("I already have a roast") { showAdopt = true }.buttonStyle(.ghost)
                    MonoLabel("Entertainment only. Saturn takes no questions.", size: 10, tracking: 1.8).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 6)
                }
            }
            .padding(.horizontal, 24).padding(.top, 16).padding(.bottom, 12)
        }
        .sheet(isPresented: $showAdopt) { AdoptRoastSheet().presentationDetents([.medium]).presentationBackground(Palette.surface) }
    }
}

struct AdoptRoastSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var error: String?
    @State private var loading = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Bring your roast over").font(.display(26, .bold)).tracking(-0.5)
            Text("Bought it on astroroast.com? Paste the link from your email and it lives here too.").font(.system(size: 15)).foregroundStyle(Palette.text2)
            TextField("astroroast.com/roast/…", text: $text, axis: .vertical).lineLimit(1...3)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(14).background(Palette.surface2, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line))
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
            Button { Task { await go() } } label: { if loading { ProgressView().tint(Palette.ink) } else { Text("Find my roast") } }.buttonStyle(.primary).disabled(text.isEmpty || loading)
            Spacer(minLength: 0)
        }
        .padding(24).foregroundStyle(Palette.text)
    }
    func go() async {
        loading = true; error = nil; defer { loading = false }
        do {
            try await model.adopt(text: text)
            if let r = model.roast, model.state.profile == nil {
                model.draft.name = r.name; dismiss()
                withAnimation(.snappy) { model.route = .birth }       // still need birth details for Today/Month
            } else { dismiss(); model.completeOnboarding() }
        } catch { self.error = (error as? LocalizedError)?.errorDescription ?? "That didn't work." }
    }
}
