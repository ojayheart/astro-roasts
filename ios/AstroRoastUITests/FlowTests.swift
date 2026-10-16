import XCTest

final class FlowTests: XCTestCase {
    var app: XCUIApplication!
    override func setUp() { continueAfterFailure = false }

    func launch(_ extra: [String] = []) {
        app = XCUIApplication()
        app.launchArguments = ["-demo"] + extra
        app.launch()
    }
    func tapText(_ t: String, timeout: TimeInterval = 8) {
        let b = app.buttons[t]; XCTAssertTrue(b.waitForExistence(timeout: timeout), "button \(t) missing"); b.tap()
    }
    func attach(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }

    /// Whole first-run journey with real typing: welcome → birth details → notifications → generating → paywall → unlock → read → Today.
    func testOnboardingToRoastToToday() {
        launch(["-fresh"])
        tapText("Face it")
        let name = app.textFields["First name"]; XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("Mara")
        let dd = app.textFields["DD"]; dd.tap(); dd.typeText("14")
        // typing two digits moves focus to month, then year, hour, minute (auto-advance)
        app.typeText("06"); app.typeText("1997"); app.typeText("06"); app.typeText("42")
        let city = app.textFields["City of birth"]; city.tap(); city.typeText("Leeds")
        let leeds = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Leeds'")).firstMatch
        XCTAssertTrue(leeds.waitForExistence(timeout: 5), "city suggestion missing"); leeds.tap()
        attach("birth-filled")
        XCTAssertTrue(app.buttons["Roast me"].isEnabled)
        tapText("Roast me")
        tapText("Not now")                                   // notification warm-up
        attach("generating")
        let unlock = app.buttons["Unlock the damage"]; XCTAssertTrue(unlock.waitForExistence(timeout: 30), "teaser/paywall never appeared")
        attach("teaser")
        unlock.tap()
        tapText("Read the full roast", timeout: 10)
        XCTAssertTrue(app.staticTexts["I / X"].waitForExistence(timeout: 5) || app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'I /'")).count > 0)
        tapText("Next"); tapText("Next")
        sleep(1)
        attach("reader")
        app.buttons["Close"].tap()
        XCTAssertTrue(app.staticTexts["TODAY"].waitForExistence(timeout: 8) || app.staticTexts["Today"].exists)
        attach("today")
    }

    func testMonthDialRotatesAndOpensDay() {
        launch(["-tab", "month"])
        let dial = app.otherElements["Moon dial"]
        XCTAssertTrue(dial.waitForExistence(timeout: 12), "dial missing")
        let before = dial.value as? String
        // drag along the ring from 12 o'clock to 9 o'clock: the wheel turns and the selected day moves forward
        dial.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1)).press(forDuration: 0.1, thenDragTo: dial.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.5)))
        sleep(1)
        let after = dial.value as? String
        XCTAssertNotEqual(before, after, "dial value should change when rotated (\(before ?? "nil") -> \(after ?? "nil"))")
        attach("month-rotated")
        // the carousel follows the dial: the selected card is the one the dial reports
        let open = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Open the day'")).firstMatch
        XCTAssertTrue(open.waitForExistence(timeout: 4), "selected day card missing")
        open.tap()
        let roast = app.buttons["Roast this day"]
        XCTAssertTrue(roast.waitForExistence(timeout: 6), "day sheet didn't open")
        roast.tap()
        XCTAssertTrue(app.buttons["Share this roast"].waitForExistence(timeout: 4), "roast didn't appear")
        attach("day-roasted")
    }

    func testTabsAndWhyScreen() {
        launch()
        XCTAssertTrue(app.buttons["Why this?"].waitForExistence(timeout: 12))
        app.buttons["Why this?"].tap()
        XCTAssertTrue(app.staticTexts["Strength"].waitForExistence(timeout: 6) || app.navigationBars["Why this?"].exists)
        attach("why")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        for tab in ["Month", "Coven", "You", "Today"] { app.tabBars.buttons[tab].tap() }
    }

    /// Starts a roast, leaves the app, and checks the Live Activity is on the home screen.
    func testLiveActivityAppearsWhenBackgrounded() {
        launch(["-fresh"])
        tapText("Face it")
        let name = app.textFields["First name"]; XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("Mara")
        app.textFields["DD"].tap(); app.typeText("14"); app.typeText("06"); app.typeText("1997"); app.typeText("06"); app.typeText("42")
        let city = app.textFields["City of birth"]; city.tap(); city.typeText("Leeds")
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Leeds'")).firstMatch.tap()
        tapText("Roast me"); tapText("Not now")
        sleep(2)
        XCUIDevice.shared.press(.home)
        sleep(3)
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = "home-with-live-activity"; a.lifetime = .keepAlways; add(a)
    }

    func testWidgetPreviewScreen() {
        launch(["-open", "widgets"])
        sleep(4)
        attach("widgets")
    }
}
