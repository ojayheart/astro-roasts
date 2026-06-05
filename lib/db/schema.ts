import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  real,
  integer,
  index,
  jsonb,
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
    stripeCustomerId: text("stripe_customer_id"),
    credits: integer("credits").default(0).notNull(),
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
    status: text("status").default("generating").notNull(), // generating | ready | error
    stagePct: integer("stage_pct").default(0).notNull(), // 0-100, runner-reported progress
    title: text("title"), // devastating one-line title
    analysis: jsonb("analysis"), // humor profile + metaphor palette + voice preset JSON
    draft: text("draft"), // first draft text (before validation)
    validationNotes: text("validation_notes"), // what the QA step caught/fixed
    paid: boolean("paid").default(false).notNull(),
    emailSent: boolean("email_sent").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("roasts_user_id_idx").on(table.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("sessions_token_idx").on(table.token)],
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("magic_links_token_idx").on(table.token)],
);

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buyerId: uuid("buyer_id")
      .references(() => users.id)
      .notNull(),
    friendId: uuid("friend_id")
      .references(() => users.id)
      .notNull(),
    roastId: uuid("roast_id")
      .references(() => roasts.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("connections_buyer_idx").on(table.buyerId)],
);

// Relations for Drizzle query API
export const usersRelations = relations(users, ({ many }) => ({
  roasts: many(roasts),
  sessions: many(sessions),
  sentConnections: many(connections, { relationName: "buyer" }),
  receivedConnections: many(connections, { relationName: "friend" }),
}));

export const roastsRelations = relations(roasts, ({ one }) => ({
  user: one(users, { fields: [roasts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  buyer: one(users, { fields: [connections.buyerId], references: [users.id] }),
  friend: one(users, {
    fields: [connections.friendId],
    references: [users.id],
  }),
  roast: one(roasts, {
    fields: [connections.roastId],
    references: [roasts.id],
  }),
}));
