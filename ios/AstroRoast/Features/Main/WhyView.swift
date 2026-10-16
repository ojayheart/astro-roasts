import SwiftUI
import AstroKit

struct WhyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let date: Date

    var body: some View {
        let r = model.reading(for: date)
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let r, let h = r.driver {
                        let noon = Calendar.current.startOfDay(for: date).addingTimeInterval(12 * 3600)
                        let exact = Voice.exactMoment(of: h, near: noon)
                        let sd = Voice.seed(r.day, 5)
                        Text("\"\(r.headline)\"").font(.display(22, .semibold)).tracking(-0.3).foregroundStyle(Palette.text2).lineSpacing(2)
                        TransitDiagram(hit: h, transitingLon: Ephemeris.shared.longitude(h.transiting, jd: JD.from(noon))).frame(height: 290).frame(maxWidth: .infinity)
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) { Text(Voice.agent(h.transiting)).font(.display(23, .semibold)).foregroundStyle(Palette.text); MonoLabel(h.transiting.name, color: Palette.ember, size: 11, tracking: 1.4) }
                            Text(h.aspect.isHard ? (h.aspect == .square ? "is picking a fight with" : "is staring down") : (h.aspect == .conjunction ? "has moved in with" : "is on good terms with")).font(.display(19, .regular)).foregroundStyle(Palette.text3)
                            HStack(spacing: 8) { Text(Voice.domain(h.natal).replacingOccurrences(of: "your ", with: "").capitalizedFirst).font(.display(23, .semibold)).foregroundStyle(Palette.text); MonoLabel("Your \(h.natal.name)", color: Palette.text2, size: 11, tracking: 1.4) }
                        }
                        VStack(spacing: 0) {
                            row("Exact", exact.map { when($0) } ?? "Around now")
                            row("Strength", strength(h.orb))
                            row("How often", Voice.cycleText(h.transiting).capitalizedFirst)
                            if let last = Voice.previousExact(of: h, before: exact ?? noon) { row("Last time", "\(last.formatted(.dateTime.month(.abbreviated).year())). \(Voice.lastTimeJoke(seed: sd))") }
                        }.overlay(alignment: .top) { Hairline() }
                        HStack(spacing: 10) {
                            Button("Mute \(h.transiting.name) stuff") { model.mute(h.transiting); dismiss() }.buttonStyle(.ghost)
                            Button("Roast this day") { model.sheet = .day(date) }.buttonStyle(.primary)
                        }.padding(.top, 8)
                    } else if let r {
                        Text("Nothing from the planets today.").font(.display(26, .bold)).foregroundStyle(Palette.text)
                        Text("\(r.body) The sky is quiet for you, so whatever happens is on you. Sorry.").font(.system(size: 16)).foregroundStyle(Palette.text2).lineSpacing(4)
                    }
                }.padding(.horizontal, 24).padding(.vertical, 12)
            }
        }
        .navigationTitle("Why this?").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
    }
    func row(_ k: String, _ v: String) -> some View {
        HStack(alignment: .top) { Text(k).font(.system(size: 14)).foregroundStyle(Palette.text3); Spacer(); Text(v).font(.system(size: 14)).foregroundStyle(Palette.text).multilineTextAlignment(.trailing).frame(maxWidth: 220, alignment: .trailing) }
            .padding(.vertical, 13).overlay(alignment: .bottom) { Hairline() }
    }
    func when(_ d: Date) -> String {
        Calendar.current.isDateInToday(d) ? "Today, \(d.formatted(date: .omitted, time: .shortened))" : d.formatted(.dateTime.weekday(.wide).day().month(.abbreviated).year().hour().minute())
    }
    func strength(_ orb: Double) -> String {
        let deg = Int(orb), min = Int((orb - Double(deg)) * 60)
        return "Orb \(deg)°\(String(format: "%02d", min))′ · \(orb < 0.5 ? "loud" : (orb < 1.2 ? "audible" : "background"))"
    }
}

struct TransitDiagram: View {
    let hit: TransitHit; let transitingLon: Double
    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2 - 18), R: CGFloat = 84
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - R, y: c.y - R, width: 2 * R, height: 2 * R)), with: .color(Color(white: 0.13)), lineWidth: 1)
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - R + 16, y: c.y - R + 16, width: 2 * R - 32, height: 2 * R - 32)), with: .color(Color(white: 0.1)), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))
            let natalA = Double.pi * 1.25, sign = angDiff(transitingLon, hit.natalLongitude) >= 0 ? -1.0 : 1.0   // transit sits ahead (counter-clockwise) or behind
            let transA = natalA + sign * hit.aspect.angle * .pi / 180 * -1
            func p(_ a: Double) -> CGPoint { CGPoint(x: c.x + R * cos(a), y: c.y - R * sin(a)) }
            var chord = Path(); chord.move(to: p(natalA)); chord.addLine(to: p(transA))
            ctx.stroke(chord, with: .color(Color(white: 0.3)), lineWidth: 1)
            func node(_ a: Double, _ glyph: String, fill: Bool, label: String, sub: String) {
                let pt = p(a), r: CGFloat = 22
                let rect = CGRect(x: pt.x - r, y: pt.y - r, width: 2 * r, height: 2 * r)
                if fill { ctx.fill(Path(ellipseIn: rect), with: .color(Color(red: 217/255, green: 212/255, blue: 204/255))) }
                else { ctx.fill(Path(ellipseIn: rect), with: .color(.black)); ctx.stroke(Path(ellipseIn: rect), with: .color(Color(red: 1, green: 74/255, blue: 28/255)), lineWidth: 1.3) }
                ctx.draw(ctx.resolve(Text(glyph).font(.system(size: 19)).foregroundStyle(fill ? Color.black : Color(red: 1, green: 74/255, blue: 28/255))), at: pt)
                let dx: CGFloat = pt.x > c.x ? 1 : -1
                ctx.draw(ctx.resolve(Text(label).font(.mono(9.5)).foregroundStyle(.white)), at: CGPoint(x: pt.x + dx * 4, y: pt.y + 36), anchor: .center)
                ctx.draw(ctx.resolve(Text(sub).font(.mono(9.5)).foregroundStyle(Color(white: 0.56))), at: CGPoint(x: pt.x + dx * 4, y: pt.y + 49), anchor: .center)
            }
            node(transA, hit.transiting.glyph, fill: false, label: "\(hit.transiting.name.uppercased()) NOW", sub: Zodiac.label(transitingLon).uppercased())
            node(natalA, hit.natal.kind == .body ? hit.natal.body!.glyph : hit.natal.glyph, fill: true, label: "YOUR \(hit.natal.name.uppercased())", sub: Zodiac.label(hit.natalLongitude).uppercased())
            ctx.draw(ctx.resolve(Text("\(hit.aspect.rawValue)° \(hit.aspect.name.uppercased())").font(.mono(10)).foregroundStyle(Color(white: 0.56))), at: CGPoint(x: c.x, y: c.y - 10))
        }
        .accessibilityLabel("\(hit.transiting.name) \(hit.aspect.name) your \(hit.natal.name)")
    }
}

extension String { var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() } }
