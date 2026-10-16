import Foundation
import EventKit
import AstroKit

enum CalendarSync {
    static let store = EKEventStore()
    static let marker = CalendarPlan.marker
    typealias Planned = CalendarPlan.Planned
    static func plan(natal: NatalChart, prefs: CalendarPrefs, people: [Person], days: Int = 90) -> [Planned] { CalendarPlan.plan(natal: natal, prefs: prefs, people: people, days: days) }
    static func ics(planned: [Planned]) -> String { CalendarPlan.ics(planned: planned) }

    static func requestAccess() async -> Bool { (try? await store.requestFullAccessToEvents()) ?? false }
    static func writableCalendars() -> [EKCalendar] { store.calendars(for: .event).filter { $0.allowsContentModifications } }

    @MainActor
    static func addDay(_ r: DayReading) async {
        guard await requestAccess(), let cal = store.defaultCalendarForNewEvents else { return }
        let e = EKEvent(eventStore: store); e.calendar = cal
        e.title = r.driver.map { Voice.hitName($0) } ?? "Moon in \(r.moonSign)"
        e.notes = "\(r.headline)\n\n\(marker)"; e.isAllDay = true; e.startDate = r.day; e.endDate = r.day
        try? store.save(e, span: .thisEvent)
    }

    /// Replaces previous AstroRoast events in the window, then writes the plan as all-day events with no alerts.
    @MainActor
    static func sync(planned: [Planned], calendarID: String?) async -> Int {
        guard await requestAccess() else { return 0 }
        let cal = calendarID.flatMap { store.calendar(withIdentifier: $0) } ?? store.defaultCalendarForNewEvents
        guard let cal else { return 0 }
        await removeAll()
        var n = 0
        for p in planned {
            let e = EKEvent(eventStore: store); e.calendar = cal; e.title = p.title; e.notes = p.notes + "\n\n" + marker
            e.isAllDay = true; e.startDate = Calendar.current.startOfDay(for: p.date); e.endDate = e.startDate
            e.alarms = []
            if (try? store.save(e, span: .thisEvent, commit: false)) != nil { n += 1 }
        }
        try? store.commit()
        return n
    }

    @MainActor
    static func removeAll() async {
        let start = Calendar.current.date(byAdding: .month, value: -1, to: Date())!, end = Calendar.current.date(byAdding: .year, value: 1, to: Date())!
        for e in store.events(matching: store.predicateForEvents(withStart: start, end: end, calendars: nil)) where e.notes?.contains(marker) == true { try? store.remove(e, span: .thisEvent, commit: false) }
        try? store.commit()
    }

}
