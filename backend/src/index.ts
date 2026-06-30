import app from './app';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API docs: http://localhost:${port}/api/v1/docs`);
});
