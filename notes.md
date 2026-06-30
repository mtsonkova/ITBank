# 1. Start PostgreSQL
docker compose up -d

# 2. Copy env file (if not done already)
cp backend/.env.example backend/.env

# 3. Create migration + apply + seed
cd backend
npx prisma migrate dev --name init
npx prisma db seed