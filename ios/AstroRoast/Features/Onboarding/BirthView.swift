import SwiftUI
import AstroKit

enum BirthField { case name, day, month, year, hour, minute, place }

struct BirthView: View {
    @Environment(AppModel.self) private var model
    @FocusState private var focus: BirthField?

    var body: some View {
        @Bindable var m = model
        ZStack {
            ScreenBackground()
            VStack(spacing: 0) {
                TopBar(title: "About you", back: { withAnimation(.snappy) { model.route = .welcome } })
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Tell us when you arrived.").font(.display(32, .bold)).tracking(-0.8).foregroundStyle(Palette.text)
                            Text("The exact time makes it sharper. No time? No problem, we'll still find plenty.").font(.system(size: 15)).foregroundStyle(Palette.text2)
                        }.padding(.horizontal, 8)
                        BirthFormFields(draft: $m.draft, showGender: true, focus: $focus)
                    }.padding(.horizontal, 16).padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)
                Button("Get my roast") { focus = nil; model.submitBirth() }.buttonStyle(.primary).disabled(!model.draft.valid).opacity(model.draft.valid ? 1 : 0.4)
                    .padding(.horizontal, 16).padding(.bottom, 12)
            }
        }
    }
}

/// Name / date / time / place fields, shared by onboarding, Coven and "roast someone".
struct BirthFormFields: View {
    @Binding var draft: BirthDraft
    var showGender = false
    var nameLabel = "Name"
    var focus: FocusState<BirthField?>.Binding
    @State private var search = PlaceSearch()

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if showGender {
                Picker("I am", selection: $draft.gender) { Text("Woman").tag("woman"); Text("Man").tag("man"); Text("Non-binary").tag("non-binary") }.pickerStyle(.segmented)
            }
            FormGroup(label: "About you") {
                FormRow(nameLabel) {
                    TextField("First name", text: $draft.name).multilineTextAlignment(.trailing).textContentType(.givenName)
                        .focused(focus, equals: .name).submitLabel(.next).onSubmit { focus.wrappedValue = .day }
                }
                Hairline()
                FormRow("Born") {
                    HStack(spacing: 6) {
                        DigitField("DD", text: $draft.day, max: 2, width: 40, focus: focus, me: .day, next: .month)
                        Text("/").foregroundStyle(Palette.text3)
                        DigitField("MM", text: $draft.month, max: 2, width: 40, focus: focus, me: .month, next: .year)
                        Text("/").foregroundStyle(Palette.text3)
                        DigitField("YYYY", text: $draft.year, max: 4, width: 62, focus: focus, me: .year, next: draft.timeKnown ? .hour : .place)
                    }
                }
                Hairline()
                FormRow("Time") {
                    HStack(spacing: 6) {
                        DigitField("HH", text: $draft.hour, max: 2, width: 40, focus: focus, me: .hour, next: .minute)
                        Text(":").foregroundStyle(Palette.text3)
                        DigitField("MM", text: $draft.minute, max: 2, width: 40, focus: focus, me: .minute, next: .place)
                    }.opacity(draft.timeKnown ? 1 : 0.3).disabled(!draft.timeKnown)
                }
                Hairline()
                Toggle(isOn: Binding(get: { !draft.timeKnown }, set: { draft.timeKnown = !$0 })) { Text("I don't know the time").font(.system(size: 16)).foregroundStyle(Palette.text) }
                    .tint(Palette.moon).frame(minHeight: 50).padding(.horizontal, 16)
            }
            Text("Check the birth certificate, or ask their mother. She remembers. She remembers everything.").font(.system(size: 12)).foregroundStyle(Palette.text3).padding(.horizontal, 16).padding(.top, -14)

