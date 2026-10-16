import SwiftUI
import WidgetKit

public struct DayEntry: TimelineEntry {
    public let date: Date
    public let reading: DayReading?
    public let streak: Int
    public let name: String
    public init(date: Date, reading: DayReading?, streak: Int, name: String) { self.date = date; self.reading = reading; self.streak = streak; self.name = name }
    public static var sample: DayEntry {
        let b = BirthData.make(name: "Mara", year: 1997, month: 6, day: 14, hour: 6, minute: 42, latitude: 53.8, longitude: -1.55, timeZoneID: "Europe/London", placeName: "Leeds", countryName: "UK")!
        return DayEntry(date: Date(), reading: Voice.reading(natal: NatalChart(birth: b), on: Date()), streak: 12, name: "Mara")
    }
}

public struct DailyLineView: View {
    @Environment(\.widgetFamily) private var envFamily
    let entry: DayEntry
    var override: WidgetFamily?
    private var family: WidgetFamily { override ?? envFamily }
    public init(entry: DayEntry, family: WidgetFamily? = nil) { Fonts.register(); self.entry = entry; self.override = family }

    public var body: some View {
        Group {
            if let r = entry.reading {
                switch family {
                case .accessoryInline: Text(r.headline)
                case .accessoryCircular:
                    ZStack { AccessoryWidgetBackground(); VStack(spacing: 0) { Text(r.driver?.transiting.glyph ?? "☽").font(.system(size: 20)); Text(r.vibe.prefix(5)).font(.system(size: 9, weight: .semibold)) } }
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.driver.map { Voice.hitTitle($0) } ?? "Moon in \(r.moonSign)").font(.system(size: 11, weight: .semibold)).widgetAccentable()
                        Text(r.headline).font(.system(size: 13, weight: .semibold)).lineLimit(3).minimumScaleFactor(0.8)
                    }
                case .systemMedium:
                    HStack(alignment: .top, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("TODAY").font(.custom("DMMono-Regular", size: 10)).tracking(1.8).foregroundStyle(Palette.ember)
                            Text(r.headline).font(.display(21, .bold)).tracking(-0.4).foregroundStyle(Palette.text).lineLimit(5).minimumScaleFactor(0.7)
                            Spacer(minLength: 0)
                            Text(r.driver.map { Voice.hitName($0) } ?? r.phase).font(.custom("DMMono-Regular", size: 9.5)).tracking(1).foregroundStyle(Palette.text3).lineLimit(1)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            list("DO", r.doList.first ?? ""); list("DON'T", r.dontList.first ?? ""); list("NEVER", r.neverList.first ?? "", hot: true)
                        }.frame(width: 104)
                    }
                default:
                    VStack(alignment: .leading, spacing: 6) {
                        Text("TODAY").font(.custom("DMMono-Regular", size: 9.5)).tracking(1.8).foregroundStyle(Palette.ember)
                        Text(r.headline).font(.display(16, .bold)).tracking(-0.3).foregroundStyle(Palette.text).lineLimit(6).minimumScaleFactor(0.65)
                        Spacer(minLength: 0)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 6) { Text("ASTROROAST").font(.custom("DMMono-Regular", size: 10)).foregroundStyle(Palette.ember); Text("Open the app to add your birth details.").font(.system(size: 13)).foregroundStyle(Palette.text2) }
            }
        }
        .widgetURL(URL(string: "astroroast://today"))
        .containerBackground(Palette.ground, for: .widget)
    }
    func list(_ k: String, _ v: String, hot: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(k).font(.custom("DMMono-Regular", size: 8.5)).tracking(1.4).foregroundStyle(hot ? Palette.emberSoft : Palette.text3); Text(v).font(.system(size: 11.5)).foregroundStyle(Palette.text).lineLimit(2) }
    }
}

public struct StreakView: View {
    let entry: DayEntry
    public init(entry: DayEntry) { Fonts.register(); self.entry = entry }
    public var body: some View {
        VStack(alignment: .leading) {
            Text("STREAK").font(.custom("DMMono-Medium", size: 9.5)).tracking(1.8).foregroundStyle(Palette.ink)
            Spacer()
            Text("\(max(entry.streak, 1))").font(.system(size: 58, weight: .black, design: .rounded)).tracking(-2).foregroundStyle(Palette.ink)
            Text("days humbled").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.ink)
        }.frame(maxWidth: .infinity, alignment: .leading).widgetURL(URL(string: "astroroast://today")).containerBackground(Palette.ember, for: .widget)
    }
}
