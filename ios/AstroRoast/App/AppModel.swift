import SwiftUI
import AstroKit
import ActivityKit
import WidgetKit

struct BirthDraft {
    var name = ""
    var gender = "woman"
    var day = "", month = "", year = ""
    var hour = "", minute = ""
    var timeKnown = true
    var place: PlaceResult?

    var dayI: Int? { Int(day) }
    var monthI: Int? { Int(month) }
    var yearI: Int? { Int(year) }
    var dateValid: Bool {
        guard let d = dayI, let m = monthI, let y = yearI, (1900...2099).contains(y), (1...12).contains(m), (1...31).contains(d) else { return false }
        var c = DateComponents(); c.year = y; c.month = m; c.day = d
        let cal = Calendar(identifier: .gregorian)
        guard let date = cal.date(from: c), cal.component(.day, from: date) == d else { return false }
        return date <= Date()
    }
    var timeValid: Bool { !timeKnown || ((Int(hour) ?? -1) >= 0 && (Int(hour) ?? 99) <= 23 && (Int(minute) ?? -1) >= 0 && (Int(minute) ?? 99) <= 59 && !hour.isEmpty && !minute.isEmpty) }
    var valid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty && dateValid && timeValid && place != nil }

    func birth() -> BirthData? {
        guard valid, let p = place, let y = yearI, let m = monthI, let d = dayI else { return nil }
        return BirthData.make(name: name.trimmingCharacters(in: .whitespaces), year: y, month: m, day: d,
                              hour: timeKnown ? Int(hour) : nil, minute: timeKnown ? Int(minute) : nil,
                              latitude: p.lat, longitude: p.lon, timeZoneID: p.tzID, placeName: p.name, countryName: p.country)
    }
}

@MainActor @Observable
final class AppModel {
    enum Route { case welcome, birth, rising, warmup, generating, teaser, main }

    var state: AppState { didSet { guard !demo else { return }; Persistence.save(state); WidgetCenter.shared.reloadAllTimelines() } }
    var route: Route
    var draft = BirthDraft()
    var roast: RoastPayload?
    var generationError: String?
    var openRoast = false
    var tab = 0
    var linked: [String] = []                 // signed-in emails
    var cloud: [CloudRoast] = []
    @ObservationIgnored private var memTokens: [String: String] = [:]   // demo mode never touches the Keychain
    var deepLink: String?
    var sheet: Sheet?
    var path = NavigationPath()
    @ObservationIgnored private var readingCache: [String: DayReading] = [:]

    enum Sheet: Identifiable {
        case plans, calendar, anyone, addPerson, day(Date), share(ShareContent), adopt, widgets, signIn
        var id: String {
            switch self { case .plans: "plans"; case .calendar: "calendar"; case .anyone: "anyone"; case .addPerson: "addPerson"; case .day(let d): "day\(d.timeIntervalSince1970)"; case .share(let c): "share\(c.id)"; case .adopt: "adopt"; case .widgets: "widgets"; case .signIn: "signIn" }
        }
    }

    var mutedBodies: Set<AstroKit.Body> { Set(state.mutedTransitBodies.compactMap { AstroKit.Body(rawValue: $0) }) }
    func reading(for date: Date) -> DayReading? {
        guard let natal else { return nil }
        let k = DayKey.key(date) + "m\(state.mutedTransitBodies.count)"
        if let r = readingCache[k] { return r }
        let r = Voice.reading(natal: natal, on: date, muted: mutedBodies)
        readingCache[k] = r; return r
    }
    var today: DayReading? { reading(for: Date()) }
    func mute(_ b: AstroKit.Body) { if !state.mutedTransitBodies.contains(b.rawValue) { state.mutedTransitBodies.append(b.rawValue) }; readingCache = [:] }
    func share(_ text: String, kicker: String, footer: String? = nil) { sheet = .share(ShareContent(text: text, kicker: kicker, footer: footer ?? "\(profileName) · astroroast.com")) }
    func requirePlusOverlay(_ id: UUID) {
        guard let i = state.people.firstIndex(where: { $0.id == id }) else { return }
        if !state.people[i].overlaySource, !isPlus, state.people.filter(\.overlaySource).count >= 1 { sheet = .plans; return }
        state.people[i].overlaySource.toggle()
    }
    func requirePlus(_ then: () -> Void) { if isPlus { then() } else { sheet = .plans } }
    var generationStart = Date()
    var statusIndex = 0
    var natal: NatalChart?
    let purchases = Purchases()
    let demo: Bool
    private var pollTask: Task<Void, Never>?
    private var activity: Activity<RoastActivityAttributes>?

