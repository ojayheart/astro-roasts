import ActivityKit
import Foundation

public struct RoastActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var pct: Int
        public var line: String
        public var ready: Bool
        public init(pct: Int, line: String, ready: Bool) { self.pct = pct; self.line = line; self.ready = ready }
    }
    public var name: String
    public var start: Date
    public var estimatedEnd: Date
    public init(name: String, start: Date, estimatedEnd: Date) { self.name = name; self.start = start; self.estimatedEnd = estimatedEnd }
}
