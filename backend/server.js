import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { connectDB, db } from './db.js';
import { 
  createRoomState, 
  startAuctionTimer, 
  getNextBidIncrement, 
  runtimeRooms, 
  runTournamentSimulation,
  pauseAuctionTimer,
  resumeAuctionTimer,
  endAuctionEarly,
  fillLobbyWithAIBots
} from './auctionEngine.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for local testing convenience
    methods: ["GET", "POST"]
  }
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', databaseMode: db.isInMemory() ? 'memory' : 'mongodb' });
});

const JWT_SECRET = process.env.JWT_SECRET || 'ipl_league_secret_key_123';
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Signup Endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const existingUser = await db.getUser(username);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already exists.' });
    }

    const passwordHash = hashPassword(password);
    const newUser = {
      username,
      passwordHash,
      email,
      careerStats: { matchesPlayed: 0, trophiesWon: 0, totalRuns: 0, totalWickets: 0 }
    };

    const user = await db.saveUser(newUser);
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    const userRes = { username: user.username, email: user.email, careerStats: user.careerStats };
    res.json({ success: true, token, user: userRes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Server error during signup.' });
  }
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const user = await db.getUser(username);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const userRes = { username: user.username, email: user.email, careerStats: user.careerStats };
    res.json({ success: true, token, user: userRes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Server error during login.' });
  }
});

// Profile Endpoint
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await db.getUser(decoded.username);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const userRes = { username: user.username, email: user.email, careerStats: user.careerStats };
    res.json({ success: true, user: userRes });
  } catch (e) {
    res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
});

