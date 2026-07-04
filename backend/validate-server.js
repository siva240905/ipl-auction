import { getNextBidIncrement, simulateMatch } from './auctionEngine.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Starting Automated Backend Verification tests...');

// 1. Test Bid Increment Rules
console.log('👉 Testing bid increment rules...');
assert(getNextBidIncrement(1.5) === 0.10, 'Bid increment for ₹1.5 Cr should be ₹0.10 Cr');
assert(getNextBidIncrement(3.5) === 0.20, 'Bid increment for ₹3.5 Cr should be ₹0.20 Cr');
assert(getNextBidIncrement(7.5) === 0.50, 'Bid increment for ₹7.5 Cr should be ₹0.50 Cr');
assert(getNextBidIncrement(12.5) === 1.00, 'Bid increment for ₹12.5 Cr should be ₹1.00 Cr');
console.log('✅ Bid increments validated.');

// 2. Test Match Simulator
console.log('👉 Testing match simulator logic...');
const teamA = {
  username: 'RCB_Owner',
  franchise: 'Royal Challengers Bengaluru',
  squad: [
    { name: 'Virat Kohli', rating: 94, batting: 96, bowling: 20, role: 'Batsman' },
    { name: 'Glenn Maxwell', rating: 87, batting: 88, bowling: 76, role: 'All-rounder' },
    { name: 'Mohammed Siraj', rating: 85, batting: 15, bowling: 87, role: 'Bowler' }
  ]
};

const teamB = {
  username: 'MI_Owner',
  franchise: 'Mumbai Indians',
  squad: [
    { name: 'Rohit Sharma', rating: 92, batting: 94, bowling: 30, role: 'Batsman' },
    { name: 'Hardik Pandya', rating: 90, batting: 85, bowling: 84, role: 'All-rounder' },
    { name: 'Jasprit Bumrah', rating: 96, batting: 15, bowling: 98, role: 'Bowler' }
  ]
};

const match = simulateMatch(teamA, teamB);
assert(match.winner === 'RCB_Owner' || match.winner === 'MI_Owner', 'Winner must be one of the competing owners');
assert(match.homeScore > 50 && match.awayScore > 50, 'Scores must be reasonably high cricket scores');
assert(match.commentary.length > 3, 'Commentary feed must have lines generated');
console.log('✅ Match simulator validated.');

console.log('🎉 All server validation tests PASSED successfully!');
process.exit(0);