    static let statuses = [
        "Locating your planets…", "Working out where everyone ended up…", "Checking in with the Moon. She has feelings about this…",
        "Consulting Saturn. Saturn is being Saturn…", "Measuring your potential. It's considerable…", "Asking Mercury about that thing you said in 2019…",
        "Counting your placements. Some good ones in here…", "Translating your life into degrees and minutes…", "Letting your rising sign know we're on our way…",
        "Asking Venus what she thinks. She's smiling…", "Pulling out your chart. It has its own gravity…", "Checking three planets agree. They do…",
        "Having a word with your inner child. They're thrilled…", "Writing it up. Keeping all the good bits…", "Finding the funny part. There are several…",
        "Sealing the chart. The universe signs in ember…", "Almost done. You'll like this more than you expect…"
    ]

    init(demo: Bool) {
        self.demo = demo
        // Demo mode (-demo) is sample data in memory only: it never reads or writes the real profile on disk.
        let s = demo ? (CommandLine.arguments.contains("-fresh") ? AppState() : DemoData.state()) : (CommandLine.arguments.contains("-resetstate") ? AppState() : Persistence.load())
        state = s
        route = s.onboardingDone ? .main : .welcome
        natal = s.profile.map { NatalChart(birth: $0) }
        roast = s.currentRoast
        if CommandLine.arguments.contains("-resetstate") { Keychain.accounts().forEach { Keychain.remove($0) } }   // clean slate for tests
        linked = demo ? [] : Keychain.accounts()
        recordOpen()
        applyDebugArguments()
        if !linked.isEmpty { Task { await refreshCloud() } }
    }

    /// Debug aids for design review: -route <welcome|birth|rising|warmup|generating|teaser|main>, -tab <today|month|coven|you>, -open <screen>
    private func applyDebugArguments() {
        let a = CommandLine.arguments
        func arg(_ k: String) -> String? { a.firstIndex(of: k).flatMap { $0 + 1 < a.count ? a[$0 + 1] : nil } }
        if let r = arg("-route") {
            let map: [String: Route] = ["welcome": .welcome, "birth": .birth, "rising": .rising, "warmup": .warmup, "generating": .generating, "teaser": .teaser, "main": .main]
            if let route = map[r] { self.route = route }
            if route == .generating { generationStart = Date().addingTimeInterval(-70) }
        }
        if let t = arg("-tab") { tab = ["today": 0, "month": 1, "coven": 2, "you": 3][t] ?? 0 }
        deepLink = arg("-open")
    }

    var profileName: String { state.profile?.name ?? "You" }
    var isPlus: Bool { purchases.isPlus || demo }

    func recordOpen() {
        let k = DayKey.key(Date())
        if !state.openedDays.contains(k) { state.openedDays.append(k); state.openedDays = Array(state.openedDays.suffix(400)) }
    }
    var streak: Int {
        let cal = Calendar.current
        let set = Set(state.openedDays)
        var n = 0, d = Date()
        while set.contains(DayKey.key(d)) { n += 1; d = cal.date(byAdding: .day, value: -1, to: d)! }
        return n
    }

    // MARK: onboarding
    func submitBirth() {
        guard let b = draft.birth() else { return }
        state.profile = b
        state.gender = draft.gender
        state.timeAssumed = false
        readingCache = [:]
        natal = NatalChart(birth: b)
        route = b.timeKnown ? .warmup : .rising
    }

