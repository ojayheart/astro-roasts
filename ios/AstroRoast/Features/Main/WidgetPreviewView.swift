import SwiftUI
import WidgetKit
import AstroKit

/// Design-review aid (reachable with `-open widgets`): renders the real widget views at their system sizes.
struct WidgetPreviewView: View {
    var entry: DayEntry { model.state.profile == nil ? .sample : model.entry }
    @Environment(AppModel.self) private var model
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Widgets").font(.display(26, .bold)).foregroundStyle(Palette.text)
                HStack(alignment: .top, spacing: 16) {
                    frame(.systemSmall, w: 158, h: 158) { DailyLineView(entry: entry, family: .systemSmall) }
                    frame(.systemSmall, w: 158, h: 158, ember: true) { StreakView(entry: entry) }
                }
                frame(.systemMedium, w: 338, h: 158) { DailyLineView(entry: entry, family: .systemMedium) }
                Text("Lock Screen").font(.mono(11)).foregroundStyle(Palette.text3)
                HStack(spacing: 14) {
                    frame(.accessoryRectangular, w: 160, h: 72, lock: true) { DailyLineView(entry: entry, family: .accessoryRectangular) }
                    frame(.accessoryCircular, w: 72, h: 72, lock: true) { DailyLineView(entry: entry, family: .accessoryCircular) }
                }
                frame(.accessoryInline, w: 280, h: 28, lock: true) { DailyLineView(entry: entry, family: .accessoryInline) }
            }.padding(20)
        }
    }
    func frame<V: View>(_ fam: WidgetFamily, w: CGFloat, h: CGFloat, lock: Bool = false, ember: Bool = false, @ViewBuilder _ v: () -> V) -> some View {
        v().padding(lock ? 8 : 16).frame(width: w, height: h, alignment: .topLeading)
            .background(lock ? Color(white: 0.3).opacity(0.5) : (ember ? Palette.ember : Palette.ground), in: RoundedRectangle(cornerRadius: lock ? 14 : 22, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: lock ? 14 : 22, style: .continuous)).foregroundStyle(lock ? .white : Palette.text)
    }
}
extension AppModel {
    var entry: DayEntry { DayEntry(date: Date(), reading: today, streak: streak, name: profileName) }
}
