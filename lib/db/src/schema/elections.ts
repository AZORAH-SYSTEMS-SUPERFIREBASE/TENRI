import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const schoolsTable = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  number: integer("number").notNull().unique(),
  electionTitle: text("election_title"),
  votingEndsAt: timestamp("voting_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slogan: text("slogan"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidatesTable.id, { onDelete: "cascade" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  paystackReference: text("paystack_reference").notNull().unique(),
  voterEmail: text("voter_email").notNull(),
  amountKes: integer("amount_kes").notNull().default(20),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type School = typeof schoolsTable.$inferSelect;
export type Candidate = typeof candidatesTable.$inferSelect;
export type Vote = typeof votesTable.$inferSelect;
