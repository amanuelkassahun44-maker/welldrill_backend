import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

import path from 'path';
import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { serviceRouter } from './routes/service.routes';
import { marketplaceRouter } from './routes/marketplace.routes';
import { chatRouter } from './routes/chat.routes';
import { feedRouter } from './routes/feed.routes';
import { paymentRouter } from './routes/payment.routes';
import { adminRouter } from './routes/admin.routes';
import { ecosystemRouter } from './routes/ecosystem.routes';
import { versionRouter } from './routes/version.routes';
import { setupSocketIO } from './socket/socket.handler';
import { errorHandler } from './middleware/error.middleware';

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new SocketServer(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});
setupSocketIO(io);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static uploads serving
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api/', limiter);

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', app: 'WellDrill Ethiopia API', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/services', serviceRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/chat', chatRouter);
app.use('/api/feed', feedRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ecosystem', ecosystemRouter);
app.use('/api/version', versionRouter);

app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '5000');
server.listen(PORT, () => {
  console.log(`\n🚰 WellDrill Ethiopia API running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health\n`);
});

export { app, io };
