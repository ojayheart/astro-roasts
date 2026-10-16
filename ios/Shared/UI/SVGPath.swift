import SwiftUI

/// Minimal SVG path-data parser (M, L, H, V, C, A, Z; absolute and relative) so the web's hand-drawn glyphs can be reused as they are.
public enum SVGPath {
    public static func parse(_ d: String) -> Path {
        var tokens: [String] = []
        var cur = ""
        func flush() { if !cur.isEmpty { tokens.append(cur); cur = "" } }
        var prevWasE = false
        for ch in d {
            if ch.isLetter && ch != "e" && ch != "E" { flush(); tokens.append(String(ch)); prevWasE = false }
            else if ch == " " || ch == "," || ch == "\n" { flush(); prevWasE = false }
            else if ch == "-" && !cur.isEmpty && !prevWasE { flush(); cur = "-"; prevWasE = false }
            else if ch == "." && cur.contains(".") { flush(); cur = "."; prevWasE = false }
            else { cur.append(ch); prevWasE = (ch == "e" || ch == "E") }
        }
        flush()

        var path = Path()
        var i = 0
        var cmd: Character = "M"
        var cp = CGPoint.zero, start = CGPoint.zero
        func num() -> CGFloat { defer { i += 1 }; return CGFloat(Double(tokens[i]) ?? 0) }
        func hasNum() -> Bool { i < tokens.count && (Double(tokens[i]) != nil) }

        while i < tokens.count {
            if let c = tokens[i].first, tokens[i].count == 1, c.isLetter { cmd = c; i += 1; if cmd == "Z" || cmd == "z" { path.closeSubpath(); cp = start; continue } }
            let rel = cmd.isLowercase
            switch cmd {
            case "M", "m":
                var p = CGPoint(x: num(), y: num()); if rel { p = CGPoint(x: cp.x + p.x, y: cp.y + p.y) }
                path.move(to: p); cp = p; start = p; cmd = rel ? "l" : "L"
            case "L", "l":
                var p = CGPoint(x: num(), y: num()); if rel { p = CGPoint(x: cp.x + p.x, y: cp.y + p.y) }
                path.addLine(to: p); cp = p
            case "H", "h":
                let x = num(); cp = CGPoint(x: rel ? cp.x + x : x, y: cp.y); path.addLine(to: cp)
            case "V", "v":
                let y = num(); cp = CGPoint(x: cp.x, y: rel ? cp.y + y : y); path.addLine(to: cp)
            case "C", "c":
                var a = CGPoint(x: num(), y: num()), b = CGPoint(x: num(), y: num()), e = CGPoint(x: num(), y: num())
                if rel { a = CGPoint(x: cp.x + a.x, y: cp.y + a.y); b = CGPoint(x: cp.x + b.x, y: cp.y + b.y); e = CGPoint(x: cp.x + e.x, y: cp.y + e.y) }
                path.addCurve(to: e, control1: a, control2: b); cp = e
            case "A", "a":
                let rx = num(), ry = num(), rot = num(), large = num() != 0, sweep = num() != 0
                var e = CGPoint(x: num(), y: num()); if rel { e = CGPoint(x: cp.x + e.x, y: cp.y + e.y) }
                addArc(&path, from: cp, to: e, rx: rx, ry: ry, rotation: rot, large: large, sweep: sweep); cp = e
            default: i += 1
            }
            if !hasNum() && i < tokens.count && tokens[i].count > 1 { i += 1 }
        }
        return path
    }

    /// SVG endpoint arc → centre parameterisation (SVG 1.1 §F.6.5), emitted as cubic Béziers.
    private static func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat, rotation: CGFloat, large: Bool, sweep: Bool) {
        if p0 == p1 { return }
        var rx = abs(rx0), ry = abs(ry0)
        if rx == 0 || ry == 0 { path.addLine(to: p1); return }
        let phi = rotation * .pi / 180, cphi = cos(phi), sphi = sin(phi)
        let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
        let x1 = cphi * dx + sphi * dy, y1 = -sphi * dx + cphi * dy
        let lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lam > 1 { rx *= sqrt(lam); ry *= sqrt(lam) }
        let sign: CGFloat = (large == sweep) ? -1 : 1
        let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
        let co = sign * sqrt(max(0, num / den))
        let cx1 = co * (rx * y1 / ry), cy1 = co * -(ry * x1 / rx)
        let cx = cphi * cx1 - sphi * cy1 + (p0.x + p1.x) / 2, cy = sphi * cx1 + cphi * cy1 + (p0.y + p1.y) / 2
        func ang(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a
        }
        let theta1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var dtheta = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep && dtheta > 0 { dtheta -= 2 * .pi } else if sweep && dtheta < 0 { dtheta += 2 * .pi }
        let segs = Int(ceil(abs(dtheta) / (.pi / 2)))
        let delta = dtheta / CGFloat(segs)
        let t = 4.0 / 3.0 * tan(delta / 4)
        var th = theta1
        for _ in 0..<segs {
            let c1 = cos(th), s1 = sin(th), c2 = cos(th + delta), s2 = sin(th + delta)
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: cphi * rx * x - sphi * ry * y + cx, y: sphi * rx * x + cphi * ry * y + cy)
            }
            path.addCurve(to: pt(c2, s2), control1: pt(c1 - t * s1, s1 + t * c1), control2: pt(c2 + t * s2, s2 - t * c2))
            th += delta
        }
    }
}
