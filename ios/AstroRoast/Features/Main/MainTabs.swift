import SwiftUI
import AstroKit

struct ShareContent: Identifiable, Hashable {
    let id = UUID()
    let text: String
    let kicker: String
    let footer: String
}

enum Dest: Hashable {
    case why(Date), roast, situations, receipts, sunday, draft, bodygraph, person(UUID), roasts
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var m = model
        TabView(selection: $m.tab) {
            NavigationStack(path: $m.path) { TodayView().destinations() }.tabItem { Label("Today", systemImage: "sun.max") }.tag(0)
            NavigationStack { MonthView().destinations() }.tabItem { Label("Month", systemImage: "moon.circle") }.tag(1)
            NavigationStack { CovenView().destinations() }.tabItem { Label("Coven", systemImage: "person.2") }.tag(2)
            NavigationStack { YouView().destinations() }.tabItem { Label("You", systemImage: "circle.hexagongrid") }.tag(3)
        }
        .sheet(item: $m.sheet) { sheet in
            switch sheet {
            case .plans: PlansView().presentationBackground(Palette.ground)
            case .calendar: CalendarSyncView().presentationBackground(Palette.ground)
            case .anyone: AnyoneView().presentationBackground(Palette.ground)
            case .addPerson: AnyoneView(addOnly: true).presentationBackground(Palette.ground)
            case .day(let d): DayDetailView(date: d).presentationDetents([.large]).presentationBackground(Palette.surface)
            case .share(let c): ShareSheetView(content: c).presentationBackground(Palette.ground)
            case .adopt: SignInSheet().presentationDetents([.large]).presentationBackground(Palette.surface)
            case .signIn: SignInSheet().presentationDetents([.large]).presentationBackground(Palette.surface)
            case .widgets: WidgetPreviewView().presentationBackground(Color(white: 0.12))
            }
        }
        .fullScreenCover(isPresented: $m.openRoast) { RoastReaderView().environment(model) }
        .task { handleDeepLink() }
    }

    private func handleDeepLink() {
        guard let d = model.deepLink else { return }
        model.deepLink = nil
        let today = Date()
        switch d {
        case "why": if let r = model.today, r.driver != nil { model.path.append(Dest.why(today)) } else { model.path.append(Dest.why(Calendar.current.date(byAdding: .day, value: 1, to: today)!)) }
        case "roast": model.openRoast = true
        case "share": model.share(model.today?.headline ?? "Quiet sky.", kicker: "Today")
        case "plans": model.sheet = .plans
        case "signin": model.sheet = .signIn
        case "roasts": model.path.append(Dest.roasts)
        case "widgets": model.sheet = .widgets
        case "calendar": model.sheet = .calendar
        case "anyone": model.sheet = .anyone
        case "day": model.sheet = .day(today)
        case "sunday": model.path.append(Dest.sunday)
        case "situations": model.path.append(Dest.situations)
        case "receipts": model.path.append(Dest.receipts)
        case "draft": model.path.append(Dest.draft)
        case "bodygraph": model.path.append(Dest.bodygraph)
        default: break
        }
    }
}

extension View {
    func destinations() -> some View {
        navigationDestination(for: Dest.self) { d in
            switch d {
            case .why(let date): WhyView(date: date)
            case .roast: RoastReaderView()
            case .situations: SituationsView()
            case .receipts: ReceiptsView()
            case .sunday: SundayView()
            case .draft: DraftView()
            case .bodygraph: BodygraphView()
            case .person(let id): PersonDetailView(id: id)
            case .roasts: RoastsView()
            }
        }
    }
}

/// Wraps Roast+ screens: free users see a blurred preview and an unlock card.
struct PlusGate<Content: View>: View {
    @Environment(AppModel.self) private var model
    let title: String; let blurb: String
    @ViewBuilder let content: Content
    var body: some View {
        if model.isPlus { content }
        else {
            ZStack {
                content.blur(radius: 9).allowsHitTesting(false).accessibilityHidden(true)
                Rectangle().fill(Palette.ground.opacity(0.55))
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        MonoLabel("Roast+", color: Palette.emberSoft)
                        Text(title).font(.display(26, .bold)).tracking(-0.5).foregroundStyle(Palette.text)
                        Text(blurb).font(.system(size: 15)).foregroundStyle(Palette.text2)
                        Button("See Roast+") { model.sheet = .plans }.buttonStyle(.primary)
                    }
                }.padding(20)
            }
        }
    }
}
