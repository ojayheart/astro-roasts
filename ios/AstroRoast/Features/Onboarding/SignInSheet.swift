import SwiftUI
import AstroKit

/// Email → 6-digit code → every roast on that email, in one place. Also restores your profile from the birth details saved with a roast.
struct SignInSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    enum Step { case email, code, found, empty, link }
    @State private var step = Step.email
    @State private var email = ""
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?
    @State private var found: [CloudRoast] = []
    @State private var pasted = ""
    @FocusState private var focus: Bool

    var cleanEmail: String { email.trimmingCharacters(in: .whitespaces).lowercased() }
    var emailValid: Bool { cleanEmail.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#, options: .regularExpression) != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack { Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Close"); Spacer() }
            switch step {
            case .email: emailStep
            case .code: codeStep
            case .found: foundStep
            case .empty: emptyStep
            case .link: linkStep
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24).padding(.bottom, 16).foregroundStyle(Palette.text)
        .animation(.snappy, value: step)
    }

    // MARK: steps
    var emailStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Find your roasts.").font(.display(32, .bold)).tracking(-0.8)
            Text("Use the email you gave when you got a roast. We'll send a 6-digit code, then bring every roast on that email into the app, and set up your profile for you.").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3)
            field("Email address", text: $email, keyboard: .emailAddress).textContentType(.emailAddress).submitLabel(.send).onSubmit { Task { await send() } }
                .task { try? await Task.sleep(for: .milliseconds(500)); focus = true }
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
            Button { Task { await send() } } label: { if busy { ProgressView().tint(Palette.ink) } else { Text("Send code") } }.buttonStyle(.primary).disabled(!emailValid || busy).opacity(emailValid ? 1 : 0.4)
            Button("Have a roast link instead?") { step = .link }.font(.system(size: 14)).foregroundStyle(Palette.text3).frame(maxWidth: .infinity)
            Text("New here? You don't need an account to get your first roast. Linking an email just keeps them all together.").font(.system(size: 12)).foregroundStyle(Palette.text3).lineSpacing(2)
        }
    }
    var codeStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Check your email.").font(.display(32, .bold)).tracking(-0.8)
            Text("We sent a 6-digit code to \(cleanEmail). It works for 10 minutes.").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3)
            TextField("123456", text: $code).keyboardType(.numberPad).textContentType(.oneTimeCode).focused($focus).font(.mono(28)).tracking(8).multilineTextAlignment(.center)
                .padding(16).background(Palette.surface2, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Palette.line))
                .onChange(of: code) { _, v in let f = String(v.filter(\.isNumber).prefix(6)); if f != v { code = f }; if f.count == 6 { Task { await verify() } } }
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
            if busy { ProgressView().tint(Palette.text2).frame(maxWidth: .infinity) }
            HStack { Button("Use a different email") { code = ""; error = nil; step = .email }; Spacer(); Button("Send again") { Task { await send(resend: true) } } }.font(.system(size: 14)).foregroundStyle(Palette.text2)
        }.task { try? await Task.sleep(for: .milliseconds(450)); focus = true }   // wait for the step transition, then raise the keyboard
    }
    var foundStep: some View {
        let people = CloudRoast.people(found)
        return VStack(alignment: .leading, spacing: 14) {
            Text(model.state.profile == nil ? "We found \(found.count) roast\(found.count == 1 ? "" : "s"). Which one is you?" : "We found \(found.count) roast\(found.count == 1 ? "" : "s").").font(.display(28, .bold)).tracking(-0.6)
            if model.state.profile == nil {
                Text("Tap yourself and we'll set up your chart, Today and the moon dial from the details you gave.").font(.system(size: 14)).foregroundStyle(Palette.text2)
                ForEach(people, id: \.id) { c in
                    Button { Task { await pick(c) } } label: { row(c, chevron: true) }.buttonStyle(.plain)
                }
            } else {
                ScrollView { VStack(spacing: 0) { ForEach(found) { c in row(c, chevron: false) } } }.frame(maxHeight: 380)
                Button("Done") { dismiss() }.buttonStyle(.primary)
            }
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
        }
    }
    var emptyStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("No roasts on that email yet.").font(.display(28, .bold)).tracking(-0.6)
            Text("You're signed in, so your next roast will be saved to \(cleanEmail) automatically. If you used a different email before, try that one.").font(.system(size: 15)).foregroundStyle(Palette.text2).lineSpacing(3)
            Button("Try another email") { email = ""; code = ""; step = .email }.buttonStyle(.ghost)
            if model.state.profile == nil { Button("Start my first roast") { dismiss(); withAnimation(.snappy) { model.route = .birth } }.buttonStyle(.primary) }
            else { Button("Done") { dismiss() }.buttonStyle(.primary) }
        }
    }
    var linkStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Paste your roast link.").font(.display(30, .bold)).tracking(-0.8)
            Text("From the email we sent when you got your roast, or from the page's address bar.").font(.system(size: 15)).foregroundStyle(Palette.text2)
            field("astroroast.com/roast/…", text: $pasted, keyboard: .URL)
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Palette.emberSoft) }
            Button { Task { await importLink() } } label: { if busy { ProgressView().tint(Palette.ink) } else { Text("Find my roast") } }.buttonStyle(.primary).disabled(pasted.isEmpty || busy)
            Button("Back to email") { step = .email }.font(.system(size: 14)).foregroundStyle(Palette.text3).frame(maxWidth: .infinity)
        }
    }

    // MARK: pieces
    func field(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        TextField(placeholder, text: text).keyboardType(keyboard).textInputAutocapitalization(.never).autocorrectionDisabled().focused($focus)
            .padding(14).background(Palette.surface2, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line))
    }
    func row(_ c: CloudRoast, chevron: Bool) -> some View {
        HStack(spacing: 14) {
            Avatar(name: c.birth.name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(c.roast.kind == "couple" || c.roast.kind == "family" ? (c.roast.subjectNames ?? [c.birth.name]).joined(separator: " + ") : c.birth.name).font(.system(size: 16, weight: .semibold))
                Text("\(c.roast.sunSign ?? "") Sun · \(c.roast.moonSign ?? "") Moon · \(Self.pretty(c.birth.date))\(c.roast.paid ? "" : " · teaser")").font(.system(size: 13)).foregroundStyle(Palette.text3)
            }
            Spacer(); if chevron { Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(Palette.text3) }
        }.padding(.vertical, 12).overlay(alignment: .top) { Hairline() }.contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
    static func pretty(_ iso: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; guard let d = f.date(from: iso) else { return iso }
        return d.formatted(.dateTime.day().month(.abbreviated).year())
    }
    // MARK: actions
    func send(resend: Bool = false) async {
        busy = true; error = nil; defer { busy = false }
        do { try await model.requestCode(email: cleanEmail); if !resend { code = ""; step = .code } else { error = "Sent again." } }
        catch { self.error = (error as? LocalizedError)?.errorDescription ?? "Couldn't send the code." }
    }
    func verify() async {
        guard !busy else { return }
        busy = true; error = nil; defer { busy = false }
        do {
            let list = try await model.signIn(email: cleanEmail, code: code)
            found = list; step = list.isEmpty ? .empty : .found
            if !list.isEmpty, model.state.profile != nil { /* profile already set; just show the list */ }
        } catch { self.error = (error as? LocalizedError)?.errorDescription ?? "That didn't work."; code = "" }
    }
    func pick(_ c: CloudRoast) async {
        busy = true; error = nil; defer { busy = false }
        if await model.adoptProfile(from: c) { dismiss() }
        else { model.prefillDraft(from: c); dismiss() }   // couldn't place the birthplace: open the form pre-filled
    }
    func importLink() async {
        busy = true; error = nil; defer { busy = false }
        do {
            try await model.adopt(text: pasted)
            if model.state.profile == nil, let r = model.roast { model.draft.name = r.name; dismiss(); withAnimation(.snappy) { model.route = .birth } } else { dismiss(); model.completeOnboarding() }
        } catch { self.error = (error as? LocalizedError)?.errorDescription ?? "That didn't work." }
    }
}

