import { Server } from 'socket.io';
import { auth } from '../config/firebase';
import { db } from '../config/database';
import { filterMessage } from '../services/chat-filter.service';

export function setupSocketIO(io: Server) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = await auth.verifyIdToken(token);
      const user = await db.query('SELECT id, full_name, role FROM users WHERE firebase_uid = $1', [decoded.uid]);
      if (!user.rows[0]) return next(new Error('Unauthorized'));
      (socket as unknown as Record<string, unknown>).userId = user.rows[0].id;
      (socket as unknown as Record<string, unknown>).user = user.rows[0];
      next();
    } catch { next(new Error('Authentication failed')); }
  });

  io.on('connection', (socket) => {
    const userId = (socket as unknown as Record<string, unknown>).userId as string;
    console.log(`💬 User connected: ${userId}`);

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
    });

    socket.on('send_message', async (data: {
      roomId: string; text: string; messageType?: string;
    }) => {
      try {
        // Get violation count for this user
        const vcResult = await db.query(
          'SELECT COUNT(*) as count FROM chat_violations WHERE user_id = $1', [userId]
        );
        const violationCount = parseInt(vcResult.rows[0]?.count || '0');

        // Apply chat filter
        const filterResult = await filterMessage(data.text, userId, violationCount);

        if (filterResult.shouldBan) {
          socket.emit('error', { message: '🚫 Account suspended for repeated violations.' });
          return;
        }

        // Save violation log if detected
        if (!filterResult.isClean) {
          const room = await db.query('SELECT id FROM chat_rooms WHERE id = $1', [data.roomId]);
          if (room.rows[0]) {
            await db.query(
              `INSERT INTO chat_violations (room_id, user_id, violation_type, original_content)
               VALUES ($1, $2, $3, $4)`,
              [data.roomId, userId, filterResult.violationType, filterResult.originalText]
            );
          }
        }

        const messagePayload = {
          id: Date.now().toString(),
          senderId: userId,
          text: filterResult.filteredText,
          isFiltered: !filterResult.isClean,
          timestamp: new Date().toISOString(),
        };

        io.to(data.roomId).emit('new_message', messagePayload);

        if (!filterResult.isClean) {
          socket.emit('filter_warning', {
            message: filterResult.shouldWarn
              ? '⚠️ Your message contained contact info and was filtered. Use in-app calls only.'
              : '🚫 Repeated violation detected. One more and your account will be suspended.',
            violationCount: violationCount + 1,
          });
        }
      } catch (err) {
        console.error('Message error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`💔 User disconnected: ${userId}`);
    });
  });
}
