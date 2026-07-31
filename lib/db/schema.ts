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
    gender: text("gender"),
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
    chartJson: jsonb("chart_json"), // fast natal chart JSON for the d3 loading wheel
    chartAnnotations: jsonb("chart_annotations"), // {id: {facts, line}} witty per-element copy for the interactive wheel
    status: text("status").default("generating").notNull(), // generating | ready | error
    stagePct: integer("stage_pct").default(0).notNull(), // 0-100, runner-reported progress
    title: text("title"), // devastating one-line title
    analysis: jsonb("analysis"), // humor profile + metaphor palette + voice preset JSON
    draft: text("draft"), // first draft text (before validation)
    validationNotes: text("validation_notes"), // what the QA step caught/fixed
    paid: boolean("paid").default(false).notNull(),
    unlockedVia: text("unlocked_via"), // stripe | share | admin — null on legacy rows
    emailSent: boolean("email_sent").default(false).notNull(),
    source: text("source").default("web").notNull(), // web | instagram_dm
    mcSubscriberId: text("mc_subscriber_id"), // ManyChat subscriber to DM the teaser back to
    kind: text("kind").default("solo").notNull(), // solo | couple | family
    relationship: text("relationship"), // partners | lovers | siblings | friends | ... — null on solo/legacy
    goldLine: text("gold_line"), // most savage standalone quote — story card
    extraPlacements: jsonb("extra_placements"), // ExtraPlacement[] for persons 2..N
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

export const roastSubjects = pgTable(
  "roast_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roastId: uuid("roast_id")
      .references(() => roasts.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("roast_subjects_roast_idx").on(table.roastId)],
);

// Relations for Drizzle query API
export const usersRelations = relations(users, ({ many }) => ({
  roasts: many(roasts),
  sessions: many(sessions),
  sentConnections: many(connections, { relationName: "buyer" }),
  receivedConnections: many(connections, { relationName: "friend" }),
}));

export const roastsRelations = relations(roasts, ({ one, many }) => ({
  user: one(users, { fields: [roasts.userId], references: [users.id] }),
  subjects: many(roastSubjects),
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

export const roastSubjectsRelations = relations(roastSubjects, ({ one }) => ({
  roast: one(roasts, {
    fields: [roastSubjects.roastId],
    references: [roasts.id],
  }),
  user: one(users, {
    fields: [roastSubjects.userId],
    references: [users.id],
  }),
}));
