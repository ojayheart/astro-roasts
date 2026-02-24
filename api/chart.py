"""
Vercel Python Serverless Function — Natal Chart Calculator.
POST /api/chart with JSON body: { name, year, month, day, hour, minute, lat, lon, tz }
Returns structured chart data as JSON.
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

# Add project root to path so natal_chart.py can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from natal_chart import compute_chart, compute_aspects, detect_configurations, analyze_chart, format_output


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
            return

        required = ["name", "year", "month", "day", "hour", "minute", "lat", "lon", "tz"]
        missing = [k for k in required if k not in data]
        if missing:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Missing fields: {', '.join(missing)}"}).encode())
            return

        try:
            chart = compute_chart(
                year=int(data["year"]),
                month=int(data["month"]),
                day=int(data["day"]),
                hour=int(data["hour"]),
                minute=int(data["minute"]),
                lat=float(data["lat"]),
                lon=float(data["lon"]),
                tz_str=str(data["tz"]),
            )

            aspects = compute_aspects(chart["points"])
            configs = detect_configurations(aspects, chart["points"])
            analysis = analyze_chart(chart)
            formatted = format_output(str(data["name"]), chart, analysis, aspects, configs)

            # Extract key placements
            points = chart["points"]
            result = {
                "formatted_output": formatted,
                "sun_sign": points.get("Sun", {}).get("sign", ""),
                "moon_sign": points.get("Moon", {}).get("sign", ""),
                "rising_sign": points.get("Ascendant", {}).get("sign", ""),
                "mercury_sign": points.get("Mercury", {}).get("sign", ""),
                "venus_sign": points.get("Venus", {}).get("sign", ""),
                "mars_sign": points.get("Mars", {}).get("sign", ""),
                "jupiter_sign": points.get("Jupiter", {}).get("sign", ""),
                "saturn_sign": points.get("Saturn", {}).get("sign", ""),
                "planets": {},
            }

            for pname, pdata in points.items():
                if pdata.get("lon") is not None:
                    result["planets"][pname] = {
                        "sign": pdata.get("sign", ""),
                        "house": pdata.get("house"),
                        "deg_str": pdata.get("deg_str", ""),
                        "retrograde": pdata.get("retrograde", False),
                    }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
