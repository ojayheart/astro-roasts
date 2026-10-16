import SwiftUI
import AstroKit

struct SituationsView: View {
    @Environment(AppModel.self) private var model
    @State private var items: [Situation] = []
    @State private var loaded = false
    static func status(_ s: Situation) -> (String, Bool) {
        let h = s.hit
        switch (h.transiting, h.aspect) {
        case (.saturn, .square), (.saturn, .opposition): return ("IT'S COMPLICATED", true)
        case (.jupiter, _) where !h.aspect.isHard: return ("TALKING STAGE, WITH SUCCESS", true)
        case (.jupiter, _): return ("OVERCOMMITTED", false)
        case (.uranus, _) where !h.aspect.isHard: return ("SURPRISINGLY HEALTHY", false)
        case (.uranus, _): return ("ON A BREAK, THEN NOT", true)
        case (.neptune, _): return ("TOXIC, BUT DREAMY", false)
        case (.pluto, _): return ("IT'S A LOT", true)
        default: return ("SITUATIONSHIP", false)
        }
    }
    var body: some View {
        PlusGate(title: "Your situationships", blurb: "The planets you're currently entangled with, how long it lasts and what to actually do about it.") {
            ZStack {
                ScreenBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Your situation\u{00AD}ships").font(.display(34, .heavy)).tracking(-1).textCase(.uppercase).foregroundStyle(Palette.text)
                        Text("The planets you're currently entangled with, how long it lasts, and what to do about it.").font(.system(size: 14)).foregroundStyle(Palette.text2).lineSpacing(3)
                        if !loaded { ProgressView().tint(Palette.text2).frame(maxWidth: .infinity).padding(.top, 40) }
                        else if items.isEmpty { Text("Nothing heavy right now. Savour it.").font(.display(22, .bold)).foregroundStyle(Palette.text).padding(.top, 20) }
                        ForEach(Array(items.prefix(6).enumerated()), id: \.offset) { _, s in row(s) }
                    }.padding(.horizontal, 22).padding(.bottom, 30)
                }.scrollIndicators(.hidden)
            }
        }
        .navigationTitle("Situationships").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
        .task {
            guard let n = model.natal, !loaded else { return }
            let r = await Task.detached(priority: .userInitiated) { Sky.situations(natal: n, around: Date()) }.value
            items = r; loaded = true
        }
    }
    func row(_ s: Situation) -> some View {
        let (status, hot) = Self.status(s)
        let total = s.end.timeIntervalSince(s.start), now = Date().timeIntervalSince(s.start)
        let frac = max(0, min(1, now / max(total, 1))), peak = max(0, min(1, s.peak.timeIntervalSince(s.start) / max(total, 1)))
        return VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline) { Text(Voice.hitName(s.hit)).font(.display(16, .semibold)).foregroundStyle(Palette.text); Spacer(); MonoLabel(status, color: hot ? Palette.emberSoft : Palette.text2, size: 9, tracking: 1.3) }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(white: 0.1)).frame(height: 4)
                    Capsule().fill(hot ? Palette.ember : Color(white: 0.4)).frame(width: g.size.width, height: 4).opacity(0.85)
                    Circle().fill(hot ? Palette.ember : Palette.moon).frame(width: 10, height: 10).offset(x: g.size.width * peak - 5)
                    Rectangle().fill(Palette.moon.opacity(0.6)).frame(width: 1, height: 16).offset(x: g.size.width * frac)
                }.frame(height: 16)
            }.frame(height: 16)
            HStack(alignment: .top) { Text(Voice.adviceLine(for: s.hit, seed: Voice.seed(s.start))).font(.system(size: 13)).foregroundStyle(Palette.text2).lineSpacing(2); Spacer(minLength: 12); MonoLabel("\(s.start.formatted(.dateTime.month(.abbreviated).year(.twoDigits))) – \(s.end.formatted(.dateTime.month(.abbreviated).year(.twoDigits)))", size: 9, tracking: 0.8) }
        }.padding(.bottom, 14).overlay(alignment: .bottom) { Hairline() }
    }
}

