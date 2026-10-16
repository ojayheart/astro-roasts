import SwiftUI
import AstroKit

struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var upcoming: [ChartEvent] = []
    @State private var exact: String = ""

    var body: some View {
        ZStack {
            ScreenBackground()
            if model.natal == nil { NoChartView() } else if let r = model.today { content(r) }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: model.state.profile?.instant) {
            guard let n = model.natal else { return }
            let hit = model.today?.driver
            let result = await Task.detached(priority: .userInitiated) { () -> ([ChartEvent], String) in
                (Voice.upcoming(natal: n, from: Date()), hit.map { Self.exactText($0) } ?? "")
            }.value
            upcoming = result.0; exact = result.1
        }
    }

    func content(_ r: DayReading) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        MonoLabel(Date.now.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)).uppercased(), size: 11, tracking: 2.4)
                        Text("Today").font(.display(36, .heavy)).tracking(-1).textCase(.uppercase).foregroundStyle(Palette.text)
                    }
                    Spacer()
                    HStack(spacing: 6) { Image(systemName: "flame").font(.system(size: 12)).foregroundStyle(Palette.ember); Text("\(max(model.streak, 1))-day streak").font(.mono(12)) }
                        .padding(.horizontal, 12).frame(height: 30).overlay(Capsule().stroke(Palette.line)).foregroundStyle(Palette.text)
                }

                if let y = yesterdayCard { y }

                // hero
                ZStack(alignment: .topTrailing) {
                    WheelArt(opacity: 0.10, spin: false).frame(width: 240, height: 240).offset(x: 80, y: -70).clipped()
                    VStack(alignment: .leading, spacing: 16) {
                        if let h = r.driver { MonoLabel("\(Voice.hitName(h))\(exact.isEmpty ? "" : "  ·  \(exact)")", color: Palette.emberSoft, size: 10.5, tracking: 1.4).lineLimit(2) }
                        else { MonoLabel("Moon in \(r.moonSign) · \(r.phase)", color: Palette.text3, size: 11, tracking: 1.6) }
                        Text(r.headline).font(.display(31, .bold)).tracking(-0.8).lineSpacing(1).foregroundStyle(Palette.text).fixedSize(horizontal: false, vertical: true)
                        Text(r.body).font(.system(size: 15)).lineSpacing(4).foregroundStyle(Palette.text2)
                        HStack(spacing: 10) {
                            Button { model.share(r.headline, kicker: r.driver.map { Voice.hitName($0) } ?? "Today") } label: { Text("Share") }.buttonStyle(.primary).frame(height: 46)
                            Button { model.path.append(Dest.why(Date())) } label: { Text("Why this?") }.buttonStyle(.ghost).frame(height: 46)
                        }
                    }.padding(22).frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Palette.hairline))
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))

                HStack(spacing: 8) {
                    ListCard(label: "Do", items: r.doList)
                    ListCard(label: "Don't", items: r.dontList)
                    ListCard(label: "Absolutely not", items: r.neverList, hot: true)
                }

                if !upcoming.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        MonoLabel("Incoming", size: 11, tracking: 2.2).padding(.bottom, 8)
                        ForEach(upcoming) { e in
                            HStack(alignment: .top, spacing: 14) {
                                Text(e.date.formatted(.dateTime.day().month(.abbreviated)).uppercased()).font(.mono(11)).foregroundStyle(Palette.text3).frame(width: 52, alignment: .leading).padding(.top, 2)
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 6) { if e.personal { EmberDot(size: 5) }; Text(e.title).font(.system(size: 15, weight: .medium)).foregroundStyle(Palette.text) }
                                    if e.personal { Text(e.subtitle).font(.system(size: 13)).foregroundStyle(Palette.text3).lineSpacing(2) }
                                }
                                Spacer(minLength: 0)
                            }.padding(.vertical, 12).overlay(alignment: .top) { Hairline() }
                        }
                    }
                }

                weekStrip
            }.padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
        }.scrollIndicators(.hidden)
    }

    var weekStrip: some View {
        Button { model.requirePlus { model.path.append(Dest.sunday) } } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack { MonoLabel("This week, in one word a day", size: 10, tracking: 1.8); Spacer(); if !model.isPlus { MonoLabel("Roast+", color: Palette.emberSoft, size: 10, tracking: 1.6) } else { Image(systemName: "play.fill").font(.system(size: 11)).foregroundStyle(Palette.text2) } }
                HStack(alignment: .bottom, spacing: 6) {
                    ForEach(0..<7, id: \.self) { i in
                        let d = Calendar.current.date(byAdding: .day, value: i, to: Calendar.current.startOfDay(for: Date()))!
                        if let r = model.reading(for: d) {
                            VStack(spacing: 6) {
                                RoundedRectangle(cornerRadius: 5).fill(r.intensity > 0.6 ? Palette.ember : (r.intensity > 0.35 ? Color(white: 0.55) : Color(white: 0.18))).frame(height: 10 + 44 * r.intensity)
                                Text(r.vibe).font(.system(size: 10.5)).foregroundStyle(Palette.text2).lineLimit(1).minimumScaleFactor(0.6)
                                Text(d.formatted(.dateTime.weekday(.narrow))).font(.mono(9)).foregroundStyle(Palette.text3)
                            }.frame(maxWidth: .infinity)
                        }
                    }
                }.frame(height: 90, alignment: .bottom)
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Palette.hairline))
        }.buttonStyle(.plain)
    }

    var yesterdayCard: AnyView? {
        let cal = Calendar.current
        guard let y = cal.date(byAdding: .day, value: -1, to: Date()), model.state.receipts[DayKey.key(y)] == nil, let r = model.reading(for: y), r.driver != nil, model.state.openedDays.contains(DayKey.key(y)) || model.demo else { return nil }
        return AnyView(
            Card(padding: 16, corner: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    MonoLabel("Yesterday's call", size: 10, tracking: 1.8)
                    Text("\"\(r.headline)\"").font(.system(size: 15, weight: .medium)).foregroundStyle(Palette.text)
                    HStack(spacing: 8) {
                        ForEach(ReceiptRating.allCases, id: \.self) { rt in
                            Button(rt.rawValue) { withAnimation { model.state.receipts[DayKey.key(y)] = rt } }.font(.system(size: 13)).foregroundStyle(Palette.text).frame(maxWidth: .infinity).frame(height: 38).overlay(RoundedRectangle(cornerRadius: 11).stroke(Palette.line))
                        }
                    }
                }
            })
    }

    nonisolated static func exactText(_ h: TransitHit) -> String {
        guard let t = Voice.exactMoment(of: h, near: Date()) else { return "" }
        let cal = Calendar.current
        if cal.isDateInToday(t) { return "exact \(t.formatted(date: .omitted, time: .shortened))" }
        let days = Int(((t.timeIntervalSince(Date())) / 86400).rounded())
        if days > 0 { return "exact in \(days) day\(days == 1 ? "" : "s")" }
        return "exact \(-days) day\(days == -1 ? "" : "s") ago"
    }
}

struct ListCard: View {
    let label: String; let items: [String]; var hot = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            MonoLabel(label, color: hot ? Palette.emberSoft : Palette.text3, size: 9, tracking: 1.4)
            VStack(alignment: .leading, spacing: 4) { ForEach(items, id: \.self) { Text($0).font(.system(size: 13)).foregroundStyle(Palette.text).fixedSize(horizontal: false, vertical: true) } }
        }.padding(12).frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(hot ? Color(red: 42/255, green: 18/255, blue: 8/255) : Palette.hairline))
    }
}

struct NoChartView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("We need your birth details").font(.display(28, .bold)).multilineTextAlignment(.center).foregroundStyle(Palette.text)
            Text("Add them once and Today, the moon dial and your widgets all light up.").font(.system(size: 15)).foregroundStyle(Palette.text2).multilineTextAlignment(.center)
            Button("Add birth details") { model.state.onboardingDone = false; model.route = .birth }.buttonStyle(.primary).padding(.horizontal, 30)
            Spacer()
        }.padding(24)
    }
}
