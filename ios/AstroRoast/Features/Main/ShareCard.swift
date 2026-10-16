import SwiftUI
import AstroKit
import Photos

enum ShareStyle: String, CaseIterable { case ember = "Ember", void = "Void", dossier = "Chart" }

struct ShareCardView: View {
    let content: ShareContent; let style: ShareStyle
    var body: some View {
        ZStack {
            switch style {
            case .ember: Palette.ember
            case .void: Palette.ground
            case .dossier: Color(red: 14/255, green: 14/255, blue: 14/255)
            }
            WheelArt(tint: style == .ember ? Palette.ink : Palette.moon, opacity: style == .ember ? 0.16 : 0.12, spin: false).scaleEffect(1.7).offset(y: 120)
            VStack(alignment: .leading, spacing: 0) {
                MonoLabel(content.kicker, color: fg.opacity(0.8), size: 11, tracking: 2.6)
                Spacer()
                Text(content.text.uppercased()).font(.display(fontSize, .heavy)).tracking(-fontSize * 0.035).lineSpacing(-fontSize * 0.04).foregroundStyle(fg)
                    .minimumScaleFactor(0.45).lineLimit(9)
                Spacer()
                HStack { MonoLabel(content.footer, color: fg.opacity(0.8), size: 10, tracking: 1.8); Spacer(); Rectangle().fill(style == .ember ? Palette.ink : Palette.ember).frame(width: 9, height: 9) }
            }.padding(26)
        }.frame(width: 360, height: 640)
    }
    var fg: Color { style == .ember ? Palette.ink : Palette.moon }
    var fontSize: CGFloat { content.text.count < 60 ? 46 : (content.text.count < 120 ? 36 : 28) }
}

struct ShareSheetView: View {
    @Environment(\.dismiss) private var dismiss
    let content: ShareContent
    @State private var style = ShareStyle.ember
    @State private var image: UIImage?
    @State private var saved = false

    var body: some View {
        VStack(spacing: 16) {
            Picker("Style", selection: $style) { ForEach(ShareStyle.allCases, id: \.self) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented).padding(.horizontal, 20).padding(.top, 20)
            ShareCardView(content: content, style: style).clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous)).shadow(color: Palette.ember.opacity(style == .ember ? 0.25 : 0.0), radius: 30, y: 12).scaleEffect(0.86)
                .frame(height: 560)
            Spacer(minLength: 0)
            HStack(spacing: 12) {
                if let image {
                    ShareLink(item: Image(uiImage: image), preview: SharePreview(content.kicker, image: Image(uiImage: image))) { Label("Share", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity).frame(height: 52) }
                        .buttonStyle(.borderedProminent).tint(Palette.moon).foregroundStyle(Palette.ink)
                    Button { Task { await save(image) } } label: { Label(saved ? "Saved" : "Save", systemImage: saved ? "checkmark" : "arrow.down.to.line").frame(maxWidth: .infinity).frame(height: 52) }.buttonStyle(.ghost).frame(width: 130)
                }
            }.padding(.horizontal, 20).padding(.bottom, 8)
            Button("Copy text") { UIPasteboard.general.string = content.text }.font(.system(size: 14)).foregroundStyle(Palette.text3).padding(.bottom, 10)
        }
        .background(Palette.ground).foregroundStyle(Palette.text)
        .task(id: style) { render() }
    }
    @MainActor func render() {
        let r = ImageRenderer(content: ShareCardView(content: content, style: style)); r.scale = 3
        image = r.uiImage
    }
    func save(_ img: UIImage) async {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { return }
        try? await PHPhotoLibrary.shared().performChanges { PHAssetChangeRequest.creationRequestForAsset(from: img) }
        saved = true
    }
}
