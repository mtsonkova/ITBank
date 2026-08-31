# 1. Copy env file (if not done already)
cp backend/.env.example backend/.env

# 2. Create migration + apply + seed (embedded SQLite database)
cd backend
npx prisma migrate dev --name init
npx prisma db seed
