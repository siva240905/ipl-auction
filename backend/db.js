import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;
let useMemoryDb = false;

// Memory DB Storage
const memoryDb = {
  rooms: new Map(),
  users: new Map()
};

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.log('⚠️ No MONGODB_URI found. Running in IN-MEMORY fallback mode.');
    useMemoryDb = true;
    return;
  }

  try {
    // Set connection timeout to 3 seconds so it fails fast if local mongo is not running
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB successfully.');
  } catch (error) {
    console.error('❌ MongoDB Connection failed:', error.message);
    console.log('⚠️ Falling back to IN-MEMORY database mode. Data will reset on server restart.');
    useMemoryDb = true;
  }
}

// Schemas & Models (only compiled if MongoDB is connected)
const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  status: { type: String, default: 'waiting' }, // waiting, active, simulating, completed
  hostSocketId: String,
  biddingTimeLimit: { type: Number, default: 15 },
  users: [{
    username: String,
    socketId: String,
    franchise: String,
    budget: Number,
    squad: Array
  }],
  currentPlayerIndex: { type: Number, default: 0 },
  currentBid: {
    amount: Number,
    highestBidder: String,
    endTime: Date
  },
  playersPool: Array,
  chat: [{
    sender: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  logs: [{
    eventType: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  matches: [{
    homeTeam: String,
    awayTeam: String,
    homeScore: Number,
    awayScore: Number,
    homeWickets: Number,
    awayWickets: Number,
    homeOvers: Number,
    awayOvers: Number,
    commentary: Array,
    winner: String
  }]
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  email: String,
  careerStats: {
    matchesPlayed: { type: Number, default: 0 },
    trophiesWon: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    totalWickets: { type: Number, default: 0 }
  }
}, { timestamps: true });

let RoomModel;
let UserModel;
if (mongoose.models && mongoose.models.Room) {
  RoomModel = mongoose.models.Room;
} else {
  RoomModel = mongoose.model('Room', RoomSchema);
}

if (mongoose.models && mongoose.models.User) {
  UserModel = mongoose.models.User;
} else {
  UserModel = mongoose.model('User', UserSchema);
}

// Unified Database CRUD Helper API
export const db = {
  isInMemory: () => useMemoryDb,

  async getRoom(code) {
    if (useMemoryDb) {
      return memoryDb.rooms.get(code) || null;
    }
    try {
      const room = await RoomModel.findOne({ code });
      return room ? room.toObject() : null;
    } catch (e) {
      console.error('Error fetching room from MongoDB, falling back to memory', e);
      return memoryDb.rooms.get(code) || null;
    }
  },

  async saveRoom(roomData) {
    if (useMemoryDb) {
      memoryDb.rooms.set(roomData.code, { ...roomData });
      return roomData;
    }
    try {
      let room = await RoomModel.findOne({ code: roomData.code });
      if (room) {
        Object.assign(room, roomData);
        await room.save();
      } else {
        room = new RoomModel(roomData);
        await room.save();
      }
      return room.toObject();
    } catch (e) {
      console.error('Error saving room to MongoDB, falling back to memory', e);
      memoryDb.rooms.set(roomData.code, { ...roomData });
      return roomData;
    }
  },

  async deleteRoom(code) {
    if (useMemoryDb) {
      return memoryDb.rooms.delete(code);
    }
    try {
      await RoomModel.deleteOne({ code });
      return true;
    } catch (e) {
      console.error('Error deleting room from MongoDB', e);
      return memoryDb.rooms.delete(code);
    }
  },

  async getUser(username) {
    if (useMemoryDb) {
      return memoryDb.users.get(username) || null;
    }
    try {
      const user = await UserModel.findOne({ username });
      return user ? user.toObject() : null;
    } catch (e) {
      console.error('Error fetching user from MongoDB, falling back to memory', e);
      return memoryDb.users.get(username) || null;
    }
  },

  async saveUser(userData) {
    if (useMemoryDb) {
      memoryDb.users.set(userData.username, { ...userData });
      return userData;
    }
    try {
      let user = await UserModel.findOne({ username: userData.username });
      if (user) {
        Object.assign(user, userData);
        await user.save();
      } else {
        user = new UserModel(userData);
        await user.save();
      }
      return user.toObject();
    } catch (e) {
      console.error('Error saving user to MongoDB, falling back to memory', e);
      memoryDb.users.set(userData.username, { ...userData });
      return userData;
    }
  }
};
