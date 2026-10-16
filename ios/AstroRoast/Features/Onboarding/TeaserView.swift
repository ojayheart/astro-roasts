import SwiftUI
import AstroKit

struct TeaserView: View {
    @Environment(AppModel.self) private var model
    @State private var showPay = false
    @State private var busy = false

    var body: some View {
        let r = model.roast
        let paras = r?.paragraphs ?? []
        ZStack(alignment: .bottom) {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Dossier(name: r?.name ?? model.profileName, sun: r?.sunSign ?? model.natal?.sunSign ?? "", moon: r?.moonSign ?? model.natal?.moonSign ?? "", rising: r?.rising ?? model.natal?.risingSign ?? "—")
                    RevealLines([("The dossier", .solid), ("on \(r?.name ?? model.profileName).", .ember)], size: 44)
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(Array(paras.prefix(2).enumerated()), id: \.offset) { _, p in
                            Text(Emphasis.attributed(p)).font(.system(size: 17)).lineSpacing(6).foregroundStyle(Palette.text.opacity(0.88))
                        }
                        if paras.count > 2 { Text(Emphasis.attributed(paras[2])).font(.system(size: 17)).lineSpacing(6).foregroundStyle(Palette.text.opacity(0.88)).blur(radius: 6).accessibilityHidden(true) }
                    }
                }.padding(.horizontal, 22).padding(.top, 14).padding(.bottom, r?.paid == true ? 120 : 330)
            }.scrollIndicators(.hidden)
            LinearGradient(colors: [.clear, Palette.ground], startPoint: .top, endPoint: .bottom).frame(height: 120).allowsHitTesting(false).padding(.bottom, r?.paid == true ? 0 : 180)
            if r?.paid == true {
                Button("Read the full roast") { model.completeOnboarding(); model.openRoast = true }.buttonStyle(.primary).padding(.horizontal, 20).padding(.bottom, 10)
            } else {
                PaywallCard(busy: busy, price: model.purchases.price(Purchases.ID.roast, fallback: "$4.99"),
                            unlock: { Task { busy = true; defer { busy = false }; await model.buyRoast() } },
                            skip: { model.completeOnboarding() })
            }
        }
    }
}

struct Dossier: View {
    let name: String, sun: String, moon: String, rising: String
    var body: some View {
        ZStack(alignment: .topLeading) {
            HStack(alignment: .top, spacing: 8) {
                cell("Subject", name); cell("Sun", "\(sun) \(Zodiac.glyphs[Zodiac.names.firstIndex(of: sun) ?? 0])"); cell("Moon", "\(moon) \(Zodiac.glyphs[Zodiac.names.firstIndex(of: moon) ?? 0])"); cell("Rising", "\(rising) \(Zodiac.glyphs[Zodiac.names.firstIndex(of: rising) ?? 0])")
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(Palette.ember).frame(width: 8, height: 8)
        }
        .overlay(Rectangle().stroke(Color(red: 42/255, green: 10/255, blue: 2/255)))
    }
    func cell(_ k: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 5) { MonoLabel(k, color: Palette.ember, size: 9, tracking: 1.6); Text(v.uppercased()).font(.mono(11)).tracking(0.8).foregroundStyle(Palette.text).lineLimit(1).minimumScaleFactor(0.7) }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PaywallCard: View {
    var busy: Bool; var price: String; var unlock: () -> Void; var skip: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) { Text("The full roast").font(.display(22, .bold)).textCase(.uppercase).tracking(-0.4); Spacer(); Text(price).font(.system(size: 26, weight: .bold)).foregroundStyle(Palette.text) }
            VStack(alignment: .leading, spacing: 7) {
                bullet("Every planet, house and aspect. Nine more sections."); bullet("Yours forever, on this phone and the web."); bullet("Unlocks your daily burns. Free, for life.")
            }
            Button { unlock() } label: { if busy { ProgressView().tint(Palette.ink) } else { Text("Unlock the damage") } }.buttonStyle(.primary).disabled(busy)
            HStack { Button("Continue free", action: skip).font(.system(size: 15)).foregroundStyle(Palette.text2); Spacer(); MonoLabel("One-time. No subscription.", size: 9, tracking: 1.4) }
        }
        .padding(20).background(Palette.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Palette.hairline)).padding(.horizontal, 12).padding(.bottom, 8)
    }
    func bullet(_ t: String) -> some View { HStack(alignment: .top, spacing: 10) { Text("*").foregroundStyle(Palette.ember); Text(t).font(.system(size: 14)).foregroundStyle(Palette.text2) } }
}

/// Server text marks emphasis with *italics* and CAPS; render the asterisk form as italics.
enum Emphasis {
    static func attributed(_ s: String) -> AttributedString {
        (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
    }
}
