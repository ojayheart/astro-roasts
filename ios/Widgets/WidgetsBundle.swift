import WidgetKit
import SwiftUI
import ActivityKit
import AstroKit

// MARK: daily line widget

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { sample() }
    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) { completion(context.isPreview ? sample() : build(for: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        Fonts.register()
        let cal = Calendar.current, start = cal.startOfDay(for: Date())
        let entries = (0..<7).map { build(for: cal.date(byAdding: .day, value: $0, to: start)!) }
        completion(Timeline(entries: entries, policy: .after(cal.date(byAdding: .day, value: 7, to: start)!)))
    }
    func sample() -> DayEntry { .sample }
    func build(for day: Date) -> DayEntry {
        let s = Persistence.load()
        guard let b = s.profile else { return DayEntry(date: day, reading: nil, streak: 0, name: "") }
        let muted = Set(s.mutedTransitBodies.compactMap { Body(rawValue: $0) })
        let r = Voice.reading(natal: NatalChart(birth: b), on: day, muted: muted)
        let set = Set(s.openedDays); let cal = Calendar.current
        var n = 0, d = Date(); while set.contains(DayKey.key(d)) { n += 1; d = cal.date(byAdding: .day, value: -1, to: d)! }
        return DayEntry(date: day, reading: r, streak: n, name: b.name)
    }
}

struct DailyLineWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "daily-line", provider: DayProvider()) { DailyLineView(entry: $0) }
            .configurationDisplayName("Today's burn").description("Your daily line, free and always on your screen.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "streak", provider: DayProvider()) { StreakView(entry: $0) }
            .configurationDisplayName("Streak").description("How many days in a row you've faced it.").supportedFamilies([.systemSmall])
    }
}

// MARK: live activity

struct RoastLiveActivity: Widget {
    /// The app is suspended soon after leaving the screen, so progress is driven by a timer rather than by pushed percentages.
    func timerBar(_ a: RoastActivityAttributes, ready: Bool) -> some View {
        ProgressView(timerInterval: a.start...a.estimatedEnd, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
            .tint(Palette.ember).opacity(ready ? 0 : 1).overlay { if ready { ProgressView(value: 1).tint(Palette.ember) } }
    }
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RoastActivityAttributes.self) { ctx in
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) { Rectangle().fill(Palette.ember).frame(width: 8, height: 8); Text(ctx.state.ready ? "\(ctx.attributes.name)'s roast is ready" : "\(ctx.attributes.name)'s roast is cooking").font(.system(size: 14, weight: .semibold)); Spacer() }
                timerBar(ctx.attributes, ready: ctx.state.ready)
                Text(ctx.state.line).font(.system(size: 13)).foregroundStyle(.white.opacity(0.7))
            }.padding(16).activityBackgroundTint(Color.black.opacity(0.75)).widgetURL(URL(string: "astroroast://roast"))
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Rectangle().fill(Palette.ember).frame(width: 10, height: 10).padding(.top, 8) }
                DynamicIslandExpandedRegion(.center) { Text(ctx.state.ready ? "Roast ready" : "Cooking \(ctx.attributes.name)'s roast").font(.system(size: 14, weight: .semibold)) }
                DynamicIslandExpandedRegion(.bottom) { VStack(alignment: .leading, spacing: 8) { timerBar(ctx.attributes, ready: ctx.state.ready); Text(ctx.state.line).font(.system(size: 12)).foregroundStyle(.white.opacity(0.7)) } }
            } compactLeading: { Rectangle().fill(Palette.ember).frame(width: 8, height: 8) } compactTrailing: {
                if ctx.state.ready { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.ember) }
                else { ProgressView(timerInterval: ctx.attributes.start...ctx.attributes.estimatedEnd, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }.progressViewStyle(.circular).tint(Palette.ember).frame(width: 16, height: 16) }
            } minimal: { Rectangle().fill(Palette.ember).frame(width: 8, height: 8) }
        }
    }
}

@main struct AstroWidgetsBundle: WidgetBundle {
    var body: some Widget { DailyLineWidget(); StreakWidget(); RoastLiveActivity() }
}
