import SwiftUI
import AstroKit

struct YouView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmDelete = false
    @State private var exportURL: URL?
    @State private var showDev = false
    @State private var confirmAccountDelete: String?
    @State private var accountError: String?
    @State private var apiBase = RoastAPI.shared.baseURL.absoluteString

    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if let n = model.natal {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack(alignment: .bottom) {
                                VStack(alignment: .leading, spacing: 4) { MonoLabel("Your chart", size: 11, tracking: 2.4); Text(model.profileName).font(.display(36, .heavy)).tracking(-1).textCase(.uppercase).foregroundStyle(Palette.text) }
                                Spacer()
                                if model.isPlus { Text("ROAST+").font(.mono(10)).tracking(1.6).foregroundStyle(Palette.ink).padding(.horizontal, 10).frame(height: 26).background(Palette.moon, in: Capsule()) }
                            }
                            ChartWheel(chart: n).frame(height: 260).frame(maxWidth: .infinity)
                            HStack(spacing: 8) { PlacementHeader(name: "", sun: n.sunSign, moon: n.moonSign, rising: n.risingSign ?? "—").frame(maxWidth: .infinity) }.hidden().frame(height: 0)
                            HStack { big("Sun", n.sunSign, Zodiac.glyph(n.lon(.sun))); big("Moon", n.moonSign, Zodiac.glyph(n.lon(.moon))); big("Rising", n.risingSign ?? "—", n.ascendant.map { Zodiac.glyph($0) } ?? "") }
                        }
                    }
                    section("Your readings") {
                        row("doc.text", "My roast", model.roast?.paid == true ? "Unlocked" : (model.roast == nil ? "Not yet" : "Teaser")) { if model.roast != nil { model.openRoast = true } else { model.state.onboardingDone = false; model.route = .birth } }
                        link("person.crop.rectangle", "Human Design", model.isPlus ? nil : "Type free", .bodygraph)
                        link("waveform.path.ecg", "Situationships", model.isPlus ? nil : "Roast+", .situations)
                        link("checkmark.seal", "Receipts", nil, .receipts)
                        link("speaker.wave.2", "Sunday roast", model.isPlus ? nil : "Roast+", .sunday)
                        link("text.bubble", "Draft check", model.isPlus ? nil : "Roast+", .draft)
                    }
                    section("Your account") {
                        if model.linked.isEmpty {
                            row("envelope", "Link your email", "Keep every roast together") { model.sheet = .signIn }
                        } else {
                            ForEach(model.linked, id: \.self) { e in
                                Menu {
                                    Button("Sign out", role: .destructive) { model.signOut(e) }
                                    Button("Delete my account…", role: .destructive) { confirmAccountDelete = e }
                                } label: { HStack { Image(systemName: "envelope.fill").frame(width: 24); Text(e).font(.system(size: 16)).lineLimit(1); Spacer(); Image(systemName: "ellipsis").font(.system(size: 13)).foregroundStyle(Palette.text3) }.foregroundStyle(Palette.text).padding(.vertical, 13).overlay(alignment: .top) { Hairline() } }
                            }
                            row("plus.circle", "Link another email", "") { model.sheet = .signIn }
                        }
                        link("rectangle.stack", "My roasts", model.allRoasts.isEmpty ? nil : "\(model.allRoasts.count)", .roasts)
                    }
                    section("Settings") {
                        row("calendar", "Calendar sync", model.state.calendar.enabled ? "On" : "Off") { model.sheet = .calendar }
                        notifRow
                        row("sparkles", model.isPlus ? "Roast+ active" : "Get Roast+", model.isPlus ? "" : "7 days free") { model.sheet = .plans }
                        row("arrow.clockwise", "Restore purchases", "") { Task { await model.purchases.restore() } }
                    }
                    section("Your data") {
                        if let exportURL { ShareLink(item: exportURL) { HStack { Image(systemName: "square.and.arrow.up").frame(width: 24); Text("Export my data").font(.system(size: 16)); Spacer() }.foregroundStyle(Palette.text).padding(.vertical, 13) } }
                        else { row("square.and.arrow.up", "Export my data", "") { exportURL = makeExport() } }
                        row("trash", "Delete everything", "", destructive: true) { confirmDelete = true }
                        Link(destination: URL(string: "https://astroroast.com/privacy")!) { HStack { Image(systemName: "hand.raised").frame(width: 24); Text("Privacy").font(.system(size: 16)); Spacer() }.foregroundStyle(Palette.text).padding(.vertical, 13) }
                        Link(destination: URL(string: "https://astroroast.com/terms")!) { HStack { Image(systemName: "doc.plaintext").frame(width: 24); Text("Terms").font(.system(size: 16)); Spacer() }.foregroundStyle(Palette.text).padding(.vertical, 13) }
                    }
                    Text("ASTROROAST \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")").font(.mono(10)).tracking(1.6).foregroundStyle(Palette.text3).frame(maxWidth: .infinity).onTapGesture(count: 5) { showDev = true }
                    if showDev {
                        VStack(alignment: .leading, spacing: 8) {
                            MonoLabel("Developer", size: 10)
                            TextField("API base", text: $apiBase).textInputAutocapitalization(.never).autocorrectionDisabled().padding(10).background(Palette.surface2, in: RoundedRectangle(cornerRadius: 10))
                            Button("Use this API") { UserDefaults.standard.set(apiBase, forKey: "apiBase"); if let u = URL(string: apiBase) { RoastAPI.shared.baseURL = u } }.buttonStyle(.ghost)
                        }
                    }
                }.padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 30)
            }.scrollIndicators(.hidden)
        }
        .toolbar(.hidden, for: .navigationBar)
        .confirmationDialog("Delete your account?", isPresented: Binding(get: { confirmAccountDelete != nil }, set: { if !$0 { confirmAccountDelete = nil } }), titleVisibility: .visible) {
            Button("Delete my account", role: .destructive) { if let e = confirmAccountDelete { Task { do { try await model.deleteAccount(e) } catch { accountError = (error as? LocalizedError)?.errorDescription } } } }
        } message: { Text("This unlinks your email from every roast and signs you out here. Roast pages that someone already holds a private link to keep working.") }
        .alert("Couldn't delete", isPresented: Binding(get: { accountError != nil }, set: { if !$0 { accountError = nil } })) { Button("OK", role: .cancel) {} } message: { Text(accountError ?? "") }
        .confirmationDialog("Delete your profile, people and roasts from this phone?", isPresented: $confirmDelete, titleVisibility: .visible) { Button("Delete everything", role: .destructive) { model.resetEverything() } } message: { Text("Roasts you've bought stay on our servers; paste the link to bring one back.") }
    }

    var notifRow: some View {
        Menu {
            Picker("Notifications", selection: Binding(get: { model.state.notifications.level }, set: { l in model.state.notifications.level = l; Task { if l != .never { _ = await Notifications.requestAuthorization() }; await Notifications.reschedule(model) } })) {
                Text("Only the big ones").tag(NotificationPrefs.Level.big); Text("Big ones + Coven clashes").tag(NotificationPrefs.Level.bigPlusCoven); Text("Never. Widget only.").tag(NotificationPrefs.Level.never)
            }
        } label: { HStack { Image(systemName: "bell").frame(width: 24); Text("Notifications").font(.system(size: 16)); Spacer(); Text(["Big ones", "Big + Coven", "Off"][model.state.notifications.level.rawValue]).font(.system(size: 14)).foregroundStyle(Palette.text3); Image(systemName: "chevron.up.chevron.down").font(.system(size: 10)).foregroundStyle(Palette.text3) }.foregroundStyle(Palette.text).padding(.vertical, 13) }
    }
    func big(_ k: String, _ v: String, _ g: String) -> some View {
        VStack(alignment: .leading, spacing: 4) { MonoLabel(k, color: Palette.ember, size: 9, tracking: 1.6); Text("\(g) \(v)").font(.display(16, .semibold)).foregroundStyle(Palette.text).lineLimit(1).minimumScaleFactor(0.7) }.frame(maxWidth: .infinity, alignment: .leading)
    }
    func section<C: View>(_ t: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) { MonoLabel(t, size: 10, tracking: 2.2).padding(.bottom, 4); VStack(spacing: 0) { c() } }
    }
    func row(_ icon: String, _ title: String, _ trailing: String, destructive: Bool = false, tap: @escaping () -> Void) -> some View {
        Button(action: tap) { HStack { Image(systemName: icon).frame(width: 24); Text(title).font(.system(size: 16)); Spacer(); Text(trailing).font(.system(size: 14)).foregroundStyle(Palette.text3); Image(systemName: "chevron.right").font(.system(size: 11)).foregroundStyle(Palette.text3) }.foregroundStyle(destructive ? Palette.emberSoft : Palette.text).padding(.vertical, 13).overlay(alignment: .top) { Hairline() } }
    }
    func link(_ icon: String, _ title: String, _ note: String?, _ d: Dest) -> some View {
        NavigationLink(value: d) { HStack { Image(systemName: icon).frame(width: 24); Text(title).font(.system(size: 16)); Spacer(); if let note { Text(note).font(.system(size: 13)).foregroundStyle(note == "Roast+" ? Palette.emberSoft : Palette.text3) }; Image(systemName: "chevron.right").font(.system(size: 11)).foregroundStyle(Palette.text3) }.foregroundStyle(Palette.text).padding(.vertical, 13).overlay(alignment: .top) { Hairline() } }
    }
    func makeExport() -> URL? {
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]; enc.dateEncodingStrategy = .iso8601
        guard let d = try? enc.encode(model.state) else { return nil }
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("astroroast-data.json"); try? d.write(to: u); return u
    }
}

