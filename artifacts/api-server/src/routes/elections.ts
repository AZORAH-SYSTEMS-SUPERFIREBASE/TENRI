import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, schoolsTable, candidatesTable, votesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/config", async (_req, res): Promise<void> => {
  res.json({
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
  });
});

router.get("/schools", async (req, res): Promise<void> => {
  const schools = await db
    .select()
    .from(schoolsTable)
    .orderBy(schoolsTable.number);
  res.json(schools);
});

router.get("/elections/:schoolId/results", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.schoolId)
    ? req.params.schoolId[0]
    : req.params.schoolId;
  const schoolId = parseInt(raw, 10);

  if (isNaN(schoolId)) {
    res.status(400).json({ error: "Invalid school ID" });
    return;
  }

  const [school] = await db
    .select()
    .from(schoolsTable)
    .where(eq(schoolsTable.id, schoolId));

  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }

  const candidates = await db
    .select()
    .from(candidatesTable)
    .where(
      and(
        eq(candidatesTable.schoolId, schoolId),
        eq(candidatesTable.active, true),
      ),
    )
    .orderBy(candidatesTable.displayOrder);

  const voteCounts = await db
    .select({
      candidateId: votesTable.candidateId,
      count: count(),
    })
    .from(votesTable)
    .where(
      and(
        eq(votesTable.schoolId, schoolId),
        eq(votesTable.verified, true),
      ),
    )
    .groupBy(votesTable.candidateId);

  const totalVotes = voteCounts.reduce(
    (sum, v) => sum + Number(v.count),
    0,
  );

  const results = candidates.map((c) => {
    const vc = voteCounts.find((v) => v.candidateId === c.id);
    const votes = vc ? Number(vc.count) : 0;
    const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
    return {
      id: c.id,
      name: c.name,
      slogan: c.slogan,
      imageUrl: c.imageUrl,
      displayOrder: c.displayOrder,
      percentage: pct.toFixed(2),
      progress: Math.round(pct),
    };
  });

  res.json({
    school: {
      id: school.id,
      name: school.name,
      number: school.number,
      electionTitle: school.electionTitle,
      votingEndsAt: school.votingEndsAt,
    },
    candidates: results,
    totalVotes,
  });
});

router.post("/votes/record", async (req, res): Promise<void> => {
  const { candidateId, paystackReference, email } = req.body as {
    candidateId?: number;
    paystackReference?: string;
    email?: string;
  };

  if (!candidateId || !paystackReference || !email) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    req.log.error("PAYSTACK_SECRET_KEY not configured");
    res.status(500).json({ error: "Payment system not configured" });
    return;
  }

  const verifyResp = await fetch(
    `https://api.paystack.co/transaction/verify/${paystackReference}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );

  if (!verifyResp.ok) {
    req.log.warn({ paystackReference }, "Paystack verify request failed");
    res.status(400).json({ error: "Payment verification failed" });
    return;
  }

  const verifyData = (await verifyResp.json()) as {
    status: boolean;
    data: { status: string; amount: number };
  };

  if (!verifyData.status || verifyData.data.status !== "success") {
    res.status(400).json({ error: "Payment was not successful" });
    return;
  }

  if (verifyData.data.amount < 2000) {
    res.status(400).json({ error: "Invalid payment amount" });
    return;
  }

  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, candidateId))
    .limit(1);

  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(votesTable)
    .where(eq(votesTable.paystackReference, paystackReference))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "This payment has already been used to vote" });
    return;
  }

  await db.insert(votesTable).values({
    candidateId,
    schoolId: candidate.schoolId,
    paystackReference,
    voterEmail: email,
    amountKes: 20,
    verified: true,
  });

  req.log.info({ candidateId, paystackReference }, "Vote recorded");
  res.json({ success: true });
});

export default router;
