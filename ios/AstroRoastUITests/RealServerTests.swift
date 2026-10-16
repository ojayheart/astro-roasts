import XCTest

/// Runs the real app against the real API and database. Skipped unless these are provided:
///   TEST_RUNNER_REAL_API=http://127.0.0.1:3100 TEST_RUNNER_REAL_EMAIL=you@example.com TEST_RUNNER_REAL_CODE=123456 xcodebuild test ...
/// (the code is the 6-digit code the server would email; REAL_NAME is the person to pick; REAL_SIGNS "Sun,Moon,Rising" are asserted on the You tab)
final class RealServerTests: XCTestCase {
    func testSignInAgainstTheRealServerRestoresTheRightChart() throws {
        let env = ProcessInfo.processInfo.environment
        guard let api = env["REAL_API"], let email = env["REAL_EMAIL"], let code = env["REAL_CODE"] else { throw XCTSkip("real-server env not provided") }
        let app = XCUIApplication()
        app.launchArguments = ["-resetstate"]            // real MapKit place search, real everything
        app.launchEnvironment["ASTROROAST_API"] = api
        app.launch()
        app.buttons["I already have roasts"].tap()
        let f = app.textFields["Email address"]; XCTAssertTrue(f.waitForExistence(timeout: 8)); f.tap(); f.typeText(email)
        app.buttons["Send code"].tap()
        let field = app.textFields["123456"]; XCTAssertTrue(field.waitForExistence(timeout: 20), "the real server should accept the address and move to the code step")
        field.tap(); field.typeText(String(code.dropLast())); app.keys[String(code.last!)].tap()
        let found = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'We found'")).firstMatch
        XCTAssertTrue(found.waitForExistence(timeout: 30), "real roasts should load")
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = "real-found"; a.lifetime = .keepAlways; add(a)
        let name = env["REAL_NAME"] ?? ""
        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5), "row for \(name)"); row.tap()
        XCTAssertTrue(app.tabBars.buttons["You"].waitForExistence(timeout: 40), "profile should be restored from the saved birth details (real geocoding)")
        app.tabBars.buttons["You"].tap()
        sleep(2)
        let b = XCTAttachment(screenshot: app.screenshot()); b.name = "real-you"; b.lifetime = .keepAlways; add(b)
        for sign in (env["REAL_SIGNS"] ?? "").split(separator: ",").map(String.init) where !sign.isEmpty {
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", sign)).firstMatch.exists, "the chart computed on the phone should show \(sign), matching the server's roast")
        }
    }
}
