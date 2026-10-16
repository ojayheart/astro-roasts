import SwiftUI
import AstroKit

struct MonthDay: Identifiable {
    var id: Int { index }
    let index: Int
    let date: Date
    let elongation: Double
    let reading: DayReading
    var event: ChartEvent?
    var cardTitle: String { event?.title ?? reading.driver.map { Voice.hitName($0) } ?? reading.phase }
}

struct MonthView: View {
    @Environment(AppModel.self) private var model
    @State private var monthOffset = 0
    @State private var days: [MonthDay] = []
    @State private var rot: Double = 0
    @State private var dragging = false
    @State private var dragStartAngle: Double?
    @State private var dragStartRot = 0.0
    @State private var overlay: [UUID: [Int: TransitHit]] = [:]
    @State private var loading = true

    private var monthStart: Date { Calendar.current.date(byAdding: .month, value: monthOffset, to: Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date()))!)! }
    private var step: Double { 360.0 / Double(max(days.count, 1)) }
    private var f: Double { max(0, min(Double(max(days.count - 1, 0)), -rot / step)) }
    private var selected: Int { Int(f.rounded()) }

    var body: some View {
        ZStack {
            ScreenBackground()
            if model.natal == nil { NoChartView() } else {
                VStack(spacing: 0) {
                    header
                    if days.isEmpty { Spacer(); ProgressView().tint(Palette.text2); Spacer() } else {
                        dial.padding(.top, 8)
                        overlayToggles.padding(.top, 8)
                        carousel.padding(.top, 14)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: "\(monthOffset)-\(model.state.profile?.instant.timeIntervalSince1970 ?? 0)") { await load() }
        .task(id: model.state.people.map { "\($0.id)\($0.overlaySource)" }.joined()) { await loadOverlay() }
    }

    // MARK: header
    var header: some View {
        HStack {
            Spacer().frame(width: 44)
            Spacer()
            HStack(spacing: 4) {
                Button { shift(-1) } label: { Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold)).frame(width: 36, height: 44) }.foregroundStyle(Palette.text3).accessibilityLabel("Previous month")
                Text(monthStart.formatted(.dateTime.month(.wide).year()).uppercased()).font(.mono(11)).tracking(2.2).foregroundStyle(Palette.moon).frame(minWidth: 130)
                Button { shift(1) } label: { Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).frame(width: 36, height: 44) }.foregroundStyle(Palette.text3).accessibilityLabel("Next month")
            }
            Spacer()
            Button { model.sheet = .calendar } label: { Image(systemName: "calendar.badge.plus").font(.system(size: 19)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Calendar sync")
        }.padding(.horizontal, 16).frame(height: 48)
    }
    func shift(_ d: Int) { withAnimation(.snappy) { monthOffset += d; rot = 0 } }

    // MARK: dial
    var dial: some View {
        let size: CGFloat = 330
        return ZStack {
            wheel(size: size).rotationEffect(.degrees(rot)).animation(dragging ? nil : .spring(duration: 0.65, bounce: 0.08), value: rot)
            // fixed pointer + selection ring at the top
            Circle().stroke(Palette.moon, lineWidth: 0.9).frame(width: 30, height: 30).offset(y: -size / 2 + 34 + 12)
            Path { p in p.move(to: CGPoint(x: size / 2 - 5, y: 2)); p.addLine(to: CGPoint(x: size / 2 + 5, y: 2)); p.addLine(to: CGPoint(x: size / 2, y: 9)); p.closeSubpath() }.fill(Palette.ember).frame(width: size, height: size)
            if days.indices.contains(selected) {
                let d = days[selected]
                VStack(spacing: 6) {
                    MonoLabel(d.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)), size: 10, tracking: 2.4)
                    Text(d.reading.phase).font(.display(21, .semibold)).tracking(-0.3).foregroundStyle(Palette.text).multilineTextAlignment(.center).minimumScaleFactor(0.8)
                    Text(d.event?.title ?? d.reading.driver.map { Voice.hitName($0) } ?? "Moon in \(d.reading.moonSign)").font(.system(size: 12)).foregroundStyle(Palette.text3).multilineTextAlignment(.center).lineLimit(2)
                }.frame(width: 170).id(selected).transition(.opacity)
            }
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .gesture(DragGesture(minimumDistance: 4).onChanged { v in
            let c = CGPoint(x: size / 2, y: size / 2)
            let a = atan2(v.location.y - c.y, v.location.x - c.x) * 180 / .pi
            if dragStartAngle == nil { dragStartAngle = a; dragStartRot = rot; dragging = true }
            var d = a - (dragStartAngle ?? a); if d > 180 { d -= 360 }; if d < -180 { d += 360 }
            let raw = dragStartRot + d
            let lo = -step * Double(days.count - 1)
            rot = raw > 0 ? raw * 0.3 : (raw < lo ? lo + (raw - lo) * 0.3 : raw)
        }.onEnded { _ in
            dragStartAngle = nil; dragging = false
            withAnimation(.spring(duration: 0.55, bounce: 0.1)) { rot = -Double(selected) * step }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        })
        .onChange(of: selected) { _, _ in UISelectionFeedbackGenerator().selectionChanged() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Moon dial")
        .accessibilityValue(days.indices.contains(selected) ? "\(days[selected].date.formatted(.dateTime.weekday(.wide).day().month(.wide))), \(days[selected].reading.phase)" : "")
        .accessibilityAdjustableAction { dir in
            let t = dir == .increment ? min(selected + 1, days.count - 1) : max(selected - 1, 0)
            withAnimation(.snappy) { rot = -Double(t) * step }
        }
    }

    func wheel(size: CGFloat) -> some View {
        let c = size / 2, R = size / 2 - 30, rIn = R * 0.8
        func pt(_ i: Int, _ r: CGFloat) -> CGPoint { let a = (Double(i) * step - 90) * .pi / 180; return CGPoint(x: c + r * cos(a), y: c + r * sin(a)) }
        return ZStack {
            Circle().stroke(style: StrokeStyle(lineWidth: 1, dash: [1, 7])).foregroundStyle(Color(white: 0.16)).frame(width: size - 4)
            Circle().stroke(Color(white: 0.07), lineWidth: 1).frame(width: R * 2)
            Circle().stroke(Color(white: 0.09), lineWidth: 1).frame(width: rIn * 2)
            // loud-week arcs
            ForEach(Array(loudRanges().enumerated()), id: \.offset) { _, rg in
                Path { p in p.addArc(center: CGPoint(x: c, y: c), radius: rIn, startAngle: .degrees(Double(rg.0) * step - 90 - step * 0.4), endAngle: .degrees(Double(rg.1) * step - 90 + step * 0.4), clockwise: false) }
                    .stroke(Palette.ember.opacity(0.45), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
            }
            ForEach(days) { d in
                let p = pt(d.index, R)
                MoonShape(elongation: d.elongation).frame(width: 13, height: 13).position(p)
            }
            // personal hits (breathing ember)
            ForEach(days.filter { d in d.reading.driver.map { $0.transiting != .moon && $0.weight >= 3.6 } ?? false }) { d in
                let p = pt(d.index, rIn)
                BreathingDot().position(p)
            }
            // sky-wide events
            ForEach(days.filter { $0.event != nil }) { d in Circle().fill(Palette.moon.opacity(0.55)).frame(width: 4, height: 4).position(pt(d.index, rIn - 14)) }
            // overlay people
            ForEach(Array(model.state.people.enumerated()), id: \.element.id) { idx, person in
                if person.overlaySource, let hits = overlay[person.id] {
                    ForEach(Array(hits.keys.sorted()), id: \.self) { di in
                        OverlayMark(shape: idx % 3).position(pt(di, rIn - 28 - CGFloat(idx % 3) * 0))
                    }
                }
            }
            ForEach([0, 7, 14, 21, 28].filter { $0 < days.count }, id: \.self) { i in
                Text("\(i + 1)").font(.mono(9)).foregroundStyle(Color(white: 0.4)).rotationEffect(.degrees(-rot)).position(pt(i, R + 20))
            }
        }.frame(width: size, height: size)
    }

    func loudRanges() -> [(Int, Int)] {
        var out: [(Int, Int)] = []; var start: Int?
        for d in days {
            let loud = d.reading.driver.map { $0.transiting != .moon && $0.weight >= 4.6 } ?? false
            if loud, start == nil { start = d.index }
            if (!loud || d.index == days.count - 1), let s = start { out.append((s, loud ? d.index : d.index - 1)); start = nil }
        }
        return out.filter { $0.1 - $0.0 >= 1 }
    }

    // MARK: overlay toggles + carousel
    var overlayToggles: some View {
        HStack(spacing: 8) {
            MonoLabel("Overlay", size: 10, tracking: 2).padding(.trailing, 4)
            if model.state.people.isEmpty { Button { model.sheet = .addPerson } label: { Label("Add someone", systemImage: "plus").font(.system(size: 13)).padding(.horizontal, 14).frame(height: 34).overlay(Capsule().stroke(Palette.line)) }.foregroundStyle(Palette.text2) }
            ForEach(Array(model.state.people.prefix(3).enumerated()), id: \.element.id) { i, p in
                Button { toggle(p) } label: {
                    HStack(spacing: 7) { OverlayMark(shape: i % 3).frame(width: 10, height: 10); Text(p.name).font(.system(size: 13)) }
                        .padding(.horizontal, 14).frame(height: 34).foregroundStyle(p.overlaySource ? Palette.text : Palette.text3)
                        .overlay(Capsule().stroke(p.overlaySource ? Palette.moon : Palette.line))
                }.accessibilityAddTraits(p.overlaySource ? .isSelected : [])
            }
        }
    }
    func toggle(_ p: Person) {
        guard let i = model.state.people.firstIndex(where: { $0.id == p.id }) else { return }
        if !model.state.people[i].overlaySource, !model.isPlus, model.state.people.filter(\.overlaySource).count >= 1 { model.sheet = .plans; return }
        withAnimation(.snappy) { model.state.people[i].overlaySource.toggle() }
    }

    var carousel: some View {
        let cardW: CGFloat = 146, gap: CGFloat = 10
        return GeometryReader { g in
            HStack(spacing: gap) {
                ForEach(days) { d in
                    let dist = abs(Double(d.index) - f)
                    DayCard(day: d, selected: d.index == selected, covenNotes: covenNotes(for: d), personal: d.reading.personal)
                        .frame(width: cardW, height: 172).opacity(dist < 0.5 ? 1 : (dist < 1.5 ? 0.62 : 0.3))
                        .onTapGesture {
                            if d.index == selected { model.sheet = .day(d.date) }
                            else { withAnimation(.spring(duration: 0.6, bounce: 0.1)) { rot = -Double(d.index) * step } }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(d.date.formatted(.dateTime.weekday(.wide).day().month(.wide))): \(d.cardTitle)\(d.index == selected ? ". Open the day" : "")")
                        .accessibilityAddTraits(.isButton)
                }
            }
            .offset(x: g.size.width / 2 - cardW / 2 - f * (cardW + gap))
            .animation(dragging ? nil : .spring(duration: 0.65, bounce: 0.08), value: f)
        }.frame(height: 176).clipped()
    }

    func covenNotes(for d: MonthDay) -> [String] {
        model.state.people.filter(\.overlaySource).compactMap { p in overlay[p.id]?[d.index].map { Voice.covenLine(name: p.name, hit: $0, day: d.date) } }
    }

    // MARK: data
    func load() async {
        guard let natal = model.natal else { return }
        let start = monthStart, cal = Calendar.current
        let n = cal.range(of: .day, in: .month, for: start)!.count
        let muted = model.mutedBodies
        let built: [MonthDay] = await Task.detached(priority: .userInitiated) {
            let end = cal.date(byAdding: .day, value: n, to: start)!
            let phases = Sky.moonPhases(from: start, to: end), events = Sky.planetaryEvents(from: start, to: end)
            return (0..<n).map { i in
                let day = cal.date(byAdding: .day, value: i, to: start)!, noon = day.addingTimeInterval(12 * 3600)
                var ev = (phases + events.filter { $0.kind == .stationDirect || $0.kind == .stationRetrograde || ($0.kind == .ingress && $0.title.hasPrefix("Sun")) }).first { cal.isDate($0.date, inSameDayAs: day) }
                if ev?.kind == .firstQuarter || ev?.kind == .lastQuarter { ev = nil }
                return MonthDay(index: i, date: day, elongation: Sky.elongation(JD.from(noon)), reading: Voice.reading(natal: natal, on: day, muted: muted), event: ev)
            }
        }.value
        days = built
        let today = cal.startOfDay(for: Date())
        let idx = monthOffset == 0 ? (cal.dateComponents([.day], from: start, to: today).day ?? 0) : 0
        rot = -Double(min(max(idx, 0), n - 1)) * (360.0 / Double(n))
    }
    func loadOverlay() async {
        let start = monthStart, cal = Calendar.current
        let n = cal.range(of: .day, in: .month, for: start)!.count
        let ppl = model.state.people.filter(\.overlaySource)
        let result: [UUID: [Int: TransitHit]] = await Task.detached(priority: .userInitiated) {
            var out: [UUID: [Int: TransitHit]] = [:]
            for p in ppl {
                let chart = p.chart; var m: [Int: TransitHit] = [:]
                for i in 0..<n {
                    let noon = cal.date(byAdding: .day, value: i, to: start)!.addingTimeInterval(12 * 3600)
                    if let h = Sky.hits(natal: chart, on: noon, maxOrb: 0.6, bodies: AstroKit.Body.slow + [.mars]).first(where: { $0.weight >= 3.8 }) { m[i] = h }
                }
                out[p.id] = m
            }
            return out
        }.value
        overlay = result
    }
}

struct BreathingDot: View {
    @State private var on = false
    var body: some View {
        ZStack {
            Circle().fill(Palette.ember.opacity(0.18)).frame(width: 18, height: 18).scaleEffect(on ? 1.15 : 0.85).opacity(on ? 0.4 : 0.9)
            Circle().fill(Palette.ember).frame(width: 6, height: 6)
        }.onAppear { if !UIAccessibility.isReduceMotionEnabled { withAnimation(.easeInOut(duration: 3.5).repeatForever(autoreverses: true)) { on = true } } }
    }
}

struct OverlayMark: View {
    let shape: Int
    var body: some View {
        Group {
            switch shape {
            case 0: Circle().stroke(Palette.moon, lineWidth: 1.2).frame(width: 9, height: 9)
            case 1: Rectangle().fill(Palette.moon).frame(width: 7, height: 7).rotationEffect(.degrees(45))
            default: Image(systemName: "triangle").font(.system(size: 9, weight: .bold)).foregroundStyle(Palette.moon)
            }
        }
    }
}

struct DayCard: View {
    let day: MonthDay; let selected: Bool; let covenNotes: [String]; let personal: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack { MonoLabel("\(day.date.formatted(.dateTime.weekday(.abbreviated))) \(day.date.formatted(.dateTime.day()))", size: 10, tracking: 1.8); Spacer(); if personal { EmberDot() } }
            Text(day.cardTitle).font(.display(14, .semibold)).foregroundStyle(Palette.text).lineLimit(2).fixedSize(horizontal: false, vertical: true)
            Text(day.reading.headline).font(.system(size: 12)).foregroundStyle(Palette.text3).lineLimit(3)
            if let c = covenNotes.first { Text(c).font(.system(size: 11.5)).foregroundStyle(Palette.moon).lineLimit(2).padding(.top, 6).overlay(alignment: .top) { Hairline() } }
            Spacer(minLength: 0)
        }
        .padding(14).background(Color(white: 0.043), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(selected ? Palette.moon : Palette.hairline, lineWidth: selected ? 1.2 : 1))
    }
}

struct DayDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let date: Date
    @State private var text: String?
    @State private var revealed = 0
    var body: some View {
        let r = model.reading(for: date)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Capsule().fill(Color(white: 0.18)).frame(width: 36, height: 5).frame(maxWidth: .infinity).padding(.top, 8)
                if let r {
                    MonoLabel("\(date.formatted(.dateTime.weekday(.wide).day().month(.wide)))  ·  \(r.phase)", size: 10, tracking: 2)
                    Text(r.headline).font(.display(27, .bold)).tracking(-0.6).foregroundStyle(Palette.text).fixedSize(horizontal: false, vertical: true)
                    Text(r.body).font(.system(size: 15)).lineSpacing(4).foregroundStyle(Palette.text2)
                    VStack(spacing: 0) {
                        detailRow("Moon in \(r.moonSign)", Voice.moonMood[r.moonSign]?.vibe ?? "")
                        if r.personal { HStack(spacing: 10) { EmberDot(); Text("Touches your chart directly").font(.system(size: 14)).foregroundStyle(Palette.text) }.padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading).overlay(alignment: .bottom) { Hairline() } }
                        ForEach(model.state.people.filter(\.overlaySource), id: \.id) { p in
                            if let h = Sky.hits(natal: p.chart, on: date.addingTimeInterval(12 * 3600), maxOrb: 0.6, bodies: AstroKit.Body.slow + [.mars]).first(where: { $0.weight >= 3.8 }) {
                                Text(Voice.covenLine(name: p.name, hit: h, day: date)).font(.system(size: 14)).foregroundStyle(Palette.moon).padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading).overlay(alignment: .bottom) { Hairline() }
                            }
                        }
                    }.overlay(alignment: .top) { Hairline() }
                    if let t = text ?? model.state.roastedDays[DayKey.key(date)] {
                        VStack(alignment: .leading, spacing: 8) {
                            MonoLabel("Your roast · \(date.formatted(.dateTime.weekday(.abbreviated).day()))", color: Palette.ember, size: 10, tracking: 2)
                            Text(t).font(.display(18, .semibold)).lineSpacing(3).foregroundStyle(Palette.text)
                        }.transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                    HStack(spacing: 10) {
                        if let t = text ?? model.state.roastedDays[DayKey.key(date)] {
                            Button("Share this roast") { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { model.share(t, kicker: date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))) } }.buttonStyle(.primary).frame(height: 52)
                        } else {
                            Button("Roast this day") { roast(r) }.buttonStyle(.primary).frame(height: 52)
                        }
                        Button { Task { await CalendarSync.addDay(r) } } label: { Image(systemName: "calendar.badge.plus").font(.system(size: 19)).frame(width: 52, height: 52).overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line)) }.foregroundStyle(Palette.moon).accessibilityLabel("Add this day to your calendar")
                    }.padding(.top, 4)
                }
            }.padding(.horizontal, 24).padding(.bottom, 30)
        }.foregroundStyle(Palette.text)
    }
    func detailRow(_ k: String, _ v: String) -> some View {
        HStack { Text(k).font(.system(size: 14)).foregroundStyle(Palette.text); Spacer(); Text(v).font(.system(size: 14)).foregroundStyle(Palette.text3) }.padding(.vertical, 12).overlay(alignment: .bottom) { Hairline() }
    }
    func roast(_ r: DayReading) {
        guard let n = model.natal else { return }
        let t = Voice.dayRoast(natal: n, reading: r)
        withAnimation(.easeOut(duration: 0.5)) { text = t }
        model.state.roastedDays[DayKey.key(date)] = t
    }
}
