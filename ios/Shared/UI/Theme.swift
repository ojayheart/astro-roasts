import SwiftUI
import CoreText

public enum Palette {
    public static let ground = Color(red: 3/255, green: 3/255, blue: 3/255)
    public static let surface = Color(red: 11/255, green: 11/255, blue: 11/255)
    public static let surface2 = Color(red: 18/255, green: 18/255, blue: 18/255)
    public static let hairline = Color(red: 31/255, green: 31/255, blue: 31/255)
    public static let line = Color(red: 42/255, green: 42/255, blue: 42/255)
    public static let text = Color(red: 229/255, green: 229/255, blue: 229/255)
    public static let text2 = Color(red: 168/255, green: 168/255, blue: 168/255)
    public static let text3 = Color(red: 143/255, green: 143/255, blue: 143/255)
    public static let moon = Color(red: 217/255, green: 212/255, blue: 204/255)
    public static let ember = Color(red: 255/255, green: 74/255, blue: 28/255)
    public static let emberSoft = Color(red: 255/255, green: 106/255, blue: 74/255)
    public static let ink = Color(red: 10/255, green: 10/255, blue: 10/255)
}

public enum Fonts {
    private static var registered = false
    public static func register() {
        guard !registered else { return }
        registered = true
        let bundle = Bundle(for: BundleAnchor.self)
        for name in ["Syne-Variable", "DMMono-Regular", "DMMono-Medium"] {
            if let url = bundle.url(forResource: name, withExtension: "ttf") ?? bundle.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}
private final class BundleAnchor {}

public extension Font {
    /// Syne: the bold display face. Heavy + tight tracking reads as confident, not shouty.
    static func display(_ size: CGFloat, _ weight: Font.Weight = .heavy) -> Font { .custom("Syne", size: size).weight(weight) }
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .custom(weight == .regular ? "DMMono-Regular" : "DMMono-Medium", size: size) }
}

public struct MonoLabel: View {
    let text: String; var color: Color = Palette.text3; var size: CGFloat = 11; var tracking: CGFloat = 2.4
    public init(_ text: String, color: Color = Palette.text3, size: CGFloat = 11, tracking: CGFloat = 2.4) { self.text = text; self.color = color; self.size = size; self.tracking = tracking }
    public var body: some View { Text(text.uppercased()).font(.mono(size)).tracking(tracking).foregroundStyle(color) }
}

/// Faint concentric-wheel linework used behind hero screens.
public struct WheelArt: View {
    var tint: Color = Palette.moon; var opacity: Double = 0.12; var spin: Bool = true
    @State private var angle = 0.0
    public init(tint: Color = Palette.moon, opacity: Double = 0.12, spin: Bool = true) { self.tint = tint; self.opacity = opacity; self.spin = spin }
    public var body: some View {
        GeometryReader { g in
            let s = min(g.size.width, g.size.height)
            ZStack {
                Circle().stroke(style: StrokeStyle(lineWidth: 1, dash: [1, 6])).frame(width: s * 0.96)
                Circle().stroke(lineWidth: 0.8).frame(width: s * 0.76)
                Circle().stroke(style: StrokeStyle(lineWidth: 0.8, dash: [4, 5])).frame(width: s * 0.56)
                ForEach(0..<12, id: \.self) { i in
                    Rectangle().frame(width: 0.6, height: s * 0.2).offset(y: -s * 0.38).rotationEffect(.degrees(Double(i) * 30))
                }
                Rectangle().frame(width: s * 0.78, height: 0.6)
                Rectangle().frame(width: 0.6, height: s * 0.78)
            }
            .foregroundStyle(tint).opacity(opacity)
            .frame(width: g.size.width, height: g.size.height)
            .rotationEffect(.degrees(angle))
            .onAppear { if spin && !UIAccessibility.isReduceMotionEnabled { withAnimation(.linear(duration: 240).repeatForever(autoreverses: false)) { angle = 360 } } }
        }
        .allowsHitTesting(false).accessibilityHidden(true)
    }
}

public struct ScreenBackground: View {
    var glow: Bool = false
    public init(glow: Bool = false) { self.glow = glow }
    public var body: some View {
        ZStack {
            Palette.ground
            if glow { RadialGradient(colors: [Palette.ember.opacity(0.10), .clear], center: .init(x: 0.5, y: 0.15), startRadius: 0, endRadius: 380) }
        }.ignoresSafeArea()
    }
}

// MARK: buttons & surfaces

public struct PrimaryButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity).frame(height: 54)
            .background(Palette.moon, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1).scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
