import type { FastifyInstance } from "fastify";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { readLocalDb } from "../lib/localStore.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/stats", async () => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const [products, units, leads, listings] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("containers").select("status"),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("marketplace_listings").select("id", { count: "exact", head: true }).eq("status", "active")
      ]);
      if (!products.error && !units.error && !leads.error && !listings.error) {
        return {
          products: products.count ?? 0,
          availableUnits: units.data.filter((u) => u.status === "available").length,
          reservedUnits: units.data.filter((u) => u.status === "reserved").length,
          leads: leads.count ?? 0,
          activeListings: listings.count ?? 0
        };
      }
    }

    const db = await readLocalDb();
    return {
      products: db.products.length,
      availableUnits: db.containers.filter((unit) => unit.status === "available").length,
      reservedUnits: db.containers.filter((unit) => unit.status === "reserved").length,
      leads: db.leads.length,
      activeListings: db.products.filter((product) => product.isPublished).length
    };
  });
}