struct CalendarSyncView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var calendars: [(id: String, title: String, source: String)] = []
    @State private var planned: [CalendarSync.Planned] = []
    @State private var status: String?
    @State private var icsURL: URL?
    @State private var busy = false

    var body: some View {
        @Bindable var m = model
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack { Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Close"); Spacer(); MonoLabel("Calendar"); Spacer(); Spacer().frame(width: 44) }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Put the cosmos in your diary.").font(.display(30, .bold)).tracking(-0.8).foregroundStyle(Palette.text)
                        Text("Only the big ones. If it wouldn't change your plans, it doesn't get a slot.").font(.system(size: 14)).foregroundStyle(Palette.text2)
                    }
                    FormGroup(label: "Where it goes") {
                        if calendars.isEmpty {
                            Button { Task { await connect() } } label: { HStack { Image(systemName: "calendar"); Text("Connect your calendar").font(.system(size: 16)); Spacer(); Image(systemName: "chevron.right").font(.system(size: 11)).foregroundStyle(Palette.text3) }.padding(.horizontal, 16).frame(minHeight: 52).foregroundStyle(Palette.text) }
                        } else {
                            ForEach(Array(calendars.enumerated()), id: \.offset) { i, c in
                                if i > 0 { Hairline() }
                                Button { m.state.calendar.calendarID = c.id } label: { HStack { VStack(alignment: .leading, spacing: 2) { Text(c.title).font(.system(size: 16)); Text(c.source).font(.system(size: 12)).foregroundStyle(Palette.text3) }; Spacer(); if (m.state.calendar.calendarID ?? calendars.first?.id) == c.id { Image(systemName: "checkmark").foregroundStyle(Palette.moon) } }.padding(.horizontal, 16).frame(minHeight: 52).foregroundStyle(Palette.text) }
                            }
                        }
                    }
                    FormGroup(label: "What gets in") {
                        toggleRow("New + Full Moons", $m.state.calendar.moons, locked: false); Hairline()
                        toggleRow("Retrogrades + stations", $m.state.calendar.retrogrades, locked: !model.isPlus); Hairline()
                        toggleRow("Transits to your chart", $m.state.calendar.transits, locked: !model.isPlus); Hairline()
                        toggleRow("Coven clashes", $m.state.calendar.coven, locked: !model.isPlus)
                    }
                    Text("\(planned.count) events in the next 90 days. All-day, no alerts unless you add one.").font(.system(size: 12)).foregroundStyle(Palette.text3).padding(.horizontal, 16).padding(.top, -10)
                    if let e = planned.first {
                        VStack(alignment: .leading, spacing: 8) {
                            MonoLabel("How it lands", size: 10, tracking: 2)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(e.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))) · all-day · AstroRoast").font(.system(size: 12)).foregroundStyle(Color(white: 0.35))
                                Text(e.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(.black)
                                Text(e.notes).font(.system(size: 13)).foregroundStyle(Color(white: 0.27)).lineSpacing(2)
                            }.padding(.leading, 18).padding(14).frame(maxWidth: .infinity, alignment: .leading).background(.white, in: RoundedRectangle(cornerRadius: 14)).overlay(alignment: .leading) { RoundedRectangle(cornerRadius: 2).fill(Palette.ember).frame(width: 4).padding(.vertical, 12).padding(.leading, 6) }
                        }
                    }
                    VStack(spacing: 10) {
                        Button { Task { await sync() } } label: { if busy { ProgressView().tint(Palette.ink) } else { Text(model.state.calendar.enabled ? "Update my calendar" : "Add to my calendar") } }.buttonStyle(.primary).disabled(busy || planned.isEmpty)
                        Button { if let u = URL(string: "webcal://astroroast.com/calendar/sky.ics") { UIApplication.shared.open(u) } } label: { Label("Subscribe to the sky calendar", systemImage: "calendar.badge.plus").frame(maxWidth: .infinity).frame(height: 50) }.buttonStyle(.ghost)
                        Text("Moons, eclipses, retrogrades and sign changes for everyone. On Google Calendar: Other calendars, From URL, paste https://astroroast.com/calendar/sky.ics.").font(.system(size: 12)).foregroundStyle(Palette.text3).multilineTextAlignment(.center)
                        if let icsURL { ShareLink(item: icsURL) { Label("Export .ics for Google or Outlook", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity).frame(height: 50) }.buttonStyle(.ghost) }
                        if model.state.calendar.enabled { Button("Remove AstroRoast events") { Task { await CalendarSync.removeAll(); m.state.calendar.enabled = false; status = "Removed." } }.font(.system(size: 14)).foregroundStyle(Palette.text3) }
                        if let status { Text(status).font(.system(size: 13)).foregroundStyle(Palette.moon) }
                    }
                }.padding(.horizontal, 20).padding(.bottom, 30)
            }.scrollIndicators(.hidden)
        }.foregroundStyle(Palette.text)
        .task { refreshPlan(); await connectIfGranted() }
        .onChange(of: model.state.calendar) { _, _ in refreshPlan() }
    }
    func toggleRow(_ t: String, _ b: Binding<Bool>, locked: Bool) -> some View {
        Toggle(isOn: locked ? .constant(false) : b) { HStack { Text(t).font(.system(size: 16)); if locked { Text("Roast+").font(.mono(9)).foregroundStyle(Palette.emberSoft) } } }.tint(Palette.moon).frame(minHeight: 50).padding(.horizontal, 16)
            .overlay { if locked { Color.clear.contentShape(Rectangle()).onTapGesture { model.sheet = .plans } } }
    }
    func refreshPlan() {
        guard let n = model.natal else { return }
        var p = model.state.calendar; if !model.isPlus { p.retrogrades = false; p.transits = false; p.coven = false }
        let natal = n, people = model.state.people
        Task.detached(priority: .userInitiated) {
            let pl = CalendarSync.plan(natal: natal, prefs: p, people: people)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("astroroast.ics")
            try? CalendarSync.ics(planned: pl).write(to: url, atomically: true, encoding: .utf8)
            await MainActor.run { planned = pl; icsURL = url }
        }
    }
    func connect() async { if await CalendarSync.requestAccess() { loadCalendars() } else { status = "Calendar access is off. Turn it on in Settings, or export the .ics instead." } }
    func connectIfGranted() async { loadCalendars() }
    func loadCalendars() { calendars = CalendarSync.writableCalendars().map { ($0.calendarIdentifier, $0.title, $0.source.title) } }
    func sync() async {
        busy = true; defer { busy = false }
        guard await CalendarSync.requestAccess() else { status = "Calendar access is off. Export the .ics instead."; return }
        loadCalendars()
        let n = await CalendarSync.sync(planned: planned, calendarID: model.state.calendar.calendarID ?? calendars.first?.id)
        model.state.calendar.enabled = n > 0; status = n > 0 ? "Added \(n) events." : "Nothing was added."
    }
}

