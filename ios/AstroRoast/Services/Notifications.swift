import Foundation
import UserNotifications
import AstroKit

@MainActor
enum Notifications {
    static func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }
    static func isAllowed() async -> Bool {
        let s = await UNUserNotificationCenter.current().notificationSettings()
        return s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
    }

    /// At most two heads-ups a week, only for things that would change your plans: retrogrades, eclipses-grade moons,
    /// and your heaviest personal transits. Honors quiet hours and the user's level.
    static func rescheduleIfAllowed(_ model: AppModel) async {
        guard await isAllowed() else { return }
        await reschedule(model)
    }
    static func reschedule(_ model: AppModel) async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        let prefs = model.state.notifications
        guard prefs.level != .never, let natal = model.natal else { return }
        let now = Date(), horizon = Calendar.current.date(byAdding: .day, value: 56, to: now)!
        var candidates: [(Date, String, String, Double)] = []
        for e in Sky.planetaryEvents(from: now, to: horizon) where e.kind == .stationRetrograde || e.kind == .stationDirect {
            guard e.title.contains("Mercury") || e.title.contains("Venus") else { continue }
            let body = e.kind == .stationRetrograde ? "Back up your phone. Do not back up to your ex." : "Texts make sense again. Mostly."
            candidates.append((e.date.addingTimeInterval(-86400), e.title.replacingOccurrences(of: " turns", with: " goes") + " tomorrow", body, 6))
        }
        for e in Sky.moonPhases(from: now, to: horizon) where e.kind == .fullMoon || e.kind == .newMoon {
            let body = e.kind == .fullMoon ? "Something you said in May comes back tonight." : "Plant something. Not a grudge."
            candidates.append((e.date.addingTimeInterval(-3600 * 3), e.title + " tonight", body, 4))
        }
        // personal transits: exact day of heavy hits
        var day = now
        while day < horizon {
            let noon = Calendar.current.startOfDay(for: day).addingTimeInterval(12 * 3600)
            if let h = Sky.hits(natal: natal, on: noon, maxOrb: 0.4, bodies: Body.slow + [.mars]).first, h.weight >= 4.5 {
                candidates.append((noon.addingTimeInterval(-3600 * 3), "\(Voice.hitName(h)) is exact today", Voice.sentence(for: h, seed: Voice.seed(noon)), h.weight))
            }
            day = Calendar.current.date(byAdding: .day, value: 1, to: day)!
        }
        candidates.sort { $0.0 < $1.0 }
        // at most 2 per ISO week, highest weight wins
        var byWeek: [Int: [(Date, String, String, Double)]] = [:]
        for c in candidates where c.0 > now { byWeek[Calendar.current.component(.weekOfYear, from: c.0) * 10000 + Calendar.current.component(.yearForWeekOfYear, from: c.0), default: []].append(c) }
        for (_, list) in byWeek {
            for c in list.sorted(by: { $0.3 > $1.3 }).prefix(2) {
                var when = c.0
                let hour = Calendar.current.component(.hour, from: when)
                if hour >= prefs.quietStart || hour < prefs.quietEnd { when = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: when.addingTimeInterval(hour >= prefs.quietStart ? 86400 : 0)) ?? when }
                let content = UNMutableNotificationContent(); content.title = c.1; content.body = c.2; content.sound = .default
                let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: when)
                try? await center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)))
            }
        }
    }
    static func remind(on day: Date, title: String, body: String) async {
        guard await requestAuthorization() else { return }
        let c = UNMutableNotificationContent(); c.title = title; c.body = body; c.sound = .default
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: day); comps.hour = 9; comps.minute = 0
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)))
    }
    static func notifyRoastReady(name: String) async {
        let c = UNMutableNotificationContent(); c.title = "Your roast is ready"; c.body = "Sit down first, \(name)."; c.sound = .default
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "roast-ready", content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))
    }
}
