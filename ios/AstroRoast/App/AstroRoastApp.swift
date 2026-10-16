import SwiftUI
import AstroKit

@main
struct AstroRoastApp: App {
    @State private var model: AppModel
    init() {
        Fonts.register()
        let demo = CommandLine.arguments.contains("-demo")
        _model = State(initialValue: AppModel(demo: demo))
        let tab = UITabBarAppearance(); tab.configureWithOpaqueBackground()
        tab.backgroundColor = UIColor(red: 8/255, green: 8/255, blue: 8/255, alpha: 0.96)
        tab.stackedLayoutAppearance.selected.iconColor = UIColor(Palette.text); tab.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(Palette.text)]
        tab.stackedLayoutAppearance.normal.iconColor = UIColor(Palette.text3); tab.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(Palette.text3)]
        UITabBar.appearance().standardAppearance = tab; UITabBar.appearance().scrollEdgeAppearance = tab
    }
    var body: some Scene {
        WindowGroup {
            RootView().environment(model).preferredColorScheme(.dark).tint(Palette.moon)
                .task { model.recordOpen() }
                .onOpenURL { url in
                    guard url.scheme == "astroroast", model.route == .main else { return }
                    switch url.host { case "today": model.tab = 0; case "month": model.tab = 1; case "roast": model.openRoast = true; default: break }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        Group {
            switch model.route {
            case .welcome: WelcomeView()
            case .birth: BirthView()
            case .rising: RisingView()
            case .warmup: WarmupView()
            case .generating: GeneratingView()
            case .teaser: TeaserView()
            case .main: MainTabs()
            }
        }
        .animation(.easeInOut(duration: 0.35), value: model.route)
        .transition(.opacity)
        .background(Palette.ground)
    }
}
