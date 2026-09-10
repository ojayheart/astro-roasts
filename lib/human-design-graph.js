/* Gate memberships and channel topology cross-checked against whitspce/hd-chart
 * engine.js (MIT); see THIRD-PARTY-LICENSE.txt. Geometry is original. */
const CENTRES = {
  Head: {
    name: "Head",
    theme: "Inspiration",
    x: 400,
    y: 85,
    r: 48,
    gates: [64, 61, 63],
    angles: [135, 90, 45],
    summary: "Questions, wonder, and the pressure to understand.",
    reflection: "Which questions deserve your attention today?",
  },
  Ajna: {
    name: "Ajna",
    theme: "Conceptualisation",
    x: 400,
    y: 235,
    r: 57,
    gates: [47, 24, 4, 17, 43, 11],
    angles: [225, 270, 315, 135, 90, 45],
    summary: "The way ideas become concepts and interpretations.",
    reflection: "Can an idea remain interesting without becoming a certainty?",
  },
  Throat: {
    name: "Throat",
    theme: "Expression",
    x: 400,
    y: 395,
    r: 66,
    gates: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
    angles: [240, 270, 300, 330, 0, 30, 60, 90, 120, 165, 205],
    summary: "Expression through language and action.",
    reflection: "What are you responding to before you speak or act?",
  },
  G: {
    name: "G / Identity",
    short: "Identity",
    theme: "Direction & love",
    x: 400,
    y: 570,
    r: 57,
    gates: [7, 1, 13, 25, 46, 2, 15, 10],
    angles: [235, 270, 305, 0, 55, 90, 125, 180],
    summary: "Identity, love, and a sense of direction.",
    reflection: "Where do you feel at ease without having to define yourself?",
  },
  Ego: {
    name: "Heart / Ego",
    short: "Heart",
    theme: "Will & resources",
    x: 595,
    y: 545,
    r: 46,
    gates: [21, 40, 26, 51],
    angles: [270, 55, 145, 190],
    summary: "Willpower, commitments, and material resources.",
    reflection: "What would you choose if there were nothing to prove?",
  },
  Spleen: {
    name: "Spleen",
    theme: "Instinct",
    x: 145,
    y: 735,
    r: 61,
    gates: [48, 57, 44, 50, 32, 28, 18],
    angles: [235, 285, 330, 25, 60, 90, 120],
    summary: "Immediate instinct and awareness of the present.",
    reflection: "What do you notice before you begin explaining it?",
  },
  SolarPlexus: {
    name: "Solar Plexus",
    theme: "Emotional awareness",
    x: 665,
    y: 755,
    r: 64,
    gates: [36, 22, 37, 6, 49, 55, 30],
    angles: [285, 250, 215, 175, 145, 110, 75],
    summary: "Emotional experience that changes over time.",
    reflection: "Does this still feel right after your mood has changed?",
  },
  Sacral: {
    name: "Sacral",
    theme: "Response & energy",
    x: 400,
    y: 790,
    r: 63,
    gates: [5, 14, 29, 59, 9, 3, 42, 27, 34],
    angles: [235, 270, 305, 0, 55, 90, 125, 175, 205],
    summary:
      "The response and sustaining energy associated with Generator types.",
    reflection: "What actually engages you, rather than merely sounds useful?",
  },
  Root: {
    name: "Root",
    theme: "Pressure & momentum",
    x: 400,
    y: 1000,
    r: 62,
    gates: [53, 60, 52, 19, 39, 41, 58, 38, 54],
    angles: [240, 270, 300, 330, 0, 30, 150, 180, 210],
    summary: "Pressure to begin, move, and complete.",
    reflection: "Is there a real deadline, or only a feeling of urgency?",
  },
};
const PAIRS = [
  [64, 47],
  [61, 24],
  [63, 4],
  [17, 62],
  [43, 23],
  [11, 56],
  [31, 7],
  [8, 1],
  [33, 13],
  [20, 34],
  [20, 57],
  [20, 10],
  [16, 48],
  [12, 22],
  [35, 36],
  [45, 21],
  [2, 14],
  [46, 29],
  [15, 5],
  [10, 34],
  [10, 57],
  [25, 51],
  [53, 42],
  [60, 3],
  [52, 9],
  [27, 50],
  [34, 57],
  [59, 6],
  [32, 54],
  [28, 38],
  [18, 58],
  [19, 49],
  [39, 55],
  [41, 30],
  [26, 44],
  [40, 37],
];
const GATE_CENTRE = Object.fromEntries(
  Object.entries(CENTRES).flatMap(([id, c]) => c.gates.map((g) => [g, id])),
);
const GATE_THEMES = {
  14: "Resources",
  19: "Sensitivity",
  20: "The present",
  24: "Returning to an idea",
  27: "Care",
  28: "Purpose & struggle",
  30: "Desire",
  34: "Power",
  43: "Insight",
  44: "Patterns",
  48: "Depth",
  49: "Principles",
  50: "Values",
  54: "Ambition",
  56: "Stimulation",
  60: "Limitation",
  61: "Inner truth",
  63: "Doubt",
};
const CHANNEL_INFO = {
  "24-61": {
    name: "Awareness",
    text: "Your activated 61 and 24 connect mental pressure with conceptual processing. In Human Design, this channel is associated with returning to questions until an individual insight takes shape.",
    prompt:
      "Let the question breathe. Repetition is not always a demand for an immediate answer.",
  },
  "20-34": {
    name: "Charisma",
    text: "Your activated 34 and 20 directly connect the Sacral to the Throat. This motor-to-expression connection, together with your defined Sacral, establishes the Manifesting Generator classification.",
    prompt:
      "Notice what draws a response. Your Emotional Authority still takes precedence when making commitments.",
  },
  "27-50": {
    name: "Preservation",
    text: "Your activated 27 and 50 connect the Sacral with the Spleen. The traditional theme is caring for and sustaining others, with awareness of what needs protecting.",
    prompt:
      "Consider whether the care you offer is sustainable for you as well.",
  },
  "19-49": {
    name: "Synthesis",
    text: "Your activated 19 and 49 connect Root pressure with the Solar Plexus. Traditional interpretation links this channel with sensitivity to needs, principles, and belonging.",
    prompt:
      "Give decisions involving needs and boundaries time to become clear.",
  },
};
const keyOf = (a, b) => [a, b].sort((x, y) => x - y).join("-");
function derive(chart) {
  const sources = {};
  for (const side of ["personality", "design"])
    for (const [planet, a] of Object.entries(chart[side])) {
      (sources[a.gate] ||= []).push({ side, planet, line: a.line });
    }
  const channels = PAIRS.filter(([a, b]) => sources[a] && sources[b]);
  const defined = new Set(
    channels.flatMap((p) => p.map((g) => GATE_CENTRE[g])),
  );
  const islands = [];
  const visited = new Set();
  for (const id of Object.keys(CENTRES))
    if (defined.has(id) && !visited.has(id)) {
      const island = [],
        queue = [id];
      visited.add(id);
      while (queue.length) {
        const current = queue.shift();
        island.push(current);
        for (const pair of channels) {
          const cs = pair.map((g) => GATE_CENTRE[g]);
          if (cs.includes(current))
            for (const c of cs)
              if (!visited.has(c)) {
                visited.add(c);
                queue.push(c);
              }
        }
      }
      islands.push(island);
    }
  return { sources, channels, defined, islands };
}

