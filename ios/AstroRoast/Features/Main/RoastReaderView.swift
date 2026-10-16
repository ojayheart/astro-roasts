import SwiftUI
import AstroKit

struct RoastReaderView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var page = 0
    @State private var busy = false

    enum Page: Hashable { case para(Int, String, String), quote(String), paywall }

    var pages: [Page] {
        guard let r = model.roast else { return [] }
        var out: [Page] = []
        let paras = r.paragraphs
        let quotes = r.callouts ?? []
        for (i, p) in paras.enumerated() {
            let (h, b) = Self.split(p)
            out.append(.para(i, h, b))
            if r.paid, i == 2, let q = quotes.first { out.append(.quote(q)) }
            if r.paid, i == 5, quotes.count > 1 { out.append(.quote(quotes[1])) }
        }
        if !r.paid { out.append(.paywall) }
        return out
    }

    /// The opening sentence(s) become the headline (the server text has no section titles). Very short openers are merged with the next sentence.
    static func split(_ p: String) -> (String, String) {
        let plain = p.replacingOccurrences(of: "*", with: "")
        var ends: [String.Index] = []
        var i = plain.startIndex
        while i < plain.endIndex { if ".!?".contains(plain[i]), plain.index(after: i) == plain.endIndex || plain[plain.index(after: i)] == " " { ends.append(i) }; i = plain.index(after: i) }
        guard var cut = ends.first else { return (plain.split(separator: " ").prefix(9).joined(separator: " ") + "…", p) }
        if plain.distance(from: plain.startIndex, to: cut) < 26, ends.count > 1 { cut = ends[1] }
        let headLen = plain.distance(from: plain.startIndex, to: cut) + 1
        if headLen > 130 { return (plain.split(separator: " ").prefix(10).joined(separator: " ") + "…", p) }
        let head = String(plain.prefix(headLen))
        // map back into the original (which may contain asterisks) by counting non-asterisk characters
        var seen = 0, idx = p.startIndex
        while idx < p.endIndex, seen < headLen { if p[idx] != "*" { seen += 1 }; idx = p.index(after: idx) }
        let rest = String(p[idx...]).trimmingCharacters(in: .whitespaces)
        return (head, rest.isEmpty ? p : rest)
    }

    var body: some View {
        let pgs = pages
        ZStack {
            ScreenBackground()
            if let r = model.roast, !pgs.isEmpty {
                VStack(spacing: 0) {
                    HStack {
                        Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Close")
                        Spacer()
                        MonoLabel("\(roman(min(page, pgs.count - 1) + 1)) / \(roman(pgs.count))", size: 11, tracking: 2.4)
                        Spacer()
                        Button { shareCurrent(pgs) } label: { Image(systemName: "square.and.arrow.up").font(.system(size: 17)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text).accessibilityLabel("Share this page")
                    }.padding(.horizontal, 12).padding(.top, 6)
                    GeometryReader { g in Rectangle().fill(Palette.hairline).frame(height: 2).overlay(alignment: .leading) { Rectangle().fill(Palette.ember).frame(width: g.size.width * CGFloat(page + 1) / CGFloat(pgs.count)).animation(.snappy, value: page) } }.frame(height: 2).padding(.horizontal, 20)
                    TabView(selection: $page) {
                        ForEach(Array(pgs.enumerated()), id: \.offset) { i, pg in
                            pageView(pg, roast: r).tag(i)
                        }
                    }.tabViewStyle(.page(indexDisplayMode: .never))
                    HStack(spacing: 10) {
                        Button { withAnimation(.snappy) { page = max(0, page - 1) } } label: { Image(systemName: "arrow.left").frame(width: 56, height: 52) }.buttonStyle(.ghost).frame(width: 64).disabled(page == 0).opacity(page == 0 ? 0.35 : 1).accessibilityLabel("Previous")
                        Button { withAnimation(.snappy) { if page < pgs.count - 1 { page += 1 } else { dismiss() } } } label: { Text(page < pgs.count - 1 ? "Next" : "Done") }.buttonStyle(.primary).frame(height: 52)
                    }.padding(.horizontal, 20).padding(.bottom, 12)
                }
            } else {
                VStack(spacing: 14) { Text("No roast yet").font(.display(26, .bold)).foregroundStyle(Palette.text); Button("Close") { dismiss() }.buttonStyle(.ghost).padding(.horizontal, 60) }
            }
        }
        .foregroundStyle(Palette.text)
        .task { await model.refreshRoast() }
    }

    @ViewBuilder func pageView(_ pg: Page, roast r: RoastPayload) -> some View {
        switch pg {
        case .para(let i, let head, let body):
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    MonoLabel(label(i, r), color: Palette.ember, size: 11, tracking: 2)
                    Text(head).font(.display(30, .bold)).tracking(-0.8).lineSpacing(1).foregroundStyle(Palette.text).fixedSize(horizontal: false, vertical: true)
                    Text(highlight(body, callouts: r.callouts ?? [])).font(.system(size: 18)).lineSpacing(7).foregroundStyle(Palette.text.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                }.padding(.horizontal, 26).padding(.top, 26).padding(.bottom, 24)
            }.scrollIndicators(.hidden)
        case .quote(let q):
            VStack(alignment: .leading, spacing: 18) {
                Spacer()
                MonoLabel("Quote of the roast", color: Palette.ember, size: 11, tracking: 2)
                Text("\u{201C}\(q)\u{201D}").font(.display(36, .heavy)).tracking(-1).lineSpacing(2).foregroundStyle(Palette.text)
                Button { model.share(q, kicker: "\(r.name)'s roast") } label: { Label("Make a card", systemImage: "rectangle.portrait.on.rectangle.portrait") }.font(.system(size: 15, weight: .medium)).foregroundStyle(Palette.moon)
                Spacer()
            }.padding(.horizontal, 26)
        case .paywall:
            VStack(alignment: .leading, spacing: 16) {
                Spacer()
                Text("The rest is\nthe good part.").font(.display(36, .heavy)).tracking(-1).foregroundStyle(Palette.text)
                Text("Nine more sections: every planet, every house, every aspect. Yours forever.").font(.system(size: 16)).foregroundStyle(Palette.text2)
                Button { Task { busy = true; defer { busy = false }; await model.buyRoast() } } label: { if busy { ProgressView().tint(Palette.ink) } else { Text("Unlock the full roast · \(model.purchases.price(Purchases.ID.roast, fallback: "$4.99"))") } }.buttonStyle(.primary).disabled(busy)
                Button("Or get Roast+ and everything else") { model.sheet = .plans; dismiss() }.font(.system(size: 15)).foregroundStyle(Palette.text2)
                Spacer()
            }.padding(.horizontal, 26)
        }
    }

    func label(_ i: Int, _ r: RoastPayload) -> String {
        guard let c = model.natal else { return i == 0 ? "The big three" : "The plot" }
        switch i {
        case 0: return "\(r.sunSign ?? c.sunSign) Sun · \(r.moonSign ?? c.moonSign) Moon · \(r.rising ?? c.risingSign ?? "") Rising"
        case 1: return "Moon \(Zodiac.label(c.lon(.moon)))"
        case 2: return "Venus \(Zodiac.label(c.lon(.venus))) · Mars \(Zodiac.label(c.lon(.mars)))"
        case 3: return "Mercury \(Zodiac.label(c.lon(.mercury)))"
        case 4: return "Saturn \(Zodiac.label(c.lon(.saturn))) · Jupiter \(Zodiac.label(c.lon(.jupiter)))"
        default: return "The plot"
        }
    }
    func highlight(_ s: String, callouts: [String]) -> AttributedString {
        var a = Emphasis.attributed(s)
        for c in callouts { if let r = a.range(of: c) { a[r].backgroundColor = Palette.ember.opacity(0.18); a[r].foregroundColor = Palette.text } }
        return a
    }
    func shareCurrent(_ pgs: [Page]) {
        guard let r = model.roast else { return }
        switch pgs[min(page, pgs.count - 1)] {
        case .quote(let q): model.share(q, kicker: "\(r.name)'s roast")
        case .para(_, let h, let b):
            let pick = (r.callouts ?? []).first(where: { b.contains($0) }) ?? h
            model.share(pick, kicker: "\(r.name)'s roast")
        case .paywall: break
        }
    }
    func roman(_ n: Int) -> String {
        let t = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]; var n = n, out = ""
        for (v, s) in t { while n >= v { out += s; n -= v } }; return out
    }
}
