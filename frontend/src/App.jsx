import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Users, Award, Trophy, Send, Timer, Plus, Coins, 
  MessageSquare, Check, Copy, Sparkles, Play, LogOut, 
  Info, Activity, TrendingUp, UserCheck, ShieldAlert,
  Home, Settings, Download, Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';


const IPL_FRANCHISES = [
  { name: 'Mumbai Indians', short: 'MI', color: 'from-blue-600 to-blue-800', border: 'border-blue-500' },
  { name: 'Chennai Super Kings', short: 'CSK', color: 'from-yellow-400 to-yellow-600', border: 'border-yellow-500' },
  { name: 'Royal Challengers Bengaluru', short: 'RCB', color: 'from-red-600 to-red-800', border: 'border-red-500' },
  { name: 'Kolkata Knight Riders', short: 'KKR', color: 'from-purple-700 to-indigo-900', border: 'border-purple-600' },
  { name: 'Delhi Capitals', short: 'DC', color: 'from-blue-500 to-red-600', border: 'border-blue-600' },
  { name: 'Rajasthan Royals', short: 'RR', color: 'from-pink-500 to-blue-700', border: 'border-pink-500' },
  { name: 'Sunrisers Hyderabad', short: 'SRH', color: 'from-orange-500 to-orange-700', border: 'border-orange-500' },
  { name: 'Gujarat Titans', short: 'GT', color: 'from-slate-700 to-slate-900', border: 'border-slate-500' },
  { name: 'Lucknow Super Giants', short: 'LSG', color: 'from-cyan-600 to-blue-500', border: 'border-cyan-500' },
  { name: 'Punjab Kings', short: 'PBKS', color: 'from-red-500 to-slate-200', border: 'border-red-500' }
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : `${window.location.protocol}//${window.location.hostname}:5000`);

