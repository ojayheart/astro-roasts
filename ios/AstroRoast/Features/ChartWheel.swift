import SwiftUI
import AstroKit

/// The natal wheel, drawn from the real chart. Aries/ASC sits at 9 o'clock. `progress` (0...1) reveals it for the loading screen.
struct ChartWheel: View {
    let chart: NatalChart
    var progress: Double = 1
    var showGlyphs = true

    private func angle(_ lon: Double, _ rot: Double) -> Double { (180 - (lon - rot)) * .pi / 180 }   // counter-clockwise zodiac
    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let R = min(size.width, size.height) / 2 - 4
            let rot = chart.ascendant ?? 0
            func pt(_ lon: Double, _ r: CGFloat) -> CGPoint { let a = angle(lon, rot); return CGPoint(x: c.x + r * cos(a), y: c.y - r * sin(a)) }
            let moon = Color(red: 217/255, green: 212/255, blue: 204/255), dim = Color(white: 0.16), ember = Color(red: 1, green: 74/255, blue: 28/255)
            let ringP = min(1, progress * 3)
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - R, y: c.y - R, width: 2 * R, height: 2 * R)), with: .color(dim), lineWidth: 1)
            let r2 = R * 0.82, r3 = R * 0.34
            var arc = Path(); arc.addArc(center: c, radius: r2, startAngle: .degrees(0), endAngle: .degrees(360 * ringP), clockwise: false)
            ctx.stroke(arc, with: .color(moon.opacity(0.55)), style: StrokeStyle(lineWidth: 1.4, lineCap: .round))
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r3, y: c.y - r3, width: 2 * r3, height: 2 * r3)), with: .color(dim), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
            for i in 0..<12 {
                let lon = Double(i) * 30
                var p = Path(); p.move(to: pt(lon, R)); p.addLine(to: pt(lon, r2)); ctx.stroke(p, with: .color(dim), lineWidth: 1)
                if showGlyphs {
                    let g = Text(Zodiac.glyphs[i]).font(.system(size: 13)).foregroundStyle(Color(white: 0.45))
                    ctx.draw(ctx.resolve(g), at: pt(lon + 15, (R + r2) / 2))
                }
            }
            // aspects between planets
            let pts = AstroKit.Body.planets.map { ($0, chart.lon($0)) }
            if progress > 0.35 {
                let aP = min(1, (progress - 0.35) / 0.45)
                var shown = 0
                let limit = Int(Double(pts.count * pts.count / 2) * aP)
                outer: for i in 0..<pts.count { for j in (i + 1)..<pts.count {
                    if let (k, orb) = AspectKind.between(pts[i].1, pts[j].1, orb: 5), k != .sextile || orb < 3 {
                        shown += 1; if shown > limit { break outer }
                        var p = Path(); p.move(to: pt(pts[i].1, r3)); p.addLine(to: pt(pts[j].1, r3))
                        ctx.stroke(p, with: .color(k.isHard ? ember.opacity(0.85) : moon.opacity(0.4)), lineWidth: k.isHard ? 1.1 : 0.8)
                    }
                } }
            }
            // planets
            let pP = min(1, max(0, (progress - 0.12) / 0.5))
            for (i, (b, lon)) in pts.enumerated() where Double(i) / Double(pts.count) < pP {
                let p = pt(lon, (r2 + r3) / 2 + CGFloat(i % 3) * 7 - 7)
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3.6, y: p.y - 3.6, width: 7.2, height: 7.2)), with: .color(b == .sun || b == .mars ? ember : moon))
                if showGlyphs { ctx.draw(ctx.resolve(Text(b.glyph).font(.system(size: 11)).foregroundStyle(moon)), at: CGPoint(x: p.x + (p.x > c.x ? 12 : -12), y: p.y)) }
            }
            if let a = chart.ascendant {
                var p = Path(); p.move(to: pt(a, R + 2)); p.addLine(to: pt(a, r3)); ctx.stroke(p, with: .color(moon.opacity(0.35)), lineWidth: 1)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement().accessibilityLabel("Your chart: Sun in \(chart.sunSign), Moon in \(chart.moonSign)")
    }
}
