import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  real,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    dob: text("dob").notNull(), // YYYY-MM-DD
    birthTime: text("birth_time"), // HH:MM or null
    birthCity: text("birth_city").notNull(),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    tz: text("tz").notNull(),
    referralCode: text("referral_code").unique(),
    referredBy: uuid("referred_by").references((): AnyPgColumn => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_referral_code_idx").on(table.referralCode),
  ],
);

export const roasts = pgTable(
  "roasts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    teaser: text("teaser"),
    fullText: text("full_text"),
    callouts: text("callouts"), // pipe-separated
    sunSign: text("sun_sign"),
    moonSign: text("moon_sign"),
    rising: text("rising"),
    mercurySign: text("mercury_sign"),
    venusSign: text("venus_sign"),
    marsSign: text("mars_sign"),
    jupiterSign: text("jupiter_sign"),
    saturnSign: text("saturn_sign"),
    chartData: text("chart_data"), // raw formatted output from natal_chart.py
    paid: boolean("paid").default(false).notNull(),
    emailSent: boolean("email_sent").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("roasts_user_id_idx").on(table.userId)],
);

// Relations for Drizzle query API
export const usersRelations = relations(users, ({ many }) => ({
  roasts: many(roasts),
}));

export const roastsRelations = relations(roasts, ({ one }) => ({
  user: one(users, { fields: [roasts.userId], references: [users.id] }),
}));
