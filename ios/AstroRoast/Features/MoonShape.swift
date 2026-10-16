import SwiftUI

/// A moon at a real phase. `elongation` is the Moon-minus-Sun longitude in degrees (0 new, 180 full).
struct MoonShape: View {
    let elongation: Double
    var dark = Color(white: 0.08)
    var lit = Color(red: 217/255, green: 212/255, blue: 204/255)
    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2, c = CGPoint(x: size.width / 2, y: size.height / 2)
            let e = elongation.truncatingRemainder(dividingBy: 360)
            let waxing = e < 180
            let rx = r * abs(cos(e * .pi / 180))
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(dark))
            var half = Path()
            half.addArc(center: c, radius: r, startAngle: .degrees(waxing ? -90 : 90), endAngle: .degrees(waxing ? 90 : 270), clockwise: false)
            half.closeSubpath()
            ctx.fill(half, with: .color(lit))
            let crescent = waxing ? e < 90 : e > 270
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - rx, y: c.y - r, width: 2 * rx, height: 2 * r)), with: .color(crescent ? dark : lit))
        }
        .accessibilityHidden(true)
    }
}
