import app from './app';

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API docs: http://localhost:${port}/api/v1/docs`);
});
