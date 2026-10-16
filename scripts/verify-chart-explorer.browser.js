(async () => {
  const results = [];
  const check = (name, ok) => results.push({ name, pass: !!ok });
  const pause = () => new Promise((r) => setTimeout(r, 120));
  const tabs = () => document.querySelectorAll(".chart-tabs [role=tab]");
  const clickText = (text) => {
    const b = [...document.querySelectorAll(".chart-explorer button")].find(
      (b) => b.textContent.trim() === text,
    );
    if (!b) throw Error("Missing " + text);
    b.click();
  };
  tabs()[1].click();
  await pause();
  check(
    "human design calculated",
    document
      .querySelector(".chart-stats")
      ?.textContent.includes("Triple Split"),
  );
  check(
    "26 planetary activation rows",
    document.querySelectorAll(".activation-column [role=button]").length === 26,
  );
  clickText("Show essentials");
  await pause();
  check(
    "essentials exposes 21 graph controls",
    document.querySelectorAll(".design-graph [role=button]").length === 47,
  );
  clickText("Show all gates & channels");
  await pause();
  check(
    "full map exposes all 64 gates, 36 channels and 9 centres",
    document.querySelectorAll(".design-graph [role=button]").length === 135,
  );
  const gate = document.querySelector(
    '.design-graph [aria-label="Gate 61, activated"]',
  );
  gate.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  await pause();
  check(
    "gate keyboard opens activation facts",
    document.querySelector(".chart-detail").textContent.includes("61."),
  );
  check(
    "mobile explanation visible",
    document.querySelector(".chart-detail").getBoundingClientRect().top >= 0 &&
      document.querySelector(".chart-detail").getBoundingClientRect().bottom <=
        innerHeight,
  );
  check(
    "selection dims unrelated routes",
    !!document.querySelector('.design-graph [style*="0.18"]'),
  );
  clickText("↑ Back to graph");
  await pause();
  check(
    "return clears selection",
    document
      .querySelector(".chart-detail")
      .textContent.includes("Your wiring. With receipts."),
  );
  const plus = document.querySelector('[aria-label="Zoom in"]');
  plus.click();
  await pause();
  check(
    "HD zoom enlarges map",
    document.querySelector(".design-graph").getBoundingClientRect().width >
      document.querySelector(".chart-map-scroll").clientWidth,
  );
  tabs()[0].click();
  await pause();
  check(
    "astrology list populated",
    document.querySelectorAll(".chart-placements button").length === 10,
  );
  const sun = document.querySelector(".chart-placements button");
  sun.click();
  await pause();
  check(
    "facts available without generated annotation",
    document.querySelector(".chart-detail").textContent.includes("Aquarius"),
  );
  check(
    "no endless reading placeholder",
    !document.body.textContent.includes("Reading the chart…"),
  );
  check(
    "natal hit targets keyboard accessible",
    document.querySelectorAll('.wheel-hits [role=button][tabindex="0"]')
      .length > 10,
  );
  check(
    "aspect connections visible by default",
    !!document.querySelector(".chart-layout") &&
      !document.querySelector(".natal-key-only"),
  );
  clickText("Focus on placements");
  await pause();
  clickText("Show aspect connections");
  await pause();
  check(
    "aspect view toggles",
    !![...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Focus on placements",
    ),
  );
  const pane = document.querySelector(".chart-swipe");
  const emit = (type, x, y) =>
    pane.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        touches:
          type === "touchstart"
            ? [
                new Touch({
                  identifier: 1,
                  target: pane,
                  clientX: x,
                  clientY: y,
                }),
              ]
            : [],
        changedTouches: [
          new Touch({ identifier: 1, target: pane, clientX: x, clientY: y }),
        ],
      }),
    );
  emit("touchstart", 300, 400);
  emit("touchend", 100, 410);
  await pause();
  check(
    "left swipe selects Human Design",
    tabs()[1].getAttribute("aria-selected") === "true",
  );
  emit("touchstart", 100, 400);
  emit("touchend", 300, 410);
  await pause();
  check(
    "right swipe selects astrology",
    tabs()[0].getAttribute("aria-selected") === "true",
  );
  emit("touchstart", 200, 400);
  emit("touchend", 210, 600);
  await pause();
  check(
    "vertical gesture preserves chart",
    tabs()[0].getAttribute("aria-selected") === "true",
  );
  tabs()[0].dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  await pause();
  check(
    "arrow key switches and focuses tab",
    document.activeElement === tabs()[1],
  );
  const scenario = document.querySelector("main>label select");
  scenario.value = "unknown";
  scenario.dispatchEvent(new Event("change", { bubbles: true }));
  await pause();
  tabs()[1].click();
  await pause();
  check(
    "unknown birth time is not fabricated",
    document
      .querySelector(".chart-empty")
      ?.textContent.includes("known birth time"),
  );
  scenario.value = "duo";
  scenario.dispatchEvent(new Event("change", { bubbles: true }));
  await pause();
  check(
    "duo astrology lists both people",
    document.querySelectorAll(".chart-placements button").length === 20,
  );
  tabs()[1].click();
  await pause();
  const person = document.querySelector(".chart-controls select");
  check("duo has HD person selector", person?.options.length === 2);
  const before = document.querySelector(".chart-stats").textContent;
  person.value = "1";
  person.dispatchEvent(new Event("change", { bubbles: true }));
  await pause();
  check(
    "second person gets own calculation",
    document.querySelector(".chart-stats").textContent !== before,
  );
  check(
    "mobile no page overflow",
    document.documentElement.scrollWidth === innerWidth,
  );
  scenario.value = "solo";
  scenario.dispatchEvent(new Event("change", { bubbles: true }));
  await pause();
  tabs()[1].click();
  await pause();
  window.scrollTo({
    top:
      document.querySelector(".chart-stats").getBoundingClientRect().top +
      scrollY -
      20,
    behavior: "instant",
  });
  return {
    viewport: [innerWidth, innerHeight],
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
})();
