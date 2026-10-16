import Foundation

public enum LineAngle: String, CaseIterable, Codable, Sendable { case asc = "ASC", dsc = "DSC", mc = "MC", ic = "IC" }

public struct CityLine: Identifiable, Hashable, Sendable {
    public var id: String { "\(body.rawValue)\(angle.rawValue)" }
    public let body: Body; public let angle: LineAngle; public let km: Double
}
public struct CityScore: Identifiable, Hashable, Sendable {
    public var id: String { city.name }
    public let city: City
    public let lines: [CityLine]       // nearest lines within range, sorted by distance
    public let score: Double           // >0 good, <0 bad
}
public struct City: Hashable, Codable, Sendable { public let name: String; public let country: String; public let lat: Double; public let lon: Double }

public struct MapLine: Identifiable, Sendable {
    public var id: String { "\(body.rawValue)\(angle.rawValue)" }
    public let body: Body; public let angle: LineAngle
    public let points: [(lat: Double, lon: Double)]   // polyline; meridians have 2 points
}

public enum Cartography {
    static let bodies: [Body] = [.sun, .moon, .mercury, .venus, .mars, .jupiter, .saturn, .uranus, .neptune, .pluto]

    struct Geo { let ra: Double; let dec: Double }
    static func geo(_ chart: NatalChart) -> (gmst: Double, planets: [Body: Geo]) {
        let jd = JD.from(chart.birth.instant)
        let eps = AstroMath.obliquity(jd: jd)
        var out: [Body: Geo] = [:]
        for b in bodies {
            let e = AstroMath.equatorial(lon: Ephemeris.shared.longitude(b, jd: jd), lat: Ephemeris.shared.latitude(b, jd: jd), eps: eps)
            out[b] = Geo(ra: e.ra, dec: e.dec)
        }
        return (AstroMath.gmst(jd: jd), out)
    }
    static func wrap(_ l: Double) -> Double { (l + 540).truncatingRemainder(dividingBy: 360) - 180 }

    public static func lines(for chart: NatalChart, visible: Set<Body> = Set(bodies)) -> [MapLine] {
        let g = geo(chart)
        var out: [MapLine] = []
        for b in bodies where visible.contains(b) {
            guard let p = g.planets[b] else { continue }
            let mc = wrap(p.ra - g.gmst)
            out.append(MapLine(body: b, angle: .mc, points: [(80, mc), (-80, mc)]))
            out.append(MapLine(body: b, angle: .ic, points: [(80, wrap(mc + 180)), (-80, wrap(mc + 180))]))
            var asc: [(Double, Double)] = [], dsc: [(Double, Double)] = []
            for lat in stride(from: -70.0, through: 70.0, by: 2.0) {
                let v = -tan(lat * .pi / 180) * tan(p.dec * .pi / 180)
                guard abs(v) < 1 else { continue }
                let h = acos(v) * 180 / .pi
                asc.append((lat, wrap(p.ra - h - g.gmst)))
                dsc.append((lat, wrap(p.ra + h - g.gmst)))
            }
            out.append(MapLine(body: b, angle: .asc, points: asc))
            out.append(MapLine(body: b, angle: .dsc, points: dsc))
        }
        return out
    }

    /// Distance in km from a city to each of a planet's four lines.
    public static func distances(chart: NatalChart, city: City) -> [CityLine] {
        let g = geo(chart)
        var out: [CityLine] = []
        func km(_ dLon: Double) -> Double {   // perpendicular distance from a meridian at the city's latitude
            let s = cos(city.lat * .pi / 180) * sin(angDiff(dLon, 0) * .pi / 180)
            return abs(asin(max(-1, min(1, s)))) * 6371.0
        }
        for b in bodies {
            guard let p = g.planets[b] else { continue }
            let mc = wrap(p.ra - g.gmst)
            out.append(CityLine(body: b, angle: .mc, km: km(city.lon - mc)))
            out.append(CityLine(body: b, angle: .ic, km: km(city.lon - (mc + 180))))
            let v = -tan(city.lat * .pi / 180) * tan(p.dec * .pi / 180)
            if abs(v) < 1 {
                let h = acos(v) * 180 / .pi
                out.append(CityLine(body: b, angle: .asc, km: km(city.lon - (p.ra - h - g.gmst))))
                out.append(CityLine(body: b, angle: .dsc, km: km(city.lon - (p.ra + h - g.gmst))))
            }
        }
        return out
    }

