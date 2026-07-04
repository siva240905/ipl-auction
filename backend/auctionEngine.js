import { db } from './db.js';
import { initialPlayers } from './playersData.js';

// In-memory active rooms runtime (stores timers, sockets list, and transient state)
export const runtimeRooms = new Map();

// Helper to shuffle the player pool
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Calculate the next bid increment based on real IPL rules
export function getNextBidIncrement(currentBid) {
  if (currentBid < 2.0) return 0.10;      // +10 Lakhs
  if (currentBid < 5.0) return 0.20;      // +20 Lakhs
  if (currentBid < 10.0) return 0.50;     // +50 Lakhs
  return 1.00;                            // +1 Crore
}

// Initialize a new room's state
export async function createRoomState(roomCode, hostSocketId) {
  // Sort player pool from high base price to low base price (secondary sort by rating descending)
  const sortedPlayers = [...initialPlayers].sort((a, b) => {
    if (b.basePrice !== a.basePrice) {
      return b.basePrice - a.basePrice;
    }
    return b.rating - a.rating;
  });

  const roomData = {
    code: roomCode,
    status: 'waiting', // waiting, active, completed
    hostSocketId,
    biddingTimeLimit: 15,
    users: [], // { username, socketId, franchise, budget, squad: [] }
    currentPlayerIndex: 0,
    currentBid: {
      amount: 0,
      highestBidder: null,
      endTime: null,
      secondsLeft: 15
    },
    playersPool: sortedPlayers.map(p => ({
      ...p,
      status: 'available', // available, sold, unsold
      soldTo: null,
      soldPrice: 0
    })),
    chat: [],
    logs: [{ eventType: 'system', text: `Room ${roomCode} created.`, timestamp: new Date() }],
    matches: []
  };

  await db.saveRoom(roomData);
  return roomData;
}

// Start auction timer tick
export function startAuctionTimer(roomCode, io) {
  const runtime = runtimeRooms.get(roomCode);
  if (!runtime) return;

  // Clear any existing timer
  if (runtime.timerInterval) {
    clearInterval(runtime.timerInterval);
  }

  db.getRoom(roomCode).then((room) => {
    if (!room) return;
    const timeLimit = room.biddingTimeLimit || 15;
    runtime.timerSecondsLeft = timeLimit;
    runtime.isPaused = false; // Reset pause status

    runTimerInterval(roomCode, io, timeLimit);
  }).catch(e => {
    console.error('Error in fetching room for timer initialization:', e);
  });
}

// Reusable timer interval execution helper
function runTimerInterval(roomCode, io, timeLimit) {
  const runtime = runtimeRooms.get(roomCode);
  if (!runtime) return;

  if (runtime.timerInterval) {
    clearInterval(runtime.timerInterval);
  }

  runtime.timerInterval = setInterval(async () => {
    try {
      const currentRoom = await db.getRoom(roomCode);
      if (!currentRoom || currentRoom.status !== 'active') {
        clearInterval(runtime.timerInterval);
        return;
      }

      if (runtime.isPaused) {
        clearInterval(runtime.timerInterval);
        return;
      }

      runtime.timerSecondsLeft--;
      
      // Update client ticking
      io.to(roomCode).emit('timer_tick', { 
        secondsLeft: runtime.timerSecondsLeft,
        totalDuration: timeLimit
      });

      // Run AI Bids Evaluation check
      await handleAIBids(roomCode, io);

      if (runtime.timerSecondsLeft <= 0) {
        clearInterval(runtime.timerInterval);
        await handlePlayerSoldOrUnsold(roomCode, io);
      }
    } catch (error) {
      console.error(`Error in timer tick for room ${roomCode}:`, error);
      clearInterval(runtime.timerInterval);
    }
  }, 1000);
}

// Pause auction timer
export function pauseAuctionTimer(roomCode, io) {
  const runtime = runtimeRooms.get(roomCode);
  if (!runtime) return false;

  runtime.isPaused = true;
  if (runtime.timerInterval) {
    clearInterval(runtime.timerInterval);
  }

  io.to(roomCode).emit('auction_paused', { secondsLeft: runtime.timerSecondsLeft });
  return true;
}

