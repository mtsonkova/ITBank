import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateIBAN(): string {
  const digits = String(Math.floor(Math.random() * 90 + 10)); // 10–99
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let body = '';
  for (let i = 0; i < 16; i++) {
    body += chars[Math.floor(Math.random() * chars.length)];
  }
  return `IB${digits}${body}`; // 20 chars: IB + 2 digits + 16 alphanumeric
}

function randomAmount(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...');

  // Clear in reverse-dependency order
  await prisma.transaction.deleteMany();
  await prisma.request.deleteMany();
  await prisma.creditCard.deleteMany();
  await prisma.debitCard.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.customerAssignment.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // ── Admin ──────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'michael.scott',
      passwordHash,
      role: 'admin',
      fullName: 'Michael Scott',
    },
  });

  // ── Managers ───────────────────────────────────────────────────────────────
  const sofiaLang = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'sofia.lang',
      passwordHash,
      role: 'account_manager',
      fullName: 'Sofia Lang',
    },
  });

  const davidMertens = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: 'david.mertens',
      passwordHash,
      role: 'account_manager',
      fullName: 'David Mertens',
    },
  });

  // ── Customers ──────────────────────────────────────────────────────────────
  const customersData = [
    { username: 'anna.becker',  fullName: 'Anna Becker',  managerId: sofiaLang.id },
    { username: 'lukas.vogel',  fullName: 'Lukas Vogel',  managerId: sofiaLang.id },
    { username: 'mara.klein',   fullName: 'Mara Klein',   managerId: davidMertens.id },
    { username: 'tomas.roth',   fullName: 'Tomas Roth',   managerId: davidMertens.id },
  ];

  for (const c of customersData) {
    const customer = await prisma.user.create({
      data: {
        id: randomUUID(),
        username: c.username,
        passwordHash,
        role: 'customer',
        fullName: c.fullName,
      },
    });

    await prisma.customerAssignment.create({
      data: { customerId: customer.id, accountManagerId: c.managerId },
    });

    // ── Accounts ─────────────────────────────────────────────────────────────
    const savings = await prisma.bankAccount.create({
      data: {
        id: randomUUID(),
        customerId: customer.id,
        iban: generateIBAN(),
        type: 'savings',
        status: 'active',
        balance: 0,
      },
    });

    const current = await prisma.bankAccount.create({
      data: {
        id: randomUUID(),
        customerId: customer.id,
        iban: generateIBAN(),
        type: 'current',
        status: 'active',
        balance: 0,
      },
    });

    // ── Cards ─────────────────────────────────────────────────────────────────
    await prisma.debitCard.create({
      data: {
        id: randomUUID(),
        bankAccountId: savings.id,
        customerId: customer.id,
        status: 'active',
      },
    });

    await prisma.debitCard.create({
      data: {
        id: randomUUID(),
        bankAccountId: current.id,
        customerId: customer.id,
        status: 'active',
      },
    });

    await prisma.creditCard.create({
      data: {
        id: randomUUID(),
        customerId: customer.id,
        status: 'active',
        creditLimit: 2000,
        outstandingBalance: 0,
      },
    });

    // ── Transactions (3–10 random, €10–€300) ─────────────────────────────────
    const txCount = randomInt(3, 10);
    let savingsBalance = 0;
    let currentBalance = 0;

    // Spread transactions over the last 90 days (most recent last)
    const txDates = Array.from({ length: txCount }, () => randomInt(1, 90))
      .sort((a, b) => b - a); // descending so oldest is created first

    for (let i = 0; i < txCount; i++) {
      const amount = randomAmount(10, 300);
      const createdAt = daysAgo(txDates[i]);

      // First transaction is always a deposit to fund the account
      const txTypes = ['deposit', 'deposit', 'spend', 'transfer'] as const;
      const type = i === 0 ? 'deposit' : txTypes[randomInt(0, txTypes.length - 1)];

      if (type === 'deposit') {
        savingsBalance = parseFloat((savingsBalance + amount).toFixed(2));
        await prisma.transaction.create({
          data: {
            id: randomUUID(),
            type: 'deposit',
            toAccountId: savings.id,
            amount,
            description: 'Bank deposit',
            createdAt,
          },
        });
      } else if (type === 'spend' && savingsBalance >= amount) {
        savingsBalance = parseFloat((savingsBalance - amount).toFixed(2));
        await prisma.transaction.create({
          data: {
            id: randomUUID(),
            type: 'spend',
            fromAccountId: savings.id,
            amount,
            description: 'Purchase',
            createdAt,
          },
        });
      } else if (type === 'transfer' && savingsBalance >= amount) {
        savingsBalance = parseFloat((savingsBalance - amount).toFixed(2));
        currentBalance = parseFloat((currentBalance + amount).toFixed(2));
        await prisma.transaction.create({
          data: {
            id: randomUUID(),
            type: 'transfer',
            fromAccountId: savings.id,
            toAccountId: current.id,
            amount,
            description: 'Transfer to current account',
            createdAt,
          },
        });
      } else {
        // Fallback: deposit if the chosen type isn't possible (insufficient balance)
        savingsBalance = parseFloat((savingsBalance + amount).toFixed(2));
        await prisma.transaction.create({
          data: {
            id: randomUUID(),
            type: 'deposit',
            toAccountId: savings.id,
            amount,
            description: 'Bank deposit',
            createdAt,
          },
        });
      }
    }

    // Set final balances to match transaction history
    await prisma.bankAccount.update({
      where: { id: savings.id },
      data: { balance: savingsBalance },
    });
    await prisma.bankAccount.update({
      where: { id: current.id },
      data: { balance: currentBalance },
    });

    console.log(`  ✓ ${c.fullName} — ${txCount} transactions seeded`);
  }

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