    static let benefic: [Body: Double] = [.venus: 3, .jupiter: 3, .sun: 2, .moon: 1.5, .mercury: 1]
    static let malefic: [Body: Double] = [.mars: -2.5, .saturn: -2.5, .pluto: -2.5, .neptune: -1.5, .uranus: -1.5]

    public static func score(chart: NatalChart, cities: [City] = CityList.all, radiusKm: Double = 800) -> [CityScore] {
        cities.map { c in
            let near = distances(chart: chart, city: c).filter { $0.km <= radiusKm }.sorted { $0.km < $1.km }
            var s = 0.0
            for l in near {
                let w = (benefic[l.body] ?? malefic[l.body] ?? 0)
                s += w * (1 - l.km / radiusKm)
            }
            return CityScore(city: c, lines: near, score: s)
        }
    }

    /// One roast sentence per (planet, angle).
    public static func blurb(_ b: Body, _ a: LineAngle) -> String {
        let t: [Body: [LineAngle: String]] = [
            .venus: [.asc: "Venus on your Rising: you arrive tanned in a way nobody can explain, and strangers are suspiciously nice.", .mc: "Venus on your Midheaven: people like your work more than they should.", .dsc: "Venus on your Descendant: love arrives, and it's weirdly mutual.", .ic: "Venus on your IC: home feels like a candlelit flat, and rent is somehow fine."],
            .jupiter: [.asc: "Jupiter on your Rising: everything's a bit too lucky. Keep the receipts.", .mc: "Jupiter on your Midheaven: your career gets the good chair.", .dsc: "Jupiter on your Descendant: generous people, big weddings, bigger drinks bills.", .ic: "Jupiter on your IC: you'll be able to afford the house. Probably."],
            .sun: [.asc: "Sun on your Rising: you are very visible, for better or for photos.", .mc: "Sun on your Midheaven: you'd be good at being in charge, and unbearable about it.", .dsc: "Sun on your Descendant: other people take the lead, and you let them.", .ic: "Sun on your IC: you finally feel at home in your own skin."],
            .moon: [.asc: "Moon on your Rising: feelings leak. Wear waterproofs.", .mc: "Moon on your Midheaven: your mood is on the org chart.", .dsc: "Moon on your Descendant: you attract carers and strays.", .ic: "Moon on your IC: deep roots, deeper sulks, great soup."],
            .mercury: [.asc: "Mercury on your Rising: you talk and think faster than you can order.", .mc: "Mercury on your Midheaven: a very good place to write emails.", .dsc: "Mercury on your Descendant: you find the clever ones and argue happily.", .ic: "Mercury on your IC: lots of books, lots of tabs."],
            .mars: [.asc: "Mars on your Rising: you'll start fights in a library.", .mc: "Mars on your Midheaven: work becomes a contact sport.", .dsc: "Mars on your Descendant: every relationship becomes a tribunal with snacks.", .ic: "Mars on your IC: the flat is loud and so are you."],
            .saturn: [.asc: "Saturn on your Rising: you'll feel 40, with a pension.", .mc: "Saturn on your Midheaven: you will work for it, twice.", .dsc: "Saturn on your Descendant: commitment arrives, with paperwork.", .ic: "Saturn on your IC: a house with a very strict landlord."],
            .uranus: [.asc: "Uranus on your Rising: you'll reinvent yourself weekly. Your neighbours are exhausted.", .mc: "Uranus on your Midheaven: a career in four unrelated chapters.", .dsc: "Uranus on your Descendant: exciting people, short contracts.", .ic: "Uranus on your IC: you'll never unpack."],
            .neptune: [.asc: "Neptune on your Rising: you glow, and nobody can find you.", .mc: "Neptune on your Midheaven: a career with beautiful, vague job titles.", .dsc: "Neptune on your Descendant: you'll fall for a story, not a person.", .ic: "Neptune on your IC: a home by water. Check for damp."],
            .pluto: [.asc: "Pluto on your Rising: you leave transformed or wanted by someone.", .mc: "Pluto on your Midheaven: power, intrigue, a very long meeting.", .dsc: "Pluto on your Descendant: intense people, intense chats, intense dinners.", .ic: "Pluto on your IC: the family secrets move in with you."]
        ]
        return t[b]?[a] ?? ""
    }
}