// Resume auction timer
export async function resumeAuctionTimer(roomCode, io) {
  const runtime = runtimeRooms.get(roomCode);
  if (!runtime) return false;

  runtime.isPaused = false;
  const room = await db.getRoom(roomCode);
  const timeLimit = room?.biddingTimeLimit || 15;

  io.to(roomCode).emit('auction_resumed', { secondsLeft: runtime.timerSecondsLeft });
  runTimerInterval(roomCode, io, timeLimit);
  return true;
}

// End auction early
export async function endAuctionEarly(roomCode, io) {
  const runtime = runtimeRooms.get(roomCode);
  if (runtime && runtime.timerInterval) {
    clearInterval(runtime.timerInterval);
  }

  const room = await db.getRoom(roomCode);
  if (!room) return false;

  room.status = 'completed';
  
  fillSquadsTo20(room);
  calculateFinalScores(room);
  
  room.logs.push({
    eventType: 'system',
    text: `🛑 Auction ended early by the host. Scoring and leaderboard finalized.`,
    timestamp: new Date()
  });

  await db.saveRoom(room);
  io.to(roomCode).emit('auction_completed', room);
  return true;
}

// Handle player selling or moving to unsold
async function handlePlayerSoldOrUnsold(roomCode, io) {
  const room = await db.getRoom(roomCode);
  if (!room) return;

  const currentPool = room.playersPool;
  const activeIndex = room.currentPlayerIndex;
  const activePlayer = currentPool[activeIndex];

  if (!activePlayer) return;

  const logs = [...room.logs];
  const users = [...room.users];

  if (room.currentBid && room.currentBid.highestBidder) {
    // SOLD!
    const buyerUsername = room.currentBid.highestBidder;
    const finalPrice = room.currentBid.amount;

    // Update player status
    activePlayer.status = 'sold';
    activePlayer.soldTo = buyerUsername;
    activePlayer.soldPrice = finalPrice;

    // Deduct user budget, add to squad
    const userIndex = users.findIndex(u => u.username === buyerUsername);
    if (userIndex !== -1) {
      users[userIndex].budget = parseFloat((users[userIndex].budget - finalPrice).toFixed(2));
      users[userIndex].squad.push({
        ...activePlayer,
        boughtFor: finalPrice
      });
    }

    logs.push({
      eventType: 'sold',
      text: `🔨 SOLD! ${activePlayer.name} bought by ${buyerUsername} for ₹${finalPrice.toFixed(2)} Cr!`,
      timestamp: new Date()
    });

    io.to(roomCode).emit('player_sold', {
      player: activePlayer,
      buyer: buyerUsername,
      price: finalPrice,
      logs
    });
  } else {
    // UNSOLD
    activePlayer.status = 'unsold';

    logs.push({
      eventType: 'unsold',
      text: `💨 UNSOLD! No bids received for ${activePlayer.name}.`,
      timestamp: new Date()
    });

    io.to(roomCode).emit('player_unsold', {
      player: activePlayer,
      logs
    });
  }

  // Update room DB details
  room.playersPool = currentPool;
  room.users = users;
  room.logs = logs;
  room.currentBid = { amount: 0, highestBidder: null, endTime: null };

  // Wait 4 seconds for frontend celebration animation before showing next player
  setTimeout(async () => {
    try {
      const updatedRoom = await db.getRoom(roomCode);
      if (!updatedRoom) return;

      updatedRoom.currentPlayerIndex += 1;
      
      // Check if auction is completed (e.g. out of players, or all teams filled)
      const allFilled = updatedRoom.users.every(u => u.squad.length >= 11);
      const poolFinished = updatedRoom.currentPlayerIndex >= updatedRoom.playersPool.length;

      if (poolFinished || allFilled) {
        updatedRoom.status = 'completed';
        
        fillSquadsTo20(updatedRoom);
        calculateFinalScores(updatedRoom);
        
        updatedRoom.logs.push({
          eventType: 'system',
          text: `🏆 Auction Completed! Scoring and leaderboard finalized.`,
          timestamp: new Date()
        });

        await db.saveRoom(updatedRoom);
        io.to(roomCode).emit('auction_completed', updatedRoom);
      } else {
        // Pull next player
        const nextPlayer = updatedRoom.playersPool[updatedRoom.currentPlayerIndex];
        updatedRoom.currentBid = {
          amount: nextPlayer.basePrice,
          highestBidder: null,
          endTime: null
        };
        
        updatedRoom.logs.push({
          eventType: 'system',
          text: `🏏 Next up: ${nextPlayer.name} (${nextPlayer.role}, Base: ₹${nextPlayer.basePrice.toFixed(2)} Cr)`,
          timestamp: new Date()
        });

        await db.saveRoom(updatedRoom);
        io.to(roomCode).emit('next_player', {
          player: nextPlayer,
          currentPlayerIndex: updatedRoom.currentPlayerIndex,
          currentBid: updatedRoom.currentBid,
          logs: updatedRoom.logs
        });

        // Restart timer
        startAuctionTimer(roomCode, io);
      }
    } catch (e) {
      console.error('Error serving next player:', e);
    }
  }, 4000);
}

