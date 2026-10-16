// MIT: whitspce/hd-chart. See HD-LICENSE.txt.
import * as A from "astronomy-engine";
"use strict";

  // The wheel starts with Gate 41 at 2 deg Aquarius (302 absolute).
  // Each gate spans 5.625 deg, each of its six lines 0.9375 deg.
  var WHEEL_START = 302.0;
  var GATE_ORDER = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];

  var GATE_CENTER = {
    64: "Head", 61: "Head", 63: "Head",
    47: "Ajna", 24: "Ajna", 4: "Ajna", 17: "Ajna", 43: "Ajna", 11: "Ajna",
    62: "Throat", 23: "Throat", 56: "Throat", 35: "Throat", 12: "Throat",
    45: "Throat", 33: "Throat", 8: "Throat", 31: "Throat", 20: "Throat",
    16: "Throat",
    1: "G", 13: "G", 25: "G", 46: "G", 2: "G", 15: "G", 10: "G", 7: "G",
    21: "Ego", 40: "Ego", 26: "Ego", 51: "Ego",
    34: "Sacral", 5: "Sacral", 14: "Sacral", 29: "Sacral", 59: "Sacral",
    9: "Sacral", 3: "Sacral", 42: "Sacral", 27: "Sacral",
    48: "Spleen", 57: "Spleen", 44: "Spleen", 50: "Spleen", 32: "Spleen",
    28: "Spleen", 18: "Spleen",
    36: "SolarPlexus", 22: "SolarPlexus", 37: "SolarPlexus",
    6: "SolarPlexus", 49: "SolarPlexus", 55: "SolarPlexus",
    30: "SolarPlexus",
    53: "Root", 60: "Root", 52: "Root", 19: "Root", 39: "Root", 41: "Root",
    58: "Root", 38: "Root", 54: "Root"
  };

  var CHANNELS = [
    [64, 47], [61, 24], [63, 4],
    [17, 62], [43, 23], [11, 56],
    [31, 7], [8, 1], [33, 13],
    [20, 34], [20, 57], [20, 10], [16, 48], [12, 22], [35, 36], [45, 21],
    [2, 14], [46, 29], [15, 5], [10, 34], [10, 57], [25, 51],
    [53, 42], [60, 3], [52, 9], [27, 50], [34, 57], [59, 6],
    [32, 54], [28, 38], [18, 58],
    [19, 49], [39, 55], [41, 30],
    [26, 44], [40, 37]];

  var MOTORS = { Sacral: 1, Ego: 1, SolarPlexus: 1, Root: 1 };

  var TYPE_INFO = {
    Manifestor: { strategy: "To inform", signature: "Peace", notSelf: "Anger" },
    Generator: { strategy: "To respond", signature: "Satisfaction", notSelf: "Frustration" },
    "Manifesting Generator": { strategy: "To respond", signature: "Satisfaction", notSelf: "Frustration" },
    Projector: { strategy: "Wait for recognition and the invitation", signature: "Success", notSelf: "Bitterness" },
    Reflector: { strategy: "Wait a lunar cycle", signature: "Surprise", notSelf: "Disappointment" }
  };

  var LINE_NAMES = ["", "Investigator", "Hermit", "Martyr", "Opportunist",
    "Heretic", "Role Model"];

  var RIGHT_ANGLE = { "1/3": 1, "1/4": 1, "2/4": 1, "2/5": 1, "3/5": 1, "3/6": 1, "4/6": 1 };
  var LEFT_ANGLE = { "5/1": 1, "5/2": 1, "6/2": 1, "6/3": 1 };

  // Cross names by personality Sun gate: [Right Angle, Juxtaposition, Left Angle]
  var CROSSES = {"1":["The Right Angle Cross of the Sphinx 4","The Juxtaposition Cross of Self-Expression","The Left Angle Cross of Defiance 2"],"2":["The Right Angle Cross of the Sphinx 2","The Juxtaposition Cross of the Driver","The Left Angle Cross of Defiance"],"3":["The Right Angle Cross of Laws","The Juxtaposition Cross of Mutation","The Left Angle Cross of Wishes"],"4":["The Right Angle Cross of Explanation 3","The Juxtaposition Cross of Formulization","The Left Angle Cross of Revolution 2"],"5":["The Right Angle Cross of Consciousness 4","The Juxtaposition Cross of Habits","The Left Angle Cross of Separation 2"],"6":["The Right Angle Cross of Eden 3","The Juxtaposition Cross of Conflict","The Left Angle Cross of the Plane 2"],"7":["The Right Angle Cross of the Sphinx 3","The Juxtaposition Cross of Interaction","The Left Angle Cross of Masks 2"],"8":["The Right Angle Cross of Contagion 2","The Juxtaposition Cross of Contribution","The Left Angle Cross of Uncertainty"],"9":["The Right Angle Cross of Planning 4","The Juxtaposition Cross of Focus","The Left Angle Cross of Identification 2"],"10":["The Right Angle Cross of Vessel of Love 4","The Juxtaposition Cross of Behavior","The Left Angle Cross of Prevention 2"],"11":["The Right Angle Cross of Eden 4","The Juxtaposition Cross of Ideas","The Left Angle Cross of Education 2"],"12":["The Right Angle Cross of Eden 2","The Juxtaposition Cross of Articulation","The Left Angle Cross of Education"],"13":["The Right Angle Cross of the Sphinx","The Juxtaposition Cross of Listening","The Left Angle Cross of Masks"],"14":["The Right Angle Cross of Contagion 4","The Juxtaposition Cross of Empowering","The Left Angle Cross of Uncertainty 2"],"15":["The Right Angle Cross of the Vessel of Love 2","The Juxtaposition Cross of Extremes","The Left Angle Cross of Prevention"],"16":["The Right Angle Cross of Planning 2","The Juxtaposition Cross of Experimentation","The Left Angle Cross of Identification"],"17":["The Right Angle Cross of Service","The Juxtaposition Cross of Opinions","The Left Angle Cross of Upheaval"],"18":["The Right Angle Cross of Service 3","The Juxtaposition Cross of Correction","The Left Angle Cross of Upheaval 2"],"19":["The Right Angle Cross of the Four Ways 4","The Juxtaposition Cross of Need","The Left Angle Cross of Refinement 2"],"20":["The Right Angle Cross of the Sleeping Phoenix 2","The Juxtaposition Cross of the Now","The Left Angle Cross of Duality"],"21":["The Right Angle Cross of Tension","The Juxtaposition Cross of Control","The Left Angle Cross of Endeavour"],"22":["The Right Angle Cross of Rulership","The Juxtaposition Cross of Grace","The Left Angle Cross of Informing"],"23":["The Right Angle Cross of Explanation 2","The Juxtaposition Cross of Assimilation","The Left Angle Cross of Dedication"],"24":["The Right Angle Cross of the Four Ways","The Juxtaposition Cross of Rationalization","The Left Angle Cross of Incarnation"],"25":["The Right Angle Cross of the Vessel of Love","The Juxtaposition Cross of Innocence","The Left Angle Cross of Healing"],"26":["The Right Angle Cross of Rulership 4","The Juxtaposition Cross of the Trickster","The Left Angle Cross of Confrontation 2"],"27":["The Right Angle Cross of the Unexpected","The Juxtaposition Cross of Caring","The Left Angle Cross of Alignment"],"28":["The Right Angle Cross of the Unexpected 3","The Juxtaposition Cross of Risks","The Left Angle Cross of Alignment 2"],"29":["The Right Angle Cross of Contagion 3","The Juxtaposition Cross of Commitment","The Left Angle Cross of Industry 2"],"30":["The Right Angle Cross of Contagion","The Juxtaposition Cross of Fates","The Left Angle Cross of Industry"],"31":["The Right Angle Cross of the Unexpected 2","The Juxtaposition Cross of Influence","The Left Angle Cross of the Alpha"],"32":["The Right Angle Cross of Maya 3","The Juxtaposition Cross of Conservation","The Left Angle Cross of Limitation 2"],"33":["The Right Angle Cross of the Four Ways 2","The Juxtaposition Cross of Retreat","The Left Angle Cross of Refinement"],"34":["The Right Angle Cross of the Sleeping Phoenix 4","The Juxtaposition Cross of Power","The Left Angle Cross of Duality 2"],"35":["The Right Angle Cross of Consciousness 2","The Juxtaposition Cross of Experience","The Left Angle Cross of Separation"],"36":["The Right Angle Cross of the Eden","The Juxtaposition Cross of Crisis","The Left Angle Cross of the Plane"],"37":["The Right Angle Cross of Planning","The Juxtaposition Cross of Bargains","The Left Angle Cross of Migration"],"38":["The Right Angle Cross of Tension 4","The Juxtaposition Cross of Opposition","The Left Angle Cross of Individualism 2"],"39":["The Right Angle Cross of Tension 2","The Juxtaposition Cross of Provocation","The Left Angle Cross of Individualism"],"40":["The Right Angle Cross of Planning 3","The Juxtaposition Cross of Denial","The Left Angle Cross of Migration 2"],"41":["The Right Angle Cross of the Unexpected 4","The Juxtaposition Cross of Fantasy","The Left Angle Cross of the Alpha 2"],"42":["The Right Angle Cross of Maya","The Juxtaposition Cross of Completion","The Left Angle Cross of Limitation"],"43":["The Right Angle Cross of Explanation 4","The Juxtaposition Cross of Insight","The Left Angle Cross of Dedication 2"],"44":["The Right Angle Cross of the Four Ways 3","The Juxtaposition Cross of Alertness","The Left Angle Cross of Incarnation 2"],"45":["The Right Angle Cross of Rulership 2","The Juxtaposition Cross of Possession","The Left Angle Cross of Confrontation"],"46":["The Right Angle Cross of the Vessel of Love 3","The Juxtaposition Cross of Serendipity","The Left Angle Cross of Healing 2"],"47":["The Right Angle Cross of Rulership 3","The Juxtaposition Cross of Oppression","The Left Angle Cross of Informing 2"],"48":["The Right Angle Cross of Tension 3","The Juxtaposition Cross of Depth","The Left Angle Cross of Endeavour 2"],"49":["The Right Angle Cross of Explanation","The Juxtaposition Cross of Principles","The Left Angle Cross of Revolution"],"50":["The Right Angle Cross of Laws 3","The Juxtaposition Cross of Values","The Left Angle Cross of Wishes 2"],"51":["The Right Angle Cross of Penetration","The Juxtaposition Cross of Shock","The Left Angle Cross of the Clarion"],"52":["The Right Angle Cross of Service 2","The Juxtaposition Cross of Stillness","The Left Angle Cross of Demands"],"53":["The Right Angle Cross of Penetration 2","The Juxtaposition Cross of Beginnings","The Left Angle Cross of Cycles"],"54":["The Right Angle Cross of Penetration 4","The Juxtaposition Cross of Ambition","The Left Angle Cross of Cycles 2"],"55":["The Right Angle Cross of the Sleeping Phoenix","The Juxtaposition Cross of Moods","The Left Angle Cross of Spirit"],"56":["The Right Angle Cross of Laws 2","The Juxtaposition Cross of Stimulation","The Left Angle Cross of Distraction"],"57":["The Right Angle Cross of Penetration 3","The Juxtaposition Cross of Intuition","The Left Angle Cross of the Clarion 2"],"58":["The Right Angle Cross of Service 4","The Juxtaposition Cross of Vitality","The Left Angle Cross of Demands 2"],"59":["The Right Angle Cross of the Sleeping Phoenix 3","The Juxtaposition Cross of Strategy","The Left Angle Cross of Spirit 2"],"60":["The Right Angle Cross of Laws 4","The Juxtaposition Cross of Limitation","The Left Angle Cross of Distraction 2"],"61":["The Right Angle Cross of Maya 4","The Juxtaposition Cross of Thinking","The Left Angle Cross of Obscuration 2"],"62":["The Right Angle Cross of Maya 2","The Juxtaposition Cross of Detail","The Left Angle Cross of Obscuration"],"63":["The Right Angle Cross of Consciousness","The Juxtaposition Cross of Doubts","The Left Angle Cross of Dominion"],"64":["The Right Angle Cross of Consciousness 3","The Juxtaposition Cross of Confusion","The Left Angle Cross of Dominion 2"]};

  var PLANETS = [
    ["sun", null], ["earth", null], ["northNode", null], ["southNode", null],
    ["moon", "Moon"], ["mercury", "Mercury"], ["venus", "Venus"],
    ["mars", "Mars"], ["jupiter", "Jupiter"], ["saturn", "Saturn"],
    ["uranus", "Uranus"], ["neptune", "Neptune"], ["pluto", "Pluto"]];

  var DESIGN_ARC = 88.0;
  var DAY_MS = 86400000;

  // ---------------------------------------------------------------- time

  // Convert a wall-clock birth time in an IANA zone to a UTC Date by
  // iterating with Intl, which carries the full historical tz database.
  function localToUTC(y, mo, d, h, mi, tz) {
    var fixed = /^([+-])(\d{1,2}):(\d{2})$/.exec(tz);
    var want = Date.UTC(y, mo - 1, d, h, mi, 0);
    if (fixed) {
      var off = (parseInt(fixed[2], 10) * 60 + parseInt(fixed[3], 10)) * 60000;
      return new Date(want - (fixed[1] === "+" ? off : -off));
    }
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
    var guess = want;
    for (var i = 0; i < 4; i++) {
      var p = {};
      fmt.formatToParts(new Date(guess)).forEach(function (x) { p[x.type] = x.value; });
      var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day,
        p.hour === "24" ? 0 : +p.hour, +p.minute, +p.second);
      if (asUTC === want) break;
      guess += want - asUTC;
    }
    return new Date(guess);
  }

  // ----------------------------------------------------------- ephemeris

  function norm(x) { return ((x % 360) + 360) % 360; }

  function sunLon(date) { return A.SunPosition(date).elon; }

  function trueNodeLon(date) {
    // Osculating ascending node of the Moon's geocentric orbit: rotate the
    // lunar state vector into the true ecliptic of date, take r x v.
    var t = A.MakeTime(date);
    var s = A.GeoMoonState(t);
    var rot = A.Rotation_EQJ_ECT(t);
    var r = A.RotateVector(rot, new A.Vector(s.x, s.y, s.z, t));
    var v = A.RotateVector(rot, new A.Vector(s.vx, s.vy, s.vz, t));
    var hx = r.y * v.z - r.z * v.y;
    var hy = r.z * v.x - r.x * v.z;
    return norm(Math.atan2(hx, -hy) * 180 / Math.PI);
  }

  function positions(date) {
    var sun = sunLon(date);
    var node = trueNodeLon(date);
    var out = {
      sun: sun, earth: norm(sun + 180),
      northNode: node, southNode: norm(node + 180),
      moon: A.EclipticGeoMoon(A.MakeTime(date)).lon
    };
    for (var i = 5; i < PLANETS.length; i++) {
      var body = PLANETS[i][1];
      var vec = A.GeoVector(A.Body[body], date, true);
      out[PLANETS[i][0]] = A.Ecliptic(vec).elon;
    }
    return out;
  }

  // Instant when the Sun sat DESIGN_ARC degrees behind its natal position.
  function designTime(birth) {
    var target = norm(sunLon(birth) - DESIGN_ARC);
    var t = birth.getTime() - (DESIGN_ARC / 0.9856) * DAY_MS;
    for (var i = 0; i < 30; i++) {
      var lon = sunLon(new Date(t));
      var delta = ((target - lon + 540) % 360) - 180;
      if (Math.abs(delta) < 1e-7) break;
      var rate = ((sunLon(new Date(t + DAY_MS / 2)) - lon + 540) % 360) - 180;
      t += delta / (rate * 2) * DAY_MS;
    }
    return new Date(Math.round(t));
  }

  // ---------------------------------------------------------------- wheel

  function gateLine(lon) {
    var off = norm(lon - WHEEL_START);
    return {
      gate: GATE_ORDER[Math.floor(off / 5.625)],
      line: Math.floor((off % 5.625) / 0.9375) + 1
    };
  }

  // ---------------------------------------------------------------- graph

  function centerGraph(channels) {
    var adj = {};
    channels.forEach(function (ch) {
      var a = GATE_CENTER[ch[0]], b = GATE_CENTER[ch[1]];
      (adj[a] = adj[a] || {})[b] = 1;
      (adj[b] = adj[b] || {})[a] = 1;
    });
    return adj;
  }

  function reaches(adj, start, targets) {
    var seen = {}, stack = [start];
    seen[start] = 1;
    while (stack.length) {
      var c = stack.pop();
      if (targets[c]) return true;
      for (var n in adj[c] || {}) if (!seen[n]) { seen[n] = 1; stack.push(n); }
    }
    return false;
  }

  function componentCount(centers, adj) {
    var seen = {}, comps = 0;
    centers.forEach(function (c) {
      if (seen[c]) return;
      comps++;
      var stack = [c]; seen[c] = 1;
      while (stack.length) {
        var x = stack.pop();
        for (var n in adj[x] || {}) if (!seen[n]) { seen[n] = 1; stack.push(n); }
      }
    });
    return comps;
  }

  // ---------------------------------------------------------------- chart

  function fmt(a) { return a.gate + "." + a.line; }

  function build(y, mo, d, h, mi, tz) {
    var birthUTC = localToUTC(y, mo, d, h, mi, tz);
    var desUTC = designTime(birthUTC);

    var pLon = positions(birthUTC), dLon = positions(desUTC);
    var pers = {}, des = {}, k;
    for (k in pLon) pers[k] = gateLine(pLon[k]);
    for (k in dLon) des[k] = gateLine(dLon[k]);

    var coloring = {};
    for (k in des) coloring[des[k].gate] = "design";
    for (k in pers) {
      var g = pers[k].gate;
      coloring[g] = coloring[g] === "design" || coloring[g] === "both" ? "both" : "personality";
    }

    var active = {};
    for (k in coloring) active[k] = 1;
    var channels = CHANNELS.filter(function (ch) {
      return active[ch[0]] && active[ch[1]];
    });

    var centerSet = {};
    channels.forEach(function (ch) {
      centerSet[GATE_CENTER[ch[0]]] = 1;
      centerSet[GATE_CENTER[ch[1]]] = 1;
    });
    var centers = Object.keys(centerSet);
    var adj = centerGraph(channels);

    var motorToThroat = centerSet.Throat && reaches(adj, "Throat", MOTORS);
    var type;
    if (!centers.length) type = "Reflector";
    else if (centerSet.Sacral) type = motorToThroat ? "Manifesting Generator" : "Generator";
    else type = motorToThroat ? "Manifestor" : "Projector";

    var authority;
    if (!centers.length) authority = "Lunar";
    else if (centerSet.SolarPlexus) authority = "Emotional";
    else if (centerSet.Sacral) authority = "Sacral";
    else if (centerSet.Spleen) authority = "Splenic";
    else if (centerSet.Ego) authority = "Ego";
    else if (centerSet.G) authority = "Self-Projected";
    else authority = "Mental";

    var profile = pers.sun.line + "/" + des.sun.line;
    var angle = RIGHT_ANGLE[profile] ? "Right Angle" :
      LEFT_ANGLE[profile] ? "Left Angle" : "Juxtaposition";
    var crossNames = CROSSES[String(pers.sun.gate)] || ["", "", ""];
    var crossName = crossNames[angle === "Right Angle" ? 0 : angle === "Juxtaposition" ? 1 : 2];

    var comps = componentCount(centers, adj);
    var definition = ["No definition", "Single", "Split", "Triple Split",
      "Quadruple Split"][comps] || comps + " components";

    crossName = crossName.replace(/^The /, "");

    return {
      birthUTC: birthUTC.toISOString(),
      designUTC: desUTC.toISOString(),
      type: type,
      strategy: TYPE_INFO[type].strategy,
      signature: TYPE_INFO[type].signature,
      notSelf: TYPE_INFO[type].notSelf,
      authority: authority,
      profile: profile,
      profileName: LINE_NAMES[pers.sun.line] + " / " + LINE_NAMES[des.sun.line],
      definition: definition,
      cross: {
        name: crossName,
        angle: angle,
        gates: [pers.sun.gate, pers.earth.gate, des.sun.gate, des.earth.gate],
        notation: pers.sun.gate + "/" + pers.earth.gate + " | " +
          des.sun.gate + "/" + des.earth.gate
      },
      personality: pers,
      design: des,
      centers: centers.sort(),
      channels: channels,
      gates: Object.keys(coloring).map(function (g) {
        return { gate: +g, coloring: coloring[g] };
      }),
      activations: {
        personality: mapValues(pers, fmt),
        design: mapValues(des, fmt)
      }
    };
  }

  function mapValues(o, f) {
    var out = {};
    for (var k in o) out[k] = f(o[k]);
    return out;
  }

  function signature(birthUTC) {
    var desUTC = designTime(birthUTC);
    var p = positions(birthUTC), d = positions(desUTC), sig = [], k;
    for (k in p) { var a = gateLine(p[k]); sig.push(k + a.gate + "." + a.line); }
    for (k in d) { var b = gateLine(d[k]); sig.push("d" + k + b.gate + "." + b.line); }
    return sig.join("|");
  }

  // Minutes the stated birth time can shift each way while producing the
  // identical chart. Rate estimate first, then a direct scan to be exact.
  function stability(y, mo, d, h, mi, tz) {
    var birth = localToUTC(y, mo, d, h, mi, tz);
    var des = designTime(birth);
    var est = { fwd: Infinity, bwd: Infinity };
    [birth, des].forEach(function (t0) {
      var p1 = positions(t0);
      var p2 = positions(new Date(t0.getTime() + DAY_MS / 48));
      for (var k in p1) {
        var rate = (((p2[k] - p1[k] + 540) % 360) - 180) / (1 / 48);
        if (Math.abs(rate) < 1e-4) continue;
        var frac = norm(p1[k] - WHEEL_START) % 0.9375;
        var up = 0.9375 - frac, down = frac;
        var f = (rate > 0 ? up : down) / Math.abs(rate) * 1440;
        var b = (rate > 0 ? down : up) / Math.abs(rate) * 1440;
        if (f < est.fwd) est.fwd = f;
        if (b < est.bwd) est.bwd = b;
      }
    });
    var sig = signature(birth);
    function refine(estMin, sign) {
      var m = Math.max(1, Math.floor(estMin) - 5);
      while (signature(new Date(birth.getTime() + sign * m * 60000)) === sig) {
        m++;
        if (m > estMin + 30) throw new Error("boundary not found");
      }
      return m - 1;
    }
    return { minus: refine(est.bwd, -1), plus: refine(est.fwd, +1) };
  }

  // What the headline facts are at one minute of the day, keyed for
  // comparison. Line changes inside the same gate only matter through the
  // Sun (profile), which the profile field captures.
  function headlineAt(y, mo, d, m, tz) {
    var c = build(y, mo, d, Math.floor(m / 60), m % 60, tz);
    return {
      key: [c.type, c.authority, c.profile, c.definition,
        c.cross.notation].join("|"),
      facts: {
        type: c.type, strategy: c.strategy, authority: c.authority,
        profile: c.profile, profileName: c.profileName,
        definition: c.definition, cross: c.cross,
        signature: c.signature, notSelf: c.notSelf
      }
    };
  }

  // Sweep a whole day for someone whose birth time is unknown. Returns an
  // incremental job: call tick() repeatedly (it returns progress 0..1);
  // when done, segments holds [{from, to, facts}] in minutes since 00:00,
  // boundaries exact to the minute.
  function daySweep(y, mo, d, tz) {
    var STEP = 6;
    var mins = [];
    for (var m = 0; m < 1440; m += STEP) mins.push(m);
    if (mins[mins.length - 1] !== 1439) mins.push(1439);

    var samples = [];
    var job = { done: false, segments: null };

    function at(m) { return headlineAt(y, mo, d, m, tz); }

    // First minute in (lo, hi] whose key differs from leftKey, given
    // at(lo).key === leftKey and at(hi).key !== leftKey.
    function firstChange(lo, hi, leftKey) {
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (at(mid).key === leftKey) lo = mid; else hi = mid;
      }
      return hi;
    }

    function finish() {
      var segs = [];
      var cur = { from: 0, facts: samples[0].facts, key: samples[0].key };
      for (var j = 1; j < samples.length; j++) {
        var pos = samples[j - 1].min;
        while (cur.key !== samples[j].key) {
          var b = firstChange(pos, samples[j].min, cur.key);
          segs.push({ from: cur.from, to: b - 1, facts: cur.facts });
          var f = at(b);
          cur = { from: b, facts: f.facts, key: f.key };
          pos = b;
        }
      }
      segs.push({ from: cur.from, to: 1439, facts: cur.facts });
      job.segments = segs;
      job.done = true;
    }

    job.tick = function () {
      if (job.done) return 1;
      var s = at(mins[samples.length]);
      s.min = mins[samples.length];
      samples.push(s);
      if (samples.length === mins.length) { finish(); return 1; }
      return samples.length / mins.length;
    };
    return job;
  }

  export default {
    build: build,
    stability: stability,
    daySweep: daySweep,
    localToUTC: localToUTC,
    gateLine: gateLine,
    positions: positions,
    designTime: designTime,
    GATE_ORDER: GATE_ORDER,
    CHANNELS: CHANNELS,
    GATE_CENTER: GATE_CENTER
  };