public enum CityList {
    public static let all: [City] = {
        let raw = """
        London|United Kingdom|51.51|-0.13;Paris|France|48.86|2.35;Barcelona|Spain|41.39|2.17;Madrid|Spain|40.42|-3.70;Lisbon|Portugal|38.72|-9.14;Rome|Italy|41.90|12.50;Milan|Italy|45.46|9.19;Berlin|Germany|52.52|13.40;Amsterdam|Netherlands|52.37|4.90;Copenhagen|Denmark|55.68|12.57;Stockholm|Sweden|59.33|18.07;Reykjavik|Iceland|64.15|-21.94;Dublin|Ireland|53.35|-6.26;Edinburgh|United Kingdom|55.95|-3.19;Vienna|Austria|48.21|16.37;Prague|Czechia|50.08|14.44;Athens|Greece|37.98|23.73;Istanbul|Turkey|41.01|28.98;Cairo|Egypt|30.04|31.24;Marrakech|Morocco|31.63|-8.01;Lagos|Nigeria|6.52|3.38;Nairobi|Kenya|-1.29|36.82;Cape Town|South Africa|-33.92|18.42;Dubai|UAE|25.20|55.27;Mumbai|India|19.08|72.88;Delhi|India|28.61|77.21;Bangkok|Thailand|13.76|100.50;Bali|Indonesia|-8.41|115.19;Singapore|Singapore|1.35|103.82;Hong Kong|China|22.32|114.17;Shanghai|China|31.23|121.47;Tokyo|Japan|35.68|139.69;Seoul|South Korea|37.57|126.98;Sydney|Australia|-33.87|151.21;Melbourne|Australia|-37.81|144.96;Brisbane|Australia|-27.47|153.03;Perth|Australia|-31.95|115.86;Auckland|New Zealand|-36.85|174.76;Wellington|New Zealand|-41.29|174.78;Christchurch|New Zealand|-43.53|172.64;Honolulu|USA|21.31|-157.86;Los Angeles|USA|34.05|-118.24;San Francisco|USA|37.77|-122.42;Seattle|USA|47.61|-122.33;Vancouver|Canada|49.28|-123.12;Denver|USA|39.74|-104.99;Austin|USA|30.27|-97.74;Chicago|USA|41.88|-87.63;Toronto|Canada|43.65|-79.38;Montreal|Canada|45.50|-73.57;New York|USA|40.71|-74.01;Boston|USA|42.36|-71.06;Miami|USA|25.76|-80.19;Mexico City|Mexico|19.43|-99.13;Tulum|Mexico|20.21|-87.47;Havana|Cuba|23.11|-82.37;Bogota|Colombia|4.71|-74.07;Lima|Peru|-12.05|-77.04;Rio de Janeiro|Brazil|-22.91|-43.17;Sao Paulo|Brazil|-23.55|-46.63;Buenos Aires|Argentina|-34.60|-58.38;Santiago|Chile|-33.45|-70.67;Oslo|Norway|59.91|10.75;Helsinki|Finland|60.17|24.94;Warsaw|Poland|52.23|21.01;Budapest|Hungary|47.50|19.04;Zurich|Switzerland|47.38|8.54;Brussels|Belgium|50.85|4.35;Florence|Italy|43.77|11.26;Naples|Italy|40.85|14.27;Seville|Spain|37.39|-5.98;Porto|Portugal|41.15|-8.61;Tel Aviv|Israel|32.09|34.78;Tbilisi|Georgia|41.72|44.79;Kyiv|Ukraine|50.45|30.52;Moscow|Russia|55.76|37.62;Beijing|China|39.90|116.41;Taipei|Taiwan|25.03|121.57;Kuala Lumpur|Malaysia|3.14|101.69;Hanoi|Vietnam|21.03|105.85;Manila|Philippines|14.60|120.98;Kathmandu|Nepal|27.72|85.32;Colombo|Sri Lanka|6.93|79.86;Accra|Ghana|5.60|-0.19;Dakar|Senegal|14.72|-17.47;Addis Ababa|Ethiopia|9.03|38.74;Zanzibar|Tanzania|-6.17|39.20;Johannesburg|South Africa|-26.20|28.05;Anchorage|USA|61.22|-149.90;Portland|USA|45.52|-122.68;Nashville|USA|36.16|-86.78;New Orleans|USA|29.95|-90.07;Washington DC|USA|38.91|-77.04;Panama City|Panama|8.98|-79.52;San Juan|Puerto Rico|18.47|-66.11;Leeds|United Kingdom|53.80|-1.55;Manchester|United Kingdom|53.48|-2.24;Glasgow|United Kingdom|55.86|-4.25
        """
        return raw.split(separator: ";").compactMap { r in
            let f = r.split(separator: "|").map(String.init)
            guard f.count == 4, let la = Double(f[2]), let lo = Double(f[3]) else { return nil }
            return City(name: f[0].trimmingCharacters(in: .whitespacesAndNewlines), country: f[1], lat: la, lon: lo)
        }
    }()
}
