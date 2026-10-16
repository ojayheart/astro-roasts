import XCTest

/// Runs the real networking path (generate → poll → decode → teaser, and importing a web-bought roast) against a local mock of the roast API.
final class NetworkFlowTests: XCTestCase {
    let api = "http://127.0.0.1:3999"
    var app: XCUIApplication!
    override func setUp() { continueAfterFailure = false }

    func launch() {
        app = XCUIApplication()
        app.launchArguments = ["-resetstate", "-cannedplaces"]
        app.launchEnvironment["ASTROROAST_API"] = api
        app.launch()
    }
    func http(_ path: String, method: String = "GET") -> Any? {
        var req = URLRequest(url: URL(string: api + path)!); req.httpMethod = method
        var out: Any?; let sem = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: req) { d, _, _ in if let d { out = try? JSONSerialization.jsonObject(with: d) }; sem.signal() }.resume()
        _ = sem.wait(timeout: .now() + 10); return out
    }
    func fillBirth(name: String = "Mara") {
        let n = app.textFields["First name"]; XCTAssertTrue(n.waitForExistence(timeout: 6)); n.tap(); n.typeText(name)
        app.textFields["DD"].tap(); app.typeText("14"); app.typeText("06"); app.typeText("1997"); app.typeText("06"); app.typeText("42")
        let city = app.textFields["City of birth"]; city.tap(); city.typeText("Leeds")
        let leeds = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Leeds'")).firstMatch
        XCTAssertTrue(leeds.waitForExistence(timeout: 5)); leeds.tap()
    }
    func attach(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }

    func testGenerateAndPollAgainstMockAPI() throws {
        _ = http("/log") // ensure reachable
        launch()
        app.buttons["Face it"].tap()
        fillBirth()
        app.buttons["Roast me"].tap(); app.buttons["Not now"].tap()
        // the mock takes ~7s to "write" the roast; the app polls every 3s
        let unlock = app.buttons["Unlock the damage"]
        XCTAssertTrue(unlock.waitForExistence(timeout: 45), "app never reached the teaser through real polling")
        attach("teaser-from-api")
        // teaser text came from the server; paid-only paragraphs must not be present
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Sit down, Mara'")).count > 0, "teaser paragraph missing")
        XCTAssertEqual(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Here is the plot'")).count, 0, "paid text leaked into the teaser")
        // the request the server received matches /api/generate's contract
        let log = try XCTUnwrap(http("/log") as? [[String: Any]])
        let gen = try XCTUnwrap(log.first { ($0["path"] as? String) == "/api/generate" }, "no generate call")
        XCTAssertEqual(gen["method"] as? String, "POST")
        let b = try XCTUnwrap(gen["body"] as? [String: Any])
        XCTAssertEqual(b["name"] as? String, "Mara"); XCTAssertEqual(b["gender"] as? String, "woman")
        XCTAssertEqual(b["date"] as? String, "1997-06-14"); XCTAssertEqual(b["time"] as? String, "06:42")
        XCTAssertEqual(b["birthPlace"] as? String, "Leeds, United Kingdom")
        XCTAssertTrue((log.filter { ($0["path"] as? String)?.hasPrefix("/api/roast/") == true }).count >= 2, "should have polled at least twice")
    }

    func testImportingAWebBoughtRoast() throws {
        let seed = try XCTUnwrap(http("/seed-paid", method: "POST") as? [String: Any])
        let id = try XCTUnwrap(seed["id"] as? String)
        func generateCalls() -> Int { ((http("/log") as? [[String: Any]]) ?? []).filter { ($0["path"] as? String) == "/api/generate" }.count }
        let before = generateCalls()
        launch()
        app.buttons["I already have a roast"].tap()
        let field = app.textFields["astroroast.com/roast/…"]; XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap(); field.typeText("Here it is: https://astroroast.com/roast/\(id)?utm=email thanks")
        app.buttons["Find my roast"].tap()
        // a web roast has no birth details yet, so the app asks for them (it must not generate a second roast)
        fillBirth(name: "Webbuyer")
        app.buttons["Roast me"].tap(); app.buttons["Not now"].tap()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 15), "should land in the app without generating again")
        XCTAssertEqual(generateCalls(), before, "importing must not create a new (paid) roast")
        app.tabBars.buttons["You"].tap()
        XCTAssertTrue(app.staticTexts["Unlocked"].waitForExistence(timeout: 5), "imported roast should be unlocked")
        attach("you-after-import")
    }

    func testServerDownShowsAFriendlyError() {
        app = XCUIApplication(); app.launchArguments = ["-resetstate", "-cannedplaces"]
        app.launchEnvironment["ASTROROAST_API"] = "http://127.0.0.1:3998"   // nothing listening
        app.launch(); app.buttons["Face it"].tap(); fillBirth()
        app.buttons["Roast me"].tap(); app.buttons["Not now"].tap()
        XCTAssertTrue(app.buttons["Try again"].waitForExistence(timeout: 20), "an error + retry should appear when the server is unreachable")
        attach("network-error")
    }
}