// Calculate team points based on squad, star power, balance, and leftover budget
export function calculateFinalScores(room) {
  room.users = room.users.map(user => {
    let ratingSum = 0;
    let starPlayersCount = 0;
    let bats = 0;
    let bowls = 0;
    let wks = 0;
    let ars = 0;

    user.squad.forEach(p => {
      ratingSum += p.rating;
      if (p.rating >= 90) starPlayersCount++;
      if (p.role === 'Batsman') bats++;
      else if (p.role === 'Bowler') bowls++;
      else if (p.role === 'Wicketkeeper') wks++;
      else if (p.role === 'All-rounder') ars++;
    });

    // Balance Bonus: Need at least 4 Bats, 4 Bowls, 1 WK, 2 All-rounders (for optimal squad size, adjust based on size)
    const hasBalance = bats >= 3 && bowls >= 3 && wks >= 1 && ars >= 2;
    const balanceBonus = hasBalance ? 100 : 0;
    const starBonus = starPlayersCount * 15;
    const budgetBonus = parseFloat((user.budget * 2).toFixed(2));

    const totalScore = ratingSum + balanceBonus + starBonus + budgetBonus;

    return {
      ...user,
      squadMetrics: { bats, bowls, wks, ars, starPlayersCount, balanceBonus },
      score: parseFloat(totalScore.toFixed(2))
    };
  });

  // Sort users by score descending
  room.users.sort((a, b) => b.score - a.score);
}

// Auto-select starting XI based on ratings and constraints (1 WK, 3 Batter, 1 AR, 3 Bowler, max 4 overseas)
export function getStartingXI(team, customXI) {
  const squad = team.squad || [];
  
  if (customXI && Array.isArray(customXI) && customXI.length === 11) {
    const list = squad.filter(p => customXI.includes(p.id));
    if (list.length === 11) return list;
  }

  const sorted = [...squad].sort((a, b) => b.rating - a.rating);
  const xi = [];
  
  const wk = sorted.find(p => p.role === 'Wicketkeeper');
  if (wk) {
    xi.push(wk);
    sorted.splice(sorted.indexOf(wk), 1);
  }

  const batters = sorted.filter(p => p.role === 'Batsman').slice(0, 3);
  batters.forEach(p => {
    xi.push(p);
    sorted.splice(sorted.indexOf(p), 1);
  });

  const ar = sorted.find(p => p.role === 'All-rounder');
  if (ar) {
    xi.push(ar);
    sorted.splice(sorted.indexOf(ar), 1);
  }

  const bowlers = sorted.filter(p => p.role === 'Bowler').slice(0, 3);
  bowlers.forEach(p => {
    xi.push(p);
    sorted.splice(sorted.indexOf(p), 1);
  });

  while (xi.length < 11 && sorted.length > 0) {
    xi.push(sorted.shift());
  }

  return xi;
}

