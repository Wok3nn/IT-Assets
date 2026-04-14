import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  { key: "SUPER_ADMIN", name: "Super Admin" },
  { key: "ADMIN", name: "Admin" },
  { key: "MANAGER", name: "Manager" },
  { key: "VIEWER", name: "Viewer" },
];

const statuses = [
  { key: "IN_STOCK", name: "In Stock", color: "#0f766e" },
  { key: "ASSIGNED", name: "Assigned", color: "#2563eb" },
  { key: "MAINTENANCE", name: "Maintenance", color: "#d97706" },
  { key: "RETIRED", name: "Retired", color: "#64748b" },
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: {},
      create: role,
    });
  }

  for (const status of statuses) {
    await prisma.assetStatus.upsert({
      where: { key: status.key },
      update: {},
      create: status,
    });
  }
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
