import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes/index';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IT Bank Banking Simulator API',
      version: '1.0.0',
      description: 'REST API for the IT Bank training application',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/**/*.ts'],
});

app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1', apiRouter);

app.use(errorHandler);

export default app;
