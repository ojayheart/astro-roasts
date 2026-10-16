import Foundation
import StoreKit
import AstroKit

@MainActor @Observable
final class Purchases {
    enum ID {
        static let roast = "com.astroroast.app.roast"            // solo roast, $4.99 (consumable; tied to a roast via appAccountToken)
        static let other = "com.astroroast.app.roast.other"      // roast someone else, $2.99
        static let couple = "com.astroroast.app.roast.couple"    // couple roast, $7.99
        static let plusMonthly = "com.astroroast.app.plus.monthly"
        static let plusYearly = "com.astroroast.app.plus.yearly"
        static let all = [roast, other, couple, plusMonthly, plusYearly]
    }
    var products: [String: Product] = [:]
    var isPlus = false
    var plusExpires: Date?
    var lastError: String?
    var busy = false
    @ObservationIgnored private var updates: Task<Void, Never>?

    init() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish(); await self?.refreshEntitlements() }
            }
        }
        Task { await load(); await refreshEntitlements() }
    }

    func load() async {
        do {
            let ps = try await Product.products(for: ID.all)
            products = Dictionary(uniqueKeysWithValues: ps.map { ($0.id, $0) })
        } catch { lastError = error.localizedDescription }
    }
    func price(_ id: String, fallback: String) -> String { products[id]?.displayPrice ?? fallback }

    func refreshEntitlements() async {
        var plus = false; var exp: Date?
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, [ID.plusMonthly, ID.plusYearly].contains(t.productID), t.revocationDate == nil {
                plus = true; exp = t.expirationDate
            }
        }
        isPlus = plus; plusExpires = exp
    }

    /// Buys a per-roast product. Returns the signed transaction (JWS) the server verifies, or nil if cancelled.
    func buy(_ productID: String, roastID: String?) async -> String? {
        guard let p = products[productID] else { lastError = "Store isn't available right now."; return nil }
        busy = true; defer { busy = false }
        do {
            var opts: Set<Product.PurchaseOption> = []
            if let rid = roastID, let uuid = UUID(uuidString: rid) { opts.insert(.appAccountToken(uuid)) }
            switch try await p.purchase(options: opts) {
            case .success(let v):
                guard case .verified(let t) = v else { lastError = "That purchase couldn't be verified."; return nil }
                let jws = v.jwsRepresentation
                await t.finish(); await refreshEntitlements()
                return jws
            case .pending: lastError = "Waiting for approval."; return nil
            case .userCancelled: return nil
            @unknown default: return nil
            }
        } catch { lastError = error.localizedDescription; return nil }
    }

    func restore() async { try? await AppStore.sync(); await refreshEntitlements() }

    /// The JWS of the active Roast+ transaction, used to unlock roasts for free.
    func plusJWS() async -> String? {
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, [ID.plusMonthly, ID.plusYearly].contains(t.productID) { return result.jwsRepresentation }
        }
        return nil
    }
}
