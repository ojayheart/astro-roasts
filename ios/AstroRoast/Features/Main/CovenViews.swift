import SwiftUI
import AstroKit

struct CovenView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 4) {
                            MonoLabel("\(model.state.people.count) \(model.state.people.count == 1 ? "suspect" : "suspects")", size: 11, tracking: 2.4)
                            Text("Coven").font(.display(36, .heavy)).tracking(-1).textCase(.uppercase).foregroundStyle(Palette.text)
                        }
                        Spacer()
                        Button { model.sheet = .addPerson } label: { Image(systemName: "plus").font(.system(size: 18, weight: .medium)).frame(width: 44, height: 44).overlay(Circle().stroke(Palette.line)) }.foregroundStyle(Palette.text).accessibilityLabel("Add someone")
                    }
                    if let me = model.natal, let first = model.state.people.first {
                        NavigationLink(value: Dest.person(first.id)) { FeaturedPair(me: me, person: first) }.buttonStyle(.plain)
                    }
                    if model.state.people.isEmpty {
                        Card { VStack(alignment: .leading, spacing: 10) {
                            Text("Nobody here yet.").font(.display(24, .bold)).foregroundStyle(Palette.text)
                            Text("Add your partner, your mum, your boss. See how your charts clash and what the sky does to each of them.").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3)
                            Button("Add someone") { model.sheet = .addPerson }.buttonStyle(.primary)
                        } }
                    }
                    VStack(spacing: 0) {
                        ForEach(model.state.people) { p in
                            NavigationLink(value: Dest.person(p.id)) {
                                HStack(spacing: 14) {
                                    Avatar(name: p.name, size: 42)
                                    VStack(alignment: .leading, spacing: 2) { Text(p.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(Palette.text); Text("\(p.role) · \(p.chart.sunSign) Sun, \(p.chart.moonSign) Moon").font(.system(size: 13)).foregroundStyle(Palette.text3) }
                                    Spacer()
                                    if p.roastID != nil { MonoLabel("Roasted", size: 9, tracking: 1.4) }
                                    Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(Palette.text3)
                                }.padding(.vertical, 12).overlay(alignment: .top) { Hairline() }
                            }.buttonStyle(.plain)
                        }
                    }.overlay(alignment: .bottom) { if !model.state.people.isEmpty { Hairline() } }
                    Button { model.sheet = .anyone } label: {
                        HStack(spacing: 12) { Image(systemName: "person.badge.plus").foregroundStyle(Palette.ember); Text("Roast someone who isn't on the app").font(.system(size: 14)).foregroundStyle(Palette.text); Spacer(); Text(model.isPlus ? "Free" : model.purchases.price(Purchases.ID.other, fallback: "$2.99")).font(.mono(12)).foregroundStyle(Palette.text3) }
                            .padding(14).overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line, style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
                    }
                }.padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 30)
            }.scrollIndicators(.hidden)
        }.toolbar(.hidden, for: .navigationBar)
    }
}

struct Avatar: View {
    let name: String; var size: CGFloat = 40
    var body: some View {
        Text(String(name.prefix(1)).uppercased()).font(.display(size * 0.4, .heavy)).foregroundStyle(Palette.ink).frame(width: size, height: size).background(Palette.moon, in: Circle())
    }
}

struct Meter: View {
    let label: String; let value: Int; var hot = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            MonoLabel(label, size: 9, tracking: 1.6)
            GeometryReader { g in Capsule().fill(Color(white: 0.12)).overlay(alignment: .leading) { Capsule().fill(hot ? Palette.ember : Palette.moon).frame(width: g.size.width * CGFloat(value) / 100) } }.frame(height: 6)
            Text("\(value)%").font(.mono(12)).foregroundStyle(hot ? Palette.emberSoft : Palette.text)
        }.frame(maxWidth: .infinity)
    }
}

struct FeaturedPair: View {
    let me: NatalChart; let person: Person
    var body: some View {
        let s = Synastry.compute(me, person.chart, aName: me.birth.name, bName: person.name)
        Card(padding: 20, corner: 24) {
            VStack(alignment: .leading, spacing: 16) {
                HStack { HStack(spacing: -10) { Avatar(name: me.birth.name, size: 40); Avatar(name: person.name, size: 40).overlay(Circle().stroke(Palette.surface, lineWidth: 2)) }; Spacer(); MonoLabel(person.role, size: 10, tracking: 1.8) }
                Text("\(me.birth.name) + \(person.name)").font(.display(23, .heavy)).textCase(.uppercase).tracking(-0.5).foregroundStyle(Palette.text)
                Text(s.categories.first?.line ?? "").font(.system(size: 15)).lineSpacing(3).foregroundStyle(Palette.text2)
                HStack(spacing: 14) { Meter(label: "Compatibility", value: s.compat); Meter(label: "Chaos", value: s.chaos, hot: true) }
            }
        }
    }
}