// Decoupled ball-by-ball innings simulator
function simulateInnings(battingTeam, bowlingTeam, batXI, bowlXI, target = null) {
  let runs = 0;
  let wickets = 0;
  let balls = 0;
  
  const batterStats = batXI.map(p => ({ id: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0 }));
  const bowlerStats = bowlXI.filter(p => p.role === 'Bowler' || p.role === 'All-rounder').map(p => ({ id: p.id, name: p.name, overs: 0, runsConceded: 0, wickets: 0 }));
  
  if (bowlerStats.length === 0) {
    bowlerStats.push({ id: 999, name: "Part-time Bowler", overs: 0, runsConceded: 0, wickets: 0 });
  }

  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let activeBowlerIdx = 0;

  while (balls < 120 && wickets < 10) {
    if (target !== null && runs > target) break;

    const striker = batterStats[strikerIdx] || { name: 'Tailender', runs: 0, balls: 0, fours: 0, sixes: 0 };
    const bowler = bowlerStats[activeBowlerIdx % bowlerStats.length];
    
    const rand = Math.random();
    let ballOutcome = 0;
    let isWicket = false;

    const batSkill = batXI.find(p => p.id === striker.id)?.batting || 50;
    const bowlSkill = bowlXI.find(p => p.id === bowler.id)?.bowling || 50;

    const wicketProb = 0.045 + (bowlSkill - batSkill) * 0.0008;
    const boundaryProb = 0.16 + (batSkill - bowlSkill) * 0.0018;

    if (rand < Math.max(0.015, wicketProb)) {
      isWicket = true;
    } else if (rand < wicketProb + boundaryProb) {
      ballOutcome = Math.random() < 0.65 ? 4 : 6;
    } else {
      const runRand = Math.random();
      if (runRand < 0.38) ballOutcome = 0;
      else if (runRand < 0.82) ballOutcome = 1;
      else if (runRand < 0.94) ballOutcome = 2;
      else ballOutcome = 3;
    }

    striker.balls++;
    bowler.overs = parseFloat((bowler.overs + 0.1).toFixed(1));
    if (parseFloat((bowler.overs % 1).toFixed(1)) === 0.6) {
      bowler.overs = Math.floor(bowler.overs) + 1;
      activeBowlerIdx++;
    }

    if (isWicket) {
      wickets++;
      bowler.wickets++;
      strikerIdx = Math.max(strikerIdx, nonStrikerIdx) + 1;
    } else {
      striker.runs += ballOutcome;
      bowler.runsConceded += ballOutcome;
      if (ballOutcome === 4) striker.fours++;
      if (ballOutcome === 6) striker.sixes++;
      runs += ballOutcome;

      if (ballOutcome === 1 || ballOutcome === 3) {
        const temp = strikerIdx;
        strikerIdx = nonStrikerIdx;
        nonStrikerIdx = temp;
      }
    }

    balls++;
    if (balls % 6 === 0) {
      const temp = strikerIdx;
      strikerIdx = nonStrikerIdx;
      nonStrikerIdx = temp;
    }
  }

  const oversDecimal = Math.floor(balls / 6) + (balls % 6) / 10;

  return {
    totalRuns: runs,
    totalWickets: wickets,
    overs: oversDecimal,
    stats: {
      batsmen: batterStats,
      bowlers: bowlerStats
    }
  };
}

