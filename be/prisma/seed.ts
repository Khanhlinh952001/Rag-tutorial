import { createPrismaClient } from "../src/lib/prisma";
import { hash } from "bcryptjs";

const prisma = createPrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@local.dev";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123456";
  const adminName = process.env.ADMIN_NAME ?? "Administrator";
  const adminPasswordHash = await hash(adminPassword, 10);

  const userEmail = process.env.USER_EMAIL ?? "user@local.dev";
  const userPassword = process.env.USER_PASSWORD ?? "user123456";
  const userName = process.env.USER_NAME ?? "Test User";
  const userPasswordHash = await hash(userPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: "ADMIN",
      password: adminPasswordHash,
    },
    create: {
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      password: adminPasswordHash,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      name: userName,
      role: "USER",
      password: userPasswordHash,
    },
    create: {
      email: userEmail,
      name: userName,
      role: "USER",
      password: userPasswordHash,
    },
  });

  console.log(
    `Admin seed completed: email=${admin.email}, role=${admin.role}, defaultPassword=${adminPassword}`,
  );
  console.log(
    `User seed completed: email=${user.email}, role=${user.role}, defaultPassword=${userPassword}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
