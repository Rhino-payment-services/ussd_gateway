import bcrypt from "bcryptjs";
import { prisma } from "./db/prisma.js";

async function main() {
  const email = "demo@ussd.local";
  const password = "demo-password";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed skipped: demo user exists");
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: "Demo Developer" },
  });
  await prisma.webhookProfile.create({
    data: {
      userId: user.id,
      name: "Local mock USSD (example)",
      slug: "demo-mock",
      callbackUrl: "http://127.0.0.1:4000/api/examples/mock-ussd",
      httpMethod: "POST",
      headers: {},
      authScheme: "none",
      provider: "DIALFORGE",
      payloadMapping: {},
      responseType: "plain",
    },
  });
  console.log("Seeded demo user:", email, "/", password);
  console.log("Created webhook profile slug: demo-mock → POST /api/examples/mock-ussd");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
