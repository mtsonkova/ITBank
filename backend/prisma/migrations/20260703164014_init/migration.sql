-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'account_manager', 'admin');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('savings', 'current');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('active', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'transfer', 'transfer_external', 'topup', 'spend', 'withdrawal');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('open_account', 'close_account', 'freeze_account', 'unfreeze_account', 'issue_debit_card', 'close_debit_card', 'freeze_debit_card', 'unfreeze_debit_card', 'issue_credit_card', 'close_credit_card', 'freeze_credit_card', 'unfreeze_credit_card', 'increase_credit_limit', 'decrease_credit_limit', 'withdraw_money');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_assignments" (
    "customer_id" TEXT NOT NULL,
    "account_manager_id" TEXT NOT NULL,

    CONSTRAINT "customer_assignments_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_cards" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'active',
    "credit_limit" DECIMAL(15,2) NOT NULL,
    "outstanding_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "from_account_id" TEXT,
    "to_account_id" TEXT,
    "from_card_id" TEXT,
    "to_card_id" TEXT,
    "debit_card_id" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "account_manager_id" TEXT,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actioned_at" TIMESTAMP(3),

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_iban_key" ON "bank_accounts"("iban");

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_cards" ADD CONSTRAINT "debit_cards_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_cards" ADD CONSTRAINT "debit_cards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_card_id_fkey" FOREIGN KEY ("from_card_id") REFERENCES "debit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_card_id_fkey" FOREIGN KEY ("to_card_id") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debit_card_id_fkey" FOREIGN KEY ("debit_card_id") REFERENCES "debit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
