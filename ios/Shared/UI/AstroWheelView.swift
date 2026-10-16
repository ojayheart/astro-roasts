import SwiftUI

/// Decorative natal wheel for the hero, ported from the website's AstroWheel.tsx: hand-drawn glyphs, the zodiac band turning clockwise (240 s),
/// the inner chart counter-rotating (360 s), everything at low opacity, and a red glow where each sign passes the fixed 12 o'clock spotlight.
public struct AstroWheelView: View {
    @State private var outer = 0.0
    @State private var inner = 0.0
    public init() {}

    static let C: CGFloat = 500
    static let glyphR: CGFloat = 412
    static let aspectR: CGFloat = 248
    static let cusps: [Double] = [0, 27, 58, 91, 121, 149, 180, 207, 238, 271, 301, 329]
    static let aspects: [(Int, Int, Bool)] = [(0, 1, true), (0, 3, true), (1, 3, false), (2, 4, false), (3, 5, false), (4, 0, true), (2, 5, false)]
    static func polar(_ r: CGFloat, _ deg: Double) -> CGPoint {
        let a = (deg - 90) * .pi / 180; return CGPoint(x: C + r * CGFloat(cos(a)), y: C + r * CGFloat(sin(a)))
    }
    static func signGlyph(_ i: Int) -> Path {
        let p = polar(glyphR, Double(i) * 30 + 15)
        let t = CGAffineTransform(translationX: p.x, y: p.y).rotated(by: CGFloat((Double(i) * 30 + 15) * .pi / 180)).scaledBy(x: 3.4, y: 3.4)
        return ZodiacGlyphs.signs[i].applying(t)
    }

    public var body: some View {
        GeometryReader { g in
            let s = min(g.size.width, g.size.height)
            ZStack {
                Canvas { ctx, size in
                    ctx.scaleBy(x: size.width / 1000, y: size.height / 1000)
                    Self.drawOuter(&ctx, color: Palette.text, widthScale: 1)
                }.opacity(0.13).rotationEffect(.degrees(outer))

                Canvas { ctx, size in
                    ctx.scaleBy(x: size.width / 1000, y: size.height / 1000)
                    Self.drawInner(&ctx)
                }.opacity(0.13).rotationEffect(.degrees(-inner))

                // Glow pass: the same glyphs, same spin, visible only under the fixed spotlight.
                ZStack {
                    glow(s).blur(radius: s * 0.006)
                    glow(s).blur(radius: s * 0.006)
                    glow(s)
                }
                .opacity(0.85)
                .rotationEffect(.degrees(outer))
                .mask {
                    RadialGradient(stops: [.init(color: .white, location: 0), .init(color: .white.opacity(0.5), location: 0.45), .init(color: .clear, location: 1)],
                                   center: UnitPoint(x: 0.5, y: (Self.C - Self.glyphR) / 1000), startRadius: 0, endRadius: s * 0.12)
                }
            }
            .frame(width: s, height: s)
            .mask(RadialGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.72), .init(color: .black.opacity(0.6), location: 0.9), .init(color: .clear, location: 1)], center: .center, startRadius: 0, endRadius: s / 2))
            .position(x: g.size.width / 2, y: g.size.height / 2)
        }
        .allowsHitTesting(false).accessibilityHidden(true)
        .onAppear {
            guard !UIAccessibility.isReduceMotionEnabled else { return }
            withAnimation(.linear(duration: 240).repeatForever(autoreverses: false)) { outer = 360 }
            withAnimation(.linear(duration: 360).repeatForever(autoreverses: false)) { inner = 360 }
        }
    }

    func glow(_ s: CGFloat) -> some View {
        Canvas { ctx, size in
            ctx.scaleBy(x: size.width / 1000, y: size.height / 1000)
            for i in 0..<12 { ctx.stroke(Self.signGlyph(i), with: .color(Palette.ember), style: StrokeStyle(lineWidth: 1.3 / 3.4 * 3.4, lineCap: .round, lineJoin: .round)) }
        }
    }

    static func drawOuter(_ ctx: inout GraphicsContext, color: Color, widthScale: CGFloat) {
        let st = StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round)
        func ring(_ r: CGFloat, _ op: Double = 1) { ctx.stroke(Path(ellipseIn: CGRect(x: C - r, y: C - r, width: 2 * r, height: 2 * r)), with: .color(color.opacity(op)), style: st) }
        ring(478); ring(452, 0.5); ring(372)
        for d in 0..<360 {
            let len: CGFloat = d % 30 == 0 ? 0 : (d % 10 == 0 ? 16 : (d % 5 == 0 ? 11 : 6))
            if len == 0 { continue }
            var p = Path(); p.move(to: polar(478, Double(d))); p.addLine(to: polar(478 - len, Double(d)))
            ctx.stroke(p, with: .color(color.opacity(d % 10 == 0 ? 0.7 : 0.4)), style: StrokeStyle(lineWidth: 1, lineCap: .round))
        }
        for i in 0..<12 {
            var p = Path(); p.move(to: polar(478, Double(i) * 30)); p.addLine(to: polar(372, Double(i) * 30))
            ctx.stroke(p, with: .color(color.opacity(0.8)), style: st)
            ctx.stroke(signGlyph(i), with: .color(color), style: st)
        }
    }

    static func drawInner(_ ctx: inout GraphicsContext) {
        let color = Palette.text
        let st = StrokeStyle(lineWidth: 1, lineCap: .round, lineJoin: .round)
        ctx.stroke(Path(ellipseIn: CGRect(x: C - 300, y: C - 300, width: 600, height: 600)), with: .color(color.opacity(0.8)), style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [2, 7]))
        ctx.stroke(Path(ellipseIn: CGRect(x: C - aspectR, y: C - aspectR, width: 2 * aspectR, height: 2 * aspectR)), with: .color(color.opacity(0.7)), style: st)
        ctx.stroke(Path(ellipseIn: CGRect(x: C - 7, y: C - 7, width: 14, height: 14)), with: .color(color), style: st)
        for (i, deg) in cusps.enumerated() {
            let angular = i % 3 == 0
            var p = Path(); p.move(to: polar(372, deg)); p.addLine(to: polar(angular ? 60 : aspectR, deg))
            ctx.stroke(p, with: .color(color.opacity(angular ? 0.55 : 0.35)), style: st)
        }
        for (lon, glyph) in ZodiacGlyphs.planets {
            let g = polar(336, lon)
            ctx.stroke(glyph.applying(CGAffineTransform(translationX: g.x, y: g.y).scaledBy(x: 3.2, y: 3.2)), with: .color(color), style: st)
            var t = Path(); t.move(to: polar(aspectR, lon)); t.addLine(to: polar(aspectR + 12, lon))
            ctx.stroke(t, with: .color(color), style: st)
            let d = polar(aspectR, lon)
            ctx.fill(Path(ellipseIn: CGRect(x: d.x - 3, y: d.y - 3, width: 6, height: 6)), with: .color(color))
        }
        for (a, b, hard) in aspects {
            var p = Path(); p.move(to: polar(aspectR, ZodiacGlyphs.planets[a].lon)); p.addLine(to: polar(aspectR, ZodiacGlyphs.planets[b].lon))
            ctx.stroke(p, with: .color(hard ? Palette.ember : color.opacity(0.6)), style: StrokeStyle(lineWidth: hard ? 1.6 : 1, lineCap: .round, dash: hard ? [] : [6, 6]))
        }
    }
}