// Simulates a single match ball-by-ball
export function simulateMatch(teamA, teamB, customXIInfo = {}) {
  const xiA = getStartingXI(teamA, customXIInfo[teamA.username]);
  const xiB = getStartingXI(teamB, customXIInfo[teamB.username]);

  const ratingA = xiA.reduce((sum, p) => sum + p.rating, 0) / (xiA.length || 1);
  const ratingB = xiB.reduce((sum, p) => sum + p.rating, 0) / (xiB.length || 1);

  const diff = ratingA - ratingB;
  const baseProbA = 0.5 + (diff * 0.025);
  const probA = Math.max(0.18, Math.min(0.82, baseProbA));

  const tossWinner = Math.random() < 0.5 ? teamA : teamB;
  const tossDecision = Math.random() < 0.5 ? 'bat' : 'bowl';
  const battingFirst = (tossWinner.username === teamA.username && tossDecision === 'bat') || 
                       (tossWinner.username === teamB.username && tossDecision === 'bowl') ? teamA : teamB;
  const bowlingFirst = battingFirst.username === teamA.username ? teamB : teamA;

  const firstXI = battingFirst.username === teamA.username ? xiA : xiB;
  const secondXI = battingFirst.username === teamA.username ? xiB : xiA;

  // Innings 1
  const innings1 = simulateInnings(battingFirst, bowlingFirst, firstXI, secondXI);
  // Innings 2
  const innings2 = simulateInnings(bowlingFirst, battingFirst, secondXI, firstXI, innings1.totalRuns);

  const winner = innings2.totalRuns > innings1.totalRuns ? bowlingFirst.username : battingFirst.username;
  const runsWinner = innings2.totalRuns > innings1.totalRuns ? innings2.totalRuns : innings1.totalRuns;
  const runsLoser = innings2.totalRuns > innings1.totalRuns ? innings1.totalRuns : innings2.totalRuns;
  const wicketsWinner = innings2.totalRuns > innings1.totalRuns ? innings2.totalWickets : innings1.totalWickets;
  const wicketsLoser = innings2.totalRuns > innings1.totalRuns ? innings1.totalWickets : innings2.totalWickets;

  const starWinner = (winner === teamA.username ? xiA : xiB).sort((a,b) => b.rating - a.rating)[0]?.name || "Batsmen";
  const commentary = [
    `🪙 Toss won by ${tossWinner.username}. Decided to ${tossDecision} first.`,
    `📈 Win Probability: ${teamA.username} ${(probA*100).toFixed(0)}% | ${teamB.username} ${((1-probA)*100).toFixed(0)}%.`,
    `🔥 Powerplay explosion! ${starWinner} gets off to a flying start, smashing back-to-back boundaries.`,
    `🏆 Game Over! ${winner} wins against ${winner === teamA.username ? teamB.username : teamA.username}! (${battingFirst.username}: ${innings1.totalRuns}/${innings1.totalWickets} vs ${bowlingFirst.username}: ${innings2.totalRuns}/${innings2.totalWickets}).`
  ];

  return {
    homeTeam: teamA.username,
    homeFranchise: teamA.franchise,
    awayTeam: teamB.username,
    awayFranchise: teamB.franchise,
    homeScore: battingFirst.username === teamA.username ? innings1.totalRuns : innings2.totalRuns,
    homeWickets: battingFirst.username === teamA.username ? innings1.totalWickets : innings2.totalWickets,
    homeOvers: battingFirst.username === teamA.username ? innings1.overs : innings2.overs,
    awayScore: battingFirst.username === teamB.username ? innings1.totalRuns : innings2.totalRuns,
    awayWickets: battingFirst.username === teamB.username ? innings1.totalWickets : innings2.totalWickets,
    awayOvers: battingFirst.username === teamB.username ? innings1.overs : innings2.overs,
    commentary,
    winner,
    playerStats: {
      innings1: innings1.stats,
      innings2: innings2.stats
    }
  };
}