struct RoastsView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        ZStack {
            ScreenBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Your roasts").font(.display(32, .heavy)).tracking(-0.8).textCase(.uppercase).foregroundStyle(Palette.text)
                    if model.linked.isEmpty {
                        Card(padding: 16, corner: 18) { VStack(alignment: .leading, spacing: 10) {
                            Text("Keep them all in one place.").font(.display(20, .bold)).foregroundStyle(Palette.text)
                            Text("Link the email you used and every roast you've ever got shows up here, on any phone.").font(.system(size: 14)).foregroundStyle(Palette.text2)
                            Button("Link my email") { model.sheet = .signIn }.buttonStyle(.primary).frame(height: 48)
                        } }
                    }
                    ForEach(model.allRoasts) { r in
                        Button { model.roast = r; model.openRoast = true } label: {
                            HStack(spacing: 14) {
                                Avatar(name: r.name, size: 40)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text((r.kind == "couple" || r.kind == "family") ? (r.subjectNames ?? [r.name]).joined(separator: " + ") : r.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(Palette.text)
                                    Text("\(r.sunSign ?? "") Sun · \(r.moonSign ?? "") Moon\(r.isReady ? "" : " · cooking")").font(.system(size: 13)).foregroundStyle(Palette.text3)
                                }
                                Spacer()
                                MonoLabel(r.paid ? "Full" : "Teaser", color: r.paid ? Palette.moon : Palette.text3, size: 9, tracking: 1.4)
                                Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(Palette.text3)
                            }.padding(.vertical, 12).overlay(alignment: .top) { Hairline() }
                        }.buttonStyle(.plain)
                    }
                    if model.allRoasts.isEmpty { Text("Nothing here yet. Your first roast will land here.").font(.system(size: 15)).foregroundStyle(Palette.text2) }
                }.padding(.horizontal, 22).padding(.bottom, 30)
            }
        }
        .navigationTitle("Roasts").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
        .refreshable { await model.refreshCloud() }
        .task { await model.refreshCloud() }
    }
}