struct BodygraphView: View {
    @Environment(AppModel.self) private var model
    @State private var hd: HDChart?
    @State private var focus: HDCenter?

    static let layout: [HDCenter: (CGPoint, String)] = [
        .head: (CGPoint(x: 150, y: 34), "tri-up"), .ajna: (CGPoint(x: 150, y: 100), "tri-down"), .throat: (CGPoint(x: 150, y: 170), "sq"), .g: (CGPoint(x: 150, y: 256), "dia"),
        .heart: (CGPoint(x: 214, y: 236), "tri-r"), .sacral: (CGPoint(x: 150, y: 356), "sq"), .spleen: (CGPoint(x: 62, y: 336), "tri-l"), .solar: (CGPoint(x: 238, y: 336), "tri-r"), .root: (CGPoint(x: 150, y: 436), "sq")
    ]

    var body: some View {
        ZStack {
            ScreenBackground()
            if let hd {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) { MonoLabel("Human Design · \(model.profileName)", size: 11, tracking: 2.2); Text("The wiring diagram").font(.display(32, .heavy)).tracking(-0.8).textCase(.uppercase).foregroundStyle(Palette.text) }
                        Canvas { ctx, size in draw(ctx, size, hd) }.frame(height: 480).frame(maxWidth: .infinity)
                            .accessibilityLabel("Bodygraph. Defined centers: \(hd.defined.map(\.rawValue).sorted().joined(separator: ", ")).")
                        HStack(spacing: 0) { stat("Type", hd.type); stat("Authority", hd.authority); stat("Profile", hd.profile) }.overlay(alignment: .top) { Hairline() }.overlay(alignment: .bottom) { Hairline() }
                        Text(HumanDesign.typeRoast(hd.type)).font(.display(20, .semibold)).lineSpacing(2).foregroundStyle(Palette.text)
                        Text("\(HumanDesign.strategyRoast(hd.type)) \(HumanDesign.authorityRoast(hd.authority))").font(.system(size: 14)).lineSpacing(4).foregroundStyle(Palette.text2)
                        PlusGate(title: "Every center, roasted", blurb: "Open and defined centers, channels and the rest of the diagram, each with a joke.") {
                            VStack(spacing: 0) {
                                ForEach(HDCenter.allCases, id: \.self) { c in
                                    let d = hd.defined.contains(c)
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack { Text(c.rawValue).font(.system(size: 15, weight: .semibold)); Spacer(); MonoLabel(d ? "Defined" : "Open", color: d ? Palette.moon : Palette.text3, size: 9, tracking: 1.5) }
                                        Text(HumanDesign.centerRoast(c, defined: d)).font(.system(size: 14)).foregroundStyle(Palette.text2).lineSpacing(3)
                                    }.padding(.vertical, 12).overlay(alignment: .top) { Hairline() }
                                }
                            }.frame(minHeight: 300)
                        }.frame(minHeight: 340)
                        Text("Calculated from your birth moment and the position of the Sun 88° earlier.").font(.system(size: 12)).foregroundStyle(Palette.text3)
                    }.padding(.horizontal, 22).padding(.bottom, 30).foregroundStyle(Palette.text)
                }.scrollIndicators(.hidden)
            } else { ProgressView().tint(Palette.text2) }
        }
        .navigationTitle("Human Design").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
        .task { if let b = model.state.profile { let c = await Task.detached { HumanDesign.chart(for: b) }.value; hd = c } }
    }
    func stat(_ k: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 4) { MonoLabel(k, size: 9, tracking: 1.6); Text(v).font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.text).lineLimit(2).minimumScaleFactor(0.7) }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12).padding(.leading, 4)
    }
    func draw(_ ctx: GraphicsContext, _ size: CGSize, _ hd: HDChart) {
        let sx = size.width / 300, sy = size.height / 470
        func P(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x * sx, y: p.y * sy + 8) }
        let moon = Color(red: 217/255, green: 212/255, blue: 204/255), ember = Color(red: 1, green: 74/255, blue: 28/255)
        // channels
        var pairCount: [String: Int] = [:]
        for ch in HumanDesign.channelList {
            guard let a = HumanDesign.centerOf[ch[0]], let b = HumanDesign.centerOf[ch[1]], let pa = Self.layout[a]?.0, let pb = Self.layout[b]?.0 else { continue }
            let key = "\(a.rawValue)-\(b.rawValue)"; let k = pairCount[key, default: 0]; pairCount[key] = k + 1
            let on = hd.channels.contains(ch)
            var path = Path(); let off = CGFloat(k) * 7 - 3
            path.move(to: P(CGPoint(x: pa.x + off, y: pa.y))); path.addLine(to: P(CGPoint(x: pb.x + off, y: pb.y)))
            ctx.stroke(path, with: .color(on ? moon : Color(white: 0.14)), style: StrokeStyle(lineWidth: on ? 2.6 : 1.2, lineCap: .round))
        }
        for c in HDCenter.allCases {
            guard let (pt, shape) = Self.layout[c] else { continue }
            let p = P(pt), r: CGFloat = 26 * sx
            var path = Path()
            switch shape {
            case "sq": path.addRoundedRect(in: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r), cornerSize: CGSize(width: 5, height: 5))
            case "dia": path.move(to: CGPoint(x: p.x, y: p.y - r * 1.1)); path.addLine(to: CGPoint(x: p.x + r * 1.1, y: p.y)); path.addLine(to: CGPoint(x: p.x, y: p.y + r * 1.1)); path.addLine(to: CGPoint(x: p.x - r * 1.1, y: p.y)); path.closeSubpath()
            case "tri-up": path.move(to: CGPoint(x: p.x, y: p.y - r)); path.addLine(to: CGPoint(x: p.x + r * 1.1, y: p.y + r * 0.8)); path.addLine(to: CGPoint(x: p.x - r * 1.1, y: p.y + r * 0.8)); path.closeSubpath()
            case "tri-down": path.move(to: CGPoint(x: p.x, y: p.y + r)); path.addLine(to: CGPoint(x: p.x + r * 1.1, y: p.y - r * 0.8)); path.addLine(to: CGPoint(x: p.x - r * 1.1, y: p.y - r * 0.8)); path.closeSubpath()
            case "tri-l": path.move(to: CGPoint(x: p.x - r, y: p.y)); path.addLine(to: CGPoint(x: p.x + r * 0.8, y: p.y - r * 1.1)); path.addLine(to: CGPoint(x: p.x + r * 0.8, y: p.y + r * 1.1)); path.closeSubpath()
            default: path.move(to: CGPoint(x: p.x + r, y: p.y)); path.addLine(to: CGPoint(x: p.x - r * 0.8, y: p.y - r * 1.1)); path.addLine(to: CGPoint(x: p.x - r * 0.8, y: p.y + r * 1.1)); path.closeSubpath()
            }
            let d = hd.defined.contains(c)
            ctx.fill(path, with: .color(d ? moon : Color(white: 0.04)))
            ctx.stroke(path, with: .color(d ? moon : (c == .head ? ember : Color(white: 0.25))), lineWidth: 1.3)
        }
    }
}