// Dynamically compile tournament standings points table
export function getPointsStandings(room) {
  const standings = room.users.map(u => ({
    username: u.username,
    franchise: u.franchise,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    points: 0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
    nrr: 0.0
  }));

  room.matches.forEach(m => {
    const home = standings.find(s => s.username === m.homeTeam);
    const away = standings.find(s => s.username === m.awayTeam);
    if (!home || !away) return;

    home.played++;
    away.played++;

    home.runsScored += m.homeScore;
    home.oversFaced += m.homeOvers;
    home.runsConceded += m.awayScore;
    home.oversBowled += m.awayOvers;

    away.runsScored += m.awayScore;
    away.oversFaced += m.awayOvers;
    away.runsConceded += m.homeScore;
    away.oversBowled += m.homeOvers;

    if (m.winner === m.homeTeam) {
      home.won++;
      home.points += 2;
      away.lost++;
    } else if (m.winner === m.awayTeam) {
      away.won++;
      away.points += 2;
      home.lost++;
    } else {
      home.tied++;
      away.tied++;
      home.points += 1;
      away.points += 1;
    }
  });

  standings.forEach(s => {
    const runsRateScored = s.oversFaced > 0 ? s.runsScored / s.oversFaced : 0;
    const runsRateConceded = s.oversBowled > 0 ? s.runsConceded / s.oversBowled : 0;
    s.nrr = parseFloat((runsRateScored - runsRateConceded).toFixed(3));
  });

  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
}

// Generate full round-robin season schedule (90 games)
export function generateFixtures(users) {
  const venues = [
    "Wankhede Stadium, Mumbai",
    "M. Chinnaswamy Stadium, Bengaluru",
    "Eden Gardens, Kolkata",
    "Narendra Modi Stadium, Ahmedabad",
    "M. A. Chidambaram Stadium, Chennai",
    "Rajiv Gandhi Stadium, Hyderabad",
    "IS Bindra Stadium, Mohali",
    "Arun Jaitley Stadium, Delhi",
    "Ekana Stadium, Lucknow",
    "Sawai Mansingh Stadium, Jaipur"
  ];

  const fixtures = [];
  let dayOffset = 1;

  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < users.length; i++) {
      for (let j = 0; j < users.length; j++) {
        if (i === j) continue;
        
        const venue = venues[(i + j + round) % venues.length];
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        
        const time = (i + j) % 2 === 0 ? "19:30 IST" : "15:30 IST";

        fixtures.push({
          id: fixtures.length + 1,
          homeTeam: users[i].username,
          homeFranchise: users[i].franchise,
          awayTeam: users[j].username,
          awayFranchise: users[j].franchise,
          venue,
          date: date.toISOString().split('T')[0],
          time
        });

        if (fixtures.length % 2 === 0) dayOffset++;
      }
    }
  }

  return fixtures;
}