// WebSockets Event Handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create_room', async (callback) => {
    try {
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      const room = await createRoomState(roomCode, socket.id);
      
      // Initialize in-memory runtime for timers
      runtimeRooms.set(roomCode, {
        timerInterval: null,
        timerSecondsLeft: 15,
        sockets: new Set([socket.id])
      });

      console.log(`🏠 Room Created: ${roomCode}`);
      callback({ success: true, roomCode, room });
    } catch (e) {
      console.error('Error creating room:', e);
      callback({ success: false, error: 'Failed to create room.' });
    }
  });

  // 2. Join Room
  socket.on('join_room', async ({ roomCode, username, franchise }, callback) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) {
        return callback({ success: false, error: 'Room not found.' });
      }

      if (room.status !== 'waiting') {
        return callback({ success: false, error: 'Auction has already started in this room.' });
      }

      // Check if username or franchise is already taken
      const usernameExists = room.users.some(u => u.username.toLowerCase() === username.toLowerCase());
      const franchiseExists = room.users.some(u => u.franchise.toLowerCase() === franchise.toLowerCase());

      if (usernameExists) {
        return callback({ success: false, error: 'Username already taken in this room.' });
      }
      if (franchiseExists) {
        return callback({ success: false, error: 'IPL Franchise name already taken in this room.' });
      }

      // Create new user block
      const newUser = {
        username,
        socketId: socket.id,
        franchise,
        budget: 100.0, // ₹100 Crore starting budget
        squad: [],
        score: 0
      };

      room.users.push(newUser);
      room.logs.push({
        eventType: 'system',
        text: `👤 ${username} (${franchise}) joined the lobby.`,
        timestamp: new Date()
      });

      await db.saveRoom(room);

      // Join Socket.io room channel
      socket.join(roomCode);

      // Track in runtime
      let runtime = runtimeRooms.get(roomCode);
      if (!runtime) {
        runtime = {
          timerInterval: null,
          timerSecondsLeft: 15,
          sockets: new Set()
        };
        runtimeRooms.set(roomCode, runtime);
      }
      runtime.sockets.add(socket.id);

      // Broadcast join event to everyone in the room
      io.to(roomCode).emit('user_joined', {
        users: room.users,
        logs: room.logs
      });

      console.log(`👤 User ${username} joined Room ${roomCode}`);
      callback({ success: true, room });
    } catch (e) {
      console.error('Error joining room:', e);
      callback({ success: false, error: 'Error joining room.' });
    }
  });

  // 3. Start Auction
  socket.on('start_auction', async ({ roomCode }, callback) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) return callback({ success: false, error: 'Room not found' });
      if (room.hostSocketId !== socket.id) {
        return callback({ success: false, error: 'Only the room creator (host) can start the auction.' });
      }
      if (room.users.length < 2) {
        return callback({ success: false, error: 'At least 2 players must join the room before starting the auction.' });
      }
      // Set active status, select first player
      room.status = 'active';
      room.currentPlayerIndex = 0;
      
      const firstPlayer = room.playersPool[0];
      room.currentBid = {
        amount: firstPlayer.basePrice,
        highestBidder: null,
        endTime: null
      };

      room.logs.push({
        eventType: 'system',
        text: `🚀 Auction started by host! First player up: ${firstPlayer.name} (Base: ₹${firstPlayer.basePrice} Cr)`,
        timestamp: new Date()
      });

      await db.saveRoom(room);

      // Notify clients
      io.to(roomCode).emit('auction_started', room);

      // Start tick timer
      startAuctionTimer(roomCode, io);

      callback({ success: true });
    } catch (e) {
      console.error('Error starting auction:', e);
      callback({ success: false, error: 'Could not start auction.' });
    }
  });

  // 4. Place Bid
  socket.on('place_bid', async ({ roomCode, username, amount }) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room || room.status !== 'active') return;

      const user = room.users.find(u => u.username === username);
      if (!user) return;

      const currentPool = room.playersPool;
      const activePlayer = currentPool[room.currentPlayerIndex];
      if (!activePlayer) return;

      // Validate budget
      if (user.budget < amount) {
        socket.emit('bid_rejected', { error: 'Insufficient budget!' });
        return;
      }

      // Validate increment rules
      const minBidRequired = room.currentBid.highestBidder 
        ? room.currentBid.amount + getNextBidIncrement(room.currentBid.amount) 
        : activePlayer.basePrice;

      // Deduct tiny tolerance for floating-point calculations
      if (amount < parseFloat((minBidRequired - 0.01).toFixed(2))) {
        socket.emit('bid_rejected', { error: `Bid must be at least ₹${minBidRequired.toFixed(2)} Cr.` });
        return;
      }

      // Prevent bidding against yourself
      if (room.currentBid.highestBidder === username) {
        socket.emit('bid_rejected', { error: "You already hold the highest bid!" });
        return;
      }

      // Update current bid
      const timeLimit = room.biddingTimeLimit || 15;
      room.currentBid = {
        amount: parseFloat(amount.toFixed(2)),
        highestBidder: username,
        endTime: new Date(Date.now() + timeLimit * 1000) // dynamic seconds extension
      };

      // Add to logs
      room.logs.push({
        eventType: 'bid',
        text: `🔨 ${username} bid ₹${room.currentBid.amount.toFixed(2)} Cr for ${activePlayer.name}`,
        timestamp: new Date()
      });

      await db.saveRoom(room);

      // Broadcast bid update
      io.to(roomCode).emit('bid_updated', {
        currentBid: room.currentBid,
        logs: room.logs
      });

      // Reset timer countdown
      startAuctionTimer(roomCode, io);
    } catch (e) {
      console.error('Error placing bid:', e);
    }
  });

  // 4b. Update Bidding Time Limit
  socket.on('update_bidding_time', async ({ roomCode, biddingTimeLimit }, callback) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });
      if (room.hostSocketId !== socket.id) {
        return callback({ success: false, error: 'Only the host can modify settings.' });
      }
      if (room.status !== 'waiting') {
        return callback({ success: false, error: 'Cannot modify settings once auction has started.' });
      }

      room.biddingTimeLimit = biddingTimeLimit;
      room.logs.push({
        eventType: 'system',
        text: `⚙️ Host updated bidding time limit to ${biddingTimeLimit} seconds.`,
        timestamp: new Date()
      });

      await db.saveRoom(room);

      // Broadcast room settings update to all participants
      io.to(roomCode).emit('room_settings_updated', room);

      callback({ success: true });
    } catch (e) {
      console.error('Error updating bidding time:', e);
      callback({ success: false, error: 'Failed to update bidding time limit.' });
    }
  });

  // 4c. Pause Auction
  socket.on('pause_auction', async ({ roomCode }, callback) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });
      if (room.hostSocketId !== socket.id) {
        return callback({ success: false, error: 'Only the host can pause the auction.' });
      }
      if (room.status !== 'active') {
        return callback({ success: false, error: 'Auction is not currently active.' });
      }

      const success = pauseAuctionTimer(roomCode, io);
      if (success) {
        room.logs.push({
          eventType: 'system',
          text: `⏸️ Auction paused by the host.`,
          timestamp: new Date()
        });
        await db.saveRoom(room);
        io.to(roomCode).emit('room_logs_updated', { logs: room.logs });
        callback({ success: true });
      } else {
        callback({ success: false, error: 'Failed to pause auction.' });
      }
    } catch (e) {
      console.error('Error pausing auction:', e);
      callback({ success: false, error: 'Error occurred.' });
    }
  });

  // 4d. Resume Auction
  socket.on('resume_auction', async ({ roomCode }, callback) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });
      if (room.hostSocketId !== socket.id) {
        return callback({ success: false, error: 'Only the host can resume the auction.' });
      }
      if (room.status !== 'active') {
        return callback({ success: false, error: 'Auction is not currently active.' });
      }

      const success = await resumeAuctionTimer(roomCode, io);
      if (success) {
        room.logs.push({
          eventType: 'system',
          text: `▶️ Auction resumed by the host.`,
          timestamp: new Date()
        });
        await db.saveRoom(room);
        io.to(roomCode).emit('room_logs_updated', { logs: room.logs });
        callback({ success: true });
      } else {
        callback({ success: false, error: 'Failed to resume auction.' });
      }
    } catch (e) {
      console.error('Error resuming auction:', e);
      callback({ success: false, error: 'Error occurred.' });
    }
  });

  // 4e. End Auction Early
  socket.on('end_auction_early', async ({ roomCode }, callback) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });
      if (room.hostSocketId !== socket.id) {
        return callback({ success: false, error: 'Only the host can end the auction early.' });
      }
      if (room.status !== 'active') {
        return callback({ success: false, error: 'Auction is not currently active.' });
      }

      const success = await endAuctionEarly(roomCode, io);
      if (success) {
        callback({ success: true });
      } else {
        callback({ success: false, error: 'Failed to end auction early.' });
      }
    } catch (e) {
      console.error('Error ending auction early:', e);
      callback({ success: false, error: 'Error occurred.' });
    }
  });

  // 5. Chat Message
  socket.on('chat_message', async ({ roomCode, sender, message }) => {
    try {
      const room = await db.getRoom(roomCode);
      if (!room) return;

      const newMsg = { sender, message, timestamp: new Date() };
      room.chat.push(newMsg);
      
      await db.saveRoom(room);
      
      io.to(roomCode).emit('chat_received', newMsg);
    } catch (e) {
      console.error('Error sending chat message:', e);
    }
  });

  // 6. Trigger Simulation
  socket.on('trigger_simulation', async ({ roomCode, username, playingXI, captainId, viceCaptainId }, callback) => {
    try {
      let room = await db.getRoom(roomCode);
      if (!room) return callback({ success: false, error: 'Room not found.' });

      if (username && playingXI) {
        room.users = room.users.map(u => {
          if (u.username === username) {
            return { ...u, playingXI, captainId, viceCaptainId };
          }
          return u;
        });
        room = await db.saveRoom(room);
      }

      const customXIInfo = {};
      room.users.forEach(u => {
        if (u.playingXI) {
          customXIInfo[u.username] = u.playingXI;
        }
      });

      await runTournamentSimulation(roomCode, io, customXIInfo);
      callback({ success: true });
    } catch (e) {
      console.error('Error triggering simulation:', e);
      callback({ success: false, error: 'Could not run match simulation.' });
    }
  });

  // 7. Disconnect / Leave
  socket.on('disconnecting', async () => {
    for (const roomCode of socket.rooms) {
      if (roomCode === socket.id) continue;

      try {
        const room = await db.getRoom(roomCode);
        if (!room) continue;

        // Remove socket from user record or update connection state
        const userIndex = room.users.findIndex(u => u.socketId === socket.id);
        if (userIndex !== -1) {
          const departingUser = room.users[userIndex];
          room.logs.push({
            eventType: 'system',
            text: `🚪 ${departingUser.username} disconnected.`,
            timestamp: new Date()
          });

          // If auction hasn't started, remove them completely. Otherwise convert to AI bot to play out tournament.
          if (room.status === 'waiting') {
            room.users.splice(userIndex, 1);
          } else {
            room.users[userIndex].isAI = true;
            room.logs.push({
              eventType: 'system',
              text: `🤖 ${departingUser.username} converted to AI Manager bot.`,
              timestamp: new Date()
            });
          }

          // Host socket update if host left
          if (room.hostSocketId === socket.id && room.users.length > 0) {
            const nextHost = room.users[0];
            room.hostSocketId = nextHost.socketId;
            room.logs.push({
              eventType: 'system',
              text: `👑 Host rights transferred to ${nextHost.username}`,
              timestamp: new Date()
            });
          }

          if (room.users.length === 0) {
            // Clean up room fully
            await db.deleteRoom(roomCode);
            const runtime = runtimeRooms.get(roomCode);
            if (runtime && runtime.timerInterval) {
              clearInterval(runtime.timerInterval);
            }
            runtimeRooms.delete(roomCode);
            console.log(`🗑️ Deleted empty room ${roomCode}`);
          } else {
            await db.saveRoom(room);
            io.to(roomCode).emit('user_left', {
              users: room.users,
              logs: room.logs
            });
          }
        }
      } catch (e) {
        console.error('Error handling disconnect cleaning:', e);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Connect to DB and start HTTP server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 IPL Auction server running on http://localhost:${PORT}`);
  });
});