export default function App() {
  // Navigation & Socket State
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('landing'); // landing, lobby, auction, completed
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [selectedFranchise, setSelectedFranchise] = useState(IPL_FRANCHISES[0].name);
  const [customFranchise, setCustomFranchise] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync Room Data
  const [room, setRoom] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(15);
  const [timerTotalDuration, setTimerTotalDuration] = useState(15);
  
  // Overlay Visuals
  const [soldOverlay, setSoldOverlay] = useState(null); // { name, buyer, price }
  const [unsoldOverlay, setUnsoldOverlay] = useState(null); // { name }
  
  // Input fields
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('squads'); // squads, matches
  const [selectedSquadFranchise, setSelectedSquadFranchise] = useState('');
  const [isAuctionPaused, setIsAuctionPaused] = useState(false);
  const [playingXI, setPlayingXI] = useState([]); // array of player ids
  const [xiSlots, setXiSlots] = useState({
    opener1: '',
    opener2: '',
    middle1: '',
    middle2: '',
    middle3: '',
    middle4: '',
    middle5: '',
    bowler1: '',
    bowler2: '',
    bowler3: '',
    bowler4: ''
  });
  const [captainId, setCaptainId] = useState(null);
  const [viceCaptainId, setViceCaptainId] = useState(null);

  useEffect(() => {
    const list = Object.values(xiSlots).filter(id => id);
    setPlayingXI(list);
    if (captainId && !list.includes(captainId)) setCaptainId(null);
    if (viceCaptainId && !list.includes(viceCaptainId)) setViceCaptainId(null);
  }, [xiSlots, captainId, viceCaptainId]);
  const [activeSimulatingMatch, setActiveSimulatingMatch] = useState(null);
  const [showTrophy, setShowTrophy] = useState(false);
  const [simBallIdx, setSimBallIdx] = useState(0);
  const [simActiveInnings, setSimActiveInnings] = useState(1);
  const [simPlaybackInterval, setSimPlaybackInterval] = useState(null);
  const [simOverlayFlash, setSimOverlayFlash] = useState(null);
  const [simRuns, setSimRuns] = useState(0);
  const [simWickets, setSimWickets] = useState(0);
  const [simOvers, setSimOvers] = useState(0.0);
  const [simCommentary, setSimCommentary] = useState([]);
  const [simWagonWheelBalls, setSimWagonWheelBalls] = useState([]);
  const [authMode, setAuthMode] = useState('login'); // login, signup, guest
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userToken, setUserToken] = useState(localStorage.getItem('token') || '');

  // Refs for auto-scrolls
  const logEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // Connect to Backend Server
  useEffect(() => {
    const newSocket = io(BACKEND_URL, { autoConnect: false });
    newSocket.connect();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Profile auto-fetch if token exists
  useEffect(() => {
    if (userToken) {
      fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsername(data.user.username);
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('token');
          setUserToken('');
        }
      })
      .catch(err => console.error("Me fetch error:", err));
    }
  }, [userToken]);

  const handleLoginSignup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username and password are required.');
      return;
    }

    const endpoint = authMode === 'login' ? 'login' : 'signup';
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          email: email.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        setUserToken(data.token);
        setIsLoggedIn(true);
        alert(`${authMode === 'login' ? 'Logged in' : 'Registered'} successfully!`);
      } else {
        setErrorMsg(data.error || 'Authentication failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error occurred.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUserToken('');
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setEmail('');
  };

  const handleSlotChange = (slotKey, value) => {
    setXiSlots(prev => ({
      ...prev,
      [slotKey]: value
    }));
  };

  const isPlayerSelectedInOtherSlot = (currentSlotKey, playerId) => {
    return Object.entries(xiSlots).some(([key, val]) => key !== currentSlotKey && val === playerId);
  };

  const togglePlayerInXI = (playerId) => {
    // Check if player is already in XI
    const currentSlot = Object.entries(xiSlots).find(([key, val]) => val === playerId);
    if (currentSlot) {
      // Remove from slot
      const [slotKey] = currentSlot;
      setXiSlots(prev => ({
        ...prev,
        [slotKey]: ''
      }));
    } else {
      // Add to first empty slot
      const myUser = room?.users?.find(u => u.username === username);
      const player = myUser?.squad?.find(p => p.id === playerId);
      if (!player) return;

      let targetSlot = '';
      if (player.role === 'Batsman' || player.role === 'Wicketkeeper') {
        // Try openers first, then middle order
        if (!xiSlots.opener1) targetSlot = 'opener1';
        else if (!xiSlots.opener2) targetSlot = 'opener2';
        else {
          const emptyMiddle = ['middle1', 'middle2', 'middle3', 'middle4', 'middle5'].find(k => !xiSlots[k]);
          if (emptyMiddle) targetSlot = emptyMiddle;
        }
      } else if (player.role === 'Bowler') {
        // Try bowlers
        const emptyBowler = ['bowler1', 'bowler2', 'bowler3', 'bowler4'].find(k => !xiSlots[k]);
        if (emptyBowler) targetSlot = emptyBowler;
      } else if (player.role === 'All-rounder') {
        // Try middle order first, then bowlers
        const emptyMiddle = ['middle1', 'middle2', 'middle3', 'middle4', 'middle5'].find(k => !xiSlots[k]);
        if (emptyMiddle) targetSlot = emptyMiddle;
        else {
          const emptyBowler = ['bowler1', 'bowler2', 'bowler3', 'bowler4'].find(k => !xiSlots[k]);
          if (emptyBowler) targetSlot = emptyBowler;
        }
      }

      // If no matching slot found, find any empty slot
      if (!targetSlot) {
        const allSlots = ['opener1', 'opener2', 'middle1', 'middle2', 'middle3', 'middle4', 'middle5', 'bowler1', 'bowler2', 'bowler3', 'bowler4'];
        targetSlot = allSlots.find(k => !xiSlots[k]);
      }

      if (!targetSlot) {
        alert("Starting XI is already full! Remove a player first.");
        return;
      }

      setXiSlots(prev => ({
        ...prev,
        [targetSlot]: playerId
      }));
    }
  };

  const selectCaptain = (playerId) => {
    if (!playingXI.includes(playerId)) return;
    setCaptainId(playerId);
    if (viceCaptainId === playerId) setViceCaptainId(null);
  };

  const selectViceCaptain = (playerId) => {
    if (!playingXI.includes(playerId)) return;
    setViceCaptainId(playerId);
    if (captainId === playerId) setCaptainId(null);
  };

  const startLiveMatchSimulation = (match) => {
    if (simPlaybackInterval) clearInterval(simPlaybackInterval);

    const runsInn1 = match.homeScore;
    const wicketsInn1 = match.homeWickets;
    let runsRemaining = runsInn1;
    let wicketsRemaining = wicketsInn1;
    let wicketsArray = Array(120).fill(false);
    
    let wPlaced = 0;
    while (wPlaced < wicketsRemaining) {
      const idx = Math.floor(Math.random() * 120);
      if (!wicketsArray[idx]) {
        wicketsArray[idx] = true;
        wPlaced++;
      }
    }

    let currentRuns1 = 0;
    let currentWickets1 = 0;
    const ballsInnings1 = [];

    for (let b = 0; b < 120; b++) {
      const isWicket = wicketsArray[b];
      let ballRuns = 0;
      if (!isWicket && runsRemaining > 0) {
        const rand = Math.random();
        if (rand < 0.12 && runsRemaining >= 6) { ballRuns = 6; runsRemaining -= 6; }
        else if (rand < 0.28 && runsRemaining >= 4) { ballRuns = 4; runsRemaining -= 4; }
        else if (rand < 0.6) { ballRuns = 1; runsRemaining -= 1; }
        else if (rand < 0.7) { ballRuns = 2; runsRemaining -= 2; }
      }
      
      if (isWicket) currentWickets1++;
      currentRuns1 += ballRuns;

      ballsInnings1.push({
        ballNum: b + 1,
        runs: ballRuns,
        isWicket,
        cumulativeRuns: currentRuns1,
        cumulativeWickets: currentWickets1,
        overs: Math.floor(b / 6) + ((b % 6) + 1) / 10
      });
    }

    const runsInn2 = match.awayScore;
    const wicketsInn2 = match.awayWickets;
    let runsRemaining2 = runsInn2;
    let wicketsRemaining2 = wicketsInn2;
    let wicketsArray2 = Array(120).fill(false);
    wPlaced = 0;
    while (wPlaced < wicketsRemaining2) {
      const idx = Math.floor(Math.random() * 120);
      if (!wicketsArray2[idx]) {
        wicketsArray2[idx] = true;
        wPlaced++;
      }
    }

    let currentRuns2 = 0;
    let currentWickets2 = 0;
    const ballsInnings2 = [];

    for (let b = 0; b < 120; b++) {
      if (currentRuns2 > runsInn1) break;

      const isWicket = wicketsArray2[b];
      let ballRuns = 0;
      if (!isWicket && runsRemaining2 > 0) {
        const rand = Math.random();
        if (rand < 0.15 && runsRemaining2 >= 6) { ballRuns = 6; runsRemaining2 -= 6; }
        else if (rand < 0.3 && runsRemaining2 >= 4) { ballRuns = 4; runsRemaining2 -= 4; }
        else if (rand < 0.65) { ballRuns = 1; runsRemaining2 -= 1; }
        else if (rand < 0.75) { ballRuns = 2; runsRemaining2 -= 2; }
      }

      if (isWicket) currentWickets2++;
      currentRuns2 += ballRuns;

      ballsInnings2.push({
        ballNum: b + 1,
        runs: ballRuns,
        isWicket,
        cumulativeRuns: currentRuns2,
        cumulativeWickets: currentWickets2,
        overs: Math.floor(b / 6) + ((b % 6) + 1) / 10
      });
    }

    setActiveSimulatingMatch({
      ...match,
      ballsInnings1,
      ballsInnings2
    });
    setSimBallIdx(0);
    setSimActiveInnings(1);
    setSimRuns(0);
    setSimWickets(0);
    setSimOvers(0.0);
    setSimCommentary([`🏏 Match begins! ${match.homeTeam} vs ${match.awayTeam}.`]);
    setSimWagonWheelBalls([]);

    let ballCounter = 0;
    let activeInn = 1;
    
    const interval = setInterval(() => {
      const activeBalls = activeInn === 1 ? ballsInnings1 : ballsInnings2;
      
      if (ballCounter >= activeBalls.length) {
        if (activeInn === 1) {
          activeInn = 2;
          setSimActiveInnings(2);
          ballCounter = 0;
          setSimBallIdx(0);
          setSimRuns(0);
          setSimWickets(0);
          setSimOvers(0.0);
          setSimWagonWheelBalls([]);
          setSimCommentary(prev => [`🎯 Target set: ${runsInn1 + 1} runs in 20 overs.`, ...prev]);
        } else {
          clearInterval(interval);
          setSimCommentary(prev => [`🏆 Game over! Winner: ${match.winner}`, ...prev]);
        }
        return;
      }

      const currentBall = activeBalls[ballCounter];
      setSimBallIdx(ballCounter);
      setSimRuns(currentBall.cumulativeRuns);
      setSimWickets(currentBall.cumulativeWickets);
      setSimOvers(currentBall.overs);

      if (currentBall.runs === 4) {
        setSimOverlayFlash('four');
        setTimeout(() => setSimOverlayFlash(null), 850);
        playSynthBeep(440, 150);
      } else if (currentBall.runs === 6) {
        setSimOverlayFlash('six');
        setTimeout(() => setSimOverlayFlash(null), 850);
        playSynthBeep(587, 200);
      } else if (currentBall.isWicket) {
        setSimOverlayFlash('wicket');
        setTimeout(() => setSimOverlayFlash(null), 850);
        playSynthBeep(220, 300);
      }

      if (currentBall.runs > 0) {
        const angle = Math.random() * 360;
        let length = 40;
        if (currentBall.runs === 4) length = 72;
        if (currentBall.runs === 6) length = 85;
        setSimWagonWheelBalls(prev => [...prev, { angle, length, runs: currentBall.runs }]);
      }

      const overStr = currentBall.overs.toFixed(1);
      let eventText = `${overStr}: Single taken.`;
      if (currentBall.runs === 4) eventText = `💥 ${overStr}: BOUNDARY! Beautiful cover drive for four!`;
      else if (currentBall.runs === 6) eventText = `🔥 ${overStr}: SIX! Clears the boundary rope with ease!`;
      else if (currentBall.isWicket) eventText = `🔴 ${overStr}: OUT! Clean bowled! The middle stump is knocked back.`;
      else if (currentBall.runs === 0) eventText = `${overStr}: Dot ball, beaten by pace.`;

      setSimCommentary(prev => [eventText, ...prev.slice(0, 15)]);

      ballCounter++;
    }, 120);

    setSimPlaybackInterval(interval);
  };

  const playSynthBeep = (freq, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration/1000);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration/1000);
    } catch (e) {}
  };

  const getAggregatedPlayerStats = () => {
    const statsMap = {};
    
    if (room && room.users) {
      room.users.forEach(u => {
        u.squad.forEach(p => {
          statsMap[p.id] = {
            id: p.id,
            name: p.name,
            franchise: u.franchise,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            wickets: 0,
            runsConceded: 0,
            overs: 0.0
          };
        });
      });
    }

    if (room && room.matches) {
      room.matches.forEach(m => {
        if (!m.playerStats) return;

        const processInnings = (inn) => {
          if (!inn) return;
          if (inn.batsmen) {
            inn.batsmen.forEach(b => {
              if (statsMap[b.id]) {
                statsMap[b.id].runs += b.runs;
                statsMap[b.id].balls += b.balls;
                statsMap[b.id].fours += b.fours;
                statsMap[b.id].sixes += b.sixes;
              }
            });
          }
          if (inn.bowlers) {
            inn.bowlers.forEach(bowl => {
              if (statsMap[bowl.id]) {
                statsMap[bowl.id].wickets += bowl.wickets;
                statsMap[bowl.id].runsConceded += bowl.runsConceded;
                const totalBalls = Math.floor(statsMap[bowl.id].overs) * 6 + Math.round((statsMap[bowl.id].overs % 1) * 10) +
                                   Math.floor(bowl.overs) * 6 + Math.round((bowl.overs % 1) * 10);
                statsMap[bowl.id].overs = Math.floor(totalBalls / 6) + (totalBalls % 6) / 10;
              }
            });
          }
        };

        processInnings(m.playerStats.innings1);
        processInnings(m.playerStats.innings2);
      });
    }

    const list = Object.values(statsMap);
    const orangeCap = [...list].sort((a,b) => b.runs - a.runs).slice(0, 10);
    const purpleCap = [...list].sort((a,b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, 10);
    const boundaryKings = [...list].sort((a,b) => (b.fours + b.sixes) - (a.fours + a.sixes)).slice(0, 10);
    const mvpList = [...list].sort((a,b) => {
      const scoreA = a.runs * 1 + a.wickets * 20 + a.sixes * 2.5 + a.fours * 1.5;
      const scoreB = b.runs * 1 + b.wickets * 20 + b.sixes * 2.5 + b.fours * 1.5;
      return scoreB - scoreA;
    }).slice(0, 10);

    return { orangeCap, purpleCap, boundaryKings, mvpList };
  };

  // Listen to Socket.io Events
  useEffect(() => {
    if (!socket) return;

    socket.on('user_joined', ({ users, logs }) => {
      setRoom(prev => prev ? { ...prev, users, logs } : null);
    });

    socket.on('user_left', ({ users, logs }) => {
      setRoom(prev => prev ? { ...prev, users, logs } : null);
    });

    socket.on('room_settings_updated', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    socket.on('auction_started', (updatedRoom) => {
      setIsAuctionPaused(false);
      setRoom(updatedRoom);
      setScreen('auction');
      setTimerSecondsLeft(updatedRoom.biddingTimeLimit || 15);
      setTimerTotalDuration(updatedRoom.biddingTimeLimit || 15);
    });

    socket.on('timer_tick', ({ secondsLeft, totalDuration }) => {
      setTimerSecondsLeft(secondsLeft);
      setTimerTotalDuration(totalDuration);
    });

    socket.on('bid_updated', ({ currentBid, logs }) => {
      setIsAuctionPaused(false);
      setRoom(prev => {
        if (!prev) return null;
        const newLimit = prev.biddingTimeLimit || 15;
        setTimerSecondsLeft(newLimit);
        return { ...prev, currentBid, logs };
      });
    });

    socket.on('player_sold', ({ player, buyer, price, logs }) => {
      setSoldOverlay({ name: player.name, buyer, price });
      triggerConfetti();
      setRoom(prev => {
        if (!prev) return null;
        // Apply updates locally while awaiting server sync
        const updatedUsers = prev.users.map(u => {
          if (u.username === buyer) {
            const updBudget = parseFloat((u.budget - price).toFixed(2));
            return {
              ...u,
              budget: updBudget,
              squad: [...u.squad, { ...player, boughtFor: price }]
            };
          }
          return u;
        });
        const updatedPool = prev.playersPool.map((p, idx) => {
          if (idx === prev.currentPlayerIndex) {
            return { ...p, status: 'sold', soldTo: buyer, soldPrice: price };
          }
          return p;
        });
        return {
          ...prev,
          users: updatedUsers,
          playersPool: updatedPool,
          logs
        };
      });

      setTimeout(() => {
        setSoldOverlay(null);
      }, 3500);
    });

    socket.on('player_unsold', ({ player, logs }) => {
      setUnsoldOverlay({ name: player.name });
      setRoom(prev => {
        if (!prev) return null;
        const updatedPool = prev.playersPool.map((p, idx) => {
          if (idx === prev.currentPlayerIndex) {
            return { ...p, status: 'unsold' };
          }
          return p;
        });
        return {
          ...prev,
          playersPool: updatedPool,
          logs
        };
      });

      setTimeout(() => {
        setUnsoldOverlay(null);
      }, 3500);
    });

    socket.on('next_player', ({ player, currentPlayerIndex, currentBid, logs }) => {
      setIsAuctionPaused(false);
      setRoom(prev => {
        if (!prev) return null;
        setTimerSecondsLeft(prev.biddingTimeLimit || 15);
        return { 
          ...prev, 
          currentPlayerIndex, 
          currentBid, 
          logs 
        };
      });
    });

    socket.on('auction_paused', ({ secondsLeft }) => {
      setIsAuctionPaused(true);
      setTimerSecondsLeft(secondsLeft);
    });

    socket.on('auction_resumed', ({ secondsLeft }) => {
      setIsAuctionPaused(false);
      setTimerSecondsLeft(secondsLeft);
    });

    socket.on('room_logs_updated', ({ logs }) => {
      setRoom(prev => prev ? { ...prev, logs } : null);
    });

    socket.on('chat_received', (msg) => {
      setRoom(prev => prev ? { ...prev, chat: [...prev.chat, msg] } : null);
    });

    socket.on('auction_completed', (updatedRoom) => {
      setRoom(updatedRoom);
      setScreen('completed');
    });

    socket.on('tournament_simulated', ({ matches, logs }) => {
      setRoom(prev => prev ? { ...prev, matches, logs } : null);
      setShowTrophy(true);
    });

    socket.on('bid_rejected', ({ error }) => {
      alert(`⚠️ Bid Rejected: ${error}`);
    });

    return () => {
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('room_settings_updated');
      socket.off('auction_started');
      socket.off('timer_tick');
      socket.off('bid_updated');
      socket.off('player_sold');
      socket.off('player_unsold');
      socket.off('next_player');
      socket.off('auction_paused');
      socket.off('auction_resumed');
      socket.off('room_logs_updated');
      socket.off('chat_received');
      socket.off('auction_completed');
      socket.off('tournament_simulated');
      socket.off('bid_rejected');
    };
  }, [socket]);

  // Scroll utilities
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.chat]);

  // Set default selected squad franchise when completed screen triggers
  useEffect(() => {
    if (screen === 'completed' && room?.users?.length > 0) {
      setSelectedSquadFranchise(room.users[0].franchise);
    }
  }, [screen, room]);

  // Confetti explosion
  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  // Copy Room Code to clipboard
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create Room Flow
  const handleCreateRoom = () => {
    if (!username.trim()) {
      setErrorMsg('Please enter a username.');
      return;
    }
    const franchiseName = customFranchise.trim() || selectedFranchise;

    setErrorMsg('');
    socket.emit('create_room', (response) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setIsHost(true);
        // Automatically join the newly created room
        socket.emit('join_room', { 
          roomCode: response.roomCode, 
          username: username.trim(), 
          franchise: franchiseName 
        }, (joinResp) => {
          if (joinResp.success) {
            setRoom(joinResp.room);
            setScreen('lobby');
          } else {
            setErrorMsg(joinResp.error);
          }
        });
      } else {
        setErrorMsg(response.error);
      }
    });
  };

  // Join Room Flow
  const handleJoinRoom = () => {
    if (!username.trim()) {
      setErrorMsg('Please enter a username.');
      return;
    }
    if (!inputRoomCode.trim()) {
      setErrorMsg('Please enter a 6-digit room code.');
      return;
    }
    const franchiseName = customFranchise.trim() || selectedFranchise;

    setErrorMsg('');
    socket.emit('join_room', { 
      roomCode: inputRoomCode.trim(), 
      username: username.trim(), 
      franchise: franchiseName 
    }, (response) => {
      if (response.success) {
        setRoomCode(inputRoomCode.trim());
        setIsHost(false);
        setRoom(response.room);
        setScreen('lobby');
      } else {
        setErrorMsg(response.error);
      }
    });
  };

  // Start Auction
  const handleStartAuction = () => {
    if (!isHost) return;
    socket.emit('start_auction', { roomCode }, (response) => {
      if (!response.success) {
        alert(response.error);
      }
    });
  };

  // Update Bidding Time Limit (Host only)
  const handleUpdateBiddingTime = (newTime) => {
    if (!isHost) return;
    socket.emit('update_bidding_time', { roomCode, biddingTimeLimit: newTime }, (response) => {
      if (!response.success) {
        alert(response.error);
      }
    });
  };

  // Pause Live Auction (Host only)
  const handlePauseAuction = () => {
    if (!socket || !roomCode) return;
    socket.emit('pause_auction', { roomCode }, (res) => {
      if (!res.success) alert(res.error);
    });
  };

  // Resume Live Auction (Host only)
  const handleResumeAuction = () => {
    if (!socket || !roomCode) return;
    socket.emit('resume_auction', { roomCode }, (res) => {
      if (!res.success) alert(res.error);
    });
  };

  // End Live Auction Early (Host only)
  const handleEndAuctionEarly = () => {
    if (!socket || !roomCode) return;
    if (window.confirm("Are you sure you want to end this live auction early? Leaderboards will be finalized based on current squads.")) {
      socket.emit('end_auction_early', { roomCode }, (res) => {
        if (!res.success) alert(res.error);
      });
    }
  };

  // Bid Increments Calculations
  const getNextBidAmount = () => {
    if (!room || !room.currentBid) return 0;
    const currentPrice = room.currentBid.amount;
    const isFirstBid = !room.currentBid.highestBidder;
    
    if (isFirstBid) {
      // First bid is exactly the player's base price
      const activePlayer = room.playersPool[room.currentPlayerIndex];
      return activePlayer ? activePlayer.basePrice : 0;
    }

    const currentBid = room.currentBid.amount;
    let increment = 0.10;
    if (currentBid < 2.0) increment = 0.10;
    else if (currentBid < 5.0) increment = 0.20;
    else if (currentBid < 10.0) increment = 0.50;
    else increment = 1.00;

    return parseFloat((currentBid + increment).toFixed(2));
  };

  // Place Bid
  const placeBid = (amount) => {
    if (!room) return;
    socket.emit('place_bid', {
      roomCode,
      username,
      amount
    });
  };

  // Send Chat Message
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    socket.emit('chat_message', {
      roomCode,
      sender: username,
      message: chatInput.trim()
    });
    setChatInput('');
  };

  // Simulate Matches
  const handleSimulateMatches = () => {
    const mySquad = myUserRecord?.squad || [];
    const xiPlayers = mySquad.filter(p => playingXI.includes(p.id));
    const wkCount = xiPlayers.filter(p => p.role === 'Wicketkeeper').length;
    const batCount = xiPlayers.filter(p => p.role === 'Batsman').length;
    const arCount = xiPlayers.filter(p => p.role === 'All-rounder').length;
    const bowlCount = xiPlayers.filter(p => p.role === 'Bowler').length;
    const overseasCount = xiPlayers.filter(p => p.isOverseas || (p.country && p.country !== 'India')).length;
    const isXIValid = playingXI.length === 11 && wkCount >= 1 && batCount >= 3 && arCount >= 1 && bowlCount >= 3 && overseasCount <= 4 && captainId && viceCaptainId;

    if (!isXIValid && mySquad.length > 0) {
      if (!window.confirm("Your Playing XI composition is invalid (minimum 1 WK, 3 Batter, 1 AR, 3 Bowler, max 4 overseas, and Captain/VC). Would you like the engine to auto-select your best XI and run simulation?")) {
        return;
      }
    }

    socket.emit('trigger_simulation', { 
      roomCode,
      username,
      playingXI,
      captainId,
      viceCaptainId
    }, (response) => {
      if (!response.success) {
        alert(response.error);
      }
    });
  };

  const getFranchiseLogo = (name) => {
    const item = IPL_FRANCHISES.find(f => f.name === name);
    const short = item ? item.short : name.slice(0, 3).toUpperCase();
    let bg = 'bg-slate-700';
    if (short === 'RCB') bg = 'bg-red-600';
    else if (short === 'CSK') bg = 'bg-yellow-500 text-black';
    else if (short === 'MI') bg = 'bg-blue-600';
    else if (short === 'KKR') bg = 'bg-[#3a225d]';
    else if (short === 'DC') bg = 'bg-blue-500';
    else if (short === 'RR') bg = 'bg-pink-600';
    else if (short === 'SRH') bg = 'bg-orange-600';
    else if (short === 'GT') bg = 'bg-slate-800';
    else if (short === 'LSG') bg = 'bg-cyan-600';
    else if (short === 'PBKS') bg = 'bg-red-700';

    return (
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm text-white ${bg} shadow-md`}>
        {short}
      </div>
    );
  };

  const downloadSquadCard = () => {
    const node = document.getElementById('squad-card-capture');
    if (!node) return;
    
    toPng(node, { cacheBust: true, pixelRatio: 2 })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${selectedSquadFranchise.replace(/\s+/g, '_')}_squad.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((error) => {
        console.error('Failed to generate image:', error);
        alert('Failed to save image. Please try again.');
      });
  };

  const shareSquadCard = () => {
    const node = document.getElementById('squad-card-capture');
    if (!node) return;

    toPng(node, { cacheBust: true, pixelRatio: 2 })
      .then((dataUrl) => {
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `${selectedSquadFranchise.replace(/\s+/g, '_')}_squad.png`, { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({
                files: [file],
                title: `${selectedSquadFranchise} Squad Card`,
                text: `Check out my IPL Auction squad for ${selectedSquadFranchise}!`,
              }).catch(err => console.log("Error sharing:", err));
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert("Link to the game copied to clipboard! (Native image sharing is not supported in this browser)");
            }
          });
      })
      .catch((error) => {
        console.error('Failed to generate shareable image:', error);
      });
  };

  // Leave room / Back to start
  const handleLeaveRoom = () => {
    window.location.reload();
  };

  // Sidebar rendering helper
  const renderSidebar = () => {
    const isLobby = screen === 'lobby';
    const isAuction = screen === 'auction';
    const isCompleted = screen === 'completed';
    const isLanding = screen === 'landing';

    // Determine current franchise name or Commander title
    const franchiseName = myUserRecord?.franchise || (selectedFranchise ? selectedFranchise : "Kolkata Knight Riders");
    const displaySub = screen !== 'landing' ? franchiseName : "ELITE TIER";

    return (
      <aside className="w-64 flex-shrink-0 bg-slate-950 border-r border-pitch-border flex flex-col justify-between p-5 min-h-screen">
        <div className="space-y-6">
          {/* Header Team Profile Card */}
          <div className="flex items-center gap-3 p-3 bg-pitch-card/30 border border-pitch-border/50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-pitch-glow/10 border border-pitch-glow/30 flex items-center justify-center font-bold text-pitch-glow text-lg">
              🏏
            </div>
            <div className="min-w-0">
              <h4 className="font-accent font-black text-[10px] text-slate-500 uppercase tracking-widest leading-none">COMMANDER</h4>
              <p className="font-accent font-black text-[11px] text-pitch-glow truncate mt-1 leading-none">{displaySub.toUpperCase()}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                if (screen === 'lobby') {
                  setScreen('lobby');
                } else if (screen === 'completed') {
                  setActiveTab('matches');
                }
              }}
              className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition text-[10px] font-accent font-black tracking-wider ${
                (screen === 'lobby' || (screen === 'completed' && activeTab === 'matches'))
                  ? 'bg-gradient-to-r from-pitch-glow/10 to-transparent text-white border-l-2 border-pitch-glow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Home className="w-4 h-4 text-pitch-glow" />
              <span>HOME</span>
            </button>

            <button
              onClick={() => {
                if (screen === 'completed') {
                  setActiveTab('squads');
                  setSelectedSquadFranchise(myUserRecord?.franchise || room?.users[0]?.franchise);
                } else if (screen === 'lobby' || screen === 'auction') {
                  setActiveTab('squads');
                }
              }}
              className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition text-[10px] font-accent font-black tracking-wider ${
                (screen === 'completed' && activeTab === 'squads')
                  ? 'bg-gradient-to-r from-pitch-glow/10 to-transparent text-white border-l-2 border-pitch-glow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Users className="w-4 h-4 text-pitch-glow" />
              <span>MY SQUAD</span>
            </button>

            <button
              onClick={() => {
                if (screen === 'completed') {
                  setActiveTab('budget');
                }
              }}
              className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition text-[10px] font-accent font-black tracking-wider ${
                (screen === 'completed' && activeTab === 'budget')
                  ? 'bg-gradient-to-r from-pitch-glow/10 to-transparent text-white border-l-2 border-pitch-glow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Coins className="w-4 h-4 text-pitch-glow" />
              <span>BUDGET</span>
            </button>

            <button
              onClick={() => {
                if (screen === 'completed') {
                  setActiveTab('market');
                }
              }}
              className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition text-[10px] font-accent font-black tracking-wider ${
                (screen === 'completed' && activeTab === 'market')
                  ? 'bg-gradient-to-r from-pitch-glow/10 to-transparent text-white border-l-2 border-pitch-glow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Award className="w-4 h-4 text-pitch-glow" />
              <span>MARKET</span>
            </button>

            <button
              onClick={() => {
                if (screen === 'completed') {
                  setActiveTab('settings');
                }
              }}
              className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition text-[10px] font-accent font-black tracking-wider ${
                (screen === 'completed' && activeTab === 'settings')
                  ? 'bg-gradient-to-r from-pitch-glow/10 to-transparent text-white border-l-2 border-pitch-glow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Settings className="w-4 h-4 text-pitch-glow" />
              <span>SETTINGS</span>
            </button>
          </nav>
        </div>

        {/* Action Button at the bottom of the sidebar */}
        <div className="pt-4 border-t border-pitch-border/50">
          {isLanding && (
            <button
              onClick={handleCreateRoom}
              className="w-full py-3 bg-pitch-glow hover:brightness-110 active:scale-95 transition text-pitch-dark text-xs font-black tracking-widest rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase font-accent"
            >
              CREATE ROOM
            </button>
          )}

          {isLobby && (
            <button
              onClick={handleStartAuction}
              disabled={room?.users?.length < 2}
              className={`w-full py-3 transition text-xs font-black tracking-widest rounded-lg flex items-center justify-center gap-2 uppercase font-accent ${
                room?.users?.length < 2
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-pitch-glow hover:brightness-110 text-pitch-dark'
              }`}
            >
              START AUCTION
            </button>
          )}

          {isAuction && (
            <button
              onClick={() => {
                const element = document.getElementById('bid-controls');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-3 bg-pitch-glow hover:brightness-110 active:scale-95 transition text-pitch-dark text-xs font-black tracking-widest rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase font-accent"
            >
              LIVE BID NOW
            </button>
          )}

          {isCompleted && (
            <button
              onClick={handleSimulateMatches}
              className="w-full py-3 bg-pitch-glow hover:brightness-110 active:scale-95 transition text-pitch-dark text-xs font-black tracking-widest rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase font-accent"
            >
              SIMULATE LEAGUE
            </button>
          )}
        </div>
      </aside>
    );
  };

  // Helper variables
  const myUserRecord = room?.users?.find(u => u.username === username);
  const activePlayer = room?.playersPool?.[room?.currentPlayerIndex];
  const nextMinBid = getNextBidAmount();
  const alreadyHighestBidder = room?.currentBid?.highestBidder === username;
  const insufficientBudget = myUserRecord ? myUserRecord.budget < nextMinBid : true;

  // Active Franchise styling colors lookup
  const getFranchiseTheme = (fname) => {
    const found = IPL_FRANCHISES.find(f => f.name === fname);
    return found || { name: fname, short: fname.slice(0, 3).toUpperCase(), color: 'from-slate-600 to-slate-800', border: 'border-slate-500' };
  };

  // circular timer path offset
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timerSecondsLeft / timerTotalDuration) * circumference;

  // Determine color coding of countdown timer
  const getTimerColorClass = () => {
    if (timerSecondsLeft > 8) return 'stroke-pitch-glow text-pitch-glow';
    if (timerSecondsLeft > 3) return 'stroke-pitch-gold text-pitch-gold';
    return 'stroke-pitch-crimson text-pitch-crimson animate-pulse';
  };

  return (
    <div className="min-h-screen flex flex-row bg-pitch-dark text-slate-100 font-sports selection:bg-pitch-glow selection:text-pitch-dark overflow-x-hidden">
      {/* 1. LEFT SIDEBAR */}
      {screen !== 'landing' && renderSidebar()}

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
        
        {/* Top Header Nav */}
        <header className="border-b border-pitch-border px-6 py-4 flex items-center justify-between bg-pitch-dark/80 backdrop-blur-sm z-30">
          {/* Left Part: Title */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-xl tracking-tight text-white font-accent">
                SIGMA <span className="text-pitch-glow">LEAGUE</span>
              </h1>
            </div>

            {/* Top navigation tabs */}
            {screen !== 'landing' && (
              <div className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-400">
                <span className={`cursor-pointer hover:text-white transition ${screen === 'lobby' ? 'text-pitch-glow border-b-2 border-pitch-glow pb-1' : ''}`} onClick={() => setScreen('lobby')}>Lobby</span>
                <span className={`cursor-pointer hover:text-white transition ${screen === 'auction' ? 'text-pitch-glow border-b-2 border-pitch-glow pb-1' : ''}`} onClick={() => setScreen('auction')}>Live Auction</span>
                <span className={`cursor-pointer hover:text-white transition ${screen === 'completed' ? 'text-pitch-glow border-b-2 border-pitch-glow pb-1' : ''}`} onClick={() => setScreen('completed')}>Franchise</span>
                <span className={`cursor-pointer hover:text-white transition ${screen === 'completed' ? 'text-pitch-glow border-b-2 border-pitch-glow pb-1' : ''}`} onClick={() => setScreen('completed')}>Leaderboard</span>
              </div>
            )}
          </div>

          {/* Right Part: Stats & Badges */}
          <div className="flex items-center gap-4">
            {screen !== 'landing' && room && (
              <div className="bg-slate-950/80 border border-pitch-border px-4 py-1.5 rounded-full flex items-center gap-4 text-[10px] md:text-xs font-bold tracking-tight text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">BUDGET:</span>
                  <span className="text-pitch-glow font-black font-accent">₹{myUserRecord ? myUserRecord.budget.toFixed(2) : '100.00'} Cr</span>
                </div>
                <div className="h-3 w-[1px] bg-pitch-border"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">SQUAD:</span>
                  <span className="text-pitch-glow font-black font-accent">{myUserRecord ? myUserRecord.squad.length : '0'}/20</span>
                </div>
              </div>
            )}

            {/* Icon shortcuts from screenshot */}
            <div className="flex items-center gap-2 text-slate-400">
              <button className="p-1.5 hover:bg-slate-800 rounded transition hover:text-white">
                <span className="text-sm">🔔</span>
              </button>
              <button className="p-1.5 hover:bg-slate-800 rounded transition hover:text-white">
                <span className="text-sm">📁</span>
              </button>
              <div className="w-8 h-8 rounded-full border border-pitch-glow/30 bg-pitch-card flex items-center justify-center font-bold text-pitch-glow text-xs">
                {username ? username.slice(0, 2).toUpperCase() : 'ME'}
              </div>
            </div>
          </div>
        </header>

        {/* SCREEN ROUTING */}
        <main className="flex-grow flex items-center justify-center p-6">
          
          {/* 1. LANDING SCREEN */}
          {screen === 'landing' && (
            <div className="max-w-md w-full bg-slate-950 border border-pitch-border rounded-2xl p-8 shadow-2xl relative overflow-hidden animate-scale-in">
              {/* Ambient glows */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-pitch-glow opacity-5 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-pitch-glow opacity-5 rounded-full blur-2xl"></div>

              <div className="text-center mb-8">
                <span className="text-[10px] text-pitch-glow font-accent font-black tracking-widest uppercase">
                  MULTIPLAYER ARENA
                </span>
                <h2 className="text-3xl font-black mt-2 font-accent tracking-tighter text-white uppercase">
                  BUILD YOUR <span className="text-pitch-glow">DREAM XI</span>
                </h2>
                <p className="text-xs text-slate-400 mt-2">
                  Initialize your franchise and enter the war room.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-950/40 border border-red-800/80 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Manager Name */}
                <div>
                  <label className="block text-[10px] font-accent font-black text-slate-500 mb-1.5 uppercase tracking-wider">MANAGER NAME</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-500 text-xs">👤</span>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value.slice(0, 15))}
                      placeholder="e.g. King Kohli"
                      className="w-full bg-slate-900 border border-pitch-border rounded-lg pl-10 pr-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-pitch-glow transition placeholder-slate-600"
                    />
                  </div>
                </div>

                {/* Base Franchise */}
                <div>
                  <label className="block text-[10px] font-accent font-black text-slate-500 mb-1.5 uppercase tracking-wider">BASE FRANCHISE</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-500 text-xs">🏏</span>
                    <select 
                      value={selectedFranchise}
                      onChange={(e) => {
                        setSelectedFranchise(e.target.value);
                        setCustomFranchise('');
                      }}
                      className="w-full bg-slate-900 border border-pitch-border rounded-lg pl-10 pr-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-pitch-glow transition cursor-pointer"
                    >
                      {IPL_FRANCHISES.map((team) => (
                        <option key={team.name} value={team.name}>
                          {team.name} ({team.short})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Team Name */}
                <div>
                  <label className="block text-[10px] font-accent font-black text-slate-500 mb-1.5 uppercase tracking-wider">CUSTOM TEAM NAME (OPTIONAL)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-500 text-xs">✏️</span>
                    <input 
                      type="text" 
                      value={customFranchise}
                      onChange={(e) => setCustomFranchise(e.target.value.slice(0, 25))}
                      placeholder="e.g. Victorious Secret"
                      className="w-full bg-slate-900 border border-pitch-border rounded-lg pl-10 pr-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-pitch-glow transition placeholder-slate-600"
                    />
                  </div>
                </div>

                {/* Create Room Button */}
                <button
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 bg-pitch-glow hover:brightness-110 active:scale-95 transition text-pitch-dark text-xs font-black tracking-widest rounded-lg shadow-lg shadow-pitch-glow/10 flex items-center justify-center gap-2 uppercase font-accent"
                >
                  + CREATE NEW ROOM
                </button>

                {/* Join Existing spacer */}
                <div className="flex items-center gap-2 my-5">
                  <div className="flex-grow h-[1px] bg-pitch-border/50"></div>
                  <span className="text-[8px] font-accent font-black text-slate-600 uppercase tracking-widest">OR JOIN EXISTING</span>
                  <div className="flex-grow h-[1px] bg-pitch-border/50"></div>
                </div>

                {/* Room Join Section */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-grow">
                    <span className="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔑</span>
                    <input 
                      type="text" 
                      value={inputRoomCode}
                      onChange={(e) => setInputRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit Code"
                      className="w-full bg-slate-900 border border-pitch-border rounded-lg pl-10 pr-4 py-3 text-white text-xs tracking-widest font-accent font-black focus:outline-none focus:border-pitch-glow transition placeholder-slate-700"
                    />
                  </div>
                  <button
                    onClick={handleJoinRoom}
                    className="px-6 py-3.5 bg-slate-950 border border-pitch-border hover:bg-slate-900 active:scale-95 transition text-pitch-glow text-xs font-black tracking-wider rounded-lg font-accent"
                  >
                    JOIN
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* 2. LOBBY / WAITING SCREEN */}
        {screen === 'lobby' && room && (
          <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6 animate-scale-in items-start">
            
            {/* Left Lobby Meta */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel rounded-2xl p-6 border border-pitch-border shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <span className="text-xs text-pitch-glow font-semibold tracking-wider font-accent">LOBBY STATUS</span>
                    <h2 className="text-2xl font-black text-white font-accent">WAITING FOR OWNERS</h2>
                  </div>
                  <div className="bg-slate-900 border border-pitch-border px-4 py-2 rounded-xl flex items-center gap-3">
                    <span className="font-accent font-black text-2xl text-pitch-glow tracking-widest">{roomCode}</span>
                    <button 
                      onClick={copyRoomCode}
                      className="p-1.5 hover:bg-slate-800 rounded transition text-slate-400 hover:text-white"
                      title="Copy Code"
                    >
                      {copied ? <Check className="w-5 h-5 text-pitch-glow" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="bg-pitch-dark/50 border border-pitch-border/50 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-pitch-accent" /> Quick Lobby Info
                  </h3>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                    <li>Requires at least 2 team owners to start the auction.</li>
                    <li>Each manager gets ₹100 Crore starting budget to bid.</li>
                    <li>Players are pulled one-by-one; bidding timer resets on every bid.</li>
                    <li>Winning matches and final squad scores determines the league champion.</li>
                  </ul>
                </div>

                {/* Lobby Settings Card */}
                <div className="bg-slate-900/50 border border-pitch-border/50 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-1.5 font-accent">
                    ⚙️ LOBBY SETTINGS
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Bidding Time Limit per Player / Bid</p>
                      <p className="text-sm font-semibold text-white">Current: <span className="text-pitch-glow font-bold">{room.biddingTimeLimit || 15} seconds</span></p>
                    </div>
                    {isHost ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={room.biddingTimeLimit || 15}
                          onChange={(e) => handleUpdateBiddingTime(parseInt(e.target.value))}
                          className="bg-slate-800 border border-pitch-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-pitch-glow cursor-pointer transition"
                        >
                          <option value="10">10 seconds</option>
                          <option value="15">15 seconds</option>
                          <option value="20">20 seconds</option>
                          <option value="30">30 seconds</option>
                          <option value="45">45 seconds</option>
                          <option value="60">60 seconds</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic bg-slate-900 border border-pitch-border/30 px-2.5 py-1 rounded">Managed by Host</span>
                    )}
                  </div>
                </div>

                {/* Host Start Controller */}
                {isHost ? (
                  <div>
                    <button
                      onClick={handleStartAuction}
                      disabled={room.users.length < 2}
                      className={`w-full py-4 rounded-xl font-black tracking-wider flex items-center justify-center gap-2 shadow-lg transition ${
                        room.users.length < 2
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-gradient-to-r from-pitch-glow to-pitch-accent text-pitch-dark hover:brightness-110 active:scale-95'
                      }`}
                    >
                      <Play className="w-5 h-5 fill-current" /> START AUCTION ({room.users.length} Owners)
                    </button>
                    {room.users.length < 2 && (
                      <p className="text-[10px] text-pitch-crimson font-bold text-center mt-2 animate-pulse">
                        ⚠️ AT LEAST 2 TEAMS MUST JOIN BEFORE STARTING THE AUCTION
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900 border border-pitch-border rounded-xl text-center text-slate-400 text-sm">
                    ☕ Waiting for host <span className="text-pitch-accent font-semibold">({room.users.find(u => u.socketId === room.hostSocketId)?.username || 'Admin'})</span> to start the auction.
                  </div>
                )}
              </div>

              {/* Lobby Users List */}
              <div className="glass-panel rounded-2xl p-6 border border-pitch-border shadow-xl">
                <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Users className="w-4 h-4 text-pitch-glow" /> Joined Managers ({room.users.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {room.users.map((user) => {
                    const isUserHost = user.socketId === room.hostSocketId;
                    const isSelf = user.username === username;
                    const theme = getFranchiseTheme(user.franchise);

                    return (
                      <div 
                        key={user.username}
                        className={`p-4 rounded-xl border ${theme.border} bg-slate-900/80 flex items-center justify-between relative overflow-hidden`}
                      >
                        {/* Team color accent strip */}
                        <div className={`absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b ${theme.color}`}></div>
                        
                        <div className="pl-3">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            {user.username}
                            {isSelf && <span className="text-[10px] bg-pitch-glow/20 border border-pitch-glow text-pitch-glow px-1.5 py-0.5 rounded font-accent uppercase">YOU</span>}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">{user.franchise}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isUserHost && (
                            <span className="text-[10px] bg-pitch-accent/20 border border-pitch-accent text-pitch-accent px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                              Crown HOST
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Chat Panel */}
            <div className="lg:col-span-1 glass-panel rounded-2xl border border-pitch-border shadow-xl h-[480px] flex flex-col justify-between">
              <div className="px-4 py-3 border-b border-pitch-border flex items-center justify-between bg-pitch-card/50">
                <h3 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pitch-accent" /> BANTER CHAT
                </h3>
              </div>

              {/* Message History */}
              <div className="flex-grow overflow-y-auto p-4 space-y-3">
                {room.chat.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 italic text-center">
                    No banter yet. Start trash talking before the auction!
                  </div>
                ) : (
                  room.chat.map((msg, idx) => {
                    const isSelf = msg.sender === username;
                    return (
                      <div key={idx} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold ${isSelf ? 'text-pitch-glow' : 'text-pitch-accent'}`}>
                            {msg.sender}
                          </span>
                          <span className="text-[8px] text-slate-600">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-xs max-w-[85%] break-words ${
                          isSelf 
                            ? 'bg-pitch-glow text-pitch-dark font-medium rounded-tr-none' 
                            : 'bg-slate-900 border border-pitch-border text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-pitch-border bg-slate-950 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value.slice(0, 100))}
                  placeholder="Type banter..."
                  className="flex-grow bg-slate-900 border border-pitch-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pitch-glow transition placeholder-slate-600"
                />
                <button
                  type="submit"
                  className="p-2 bg-slate-800 hover:bg-pitch-glow hover:text-pitch-dark transition border border-pitch-border rounded-lg text-slate-300"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. LIVE AUCTION SCREEN */}
        {screen === 'auction' && room && (
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-scale-in">
            
            {/* SOLD OVERLAYS */}
            {soldOverlay && (
              <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center animate-fade-in">
                <div className="glass-panel-glow border-2 border-pitch-glow max-w-md w-full p-8 rounded-2xl text-center shadow-2xl relative">
                  <div className="text-pitch-glow font-accent font-black text-6xl tracking-widest animate-bounce">
                    SOLD!
                  </div>
                  <hr className="border-pitch-glow/30 my-4" />
                  <p className="text-slate-400 text-xs tracking-widest uppercase">PLAYER BOUGHT</p>
                  <h3 className="text-3xl font-black text-white mt-1">{soldOverlay.name}</h3>
                  <div className="my-6 p-4 bg-pitch-dark/80 border border-pitch-border rounded-xl">
                    <p className="text-xs text-slate-400 uppercase font-semibold">ACQUIRED BY</p>
                    <p className="text-xl font-bold text-pitch-accent mt-0.5">{soldOverlay.buyer}</p>
                    <hr className="border-pitch-border/50 my-2" />
                    <p className="text-xs text-slate-400 uppercase font-semibold">FINAL PRICE</p>
                    <p className="text-2xl font-black text-pitch-gold font-accent mt-0.5">₹{soldOverlay.price.toFixed(2)} Cr</p>
                  </div>
                  <p className="text-xs text-slate-500 italic">Moving to the next player card in 3 seconds...</p>
                </div>
              </div>
            )}

            {unsoldOverlay && (
              <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center animate-fade-in">
                <div className="glass-panel border-2 border-pitch-crimson max-w-md w-full p-8 rounded-2xl text-center shadow-2xl">
                  <div className="text-pitch-crimson font-accent font-black text-6xl tracking-widest animate-pulse">
                    UNSOLD
                  </div>
                  <hr className="border-pitch-crimson/30 my-4" />
                  <p className="text-slate-400 text-xs tracking-widest uppercase">PLAYER</p>
                  <h3 className="text-3xl font-black text-white mt-1">{unsoldOverlay.name}</h3>
                  <div className="my-6 p-4 bg-pitch-dark/80 border border-pitch-border rounded-xl">
                    <p className="text-sm text-slate-300">No bids were submitted for this player.</p>
                  </div>
                  <p className="text-xs text-slate-500 italic">Moving to the next player card in 3 seconds...</p>
                </div>
              </div>
            )}

            {/* Column 1: Franchises board (Budgets, Squad sizes) */}
            <div className="lg:col-span-1 glass-panel rounded-2xl border border-pitch-border p-4 shadow-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-pitch-glow" /> Franchise Status
              </h3>
              
              <div className="space-y-2">
                {room.users.map((u) => {
                  const isCurrentHighBidder = room.currentBid?.highestBidder === u.username;
                  const theme = getFranchiseTheme(u.franchise);

                  return (
                    <div 
                      key={u.username}
                      className={`p-3 rounded-lg border ${
                        isCurrentHighBidder 
                          ? 'border-pitch-glow bg-pitch-glow/5 animate-pulse' 
                          : 'border-pitch-border bg-slate-900/60'
                      } flex items-center justify-between text-xs transition relative overflow-hidden`}
                    >
                      {/* Active indicator strip */}
                      <div className={`absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b ${theme.color}`}></div>

                      <div className="pl-2">
                        <p className="font-bold text-white flex items-center gap-1">
                          {u.username}
                          {isCurrentHighBidder && (
                            <span className="w-1.5 h-1.5 rounded-full bg-pitch-glow animate-ping"></span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{u.franchise}</p>
                      </div>

                      <div className="text-right">
                        <p className="font-accent font-black text-pitch-gold text-xs md:text-sm">
                          ₹{u.budget.toFixed(2)} Cr
                        </p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">
                          Squad: {u.squad.length}/20
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress pool */}
              <div className="pt-2 border-t border-pitch-border/50">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">
                  <span>AUCTION PROGRESS</span>
                  <span>{room.currentPlayerIndex + 1} / {room.playersPool.length} PLAYERS</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-pitch-glow to-pitch-accent h-1.5 transition-all duration-500"
                    style={{ width: `${((room.currentPlayerIndex + 1) / room.playersPool.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Upcoming Players list */}
              <div className="pt-4 border-t border-pitch-border/50">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 font-accent">
                  ⏳ UPCOMING PLAYERS
                </h4>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {room.playersPool.slice(room.currentPlayerIndex + 1, room.currentPlayerIndex + 6).map((player, pIdx) => (
                    <div 
                      key={player.id} 
                      className="p-2 bg-slate-950/60 border border-pitch-border/40 rounded flex items-center justify-between text-[10px] text-slate-300 hover:border-pitch-border/70 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[8px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono">
                          {room.currentPlayerIndex + pIdx + 2}
                        </span>
                        <p className="font-semibold truncate text-white">{player.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-2">
                        <span className="text-[8px] text-slate-400 font-accent uppercase">{player.role}</span>
                        <span className="text-pitch-gold font-bold">₹{player.basePrice.toFixed(2)} Cr</span>
                      </div>
                    </div>
                  ))}
                  {room.playersPool.length <= room.currentPlayerIndex + 1 && (
                    <p className="text-[10px] text-slate-500 italic text-center py-2">No more players left in the pool.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Column 2 & 3: Live Player Card & Bidding action */}
            <div className="lg:col-span-2 space-y-6">
              {/* Host Control panel */}
              {isHost && (
                <div className="bg-slate-950 border border-pitch-border rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-md animate-scale-in">
                  <span className="font-accent font-black text-[10px] text-pitch-glow uppercase tracking-widest flex items-center gap-1.5">
                    ⚙️ HOST CONTROL PANEL
                  </span>
                  <div className="flex items-center gap-2">
                    {isAuctionPaused ? (
                      <button
                        onClick={handleResumeAuction}
                        className="px-3.5 py-1.5 bg-pitch-glow hover:bg-pitch-glow/80 text-pitch-dark font-black tracking-wide rounded hover:brightness-110 active:scale-95 transition font-accent uppercase"
                      >
                        ▶️ RESUME
                      </button>
                    ) : (
                      <button
                        onClick={handlePauseAuction}
                        className="px-3.5 py-1.5 bg-pitch-gold hover:bg-pitch-gold/80 text-pitch-dark font-black tracking-wide rounded hover:brightness-110 active:scale-95 transition font-accent uppercase"
                      >
                        ⏸️ PAUSE
                      </button>
                    )}
                    <button
                      onClick={handleEndAuctionEarly}
                      className="px-3.5 py-1.5 bg-pitch-crimson hover:brightness-110 text-white font-black tracking-wide rounded active:scale-95 transition font-accent uppercase"
                    >
                      🛑 END AUCTION
                    </button>
                  </div>
                </div>
              )}

              {activePlayer ? (
                <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl relative overflow-hidden">
                  {/* Neon border pulse effect */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pitch-glow via-pitch-accent to-pitch-glow animate-pulse"></div>
                  
                  {/* Top Header Card */}
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-pitch-border/50">
                    <div>
                      <div className="text-[10px] text-slate-500 font-accent font-black tracking-widest uppercase">
                        LOT {activePlayer.id} — ROUND {Math.ceil((room.currentPlayerIndex + 1) / 10)}
                      </div>
                      <h2 className="text-2xl font-black text-white mt-1 leading-none uppercase font-accent">
                        {activePlayer.name}
                      </h2>
                    </div>

                     {/* Digital Countdown Timer */}
                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold font-accent block mb-1">
                        {isAuctionPaused ? '⏸️ PAUSED BY HOST' : 'TIME REMAINING'}
                      </span>
                      <div className={`font-accent font-black text-2xl tracking-widest ${
                        isAuctionPaused 
                          ? 'text-pitch-gold text-glow-gold' 
                          : 'text-pitch-crimson text-glow-red animate-pulse'
                      }`}>
                        00:{timerSecondsLeft < 10 ? `0${timerSecondsLeft}` : timerSecondsLeft}s
                      </div>
                    </div>
                  </div>

                  {/* Player Stats & Ratings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column: Player image and badge */}
                    <div className="h-[280px] bg-slate-950 rounded-xl overflow-hidden relative border border-pitch-border flex flex-col justify-between p-4 shadow-inner">
                      {/* Player Image backdrop */}
                      {activePlayer.image ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img 
                            src={activePlayer.image} 
                            alt={activePlayer.name}
                            className="w-full h-full object-cover opacity-60 hover:opacity-80 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                        </div>
                      ) : null}

                      {/* Mock avatar fallback if initials fail or as overlay */}
                      <div className="flex-grow flex items-center justify-center relative z-10">
                        <div className="w-16 h-16 rounded-full border border-pitch-glow/30 bg-pitch-card/80 backdrop-blur-sm flex items-center justify-center font-accent font-black text-pitch-glow text-2xl shadow-inner shadow-pitch-glow/20">
                          {activePlayer.name ? activePlayer.name.split(' ').map(n => n[0]).join('') : '?'}
                        </div>
                      </div>
                      
                      {/* Role and Overall Rating Badges */}
                      <div className="flex justify-between items-center z-10 bg-slate-950/90 backdrop-blur-sm border border-pitch-border/60 p-2.5 rounded-lg">
                        <span className="text-[10px] text-pitch-glow font-accent font-black tracking-widest">{activePlayer.role.toUpperCase()}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">RATING:</span>
                          <span className="font-accent font-black text-pitch-glow text-sm">{activePlayer.rating}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Attributes & Current Bid Box */}
                    <div className="flex flex-col justify-between space-y-4">
                      {/* Attributes */}
                      <div className="bg-slate-950/40 p-4 rounded-xl border border-pitch-border/50">
                        <h4 className="text-[10px] font-accent font-black text-slate-500 uppercase tracking-widest mb-3">PLAYER ATTRIBUTES</h4>
                        <div className="space-y-3">
                          {/* Batting */}
                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                              <span>BATTING</span>
                              <span className="text-white">{activePlayer.batting} / 100</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-pitch-glow h-1.5 rounded-full transition-all duration-300" style={{ width: `${activePlayer.batting}%` }}></div>
                            </div>
                          </div>

                          {/* Bowling */}
                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                              <span>BOWLING</span>
                              <span className="text-white">{activePlayer.bowling} / 100</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-pitch-glow h-1.5 rounded-full transition-all duration-300" style={{ width: `${activePlayer.bowling}%` }}></div>
                            </div>
                          </div>

                          {/* Wicketkeeping or Agility fallback */}
                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                              <span>{activePlayer.wicketkeeping > 10 ? 'WICKETKEEPING' : 'AGILITY'}</span>
                              <span className="text-white">{activePlayer.wicketkeeping > 10 ? activePlayer.wicketkeeping : 75} / 100</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-pitch-glow h-1.5 rounded-full transition-all duration-300" style={{ width: `${activePlayer.wicketkeeping > 10 ? activePlayer.wicketkeeping : 75}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Current Highest Bid Box */}
                      <div className="bg-slate-950 border border-pitch-border rounded-xl p-4 flex flex-col justify-center shadow-md">
                        <span className="text-[9px] text-pitch-glow font-accent font-black tracking-widest uppercase">CURRENT HIGHEST BID</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-pitch-glow font-accent">
                            ₹{room.currentBid?.amount ? room.currentBid.amount.toFixed(2) : activePlayer.basePrice.toFixed(2)} Cr
                          </span>
                          {room.currentBid?.highestBidder && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              by <span className="text-white font-bold">{room.currentBid.highestBidder}</span>
                            </span>
                          )}
                        </div>
                        {!room.currentBid?.highestBidder && (
                          <span className="text-[9px] text-slate-500 italic mt-0.5">Base price, waiting for opening bid.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bidding Control Panel */}
                  <div className="p-4 bg-slate-950 border border-pitch-border rounded-xl" id="bid-controls">
                    {alreadyHighestBidder ? (
                      <div className="py-3.5 bg-pitch-glow/10 border border-pitch-glow rounded-xl text-center text-pitch-glow text-xs font-accent font-black tracking-wider flex items-center justify-center gap-2">
                        <UserCheck className="w-4 h-4" /> YOU HOLD THE CURRENT HIGHEST BID!
                      </div>
                    ) : insufficientBudget ? (
                      <div className="py-3.5 bg-red-950/20 border border-pitch-crimson rounded-xl text-center text-pitch-crimson text-xs font-accent font-black tracking-wider flex items-center justify-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> INSUFFICIENT BUDGET TO BID ₹{nextMinBid.toFixed(2)} CR
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row gap-3">
                        {/* Primary minimum increment bid button */}
                        <button
                          onClick={() => placeBid(nextMinBid)}
                          className="flex-grow py-4 bg-pitch-glow hover:brightness-110 active:scale-95 transition text-pitch-dark text-xs font-black tracking-widest rounded-xl shadow-lg shadow-pitch-glow/20 flex items-center justify-center gap-1.5 uppercase font-accent"
                        >
                          PLACE BID FOR ₹{nextMinBid.toFixed(2)} CR
                        </button>

                        {/* Extra increment suggestion values */}
                        <button
                          onClick={() => placeBid(nextMinBid + 0.5)}
                          disabled={myUserRecord.budget < (nextMinBid + 0.5)}
                          className="px-6 py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 active:scale-95 transition text-white text-xs font-accent font-black tracking-wider rounded-xl border border-pitch-border flex items-center justify-center gap-1"
                        >
                          <span>+ ₹0.50 CR</span>
                        </button>

                        <button
                          onClick={() => placeBid(nextMinBid + 1.0)}
                          disabled={myUserRecord.budget < (nextMinBid + 1.0)}
                          className="px-6 py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 active:scale-95 transition text-white text-xs font-accent font-black tracking-wider rounded-xl border border-pitch-border flex items-center justify-center gap-1"
                        >
                          <span>+ ₹1.00 CR</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-pitch-border p-12 text-center shadow-xl">
                  <p className="text-slate-400">No active players left to auction or waiting for state updates...</p>
                </div>
              )}
            </div>

            {/* Column 4: Logs Timeline & Live Chat */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Event Logs */}
              <div className="glass-panel rounded-2xl border border-pitch-border shadow-xl h-[280px] flex flex-col justify-between">
                <div className="px-4 py-2 border-b border-pitch-border bg-pitch-card/50">
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-pitch-accent" /> Live Feed
                  </h3>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-2">
                  {room.logs.map((log, index) => {
                    let textClass = 'text-slate-400';
                    let bgClass = 'bg-slate-900/40 border-slate-800';

                    if (log.eventType === 'sold') {
                      textClass = 'text-pitch-glow font-semibold';
                      bgClass = 'bg-pitch-glow/5 border-pitch-glow/30';
                    } else if (log.eventType === 'bid') {
                      textClass = 'text-pitch-gold';
                      bgClass = 'bg-pitch-gold/5 border-pitch-gold/20';
                    } else if (log.eventType === 'unsold') {
                      textClass = 'text-pitch-crimson';
                      bgClass = 'bg-pitch-crimson/5 border-pitch-crimson/25';
                    }

                    return (
                      <div 
                        key={index}
                        className={`p-2 rounded text-[10px] border leading-normal ${bgClass} ${textClass}`}
                      >
                        {log.text}
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
              </div>

              {/* Chat panel */}
              <div className="glass-panel rounded-2xl border border-pitch-border shadow-xl h-[260px] flex flex-col justify-between">
                <div className="px-4 py-2 border-b border-pitch-border bg-pitch-card/50">
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-pitch-accent" /> Trash Talk
                  </h3>
                </div>

                <div className="flex-grow overflow-y-auto p-3 space-y-2.5">
                  {room.chat.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-600 italic">
                      No trash talk yet. Start typing below!
                    </div>
                  ) : (
                    room.chat.map((msg, idx) => {
                      const isSelf = msg.sender === username;
                      return (
                        <div key={idx} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                          <span className={`text-[8px] font-bold mb-0.5 ${isSelf ? 'text-pitch-glow' : 'text-pitch-accent'}`}>
                            {msg.sender}
                          </span>
                          <div className={`px-2 py-1 rounded text-[10px] max-w-[90%] break-words ${
                            isSelf 
                              ? 'bg-pitch-glow text-pitch-dark rounded-tr-none font-medium' 
                              : 'bg-slate-900 border border-pitch-border text-slate-300 rounded-tl-none'
                          }`}>
                            {msg.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="p-2 border-t border-pitch-border bg-slate-950 flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value.slice(0, 80))}
                    placeholder="Banter..."
                    className="flex-grow bg-slate-900 border border-pitch-border rounded px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-pitch-glow transition placeholder-slate-600"
                  />
                  <button
                    type="submit"
                    className="p-1.5 bg-slate-800 hover:bg-pitch-glow hover:text-pitch-dark transition border border-pitch-border rounded text-slate-300"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* 4. COMPLETED SCREEN & SIMULATION */}
        {screen === 'completed' && room && (
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-scale-in">
            
            {/* Leaderboard Panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pitch-glow to-pitch-accent animate-pulse"></div>
                
                <h2 className="text-xl font-black text-white font-accent tracking-tight mb-4 uppercase flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-pitch-gold" /> Standings Leaderboard
                </h2>

                <div className="space-y-3">
                  {room.users.map((u, index) => {
                    const isWinner = index === 0;
                    const isSelf = u.username === username;
                    const theme = getFranchiseTheme(u.franchise);

                    return (
                      <div 
                        key={u.username}
                        className={`p-4 rounded-xl border ${
                          isWinner 
                            ? 'border-pitch-gold bg-pitch-gold/5 shadow-md shadow-pitch-gold/10' 
                            : 'border-pitch-border bg-slate-900/60'
                        } flex items-center justify-between text-sm transition relative overflow-hidden`}
                      >
                        {/* Position visual */}
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            isWinner ? 'bg-pitch-gold text-pitch-dark' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {isWinner ? '👑' : index + 1}
                          </div>
                          
                          <div>
                            <p className="font-extrabold text-white flex items-center gap-1.5">
                              {u.username}
                              {isSelf && <span className="text-[9px] bg-pitch-glow/20 border border-pitch-glow text-pitch-glow px-1 py-0.5 rounded font-accent uppercase">YOU</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">{u.franchise}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-accent font-black text-pitch-glow text-base">
                            {(u.score || 0).toFixed(1)} <span className="text-[10px] text-slate-400 font-semibold font-sports">PTS</span>
                          </p>
                          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider leading-none">
                            ₹{(u.budget !== undefined ? u.budget : 100.0).toFixed(1)} Cr left
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 bg-slate-950 border border-pitch-border rounded-xl">
                  <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5 uppercase">
                    <Info className="w-3.5 h-3.5 text-pitch-accent" /> Scoring System Explained
                  </h4>
                  <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-3">
                    <li><strong>Player ratings</strong>: Total rating sum of players bought.</li>
                    <li><strong>Balance Bonus</strong>: +100 PTS if squad contains at least 3 batsmen, 3 bowlers, 1 WK, 2 all-rounders.</li>
                    <li><strong>Leftover Budget</strong>: +2 PTS for every ₹1 Cr remaining.</li>
                    <li><strong>Star Player Bonus</strong>: +15 PTS for every star (rating &ge; 90) acquired.</li>
                  </ul>
                </div>
              </div>

              {/* Tournament Simulator Activation Control */}
              <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl text-center">
                <h3 className="font-black text-white font-accent uppercase tracking-tight mb-2 flex justify-center items-center gap-2">
                  <Activity className="w-5 h-5 text-pitch-accent" /> Match Simulator
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Simulate dynamic head-to-head matches between all team owners. Match victories are determined by average squad attributes.
                </p>

                {room.matches.length === 0 ? (
                  <button
                    onClick={handleSimulateMatches}
                    className="w-full py-3 bg-gradient-to-r from-pitch-glow to-pitch-accent text-pitch-dark font-black tracking-wider rounded-xl shadow-lg transition active:scale-95 hover:brightness-110 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" /> RUN LEAGUE SIMULATION
                  </button>
                ) : (
                  <div className="p-3 bg-pitch-glow/10 border border-pitch-glow/30 rounded-lg text-pitch-glow text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Tournament Simulation Completed!
                  </div>
                )}
              </div>
            </div>

            {/* Simulation Matches & Squad Tabs */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Tab Navigation */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-pitch-border">
                <button
                  onClick={() => setActiveTab('squads')}
                  className={`flex-grow py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'squads' ? 'bg-pitch-card text-pitch-glow border border-pitch-border' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Award className="w-4 h-4" /> View Squads
                </button>
                <button
                  onClick={() => setActiveTab('matches')}
                  className={`flex-grow py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'matches' ? 'bg-pitch-card text-pitch-glow border border-pitch-border' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-4 h-4" /> Match Simulation Feed
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex-grow py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'stats' ? 'bg-pitch-card text-pitch-glow border border-pitch-border' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-pitch-gold" /> Leaderboards & Caps
                </button>
              </div>

              {/* SQUADS DISPLAY TAB */}
              {activeTab === 'squads' && (
                <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl">
                  {/* Select Franchise dropdown view */}
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-sm text-slate-300">Squad Rosters</h3>
                    <select
                      value={selectedSquadFranchise}
                      onChange={(e) => setSelectedSquadFranchise(e.target.value)}
                      className="bg-slate-900 border border-pitch-border rounded-lg px-3 py-1.5 text-xs text-white cursor-pointer"
                    >
                      {room.users.map(u => (
                        <option key={u.franchise} value={u.franchise}>{u.franchise}</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const activeSquadRecord = room.users.find(u => u.franchise === selectedSquadFranchise);
                    if (!activeSquadRecord) return null;

                    const isMySquad = activeSquadRecord.franchise === myUserRecord?.franchise;
                    const xiPlayers = activeSquadRecord.squad.filter(p => playingXI.includes(p.id));
                    const wkCount = xiPlayers.filter(p => p.role === 'Wicketkeeper').length;
                    const batCount = xiPlayers.filter(p => p.role === 'Batsman').length;
                    const arCount = xiPlayers.filter(p => p.role === 'All-rounder').length;
                    const bowlCount = xiPlayers.filter(p => p.role === 'Bowler').length;
                    const overseasCount = xiPlayers.filter(p => p.isOverseas || (p.country && p.country !== 'India')).length;
                    const isXIValid = playingXI.length === 11 && wkCount >= 1 && batCount >= 3 && arCount >= 1 && bowlCount >= 3 && overseasCount <= 4 && captainId && viceCaptainId;

                    const boughtPlayers = activeSquadRecord.squad.filter(p => p.boughtFor > 0);

                    return (
                      <div>
                        {/* Save & Share Action Bar */}
                        <div className="flex gap-4 mb-6">
                          <button 
                            onClick={downloadSquadCard}
                            className="flex-grow py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-white border border-[#3f3f46] rounded-xl font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 active:scale-95 shadow-md"
                          >
                            <Download className="w-3.5 h-3.5" /> Save
                          </button>
                          <button 
                            onClick={shareSquadCard}
                            className="flex-grow py-2.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-xl font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-blue-500/10"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </button>
                        </div>

                        {/* Beautiful Squad Card Preview */}
                        <div className="flex justify-center mb-6">
                          <div 
                            id="squad-card-capture" 
                            className="w-full max-w-sm bg-gradient-to-b from-[#0f111a] to-[#05060a] border border-[#1f2235] rounded-3xl p-6 shadow-2xl text-left"
                          >
                            {/* Header */}
                            <div className="flex items-center gap-3.5 mb-5">
                              {getFranchiseLogo(selectedSquadFranchise)}
                              <div>
                                <h4 className="font-extrabold text-base text-white tracking-tight leading-none mb-1">
                                  {selectedSquadFranchise}
                                </h4>
                                <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase leading-none">
                                  IPL Auction Squad
                                </p>
                              </div>
                            </div>

                            {/* Metrics Bar */}
                            <div className="bg-[#111322] border border-[#1e2136] rounded-2xl p-4 grid grid-cols-4 gap-2 mb-6 text-center">
                              <div>
                                <span className="font-accent font-black text-blue-400 text-sm leading-none block">
                                  {boughtPlayers.length}
                                </span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1 leading-none">
                                  Players
                                </span>
                              </div>
                              <div>
                                <span className="font-accent font-black text-purple-400 text-sm leading-none block">
                                  {boughtPlayers.filter(p => p.isOverseas || (p.country && p.country !== 'India')).length}
                                </span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1 leading-none">
                                  Overseas
                                </span>
                              </div>
                              <div>
                                <span className="font-accent font-black text-amber-400 text-sm leading-none block">
                                  {(100.0 - activeSquadRecord.budget).toFixed(1)} Cr
                                </span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1 leading-none">
                                  Spent
                                </span>
                              </div>
                              <div>
                                <span className="font-accent font-black text-emerald-400 text-sm leading-none block">
                                  {activeSquadRecord.budget.toFixed(1)} Cr
                                </span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1 leading-none">
                                  Remaining
                                </span>
                              </div>
                            </div>

                            {/* Bought Players List */}
                            <div>
                              <h5 className="text-[#10b981] font-bold text-[9px] uppercase tracking-wider mb-2 leading-none">
                                Bought ({boughtPlayers.length})
                              </h5>
                              <div className="space-y-2 select-none">
                                {boughtPlayers.map((p) => {
                                  const isPlayerOvs = p.isOverseas || (p.country && p.country !== 'India');
                                  return (
                                    <div 
                                      key={p.id} 
                                      className="bg-[#141727] rounded-xl px-4 py-2 flex items-center justify-between border border-[#1d2036] transition"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="font-extrabold text-xs text-white truncate">{p.name}</span>
                                        {isPlayerOvs && (
                                          <span className="text-[7px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1 py-0.5 rounded font-black tracking-widest font-accent uppercase">
                                            os
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-accent font-black text-[#10b981] text-xs leading-none">
                                        {p.boughtFor.toFixed(1)} Cr
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Promo Footer */}
                            <div className="border-t border-[#1d2036] pt-4 mt-6 flex justify-between items-center">
                              <div>
                                <p className="font-extrabold text-xs text-amber-400 tracking-tight leading-none mb-1">
                                  SIGMA LEAGUE
                                </p>
                                <p className="text-[8px] text-slate-400 font-semibold leading-none">
                                  Play your own IPL Auction with friends!
                                </p>
                              </div>
                              <button className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-[8px] tracking-wider uppercase px-3 py-2 rounded-lg shadow-md select-none pointer-events-none">
                                Play Now
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Manager Controls (Playing XI constraints validator for current user) */}
                        {isMySquad && (
                          <div className="space-y-4 mb-6">
                            {/* Slots builder panel */}
                            <div className="p-5 bg-slate-950 border border-pitch-border rounded-xl space-y-4 text-left">
                              <h4 className="text-xs font-accent font-black text-pitch-glow uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-1.5">
                                🏏 BUILD YOUR PLAYING XI SLOTS
                              </h4>
                              
                              {/* Openers Section */}
                              <div className="space-y-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Openers (2)</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase">Opener 1</label>
                                    <select
                                      value={xiSlots.opener1}
                                      onChange={(e) => handleSlotChange('opener1', e.target.value)}
                                      className="w-full bg-slate-900 border border-pitch-border rounded-lg px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-pitch-glow"
                                    >
                                      <option value="">Select Opener 1...</option>
                                      {activeSquadRecord.squad.map(p => (
                                        <option 
                                          key={p.id} 
                                          value={p.id}
                                          disabled={isPlayerSelectedInOtherSlot('opener1', p.id)}
                                        >
                                          {p.name} ({p.role}) - RTG: {p.rating}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase">Opener 2</label>
                                    <select
                                      value={xiSlots.opener2}
                                      onChange={(e) => handleSlotChange('opener2', e.target.value)}
                                      className="w-full bg-slate-900 border border-pitch-border rounded-lg px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus:border-pitch-glow"
                                    >
                                      <option value="">Select Opener 2...</option>
                                      {activeSquadRecord.squad.map(p => (
                                        <option 
                                          key={p.id} 
                                          value={p.id}
                                          disabled={isPlayerSelectedInOtherSlot('opener2', p.id)}
                                        >
                                          {p.name} ({p.role}) - RTG: {p.rating}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* Middle Order Section */}
                              <div className="space-y-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Middle Order (5)</span>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                  {['middle1', 'middle2', 'middle3', 'middle4', 'middle5'].map((slotKey, idx) => (
                                    <div key={slotKey}>
                                      <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase">Slot {idx + 3}</label>
                                      <select
                                        value={xiSlots[slotKey]}
                                        onChange={(e) => handleSlotChange(slotKey, e.target.value)}
                                        className="w-full bg-slate-900 border border-pitch-border rounded-lg px-2 py-2 text-[10px] text-white cursor-pointer focus:outline-none focus:border-pitch-glow"
                                      >
                                        <option value="">Select...</option>
                                        {activeSquadRecord.squad.map(p => (
                                          <option 
                                            key={p.id} 
                                            value={p.id}
                                            disabled={isPlayerSelectedInOtherSlot(slotKey, p.id)}
                                          >
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Bowlers Section */}
                              <div className="space-y-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Bowlers (4)</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {['bowler1', 'bowler2', 'bowler3', 'bowler4'].map((slotKey, idx) => (
                                    <div key={slotKey}>
                                      <label className="block text-[9px] text-slate-500 font-bold mb-1 uppercase">Bowler {idx + 1}</label>
                                      <select
                                        value={xiSlots[slotKey]}
                                        onChange={(e) => handleSlotChange(slotKey, e.target.value)}
                                        className="w-full bg-slate-900 border border-pitch-border rounded-lg px-2 py-2 text-[10px] text-white cursor-pointer focus:outline-none focus:border-pitch-glow"
                                      >
                                        <option value="">Select...</option>
                                        {activeSquadRecord.squad.map(p => (
                                          <option 
                                            key={p.id} 
                                            value={p.id}
                                            disabled={isPlayerSelectedInOtherSlot(slotKey, p.id)}
                                          >
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="p-4 bg-slate-950 border border-pitch-border rounded-xl">
                              <h4 className="text-xs font-accent font-black text-pitch-glow uppercase tracking-widest mb-3">
                                📋 STARTING PLAYING XI CONFIGURATION
                              </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-[10px] font-bold text-slate-400">
                              <div className={`p-2 rounded border ${playingXI.length === 11 ? 'border-pitch-glow text-pitch-glow' : 'border-slate-800 bg-slate-900/50'}`}>
                                SELECTED: {playingXI.length} / 11
                              </div>
                              <div className={`p-2 rounded border ${wkCount >= 1 ? 'border-pitch-glow text-pitch-glow' : 'border-slate-800 bg-slate-900/50'}`}>
                                WK: {wkCount} / 1 Min
                              </div>
                              <div className={`p-2 rounded border ${batCount >= 3 ? 'border-pitch-glow text-pitch-glow' : 'border-slate-800 bg-slate-900/50'}`}>
                                BAT: {batCount} / 3 Min
                              </div>
                              <div className={`p-2 rounded border ${arCount >= 1 ? 'border-pitch-glow text-pitch-glow' : 'border-slate-800 bg-slate-900/50'}`}>
                                AR: {arCount} / 1 Min
                              </div>
                              <div className={`p-2 rounded border ${bowlCount >= 3 ? 'border-pitch-glow text-pitch-glow' : 'border-slate-800 bg-slate-900/50'}`}>
                                BOWL: {bowlCount} / 3 Min
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t border-pitch-border/50 text-[10px]">
                              <div className="flex flex-wrap gap-x-4 gap-y-2">
                                <span className={overseasCount <= 4 ? 'text-pitch-glow font-bold' : 'text-pitch-crimson font-bold'}>
                                  ✈️ OVERSEAS: {overseasCount} / 4 Max
                                </span>
                                <span className={captainId ? 'text-pitch-gold font-bold' : 'text-slate-500'}>
                                  👑 CAPTAIN: {captainId ? activeSquadRecord.squad.find(p => p.id === captainId)?.name : 'Not set'}
                                </span>
                                <span className={viceCaptainId ? 'text-pitch-accent font-bold' : 'text-slate-500'}>
                                  ⚡ VICE CAPTAIN: {viceCaptainId ? activeSquadRecord.squad.find(p => p.id === viceCaptainId)?.name : 'Not set'}
                                </span>
                              </div>
                              <span className={`px-2.5 py-1 rounded font-black tracking-wider uppercase ${isXIValid ? 'bg-pitch-glow/10 border border-pitch-glow text-pitch-glow' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>
                                {isXIValid ? '✅ SQUAD VALIDATED' : '⚠️ INVALID COMPOSITION'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                        {/* List of squad players */}
                        {boughtPlayers.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 italic text-xs">
                            No players bought by this franchise.
                          </div>
                        ) : (
                          <div>
                            {isMySquad && (
                              <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                                Manage Playing XI & Bench
                              </h4>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {boughtPlayers.map((p) => {
                                const inXI = playingXI.includes(p.id);
                                const isCapt = captainId === p.id;
                                const isVC = viceCaptainId === p.id;
                                const isPlayerOvs = p.isOverseas || (p.country && p.country !== 'India');

                                return (
                                  <div 
                                    key={p.id}
                                    className={`p-3 border rounded-xl flex items-center justify-between text-xs transition ${
                                      inXI 
                                        ? 'bg-slate-900 border-pitch-glow/40 shadow-sm shadow-pitch-glow/5' 
                                        : 'bg-slate-950/60 border-pitch-border/50'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-white leading-tight">{p.name}</p>
                                        {isPlayerOvs && <span className="text-[8px] bg-slate-800 text-slate-400 px-1 rounded font-accent">OVS</span>}
                                        {isCapt && <span className="text-[8px] bg-pitch-gold text-pitch-dark px-1.5 py-0.5 rounded font-black font-accent">C</span>}
                                        {isVC && <span className="text-[8px] bg-pitch-accent text-pitch-dark px-1.5 py-0.5 rounded font-black font-accent">VC</span>}
                                      </div>
                                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{p.role} (RTG: {p.rating})</p>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                      <div>
                                        <p className="font-accent font-black text-pitch-gold leading-none">₹{p.boughtFor.toFixed(2)} Cr</p>
                                      </div>
                                      {isMySquad && (
                                        <div className="flex items-center gap-1.5 border-l border-pitch-border/50 pl-3">
                                          <button
                                            onClick={() => togglePlayerInXI(p.id)}
                                            className={`px-2 py-1 rounded text-[9px] font-black uppercase transition ${
                                              inXI
                                                ? 'bg-pitch-glow text-pitch-dark'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                          >
                                            {inXI ? 'XI' : 'BENCH'}
                                          </button>
                                          {inXI && (
                                            <div className="flex flex-col gap-1">
                                              <button
                                                onClick={() => selectCaptain(p.id)}
                                                className={`px-1 rounded text-[8px] font-bold leading-none py-0.5 transition ${
                                                  isCapt ? 'bg-pitch-gold text-pitch-dark' : 'bg-slate-950 text-slate-600 hover:text-slate-400'
                                                }`}
                                                title="Make Captain"
                                              >
                                                C
                                              </button>
                                              <button
                                                onClick={() => selectViceCaptain(p.id)}
                                                className={`px-1 rounded text-[8px] font-bold leading-none py-0.5 transition ${
                                                  isVC ? 'bg-pitch-accent text-pitch-dark' : 'bg-slate-950 text-slate-600 hover:text-slate-400'
                                                }`}
                                                title="Make Vice Captain"
                                              >
                                                VC
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* MATCH SIMULATION TAB */}
              {activeTab === 'matches' && (
                <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl space-y-4">
                  <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-pitch-accent" /> Simulated Matches Feed ({room.matches.length})
                  </h3>

                  {/* Playoff Bracket Rendering */}
                  {room.matches.some(m => m.stage) && (
                    <div className="bg-slate-950 p-5 border border-pitch-border rounded-2xl mb-6">
                      <h4 className="text-xs font-accent font-black text-pitch-gold uppercase tracking-widest mb-4 text-center">
                        🏆 IPL PLAYOFFS BRACKET STANDINGS
                      </h4>
                      <div className="flex flex-wrap gap-4 text-[10px] justify-center">
                        {/* Q1 */}
                        {(() => {
                          const match = room.matches.find(m => m.stage === "Qualifier 1");
                          if (!match) return null;
                          return (
                            <div className="p-3 bg-slate-900 border border-pitch-border rounded-xl min-w-[180px] flex-1">
                              <span className="text-[8px] text-pitch-glow font-bold block mb-1">QUALIFIER 1</span>
                              <p className="font-bold text-white truncate">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-slate-400 mt-1 font-semibold">Winner: <span className="text-pitch-gold">{match.winner}</span></p>
                            </div>
                          );
                        })()}

                        {/* Eliminator */}
                        {(() => {
                          const match = room.matches.find(m => m.stage === "Eliminator");
                          if (!match) return null;
                          return (
                            <div className="p-3 bg-slate-900 border border-pitch-border rounded-xl min-w-[180px] flex-1">
                              <span className="text-[8px] text-pitch-glow font-bold block mb-1">ELIMINATOR</span>
                              <p className="font-bold text-white truncate">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-slate-400 mt-1 font-semibold">Winner: <span className="text-pitch-gold">{match.winner}</span></p>
                            </div>
                          );
                        })()}

                        {/* Semi-Final */}
                        {(() => {
                          const match = room.matches.find(m => m.stage === "Semi-Final");
                          if (!match) return null;
                          return (
                            <div className="p-3 bg-slate-900 border border-pitch-border rounded-xl min-w-[180px] flex-1">
                              <span className="text-[8px] text-pitch-glow font-bold block mb-1">SEMI-FINAL</span>
                              <p className="font-bold text-white truncate">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-slate-400 mt-1 font-semibold">Winner: <span className="text-pitch-gold">{match.winner}</span></p>
                            </div>
                          );
                        })()}

                        {/* Q2 */}
                        {(() => {
                          const match = room.matches.find(m => m.stage === "Qualifier 2");
                          if (!match) return null;
                          return (
                            <div className="p-3 bg-slate-900 border border-pitch-border rounded-xl min-w-[180px] flex-1">
                              <span className="text-[8px] text-pitch-glow font-bold block mb-1">QUALIFIER 2</span>
                              <p className="font-bold text-white truncate">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-slate-400 mt-1 font-semibold">Winner: <span className="text-pitch-gold">{match.winner}</span></p>
                            </div>
                          );
                        })()}

                        {/* Final */}
                        {(() => {
                          const match = room.matches.find(m => m.stage === "Final");
                          if (!match) return null;
                          return (
                            <div className="p-3 bg-pitch-gold/10 border border-pitch-gold rounded-xl min-w-[180px] flex-1">
                              <span className="text-[8px] text-pitch-gold font-bold block mb-1">👑 GRAND FINAL</span>
                              <p className="font-bold text-white truncate">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-pitch-gold mt-1 font-black">CHAMPION: {match.winner}</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {room.matches.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 italic text-xs">
                      No matches simulated yet. Trigger the simulation from the leaderboard side.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {room.matches.map((match, idx) => (
                        <div 
                          key={idx}
                          className="bg-slate-900 border border-pitch-border rounded-xl overflow-hidden shadow-md"
                        >
                          {/* Score header */}
                          <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-pitch-border/30 text-xs">
                            <span className="text-[10px] bg-pitch-glow/20 border border-pitch-glow/30 text-pitch-glow px-2 py-0.5 rounded font-bold uppercase">
                              MATCH {idx + 1}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 font-bold">Winner: <span className="text-pitch-gold font-extrabold">{match.winner}</span></span>
                              <button
                                onClick={() => startLiveMatchSimulation(match)}
                                className="px-2.5 py-1 bg-pitch-glow text-pitch-dark text-[9px] font-accent font-black tracking-wider uppercase rounded hover:brightness-110 active:scale-95 transition"
                              >
                                📺 PLAY LIVE SIM
                              </button>
                            </div>
                          </div>

                          <div className="p-4 grid grid-cols-7 items-center text-center">
                            {/* Home team */}
                            <div className="col-span-3">
                              <p className="font-bold text-white text-sm truncate">{match.homeTeam}</p>
                              <p className="font-accent font-extrabold text-lg text-pitch-accent mt-1">
                                {match.homeScore}/{match.homeWickets}
                              </p>
                              <p className="text-[10px] text-slate-500">({match.homeOvers} Overs)</p>
                            </div>

                            {/* VS */}
                            <div className="col-span-1 text-slate-500 font-accent font-black text-xs">
                              VS
                            </div>

                            {/* Away team */}
                            <div className="col-span-3">
                              <p className="font-bold text-white text-sm truncate">{match.awayTeam}</p>
                              <p className="font-accent font-extrabold text-lg text-pitch-accent mt-1">
                                {match.awayScore}/{match.awayWickets}
                              </p>
                              <p className="text-[10px] text-slate-500">({match.awayOvers} Overs)</p>
                            </div>
                          </div>

                          {/* Match Commentary accordion preview */}
                          <div className="bg-slate-950/80 p-3 border-t border-pitch-border/30 text-[10px] text-slate-400 max-h-24 overflow-y-auto space-y-1">
                            {match.commentary.map((line, cIdx) => (
                              <p key={cIdx} className="leading-relaxed border-l-2 border-pitch-border pl-2">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LEADERBOARDS & STATS TAB */}
              {activeTab === 'stats' && (() => {
                const { orangeCap, purpleCap, boundaryKings, mvpList } = getAggregatedPlayerStats();

                return (
                  <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl space-y-6 text-left">
                    <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-pitch-gold animate-pulse" /> Individual Player Leaderboards
                    </h3>

                    {room.matches.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 italic text-xs">
                        No match statistics available. Run the tournament simulation first to generate stats!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Orange Cap */}
                        <div className="bg-slate-950 p-4 border border-pitch-border rounded-2xl">
                          <h4 className="text-xs font-accent font-black text-pitch-gold uppercase tracking-wider mb-3 flex items-center gap-1">
                            🟠 ORANGE CAP (MOST RUNS)
                          </h4>
                          <div className="space-y-1.5 text-[10px]">
                            {orangeCap.map((p, idx) => (
                              <div key={p.id} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                                <span className="font-bold text-white text-xs truncate max-w-[140px]">{idx+1}. {p.name} ({p.franchise.split(' ')[0]})</span>
                                <span className="font-accent font-extrabold text-pitch-gold text-xs">{p.runs} Runs <span className="text-[8px] text-slate-400 font-normal">({p.balls}b)</span></span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Purple Cap */}
                        <div className="bg-slate-950 p-4 border border-pitch-border rounded-2xl">
                          <h4 className="text-xs font-accent font-black text-pitch-glow uppercase tracking-wider mb-3 flex items-center gap-1">
                            🟣 PURPLE CAP (MOST WICKETS)
                          </h4>
                          <div className="space-y-1.5 text-[10px]">
                            {purpleCap.map((p, idx) => (
                              <div key={p.id} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                                <span className="font-bold text-white text-xs truncate max-w-[140px]">{idx+1}. {p.name} ({p.franchise.split(' ')[0]})</span>
                                <span className="font-accent font-extrabold text-pitch-glow text-xs">{p.wickets} Wkts <span className="text-[8px] text-slate-400 font-normal">({p.overs.toFixed(1)} ov)</span></span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Boundary Kings */}
                        <div className="bg-slate-950 p-4 border border-pitch-border rounded-2xl">
                          <h4 className="text-xs font-accent font-black text-pitch-accent uppercase tracking-wider mb-3 flex items-center gap-1">
                            💥 BOUNDARY KINGS (FOURS & SIXES)
                          </h4>
                          <div className="space-y-1.5 text-[10px]">
                            {boundaryKings.map((p, idx) => (
                              <div key={p.id} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                                <span className="font-bold text-white text-xs truncate max-w-[140px]">{idx+1}. {p.name} ({p.franchise.split(' ')[0]})</span>
                                <span className="font-accent font-extrabold text-pitch-accent text-xs">{p.fours + p.sixes} <span className="text-[8px] text-slate-400 font-normal">({p.fours}x4, {p.sixes}x6)</span></span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tournament MVP */}
                        <div className="bg-slate-950 p-4 border border-pitch-gold/20 rounded-2xl shadow-inner shadow-pitch-gold/5">
                          <h4 className="text-xs font-accent font-black text-white uppercase tracking-wider mb-3 flex items-center gap-1">
                            👑 TOURNAMENT MVP
                          </h4>
                          <div className="space-y-1.5 text-[10px]">
                            {mvpList.map((p, idx) => {
                              const mvpScore = p.runs * 1 + p.wickets * 20 + p.sixes * 2.5 + p.fours * 1.5;
                              return (
                                <div key={p.id} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                                  <span className="font-bold text-white text-xs truncate max-w-[140px]">{idx+1}. {p.name} ({p.franchise.split(' ')[0]})</span>
                                  <span className="font-accent font-black text-white text-xs">{mvpScore.toFixed(0)} pts</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })()}

              {/* BUDGET ANALYSIS TAB */}
              {activeTab === 'budget' && (
                <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl space-y-6 text-left animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-pitch-glow" /> Franchise Spending & Purse Analysis
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-400">
                      <thead className="text-[10px] uppercase bg-slate-950 font-accent text-slate-500 border-b border-pitch-border">
                        <tr>
                          <th className="py-3 px-4">Franchise</th>
                          <th className="py-3 px-4">Manager</th>
                          <th className="py-3 px-4">Spent (Cr)</th>
                          <th className="py-3 px-4">Remaining (Cr)</th>
                          <th className="py-3 px-4">Squad Size</th>
                          <th className="py-3 px-4">Avg Buy (Cr)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pitch-border/40">
                        {room.users.map((u) => {
                          const budgetVal = u.budget !== undefined ? u.budget : 100.0;
                          const spent = 100.0 - budgetVal;
                          const squadLength = u.squad ? u.squad.length : 0;
                          const avgBuy = squadLength > 0 ? spent / squadLength : 0;
                          return (
                            <tr key={u.username} className="hover:bg-slate-900/40">
                              <td className="py-3 px-4 font-bold text-white">{u.franchise}</td>
                              <td className="py-3 px-4">{u.username}</td>
                              <td className="py-3 px-4 text-pitch-accent font-bold">₹{spent.toFixed(2)} Cr</td>
                              <td className="py-3 px-4 text-pitch-gold font-bold">₹{budgetVal.toFixed(2)} Cr</td>
                              <td className="py-3 px-4 font-black">{squadLength} / 20</td>
                              <td className="py-3 px-4">₹{avgBuy.toFixed(2)} Cr</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MARKET & PLAYERS POOL TAB */}
              {activeTab === 'market' && (
                <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl space-y-6 text-left animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-pitch-gold" /> Players Market Feed
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto pr-2">
                    {/* Sold Players */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-accent font-black text-pitch-glow uppercase tracking-wider">
                        🔨 SOLD PLAYERS ({room.playersPool.filter(p => p.status === 'sold').length})
                      </h4>
                      <div className="space-y-2">
                        {room.playersPool.filter(p => p.status === 'sold').map(p => (
                          <div key={p.id} className="p-3 bg-slate-900 border border-pitch-border rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-white">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{p.role} (RTG: {p.rating})</p>
                            </div>
                            <div className="text-right">
                              <p className="font-accent font-black text-pitch-gold">₹{(p.soldPrice || 0).toFixed(2)} Cr</p>
                              <p className="text-[9px] text-pitch-accent font-bold">Buyer: {p.soldTo || 'Drafted'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Unsold Players */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-accent font-black text-pitch-crimson uppercase tracking-wider">
                        💨 UNSOLD PLAYERS ({room.playersPool.filter(p => p.status === 'unsold').length})
                      </h4>
                      <div className="space-y-2">
                        {room.playersPool.filter(p => p.status === 'unsold').map(p => (
                          <div key={p.id} className="p-3 bg-slate-900/60 border border-pitch-border/30 rounded-xl flex items-center justify-between text-xs opacity-75">
                            <div>
                              <p className="font-bold text-slate-300">{p.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{p.role} (RTG: {p.rating})</p>
                            </div>
                            <div className="text-right">
                              <p className="font-accent font-bold text-slate-500">Base: ₹{p.basePrice.toFixed(2)} Cr</p>
                              <span className="text-[8px] bg-slate-800 text-slate-500 px-1 py-0.5 rounded uppercase">Passed</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SETTINGS & FIXTURES TAB */}
              {activeTab === 'settings' && (
                <div className="glass-panel rounded-2xl border border-pitch-border p-6 shadow-xl space-y-6 text-left animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-pitch-border/50 pb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-pitch-accent" /> Room Settings & Fixtures
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-950 p-3.5 border border-pitch-border rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Room Code</span>
                      <span className="font-accent font-black text-pitch-glow text-lg">{room.code}</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 border border-pitch-border rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Timer Setting</span>
                      <span className="font-accent font-black text-white text-lg">{room.biddingTimeLimit || 15} seconds</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 border border-pitch-border rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Total Franchises</span>
                      <span className="font-accent font-black text-pitch-gold text-lg">{room.users.length} / 10 Owners</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-accent font-black text-white uppercase tracking-wider">
                      📅 FULL LEAGUE FIXTURES SCHEDULE
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                      {room.matches.filter(m => !m.stage).map((m, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-900 border border-pitch-border/50 rounded-xl text-[10px] text-slate-400 space-y-1">
                          <div className="flex justify-between font-bold text-slate-300">
                            <span>MATCH {idx + 1}</span>
                            <span className="text-pitch-gold font-accent">WINNER: {m.winner}</span>
                          </div>
                          <p className="font-bold text-white text-xs">{m.homeTeam} vs {m.awayTeam}</p>
                          <p className="text-[9px] text-slate-500">Score: {m.homeScore}/{m.homeWickets} ({m.homeOvers}ov) vs {m.awayScore}/{m.awayWickets} ({m.awayOvers}ov)</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </main>

      {/* 5. LIVE MATCH SIMULATOR MODAL OVERLAY */}
      {activeSimulatingMatch && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in animate-scale-in">
          <div className="max-w-3xl w-full bg-slate-900 border border-pitch-border rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col gap-6 max-h-[90vh]">
            
            {/* Flash Indicator Overlay */}
            {simOverlayFlash && (
              <div className="absolute inset-0 bg-pitch-dark/85 flex items-center justify-center z-40 animate-scale-in">
                <span className={`font-accent font-black text-6xl tracking-widest uppercase animate-bounce ${
                  simOverlayFlash === 'four' ? 'text-pitch-gold text-glow-gold' :
                  simOverlayFlash === 'six' ? 'text-pitch-glow text-glow-green' :
                  'text-pitch-crimson text-glow-red'
                }`}>
                  {simOverlayFlash === 'four' ? '💥 FOUR 💥' :
                   simOverlayFlash === 'six' ? '🔥 SIX 🔥' :
                   '🔴 WICKET 🔴'}
                </span>
              </div>
            )}

            {/* Header info */}
            <div className="flex justify-between items-center pb-4 border-b border-pitch-border/50">
              <div>
                <span className="text-[10px] text-pitch-glow font-accent font-black tracking-widest uppercase">
                  LIVE MATCH SIMULATION — INNINGS {simActiveInnings}
                </span>
                <h3 className="text-xl font-black text-white font-accent uppercase mt-1 leading-none">
                  {activeSimulatingMatch.homeTeam} VS {activeSimulatingMatch.awayTeam}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (simPlaybackInterval) clearInterval(simPlaybackInterval);
                  setActiveSimulatingMatch(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-lg border border-pitch-border active:scale-95 transition"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Score banner & Win probability */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              {/* Dynamic Score display */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-pitch-border text-center md:col-span-2 relative overflow-hidden flex flex-col justify-center">
                <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest mb-1">
                  {simActiveInnings === 1 ? 'Batting First' : 'Chasing Target'}
                </div>
                <div className="font-accent font-black text-5xl text-pitch-glow tracking-tighter">
                  {simRuns} / {simWickets}
                </div>
                <div className="text-slate-400 font-bold text-xs mt-2">
                  {simOvers.toFixed(1)} / 20.0 OVERS (CRR: {simOvers > 0 ? (simRuns / simOvers).toFixed(2) : '0.00'})
                </div>
                
                {simActiveInnings === 2 && (
                  <div className="mt-3 text-[10px] text-pitch-gold font-bold uppercase tracking-wide">
                    Target: {activeSimulatingMatch.homeScore + 1} | Need {Math.max(0, activeSimulatingMatch.homeScore + 1 - simRuns)} runs from {Math.max(0, 120 - simBallIdx)} balls
                  </div>
                )}
              </div>

              {/* Wagon Wheel SVG */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-pitch-border flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-500 font-black tracking-widest uppercase mb-3">Wagon Wheel</span>
                <svg viewBox="0 0 200 200" className="w-36 h-36 bg-slate-900 border border-pitch-border/50 rounded-full">
                  <circle cx="100" cy="100" r="95" fill="none" stroke="#1e293b" strokeWidth="1.5" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="#1e293b" strokeDasharray="3,3" />
                  <circle cx="100" cy="100" r="3" fill="#00e653" />
                  
                  {simWagonWheelBalls.map((b, bIdx) => {
                    const rad = (b.angle * Math.PI) / 180;
                    const x2 = 100 + b.length * Math.cos(rad);
                    const y2 = 100 + b.length * Math.sin(rad);
                    const strokeColor = b.runs === 6 ? '#00e653' : b.runs === 4 ? '#facc15' : '#475569';
                    
                    return (
                      <line 
                        key={bIdx} 
                        x1="100" 
                        y1="100" 
                        x2={x2} 
                        y2={y2} 
                        stroke={strokeColor} 
                        strokeWidth={b.runs >= 4 ? '1.5' : '0.8'} 
                        opacity="0.8"
                      />
                    );
                  })}
                </svg>
              </div>

            </div>

            {/* Win Probability Bar */}
            <div>
              {(() => {
                let winProbHome = 50;
                if (simActiveInnings === 1) {
                  winProbHome = Math.max(20, Math.min(80, 50 + (simRuns / 8)));
                } else {
                  const reqRuns = activeSimulatingMatch.homeScore + 1 - simRuns;
                  const ballsRemaining = Math.max(1, 120 - simBallIdx);
                  const reqRR = (reqRuns / (ballsRemaining / 6));
                  const crr = simOvers > 0 ? (simRuns / simOvers) : 6.0;
                  winProbHome = 50 + (reqRR - crr) * 6 + simWickets * 6;
                }
                winProbHome = Math.max(5, Math.min(95, winProbHome));
                const winProbAway = 100 - winProbHome;

                return (
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mb-1.5 font-accent">
                      <span>{activeSimulatingMatch.homeTeam} ({winProbHome.toFixed(0)}%)</span>
                      <span>WIN PROBABILITY</span>
                      <span>{activeSimulatingMatch.awayTeam} ({winProbAway.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex border border-pitch-border/30">
                      <div className="bg-pitch-glow h-full transition-all duration-300" style={{ width: `${winProbHome}%` }}></div>
                      <div className="bg-pitch-crimson h-full transition-all duration-300 flex-grow"></div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Commentary Box */}
            <div className="flex-grow flex flex-col min-h-0">
              <span className="text-[10px] text-slate-500 font-accent font-black tracking-widest uppercase mb-2">Live Commentary Feed</span>
              <div className="bg-slate-950 border border-pitch-border rounded-2xl p-4 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-2 flex-grow min-h-[160px] max-h-[220px]">
                {simCommentary.map((line, idx) => {
                  let textClass = "text-slate-400";
                  if (line.includes("BOUNDARY")) textClass = "text-pitch-gold font-extrabold";
                  if (line.includes("SIX")) textClass = "text-pitch-glow font-extrabold";
                  if (line.includes("OUT")) textClass = "text-pitch-crimson font-extrabold";

                  return (
                    <p key={idx} className={`${textClass} leading-relaxed`}>
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 6. CHAMPIONS TROPHY CELEBRATION OVERLAY */}
      {showTrophy && room && (
        <div className="fixed inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-50 p-6 animate-scale-in">
          <div className="text-center space-y-6 max-w-md w-full relative">
            <div className="w-48 h-48 mx-auto relative animate-bounce">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]">
                <path d="M20 20 h60 v15 c0 15 -10 25 -30 25 s-30 -10 -30 -25 z" fill="#eab308" />
                <path d="M45 60 h10 v20 h-10 z" fill="#ca8a04" />
                <path d="M30 80 h40 v8 h-40 z" fill="#854d0e" />
                <path d="M20 25 c-10 0 -15 10 -15 20 s10 15 15 5" fill="none" stroke="#eab308" strokeWidth="4" />
                <path d="M80 25 c10 0 15 10 15 20 s-10 15 -15 5" fill="none" stroke="#eab308" strokeWidth="4" />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-pitch-gold font-accent font-black tracking-widest uppercase animate-pulse">
                🏆 IPL AUCTION LEAGUE CHAMPION 🏆
              </span>
              <h2 className="text-3xl font-accent font-black text-white uppercase tracking-tight">
                {(() => {
                  const final = room.matches.find(m => m.stage === "Final");
                  return final ? final.winner : "UNKNOWN";
                })()}
              </h2>
              <p className="text-xs text-slate-400">
                Spectacular victory in the Grand Final closes out a phenomenal season!
              </p>
            </div>

            <button
              onClick={() => setShowTrophy(false)}
              className="px-8 py-3 bg-pitch-gold text-pitch-dark font-black text-xs tracking-widest uppercase rounded-xl hover:brightness-110 active:scale-95 transition"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* FOOTER SECTION */}
      <footer className="glass-panel text-center py-3 border-t border-pitch-border text-xs text-slate-500">
        🎮 MERN Stack real-time application using WebSockets (Socket.io) & fallback memory storage.  -POWERED BY SIGMA
      </footer>
    </div>
  </div>
  );
}