// Generate and simulate full tournament season + playoffs
export async function runTournamentSimulation(roomCode, io, customXIInfo = {}) {
  const room = await db.getRoom(roomCode);
  if (!room) return;

  const users = room.users;
  const matches = [];
  const standLogs = [];

  standLogs.push({
    eventType: 'system',
    text: `⚡ Starting Tournament Simulation between all ${users.length} franchises!`,
    timestamp: new Date()
  });

  // 1. League Stage simulation
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (i === j) continue;
      const matchResult = simulateMatch(users[i], users[j], customXIInfo);
      matches.push(matchResult);
    }
  }

  room.matches = matches;
  const standings = getPointsStandings(room);
  const numTeams = standings.length;

  let championsName = "";

  if (numTeams >= 4) {
    // 2. Playoffs simulation (Top 4 teams)
    const top4 = standings.slice(0, 4);
    const team1 = users.find(u => u.username === top4[0].username);
    const team2 = users.find(u => u.username === top4[1].username);
    const team3 = users.find(u => u.username === top4[2].username);
    const team4 = users.find(u => u.username === top4[3].username);

    // Qualifier 1
    const q1 = simulateMatch(team1, team2, customXIInfo);
    q1.stage = "Qualifier 1";
    matches.push(q1);

    // Eliminator
    const elim = simulateMatch(team3, team4, customXIInfo);
    elim.stage = "Eliminator";
    matches.push(elim);

    // Qualifier 2
    const q1Loser = q1.winner === team1.username ? team2 : team1;
    const elimWinner = users.find(u => u.username === elim.winner);
    const q2 = simulateMatch(q1Loser, elimWinner, customXIInfo);
    q2.stage = "Qualifier 2";
    matches.push(q2);

    // Final
    const q1Winner = users.find(u => u.username === q1.winner);
    const q2Winner = users.find(u => u.username === q2.winner);
    const finalMatch = simulateMatch(q1Winner, q2Winner, customXIInfo);
    finalMatch.stage = "Final";
    matches.push(finalMatch);

    championsName = finalMatch.winner;
  } else if (numTeams === 3) {
    // Top 3 playoffs
    const team1 = users.find(u => u.username === standings[0].username);
    const team2 = users.find(u => u.username === standings[1].username);
    const team3 = users.find(u => u.username === standings[2].username);

    // Semi-Final (Qualifier)
    const qual = simulateMatch(team2, team3, customXIInfo);
    qual.stage = "Semi-Final";
    matches.push(qual);

    // Final
    const qualWinner = users.find(u => u.username === qual.winner);
    const finalMatch = simulateMatch(team1, qualWinner, customXIInfo);
    finalMatch.stage = "Final";
    matches.push(finalMatch);

    championsName = finalMatch.winner;
  } else if (numTeams === 2) {
    // Top 2 playoffs - Direct Final
    const team1 = users.find(u => u.username === standings[0].username);
    const team2 = users.find(u => u.username === standings[1].username);

    const finalMatch = simulateMatch(team1, team2, customXIInfo);
    finalMatch.stage = "Final";
    matches.push(finalMatch);

    championsName = finalMatch.winner;
  } else if (numTeams === 1) {
    // Solo team playing - Auto Champion
    championsName = users[0].username;
  }

  standLogs.push({
    eventType: 'sold',
    text: `🏆 CHAMPIONS: ${championsName} wins the Sigma League Trophy!`,
    timestamp: new Date()
  });

  room.matches = matches;
  room.logs = [...room.logs, ...standLogs];
  room.status = 'completed';

  await db.saveRoom(room);
  
  io.to(roomCode).emit('tournament_simulated', {
    matches,
    logs: room.logs
  });
}

// IPL Franchises definition for bot generation
export const IPL_FRANCHISES = [
  { name: 'Mumbai Indians', short: 'MI' },
  { name: 'Chennai Super Kings', short: 'CSK' },
  { name: 'Royal Challengers Bengaluru', short: 'RCB' },
  { name: 'Kolkata Knight Riders', short: 'KKR' },
  { name: 'Delhi Capitals', short: 'DC' },
  { name: 'Rajasthan Royals', short: 'RR' },
  { name: 'Sunrisers Hyderabad', short: 'SRH' },
  { name: 'Gujarat Titans', short: 'GT' },
  { name: 'Lucknow Super Giants', short: 'LSG' },
  { name: 'Punjab Kings', short: 'PBKS' }
];

// Fill lobby to 10 teams with AI bots
export function fillLobbyWithAIBots(room) {
  const currentFranchises = room.users.map(u => u.franchise);
  const availableFranchises = IPL_FRANCHISES.filter(f => !currentFranchises.includes(f.name));

  let botIndex = 1;
  while (room.users.length < 10 && availableFranchises.length > 0) {
    const franchise = availableFranchises.shift();
    const botUser = {
      username: `[AI] ${franchise.name}`,
      socketId: `ai_bot_socket_${botIndex}_${room.code}`,
      franchise: franchise.name,
      budget: 100.0,
      squad: [],
      isAI: true
    };
    room.users.push(botUser);
    botIndex++;
  }
}