function centreVertices(id) {
  const c = CENTRES[id],
    r = c.r * 1.14;
  const offsets =
    id === "Head"
      ? [
          [0, -1],
          [-1, 0.8],
          [1, 0.8],
        ]
      : id === "Ajna"
        ? [
            [0, 1],
            [-1, -0.8],
            [1, -0.8],
          ]
        : id === "G"
          ? [
              [0, -1],
              [1, 0],
              [0, 1],
              [-1, 0],
            ]
          : id === "Spleen"
            ? [
                [-0.8, -1],
                [1, 0],
                [-0.8, 1],
              ]
            : id === "SolarPlexus"
              ? [
                  [0.8, -1],
                  [-1, 0],
                  [0.8, 1],
                ]
              : id === "Ego"
                ? [
                    [0, -1],
                    [-1, 0.7],
                    [1, 0.7],
                  ]
                : [
                    [-0.85, -0.85],
                    [0.85, -0.85],
                    [0.85, 0.85],
                    [-0.85, 0.85],
                  ];
  return offsets.map(([x, y]) => ({ x: c.x + x * r, y: c.y + y * r }));
}
function centrePath(id) {
  return (
    centreVertices(id)
      .map((p, i) => (i ? "L" : "M") + " " + p.x + " " + p.y)
      .join(" ") + " Z"
  );
}
function gatePoint(g) {
  const id = GATE_CENTRE[g],
    c = CENTRES[id],
    a = (c.angles[c.gates.indexOf(+g)] * Math.PI) / 180,
    dx = Math.cos(a),
    dy = Math.sin(a),
    v = centreVertices(id);
  let distance = Infinity;
  for (let i = 0; i < v.length; i++) {
    const p = v[i],
      q = v[(i + 1) % v.length],
      ex = q.x - p.x,
      ey = q.y - p.y,
      den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const px = p.x - c.x,
      py = p.y - c.y,
      t = (px * ey - py * ex) / den,
      u = (px * dy - py * dx) / den;
    if (t >= 0 && u >= 0 && u <= 1) distance = Math.min(distance, t);
  }
  return { x: c.x + distance * dx, y: c.y + distance * dy, dx, dy };
}

function channelPath(a, b) {
  const p = gatePoint(a),
    q = gatePoint(b),
    d = Math.hypot(q.x - p.x, q.y - p.y);
  // Each route leaves its own centre radially; long routes have custom lanes.
  const special = {
    "20-34": [245, 460, 240, 670],
    "20-57": [230, 480, 205, 560],
    "16-48": [130, 430, 60, 565],
    "12-22": [730, 400, 720, 570],
    "35-36": [770, 390, 800, 575],
    "26-44": [450, 665, 330, 635],
    "10-34": [290, 570, 270, 700],
    "10-57": [260, 570, 235, 595],
    "34-57": [255, 710, 225, 605],
    "18-58": [45, 920, 220, 1100],
    "28-38": [145, 965, 225, 1000],
    "32-54": [220, 865, 280, 880],
    "19-49": [540, 920, 570, 890],
    "39-55": [610, 1000, 635, 960],
    "30-41": [640, 1120, 760, 965],
  };
  let control = special[keyOf(a, b)];
  // Special controls are ordered for the PAIRS orientation, except 30–41.
  if (keyOf(a, b) === "30-41") control = [640, 1120, 760, 965];
  if (!control) {
    const k = Math.min(115, d * 0.45);
    control = [p.x + p.dx * k, p.y + p.dy * k, q.x + q.dx * k, q.y + q.dy * k];
  }
  return `M ${p.x} ${p.y} C ${control[0]} ${control[1]} ${control[2]} ${control[3]} ${q.x} ${q.y}`;
}
export {
  CENTRES,
  PAIRS,
  GATE_CENTRE,
  keyOf,
  derive,
  gatePoint,
  channelPath,
  centrePath,
  centreVertices,
};