struct ReceiptsView: View {
    @Environment(AppModel.self) private var model
    @State private var travel = Calendar.current.date(byAdding: .year, value: -1, to: Date())!
    @State private var text: String?
    var stats: (spot: Int, rude: Int, wrong: Int, pct: Int) {
        let v = Array(model.state.receipts.values); let s = v.filter { $0 == .spotOn }.count, r = v.filter { $0 == .rudeButTrue }.count, w = v.filter { $0 == .wrong }.count
        return (s, r, w, v.isEmpty ? 0 : Int((Double(s + r) / Double(v.count) * 100).rounded()))
    }
    var body: some View {
        let st = stats, total = max(st.spot + st.rude + st.wrong, 1)
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(model.state.receipts.isEmpty ? "–" : "\(st.pct)%").font(.display(64, .heavy)).tracking(-2).foregroundStyle(Palette.text)
                        Text(model.state.receipts.isEmpty ? "Rate a few days and we'll show our hit rate. We keep the misses up too." : "of our calls on you landed. We keep the misses up too.").font(.system(size: 14)).foregroundStyle(Palette.text2).lineSpacing(3)
                    }
                    GeometryReader { g in HStack(spacing: 2) {
                        Rectangle().fill(Palette.moon).frame(width: g.size.width * CGFloat(st.spot) / CGFloat(total)); Rectangle().fill(Palette.ember).frame(width: g.size.width * CGFloat(st.rude) / CGFloat(total)); Rectangle().fill(Color(white: 0.16))
                    }.clipShape(Capsule()) }.frame(height: 8)
                    HStack(spacing: 16) { Text("Spot on \(st.spot)"); Text("Rude but accurate \(st.rude)").foregroundStyle(Palette.emberSoft); Text("Wrong \(st.wrong)") }.font(.system(size: 12)).foregroundStyle(Palette.text3)

                    Card(padding: 16, corner: 20) {
                        VStack(alignment: .leading, spacing: 12) {
                            MonoLabel("Time travel", size: 10, tracking: 2)
                            DatePicker("Pick a day", selection: $travel, in: ...Date(), displayedComponents: .date).datePickerStyle(.compact).tint(Palette.moon).foregroundStyle(Palette.text)
                            Button(text == nil ? "What did the sky do?" : "Another day") { if let n = model.natal, let r = model.reading(for: travel) { withAnimation { text = Voice.dayRoast(natal: n, reading: r) } } }.buttonStyle(.primary).frame(height: 48)
                            if let t = text {
                                Text(t).font(.display(17, .semibold)).lineSpacing(3).foregroundStyle(Palette.text)
                                MonoLabel("How did it actually go?", size: 10, tracking: 1.6)
                                HStack(spacing: 8) { ForEach(ReceiptRating.allCases, id: \.self) { rt in
                                    Button(rt.rawValue) { withAnimation { model.state.receipts[DayKey.key(travel)] = rt } }.font(.system(size: 13)).frame(maxWidth: .infinity).frame(height: 42)
                                        .foregroundStyle(model.state.receipts[DayKey.key(travel)] == rt ? Palette.ink : Palette.text)
                                        .background(model.state.receipts[DayKey.key(travel)] == rt ? Palette.moon : .clear, in: RoundedRectangle(cornerRadius: 11)).overlay(RoundedRectangle(cornerRadius: 11).stroke(Palette.line))
                                } }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        MonoLabel("Recent calls", size: 10, tracking: 2).padding(.bottom, 8)
                        ForEach(model.state.receipts.sorted(by: { $0.key > $1.key }).prefix(8), id: \.key) { k, rt in
                            let d = Self.parse(k)
                            HStack(alignment: .top, spacing: 12) {
                                Text(d.formatted(.dateTime.weekday(.abbreviated).day()).uppercased()).font(.mono(10)).foregroundStyle(Palette.text3).frame(width: 52, alignment: .leading).padding(.top, 2)
                                Text(model.reading(for: d)?.headline ?? "").font(.system(size: 14)).foregroundStyle(Palette.text).lineLimit(2)
                                Spacer(minLength: 6)
                                Text(rt.rawValue).font(.system(size: 12)).foregroundStyle(rt == .wrong ? Palette.text3 : Palette.moon)
                            }.padding(.vertical, 11).overlay(alignment: .top) { Hairline() }
                        }
                    }
                    Card(padding: 14, corner: 16, fill: .clear, stroke: Palette.line) { HStack(spacing: 12) { Text((model.state.profile.map { $0.instant.formatted(.dateTime.day().month(.abbreviated).timeZone(.specificName(.short))) } ?? "").components(separatedBy: " ").prefix(2).joined(separator: " ").uppercased()).font(.display(18, .heavy)).foregroundStyle(Palette.ember); Text("Your year, pre-roasted, unlocks on your birthday. Twelve months, twelve verdicts.").font(.system(size: 13)).foregroundStyle(Palette.text2) } }
                }.padding(.horizontal, 22).padding(.bottom, 30)
            }.scrollIndicators(.hidden)
        }.foregroundStyle(Palette.text)
        .navigationTitle("Receipts").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
    }
    static func parse(_ k: String) -> Date { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.date(from: k) ?? Date() }
}