public struct GhostButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .regular)).foregroundStyle(Palette.text)
            .frame(maxWidth: .infinity).frame(height: 50)
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Palette.line, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
public extension ButtonStyle where Self == PrimaryButtonStyle { static var primary: PrimaryButtonStyle { .init() } }
public extension ButtonStyle where Self == GhostButtonStyle { static var ghost: GhostButtonStyle { .init() } }

public struct Card<Content: View>: View {
    var padding: CGFloat = 18; var corner: CGFloat = 22; var fill: Color = Palette.surface; var stroke: Color = Palette.hairline
    let content: Content
    public init(padding: CGFloat = 18, corner: CGFloat = 22, fill: Color = Palette.surface, stroke: Color = Palette.hairline, @ViewBuilder content: () -> Content) {
        self.padding = padding; self.corner = corner; self.fill = fill; self.stroke = stroke; self.content = content()
    }
    public var body: some View {
        content.padding(padding).frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: corner, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: corner, style: .continuous).stroke(stroke, lineWidth: 1))
    }
}

public struct Hairline: View { public init() {}; public var body: some View { Rectangle().fill(Palette.hairline).frame(height: 1) } }

public struct EmberDot: View { var size: CGFloat = 6; public init(size: CGFloat = 6) { self.size = size }; public var body: some View { Circle().fill(Palette.ember).frame(width: size, height: size) } }

/// Outlined display type with a transparent middle (whatever is behind shows through), like the website's `.text-outline`.
public struct OutlinedText: View {
    let text: String; let font: Font; let tracking: CGFloat; var stroke: Color = Palette.text
    public init(_ text: String, font: Font, tracking: CGFloat, stroke: Color = Palette.text) { self.text = text; self.font = font; self.tracking = tracking; self.stroke = stroke }
    public var body: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) * .pi / 4
                Text(text).font(font).tracking(tracking).foregroundStyle(stroke).offset(x: cos(a) * 1.0, y: sin(a) * 1.0)
            }
            Text(text).font(font).tracking(tracking).foregroundStyle(.black).blendMode(.destinationOut)
        }.compositingGroup()
    }
}

/// Staggered line-by-line headline reveal: bold display type with elegant motion.
public struct RevealLines: View {
    let lines: [(String, Style)]
    public enum Style { case solid, outline, ember }
    var size: CGFloat
    @State private var shown = false
    public init(_ lines: [(String, Style)], size: CGFloat = 60) { self.lines = lines; self.size = size }
    public var body: some View {
        VStack(alignment: .leading, spacing: -size * 0.1) {
            ForEach(Array(lines.enumerated()), id: \.offset) { i, l in
                Group {
                    switch l.1 {
                    case .outline: OutlinedText(l.0.uppercased(), font: .display(size), tracking: -size * 0.04)
                    case .ember: Text(l.0.uppercased()).font(.display(size)).tracking(-size * 0.04).foregroundStyle(Palette.ember)
                    case .solid: Text(l.0.uppercased()).font(.display(size)).tracking(-size * 0.04).foregroundStyle(Palette.text)
                    }
                }
                .lineLimit(1).minimumScaleFactor(0.5)
                .opacity(shown ? 1 : 0).offset(y: shown ? 0 : 30)
                .animation(.spring(duration: 0.9, bounce: 0.0).delay(Double(i) * 0.14 + 0.15), value: shown)
            }
        }
        .onAppear { shown = true }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(lines.map { $0.0 }.joined(separator: " "))
    }
}
