import SwiftUI
import StoreKit
import AstroKit

struct PlansView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var yearly = true
    @State private var busy = false

    struct Row: Identifiable { let id = UUID(); let name: String; let free: String; let plus: String }
    let rows: [Row] = [
        .init(name: "Daily burn from your chart", free: "✓", plus: "✓"), .init(name: "Moon dial + widgets", free: "✓", plus: "✓"),
        .init(name: "Your full roast", free: "$4.99", plus: "✓"), .init(name: "Your transits on the dial", free: "–", plus: "✓"),
        .init(name: "Calendar sync", free: "Moons", plus: "✓"), .init(name: "Human Design roast", free: "Type", plus: "✓"),
        .init(name: "Sunday audio roast", free: "–", plus: "✓"), .init(name: "Situationships + Draft check", free: "–", plus: "✓"),
        .init(name: "Coven overlays", free: "1", plus: "∞"), .init(name: "Roast someone not on the app", free: "$2.99", plus: "Free")
    ]

    var body: some View {
        let sub = model.purchases.products[yearly ? Purchases.ID.plusYearly : Purchases.ID.plusMonthly]
        ZStack {
            ScreenBackground(glow: true)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack { Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Close"); Spacer(); Button("Restore") { Task { await model.purchases.restore() } }.font(.system(size: 14)).foregroundStyle(Palette.text2) }
                    HStack(alignment: .firstTextBaseline, spacing: 0) { Text("ROAST").font(.display(54, .heavy)).tracking(-2); Text("+").font(.display(54, .heavy)).foregroundStyle(Palette.ember) }.foregroundStyle(Palette.text)
                    Text("The free app tells you who you are. Roast+ tells you what's coming, who to avoid and what to say.").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3)
                    VStack(spacing: 0) {
                        HStack { Spacer(); MonoLabel("Free", size: 10, tracking: 1.6).frame(width: 60); MonoLabel("Roast+", color: Palette.ember, size: 10, tracking: 1.6).frame(width: 64) }.padding(.bottom, 6)
                        ForEach(rows) { r in
                            HStack { Text(r.name).font(.system(size: 14)).foregroundStyle(Palette.text); Spacer(); Text(r.free).font(.system(size: 13)).foregroundStyle(Palette.text3).frame(width: 60); Text(r.plus).font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.text).frame(width: 64) }
                                .padding(.vertical, 11).overlay(alignment: .top) { Hairline() }
                        }
                    }.overlay(alignment: .bottom) { Hairline() }
                    HStack(spacing: 10) {
                        planCard(title: "Yearly · save 44%", price: model.purchases.price(Purchases.ID.plusYearly, fallback: "$39.99"), sub: "7 days free, then billed yearly", on: yearly) { yearly = true }
                        planCard(title: "Monthly", price: model.purchases.price(Purchases.ID.plusMonthly, fallback: "$5.99"), sub: "Commitment issues", on: !yearly) { yearly = false }
                    }
                    Button { Task { busy = true; defer { busy = false }; if await model.purchases.buy(yearly ? Purchases.ID.plusYearly : Purchases.ID.plusMonthly, roastID: nil) != nil { dismiss() } } } label: { if busy { ProgressView().tint(Palette.ink) } else { Text(yearly ? "Try 7 days free" : "Get Roast+") } }.buttonStyle(.primary).disabled(busy || sub == nil)
                    if let e = model.purchases.lastError { Text(e).font(.system(size: 12)).foregroundStyle(Palette.emberSoft) }
                    Text("Cancel any time in Settings. We'll remind you before the trial ends. Saturn would never.").font(.system(size: 12)).foregroundStyle(Palette.text3).multilineTextAlignment(.center).frame(maxWidth: .infinity)
                    HStack(spacing: 18) { Link("Terms", destination: URL(string: "https://astroroast.com/terms")!); Link("Privacy", destination: URL(string: "https://astroroast.com/privacy")!) }.font(.system(size: 12)).foregroundStyle(Palette.text3).frame(maxWidth: .infinity)
                }.padding(.horizontal, 22).padding(.bottom, 24)
            }.scrollIndicators(.hidden)
        }.foregroundStyle(Palette.text)
        .task { if model.purchases.products.isEmpty { await model.purchases.load() } }
    }
    func planCard(title: String, price: String, sub: String, on: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            VStack(alignment: .leading, spacing: 3) {
                MonoLabel(title, color: on ? Palette.moon : Palette.text3, size: 9, tracking: 1.3)
                Text(price).font(.system(size: 19, weight: .semibold)).foregroundStyle(Palette.text)
                Text(sub).font(.system(size: 11)).foregroundStyle(Palette.text3).multilineTextAlignment(.leading)
            }.padding(13).frame(maxWidth: .infinity, alignment: .leading)
                .background(on ? Palette.surface2 : .clear, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(on ? Palette.moon : Palette.line, lineWidth: on ? 1.5 : 1))
        }.accessibilityAddTraits(on ? .isSelected : [])
    }
}
