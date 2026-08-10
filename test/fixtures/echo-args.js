// Stand-in for transits.py: prints the argv it was handed as one JSON object.
console.log(JSON.stringify({ mode: "daily", argv: process.argv.slice(2) }));
