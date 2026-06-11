import app from "./app";
import { logger } from "./lib/logger";
import { db, schoolsTable, candidatesTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedIfEmpty() {
  try {
    const existing = await db.select().from(schoolsTable).limit(1);
    if (existing.length === 0) {
      logger.info("Seeding initial election data");
      const [school] = await db
        .insert(schoolsTable)
        .values({
          name: "Tenri Schools Embu",
          number: 1,
          electionTitle: "Tenri Schools Embu Presidential Election 2026",
          votingEndsAt: new Date("2026-06-20T00:00:00.000Z"),
        })
        .returning();

      await db.insert(candidatesTable).values([
        {
          schoolId: school.id,
          name: "Allan Njue",
          slogan: "Alo! Alo! (Diligence redefined)",
          imageUrl: "/images/allan.png",
          displayOrder: 1,
        },
        {
          schoolId: school.id,
          name: "Kingsley Munene",
          slogan: "PANGA MISTARI",
          imageUrl: "/images/kingsley.png",
          displayOrder: 2,
        },
        {
          schoolId: school.id,
          name: "Sally Mwende",
          slogan: "Shaa! Shaa! (Leadership can be for everyone)",
          imageUrl: "/images/sally.png",
          displayOrder: 3,
        },
        {
          schoolId: school.id,
          name: "Precious Nevina",
          slogan: "GROUND NDIYO KUSEMA",
          imageUrl: "/images/precious.png",
          displayOrder: 4,
        },
      ]);

      logger.info("Seed data inserted successfully");
    }
  } catch (e) {
    logger.warn({ err: e }, "Seed skipped — run db push to create tables first");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void seedIfEmpty();
});
