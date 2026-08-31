import prisma from './prisma';
import { seedDatabase } from './seedDatabase';

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`Database already has ${userCount} users — skipping seed.`);
    return;
  }
  console.log('Database is empty — running initial seed...');
  await seedDatabase(prisma);
  console.log('Initial seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