struct PersonDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let id: UUID
    @State private var roasting = false
    @State private var error: String?
    @State private var confirmDelete = false

    var body: some View {
        ZStack {
            ScreenBackground()
            if let i = model.state.people.firstIndex(where: { $0.id == id }), let me = model.natal {
                let p = model.state.people[i]
                let s = Synastry.compute(me, p.chart, aName: me.birth.name, bName: p.name)
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        HStack(spacing: 14) { Avatar(name: p.name, size: 54); VStack(alignment: .leading, spacing: 3) { Text(p.name).font(.display(28, .heavy)).tracking(-0.6).foregroundStyle(Palette.text); Text("\(p.role) · \(p.chart.sunSign) Sun · \(p.chart.moonSign) Moon").font(.system(size: 14)).foregroundStyle(Palette.text3) } }
                        HStack(spacing: 14) { Meter(label: "Compatibility", value: s.compat); Meter(label: "Chaos", value: s.chaos, hot: true) }
                        VStack(spacing: 0) {
                            ForEach(Array(s.categories.enumerated()), id: \.offset) { _, c in
                                VStack(alignment: .leading, spacing: 3) { MonoLabel(c.title, size: 10, tracking: 1.8); Text(c.line).font(.system(size: 15)).foregroundStyle(Palette.text) }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12).overlay(alignment: .top) { Hairline() }
                            }
                        }.overlay(alignment: .bottom) { Hairline() }
                        VStack(alignment: .leading, spacing: 10) {
                            MonoLabel("The household", size: 10, tracking: 1.8)
                            fact("Starts the fight", s.fight); fact("Apologises first", s.apologises); fact("Does the dishes", s.dishes)
                        }
                        Toggle(isOn: Binding(get: { p.overlaySource }, set: { _ in model.requirePlusOverlay(p.id) })) { Text("Show on the moon dial").font(.system(size: 16)) }.tint(Palette.moon)
                        if let e = error { Text(e).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
                        VStack(spacing: 10) {
                            if let rid = p.roastID, let r = model.state.roasts.first(where: { $0.id == rid }) {
                                Button("Read \(p.name)'s roast") { model.roast = r; model.openRoast = true }.buttonStyle(.primary)
                            } else {
                                Button { Task { await roast(p, me: me) } } label: { if roasting { HStack { ProgressView().tint(Palette.ink); Text("Cooking…") } } else { Text("Roast \(me.birth.name) + \(p.name) · \(model.isPlus ? "Free" : model.purchases.price(Purchases.ID.couple, fallback: "$7.99"))") } }.buttonStyle(.primary).disabled(roasting)
                            }
                            Button("Remove from Coven", role: .destructive) { confirmDelete = true }.font(.system(size: 14)).foregroundStyle(Palette.text3)
                        }
                    }.padding(.horizontal, 22).padding(.bottom, 40)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
        .confirmationDialog("Remove from your Coven?", isPresented: $confirmDelete, titleVisibility: .visible) { Button("Remove", role: .destructive) { model.state.people.removeAll { $0.id == id }; dismiss() } }
    }
    func fact(_ k: String, _ v: String) -> some View { HStack { Text(k).font(.system(size: 15)).foregroundStyle(Palette.text3); Spacer(); Text(v).font(.system(size: 15, weight: .medium)).foregroundStyle(Palette.text) } }
    func roast(_ p: Person, me: NatalChart) async {
        roasting = true; error = nil; defer { roasting = false }
        do {
            guard let mine = model.state.profile else { return }
            let r = try await model.roastOther([Person(birth: mine, role: "Me"), p], relationship: p.role.lowercased() == "partner" ? "partners" : (p.role.lowercased() == "ex" ? "exes" : "friends"))
            if let i = model.state.people.firstIndex(where: { $0.id == p.id }) { model.state.people[i].roastID = r.id }
            model.roast = r; model.openRoast = true
        } catch { self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
    }
}

struct AnyoneView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var addOnly = false
    @State private var draft = BirthDraft()
    @State private var role = "Boss"
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: BirthField?
    static let roles = ["Boss", "Ex", "Crush", "Mum", "Flatmate", "Partner", "Friend", "Cat"]

    var body: some View {
        ZStack {
            ScreenBackground()
            VStack(spacing: 0) {
                HStack { Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Close"); Spacer(); MonoLabel(addOnly ? "New suspect" : "Not on the app"); Spacer(); Spacer().frame(width: 44) }.padding(.horizontal, 12)
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(addOnly ? "Add someone to your Coven." : "Roast someone who isn't here.").font(.display(30, .bold)).tracking(-0.8).foregroundStyle(Palette.text)
                            Text("They don't need the app. They don't need to know. Yet.").font(.system(size: 14)).foregroundStyle(Palette.text2)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            MonoLabel("Who are they to you", size: 11, tracking: 2).padding(.leading, 4)
                            FlowChips(items: Self.roles, selection: $role)
                        }
                        BirthFormFields(draft: $draft, showGender: false, nameLabel: "Name", focus: $focus)
                        if !addOnly {
                            Card(padding: 14, corner: 14, fill: .clear, stroke: Palette.hairline) { VStack(alignment: .leading, spacing: 6) { MonoLabel("You get", size: 10, tracking: 1.8); Text("\(draft.name.isEmpty ? "Their" : draft.name)'s roast, written for your \(role.lowercased()). How their chart clashes with yours. A share card, if you're brave.").font(.system(size: 14)).foregroundStyle(Palette.text2).lineSpacing(3) } }
                        }
                        if let e = error { Text(e).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
                    }.padding(.horizontal, 18).padding(.bottom, 20)
                }.scrollDismissesKeyboard(.interactively)
                VStack(spacing: 8) {
                    if !addOnly {
                        Button { Task { await go(roast: true) } } label: { if busy { ProgressView().tint(Palette.ink) } else { Text("Roast \(draft.name.isEmpty ? "them" : draft.name) · \(model.isPlus ? "Free" : model.purchases.price(Purchases.ID.other, fallback: "$2.99"))") } }.buttonStyle(.primary).disabled(!draft.valid || busy).opacity(draft.valid ? 1 : 0.4)
                    }
                    if addOnly {
                        Button { Task { await go(roast: false) } } label: { Text("Add to Coven") }.buttonStyle(.primary).disabled(!draft.valid || busy).opacity(draft.valid ? 1 : 0.4)
                    } else {
                        Button { Task { await go(roast: false) } } label: { Text("Just add to Coven") }.buttonStyle(.ghost).disabled(!draft.valid || busy).opacity(draft.valid ? 1 : 0.4)
                    }
                    if !addOnly { Text("Free with Roast+. We roast traits, not people's worth. They stay private unless you share.").font(.system(size: 11)).foregroundStyle(Palette.text3).multilineTextAlignment(.center) }
                }.padding(.horizontal, 18).padding(.bottom, 10)
            }
        }.foregroundStyle(Palette.text)
    }

    func go(roast: Bool) async {
        guard var b = draft.birth() else { return }
        b.name = draft.name.trimmingCharacters(in: .whitespaces)
        let person = Person(birth: b, role: role)
        model.state.people.append(person)
        guard roast else { dismiss(); return }
        busy = true; error = nil; defer { busy = false }
        do {
            var r = try await model.roastOther([person], relationship: nil)
            if model.isPlus, let jws = await model.purchases.plusJWS(), !model.demo { if (try? await RoastAPI.shared.unlock(roastID: r.id, signedTransaction: jws)) == true, let fresh = try? await RoastAPI.shared.fetch(id: r.id) { r = fresh; model.upsert(r) } }
            else if model.demo { r.paid = true; r.fullText = DemoData.fullText(for: r.name); model.upsert(r) }
            if let i = model.state.people.firstIndex(where: { $0.id == person.id }) { model.state.people[i].roastID = r.id }
            model.roast = r; dismiss()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { model.openRoast = true }
        } catch { self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
    }
}

struct FlowChips: View {
    let items: [String]; @Binding var selection: String
    var body: some View {
        FlexibleLayout(spacing: 8) {
            ForEach(items, id: \.self) { it in
                Button { withAnimation(.snappy) { selection = it } } label: {
                    Text(it).font(.system(size: 14)).foregroundStyle(selection == it ? Palette.ink : Palette.text2).padding(.horizontal, 14).frame(height: 36)
                        .background(selection == it ? Palette.moon : .clear, in: Capsule()).overlay(Capsule().stroke(selection == it ? Palette.moon : Palette.line))
                }.accessibilityAddTraits(selection == it ? .isSelected : [])
            }
        }
    }
}
struct FlexibleLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 320; var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews { let sz = s.sizeThatFits(.unspecified); if x + sz.width > w { x = 0; y += rowH + spacing; rowH = 0 }; x += sz.width + spacing; rowH = max(rowH, sz.height) }
        return CGSize(width: w, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for s in subviews { let sz = s.sizeThatFits(.unspecified); if x + sz.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }; s.place(at: CGPoint(x: x, y: y), proposal: .unspecified); x += sz.width + spacing; rowH = max(rowH, sz.height) }
    }
}