struct DraftView: View {
    @Environment(AppModel.self) private var model
    @State private var text = ""
    @State private var recipient: UUID?
    @State private var result: DraftResult?
    @State private var copied = false
    @FocusState private var focused: Bool

    var body: some View {
        PlusGate(title: "Draft check", blurb: "Paste the text you're about to send. We'll tell you whether to send it, fix it or bin it, and why.") {
            ZStack {
                ScreenBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Before you send that.").font(.display(30, .bold)).tracking(-0.8).foregroundStyle(Palette.text)
                        if !model.state.people.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) {
                                chip("Nobody", on: recipient == nil) { recipient = nil }
                                ForEach(model.state.people) { p in chip(p.name, on: recipient == p.id) { recipient = p.id } }
                            } }
                        }
                        ZStack(alignment: .topLeading) {
                            if text.isEmpty { Text("Paste or type the message…").font(.system(size: 16)).foregroundStyle(Palette.text3).padding(16) }
                            TextEditor(text: $text).focused($focused).scrollContentBackground(.hidden).font(.system(size: 16)).padding(10).frame(minHeight: 120).foregroundStyle(Palette.text)
                        }.background(Palette.surface, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(Palette.hairline))
                        Button("Check it") { focused = false; withAnimation(.snappy) { result = DraftCheck.analyze(text, natal: model.natal, recipient: model.state.people.first { $0.id == recipient }) } }.buttonStyle(.primary).disabled(text.trimmingCharacters(in: .whitespaces).isEmpty).opacity(text.isEmpty ? 0.4 : 1)
                        if let r = result { resultView(r) }
                    }.padding(.horizontal, 20).padding(.bottom, 30)
                }.scrollDismissesKeyboard(.interactively)
            }.foregroundStyle(Palette.text)
        }
        .navigationTitle("Draft check").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
    }
    func chip(_ t: String, on: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) { Text(t).font(.system(size: 13)).padding(.horizontal, 14).frame(height: 32).foregroundStyle(on ? Palette.ink : Palette.text2).background(on ? Palette.moon : .clear, in: Capsule()).overlay(Capsule().stroke(on ? Palette.moon : Palette.line)) }
    }
    func resultView(_ r: DraftResult) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Card(padding: 16, corner: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack { MonoLabel("Verdict", size: 10, tracking: 2); Spacer()
                        HStack(spacing: 6) { ForEach([DraftResult.Verdict.send, .rewrite, .bin], id: \.self) { v in Text(v.rawValue.uppercased()).font(.mono(10)).tracking(1.2).padding(.horizontal, 10).frame(height: 26).foregroundStyle(v == r.verdict ? Palette.ink : Palette.text3).background(v == r.verdict ? Palette.moon : .clear, in: Capsule()).overlay(Capsule().stroke(v == r.verdict ? Palette.moon : Palette.line)) } } }
                    ForEach(r.reasons, id: \.self) { Text($0).font(.system(size: 15)).lineSpacing(3).foregroundStyle(Palette.text2) }
                    if r.reasons.isEmpty { Text("Reads fine. Send it, and don't re-read it.").font(.system(size: 15)).foregroundStyle(Palette.text2) }
                    if !r.tags.isEmpty { HStack(spacing: 6) { ForEach(r.tags, id: \.self) { Text($0).font(.mono(10)).foregroundStyle(Palette.text2).padding(.horizontal, 9).frame(height: 24).overlay(Capsule().stroke(Palette.line)) } } }
                }
            }
            if r.verdict != .send {
                MonoLabel("Try this instead", color: Palette.ember, size: 10, tracking: 2)
                Text(r.rewrite).font(.system(size: 16)).padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Palette.moon, in: RoundedRectangle(cornerRadius: 18)).foregroundStyle(Palette.ink)
                if let d = r.betterDay, let why = r.betterDayReason { Text("\(d.formatted(.dateTime.weekday(.wide))): \(why)").font(.system(size: 13)).foregroundStyle(Palette.text3) }
                HStack(spacing: 10) {
                    Button(copied ? "Copied" : "Copy rewrite") { UIPasteboard.general.string = r.rewrite; copied = true }.buttonStyle(.primary).frame(height: 48)
                    if let d = r.betterDay { Button("Remind me \(d.formatted(.dateTime.weekday(.abbreviated)))") { Task { await Notifications.remind(on: d, title: "About that text", body: "It's a calmer sky. Send the rewrite.") } }.buttonStyle(.ghost).frame(height: 48) }
                }
            }
            Text("Checked on your phone. Nothing is sent anywhere.").font(.system(size: 12)).foregroundStyle(Palette.text3)
        }
    }
}