    /// Unknown birth time: the user picked which rising sign hurt more. We assume a time inside that window.
    func chooseRising(early: Bool) {
        guard var b = state.profile, let c = natal?.risingCandidates() else { route = .warmup; return }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = b.timeZone
        let start = cal.startOfDay(for: b.instant)
        let minutes = early ? max(30, c.flipLocalMinutes - 120) : min(1400, c.flipLocalMinutes + 120)
        b.instant = start.addingTimeInterval(Double(minutes) * 60)
        b.timeKnown = true            // locally; the server still gets "no time"
        state.timeAssumed = true
        state.profile = b
        natal = NatalChart(birth: b)
        route = .warmup
    }

    /// Adopted web roasts are already written; everything else needs generating.
    func afterWarmup() {
        if let r = roast, r.isReady, r.id != "demo" { upsert(r); completeOnboarding() } else { startGeneration() }
    }

    func startGeneration() {
        guard let b = state.profile else { return }
        generationError = nil; generationStart = Date(); statusIndex = 0
        route = .generating
        pollTask?.cancel()
        startActivity()
        if demo { simulateDemoGeneration(); return }
        pollTask = Task { [weak self] in
            guard let self else { return }
            do {
                var person = RoastAPI.person(b, gender: state.gender)
                if state.timeAssumed { person.time = nil }   // an unknown birth time stays unknown on the server
                let id = try await RoastAPI.shared.generate(person: person, email: linked.first)
                var r = RoastPayload(id: id, name: b.name, status: "generating", kind: "solo")
                roast = r; state.currentRoast = r
                var misses = 0
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(3))
                    do {
                        r = try await RoastAPI.shared.fetch(id: id); misses = 0
                    } catch { misses += 1; if misses > 8 { throw error }; continue }
                    roast = r
                    await updateActivity(pct: Self.pct(r, since: generationStart), ready: r.isReady)
                    if r.status == "error" { throw APIError.badStatus(500, "The planets refused to cooperate. Try again.") }
                    if r.isReady { state.currentRoast = r; upsert(r); finishGeneration(); return }
                }
            } catch {
                generationError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                await endActivity()
            }
        }
    }
    static func pct(_ r: RoastPayload, since: Date) -> Int {
        let est = min(92, Int(Date().timeIntervalSince(since) / 150 * 100))
        return r.isReady ? 100 : max(r.stagePct ?? 0, est)
    }
    func cycleStatus() { statusIndex = (statusIndex + 1) % Self.statuses.count }

    func finishGeneration() {
        Task { await endActivity() }
        route = state.onboardingDone ? .main : .teaser
    }
    func completeOnboarding() { state.onboardingDone = true; route = .main; Task { await Notifications.rescheduleIfAllowed(self) } }

    func upsert(_ r: RoastPayload) {
        if let i = state.roasts.firstIndex(where: { $0.id == r.id }) { state.roasts[i] = r } else { state.roasts.insert(r, at: 0) }
        if state.currentRoast?.id == r.id { state.currentRoast = r }
    }

    /// "I already have a roast" (bought on the web): paste the link or id.
    func adopt(text: String) async throws {
        guard let id = RoastAPI.roastID(from: text) else { throw APIError.notFound }
        let r = try await RoastAPI.shared.fetch(id: id)
        guard r.isReady else { throw APIError.badStatus(409, "That roast is still cooking.") }
        roast = r; state.currentRoast = r; upsert(r)
    }

    func refreshRoast() async {
        guard let id = roast?.id ?? state.currentRoast?.id, !demo, let r = try? await RoastAPI.shared.fetch(id: id), r.isReady else { return }
        roast = r; upsert(r)
    }

    /// After a purchase: tell the server, then pull the paid payload.
    func unlockCurrentRoast(jws: String?) async {
        guard var r = roast else { return }
        if demo || r.isDemo == true { r.paid = true; r.fullText = r.fullText ?? DemoData.fullText(for: r.name); roast = r; upsert(r); return }
        if let jws, (try? await RoastAPI.shared.unlock(roastID: r.id, signedTransaction: jws)) == true { await refreshRoast() }
        else { state.unlockedRoastIDs.append(r.id); r.paid = true; roast = r; upsert(r) }   // optimistic local flag; server payload follows on next refresh
    }

    /// Buys the full roast (own roast) via StoreKit, then unlocks it on the server.
    func buyRoast() async {
        guard let r = roast else { return }
        if demo || r.isDemo == true { await unlockCurrentRoast(jws: nil); return }
        if isPlus, let jws = await purchases.plusJWS() { await unlockCurrentRoast(jws: jws); return }
        if let jws = await purchases.buy(Purchases.ID.roast, roastID: r.id) { await unlockCurrentRoast(jws: jws) }
    }

    /// Starts a server roast for someone else (solo or couple) and follows it until it's ready. Returns the final payload.
    func roastOther(_ people: [Person], relationship: String?) async throws -> RoastPayload {
        if demo {
            try? await Task.sleep(for: .seconds(2))
            let b = people.last!.birth
            var r = DemoData.roast(for: b, paid: false); r.id = "demo-\(UUID().uuidString.prefix(6))"; r.name = b.name
            upsert(r); return r
        }
        let id: String
        if people.count == 1 { id = try await RoastAPI.shared.generate(person: RoastAPI.person(people[0].birth, gender: "non-binary"), email: linked.first) }
        else { id = try await RoastAPI.shared.generateGroup(kind: "couple", people: people.enumerated().map { RoastAPI.person($0.element.birth, gender: $0.offset == 0 ? state.gender : "non-binary") }, relationship: relationship) }
        var misses = 0
        for _ in 0..<80 {
            try? await Task.sleep(for: .seconds(3))
            do {
                let r = try await RoastAPI.shared.fetch(id: id); misses = 0
                if r.status == "error" { throw APIError.badStatus(500, "The planets refused to cooperate.") }
                if r.isReady { upsert(r); return r }
            } catch let e as APIError { misses += 1; if misses > 6 { throw e } } catch { misses += 1 }
        }
        throw APIError.badStatus(504, "That one's taking a while. Check back in a minute.")
    }

    // MARK: accounts

    private func token(for email: String) -> String? { demo ? memTokens[email] : Keychain.get(email) }
    var allRoasts: [RoastPayload] {
        var byID: [String: RoastPayload] = [:]
        for r in state.roasts { byID[r.id] = r }
        for c in cloud { byID[c.roast.id] = c.roast }
        return byID.values.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    }

    func requestCode(email: String) async throws { try await RoastAPI.shared.authStart(email: email) }

    /// Verifies the code, keeps the token, pulls every roast on that email, and attaches roasts made on this phone before signing in.
    func signIn(email: String, code: String) async throws -> [CloudRoast] {
        let token = try await RoastAPI.shared.authVerify(email: email, code: code)
        if demo { memTokens[email] = token } else { Keychain.set(token, for: email) }
        if !linked.contains(email) { linked.append(email); linked.sort() }
        await refreshCloud()
        for r in state.roasts where r.isDemo != true && !cloud.contains(where: { $0.id == r.id }) {
            if (try? await RoastAPI.shared.claim(roastID: r.id, token: token)) != nil { await refreshCloud() }
        }
        return cloud
    }

    func refreshCloud() async {
        var all: [CloudRoast] = []
        for email in linked {
            guard let t = token(for: email) else { continue }
            do { all += try await RoastAPI.shared.listRoasts(token: t) }
            catch APIError.unauthorized { signOut(email) }
            catch { continue }
        }
        var seen = Set<String>()
        // roasts that failed to generate are not shown (they have no text and can't be opened)
        cloud = CloudRoast.visible(all).filter { seen.insert($0.id).inserted }.sorted { ($0.roast.createdAt ?? "") > ($1.roast.createdAt ?? "") }
        for c in cloud { upsert(c.roast) }
    }

    func signOut(_ email: String) {
        if demo { memTokens[email] = nil } else { Keychain.remove(email) }
        linked.removeAll { $0 == email }
        cloud = []
        if !linked.isEmpty { Task { await refreshCloud() } }
    }

    func deleteAccount(_ email: String) async throws {
        if let t = token(for: email) { try await RoastAPI.shared.deleteAccount(token: t) }
        signOut(email)
    }

    /// Makes someone the person this phone is about, using the birth details saved with their roast. Returns false if the place couldn't be found.
    func adoptProfile(from c: CloudRoast) async -> Bool {
        let d = c.birth.date.split(separator: "-").compactMap { Int($0) }
        guard d.count == 3 else { return false }
        let t = c.birth.time?.split(separator: ":").compactMap { Int($0) }
        guard let place = await PlaceSearch.geocode(c.birth.place),
              let b = BirthData.make(name: c.birth.name, year: d[0], month: d[1], day: d[2], hour: t?.first, minute: (t?.count ?? 0) > 1 ? t?[1] : nil,
                                     latitude: place.lat, longitude: place.lon, timeZoneID: place.tzID, placeName: place.name, countryName: place.country) else { return false }
        state.profile = b; state.gender = c.birth.gender ?? state.gender; state.timeAssumed = b.timeKnown == false
        natal = NatalChart(birth: b); readingCache = [:]
        roast = c.roast; state.currentRoast = c.roast; upsert(c.roast)
        completeOnboarding()
        return true
    }

    /// When the saved place can't be found, open the birth form with everything else filled in.
    func prefillDraft(from c: CloudRoast) {
        var d = BirthDraft(); d.name = c.birth.name; d.gender = c.birth.gender ?? "non-binary"
        let p = c.birth.date.split(separator: "-").map(String.init)
        if p.count == 3 { d.year = p[0]; d.month = p[1]; d.day = p[2] }
        if let t = c.birth.time { let q = t.split(separator: ":").map(String.init); if q.count > 1 { d.hour = q[0]; d.minute = q[1] } } else { d.timeKnown = false }
        draft = d; roast = c.roast; upsert(c.roast); route = .birth
    }

    // MARK: Live Activity
    private func startActivity() {
        guard ActivityAuthorizationInfo().areActivitiesEnabled, let name = state.profile?.name else { return }
        let attrs = RoastActivityAttributes(name: name, start: Date(), estimatedEnd: Date().addingTimeInterval(150))
        activity = try? Activity.request(attributes: attrs, content: .init(state: .init(pct: 0, line: Self.statuses[0], ready: false), staleDate: Date().addingTimeInterval(240)))
    }
    private func updateActivity(pct: Int, ready: Bool) async {
        let line = ready ? "Your roast is ready. Sit down first." : Self.statuses[(pct / 6) % Self.statuses.count]
        await activity?.update(.init(state: .init(pct: pct, line: line, ready: ready), staleDate: Date().addingTimeInterval(240)))
    }
    private func endActivity() async {
        await activity?.end(.init(state: .init(pct: 100, line: "Your roast is ready. Sit down first.", ready: true), staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(600)))
        activity = nil
    }

    private func simulateDemoGeneration() {
        let name = state.profile?.name ?? "Mara"
        pollTask = Task { [weak self] in
            for i in 1...10 { try? await Task.sleep(for: .milliseconds(900)); guard let self else { return }; self.roast = RoastPayload(id: "demo", name: name, status: "generating", stagePct: i * 9, isDemo: true) }
            guard let self else { return }
            let r = DemoData.roast(for: self.state.profile ?? DemoData.birth, paid: false)
            self.roast = r; self.state.currentRoast = r; self.upsert(r); self.finishGeneration()
        }
    }

    func resetEverything() {
        pollTask?.cancel()
        state = AppState(); natal = nil; roast = nil; draft = BirthDraft(); route = .welcome
    }
}