// AI real-time bidding evaluation logic runs inside tick interval
export async function handleAIBids(roomCode, io) {
  const runtime = runtimeRooms.get(roomCode);
  if (!runtime || runtime.isPaused) return;

  // Only bid dynamically in certain seconds left range to feel natural
  if (runtime.timerSecondsLeft > 13 || runtime.timerSecondsLeft < 2) return;

  const room = await db.getRoom(roomCode);
  if (!room || room.status !== 'active') return;

  const activePlayer = room.playersPool[room.currentPlayerIndex];
  if (!activePlayer) return;

  // Find all AI players who are not the current highest bidder
  const aiUsers = room.users.filter(u => u.isAI && u.username !== room.currentBid?.highestBidder);
  if (aiUsers.length === 0) return;

  // Select a random AI bot to evaluate bid
  const aiUser = aiUsers[Math.floor(Math.random() * aiUsers.length)];

  const currentPrice = room.currentBid?.amount || activePlayer.basePrice;
  const isFirstBid = !room.currentBid?.highestBidder;
  
  let increment = 0.10;
  if (currentPrice < 2.0) increment = 0.10;
  else if (currentPrice < 5.0) increment = 0.20;
  else if (currentPrice < 10.0) increment = 0.50;
  else increment = 1.00;

  const nextBidAmount = isFirstBid ? activePlayer.basePrice : currentPrice + increment;

  // AI budget constraint
  if (aiUser.budget < nextBidAmount) return;
  if (aiUser.squad.length >= 20) return;

  // Overseas player count constraint
  const isPlayerOverseas = activePlayer.isOverseas || (activePlayer.country && activePlayer.country !== 'India');
  const overseasCount = aiUser.squad.filter(p => p.isOverseas).length;
  if (isPlayerOverseas && overseasCount >= 8) return;

  // AI bidding brain: determine walk-away price limit based on ratings
  let maxValue = activePlayer.basePrice * 1.5;
  if (activePlayer.rating >= 90) {
    maxValue = Math.min(aiUser.budget * 0.45, 18.0); // Superstar: up to 18 Cr
  } else if (activePlayer.rating >= 80) {
    maxValue = Math.min(aiUser.budget * 0.25, 9.5);  // Star: up to 9.5 Cr
  } else {
    maxValue = Math.min(aiUser.budget * 0.12, 4.5);  // Mid-tier: up to 4.5 Cr
  }

  // 60% probability of bidding to mimic thinking speed
  if (nextBidAmount <= maxValue && Math.random() < 0.60) {
    const timeLimit = room.biddingTimeLimit || 15;
    room.currentBid = {
      amount: parseFloat(nextBidAmount.toFixed(2)),
      highestBidder: aiUser.username,
      endTime: new Date(Date.now() + timeLimit * 1000)
    };

    room.logs.push({
      eventType: 'bid',
      text: `🔨 ${aiUser.username} (${aiUser.franchise}) bid ₹${room.currentBid.amount.toFixed(2)} Cr for ${activePlayer.name}`,
      timestamp: new Date()
    });

    await db.saveRoom(room);

    // Broadcast bid update
    io.to(roomCode).emit('bid_updated', {
      currentBid: room.currentBid,
      logs: room.logs
    });

    // Reset timer
    startAuctionTimer(roomCode, io);
  }
}

export function fillSquadsTo20(room) {
  const unsoldPlayers = room.playersPool.filter(p => p.status !== 'sold' && !p.soldTo);
  unsoldPlayers.sort((a, b) => b.rating - a.rating);

  room.users.forEach(user => {
    const currentSquadSize = user.squad.length;
    if (currentSquadSize >= 20) return;

    const needed = 20 - currentSquadSize;
    for (let k = 0; k < needed; k++) {
      if (unsoldPlayers.length === 0) break;
      
      const p = unsoldPlayers.shift();
      p.status = 'sold';
      p.soldTo = user.username;
      p.soldPrice = 0.0;

      user.squad.push({
        ...p,
        boughtFor: 0.0
      });
    }
  });

  room.users.forEach(user => {
    user.squad.forEach(sq => {
      const idx = room.playersPool.findIndex(p => p.id === sq.id);
      if (idx !== -1) {
        room.playersPool[idx].status = 'sold';
        room.playersPool[idx].soldTo = user.username;
        room.playersPool[idx].soldPrice = sq.boughtFor;
      }
    });
  });
}