            FormGroup(label: "Place of birth") {
                HStack(spacing: 12) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Palette.text3)
                    TextField("Town, city or village", text: $search.query).focused(focus, equals: .place).textContentType(.addressCity).autocorrectionDisabled().foregroundStyle(Palette.text)
                    if draft.place != nil { Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.moon) }
                }.frame(minHeight: 50).padding(.horizontal, 16)
                if let p = draft.place, search.suggestions.isEmpty || focus.wrappedValue != .place {
                    Hairline()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.label).font(.system(size: 16)).foregroundStyle(Palette.text)
                        Text(String(format: "%.2f°%@ %.2f°%@ · %@", abs(p.lat), p.lat >= 0 ? "N" : "S", abs(p.lon), p.lon >= 0 ? "E" : "W", p.tzID)).font(.mono(11)).foregroundStyle(Palette.text3)
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.vertical, 12).background(Palette.surface2)
                }
                ForEach(search.cannedMatches, id: \.self) { p in
                    Hairline()
                    Button { draft.place = p; search.query = p.label; focus.wrappedValue = nil } label: {
                        VStack(alignment: .leading, spacing: 2) { Text(p.name).font(.system(size: 16)).foregroundStyle(Palette.text); Text(p.country).font(.system(size: 13)).foregroundStyle(Palette.text3) }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.vertical, 10)
                    }
                }
                ForEach(Array(search.suggestions.enumerated()), id: \.offset) { _, s in
                    Hairline()
                    Button {
                        Task { if let p = await search.resolve(s) { draft.place = p; search.query = p.label; search.suggestions = []; focus.wrappedValue = nil } }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) { Text(s.title).font(.system(size: 16)).foregroundStyle(Palette.text); Text(s.subtitle).font(.system(size: 13)).foregroundStyle(Palette.text3) }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.vertical, 10)
                    }
                }
            }
        }
        .onChange(of: search.query) { _, q in if draft.place?.label != q { draft.place = nil } }
        .onAppear { if let p = draft.place { search.query = p.label } }
    }
}

// MARK: shared form pieces

struct TopBar: View {
    let title: String; var back: (() -> Void)? = nil
    var body: some View {
        HStack {
            if let back { Button(action: back) { Image(systemName: "chevron.left").font(.system(size: 18, weight: .semibold)).frame(width: 44, height: 44, alignment: .leading) }.foregroundStyle(Palette.text2).accessibilityLabel("Back") }
            else { Spacer().frame(width: 44) }
            Spacer(); MonoLabel(title); Spacer(); Spacer().frame(width: 44)
        }.padding(.horizontal, 16).frame(height: 44)
    }
}

struct FormGroup<Content: View>: View {
    let label: String; @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            MonoLabel(label, size: 11, tracking: 2).padding(.leading, 16)
            VStack(spacing: 0) { content }
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Palette.hairline))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}
struct FormRow<Content: View>: View {
    let label: String; @ViewBuilder let content: Content
    init(_ label: String, @ViewBuilder content: () -> Content) { self.label = label; self.content = content() }
    var body: some View {
        HStack { Text(label).font(.system(size: 16)); Spacer(); content }.frame(minHeight: 50).padding(.horizontal, 16).foregroundStyle(Palette.text)
    }
}
struct DigitField: View {
    let placeholder: String; @Binding var text: String; let max: Int; let width: CGFloat
    var focus: FocusState<BirthField?>.Binding; let me: BirthField; let next: BirthField
    init(_ p: String, text: Binding<String>, max: Int, width: CGFloat, focus: FocusState<BirthField?>.Binding, me: BirthField, next: BirthField) {
        placeholder = p; _text = text; self.max = max; self.width = width; self.focus = focus; self.me = me; self.next = next
    }
    var body: some View {
        TextField(placeholder, text: $text).keyboardType(.numberPad).multilineTextAlignment(.center).font(.mono(16))
            .frame(width: width, height: 34).background(Palette.surface2, in: RoundedRectangle(cornerRadius: 8)).focused(focus, equals: me)
            .onChange(of: text) { _, v in
                let f = String(v.filter(\.isNumber).prefix(max)); if f != v { text = f }
                if f.count == max { focus.wrappedValue = next }
            }
    }
}
