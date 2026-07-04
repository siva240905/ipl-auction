import fs from 'fs';

const jsonPath = './players.json';
const outputPath = './playersData.js';

const BATTER_IMAGES = [
  "https://images.unsplash.com/photo-1540747737956-378724044602?q=80&w=250&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=250&auto=format&fit=crop"
];
const WICKETKEEPER_IMAGES = [
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=250&auto=format&fit=crop"
];
const ALLROUNDER_IMAGES = [
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=250&auto=format&fit=crop"
];
const BOWLER_IMAGES = [
  "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=250&auto=format&fit=crop"
];

const majorCountries = ["India", "Australia", "New Zealand", "South Africa", "West Indies", "Sri Lanka", "England", "Bangladesh", "Afghanistan", "Zimbabwe"];

try {
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const allRawPlayers = JSON.parse(content);
  
  // Limit to exactly 320 players as requested
  const rawPlayers = allRawPlayers.slice(0, 320);
  
  const players = [];

  for (const p of rawPlayers) {
    const id = p.list_sr_no;
    const name = `${p.first_name} ${p.surname}`;
    
    let role = "";
    if (p.role === "BATTER") role = "Batsman";
    else if (p.role === "BOWLER") role = "Bowler";
    else if (p.role === "ALL-ROUNDER") role = "All-rounder";
    else if (p.role === "WICKETKEEPER") role = "Wicketkeeper";

    const basePrice = parseFloat((p.reserve_price_lakh / 100).toFixed(2));

    // Determine capping
    let capping = "Capped";
    if (!majorCountries.includes(p.country)) {
      capping = "Associate";
    } else if (p.set_code.startsWith("U")) {
      capping = "Uncapped";
    }

    // Generate ratings and stats
    let rating = 70;
    if (capping === 'Capped') {
      if (basePrice >= 2.0) rating = 88 + Math.floor(Math.random() * 8); // 88-95
      else if (basePrice >= 1.5) rating = 85 + Math.floor(Math.random() * 6); // 85-90
      else if (basePrice >= 1.0) rating = 82 + Math.floor(Math.random() * 6); // 82-87
      else rating = 78 + Math.floor(Math.random() * 6); // 78-83
    } else { // Uncapped or Associate
      if (basePrice >= 0.5) rating = 75 + Math.floor(Math.random() * 6); // 75-80
      else if (basePrice >= 0.4) rating = 72 + Math.floor(Math.random() * 6); // 72-77
      else rating = 68 + Math.floor(Math.random() * 7); // 68-74
    }

    let batting = 10;
    let bowling = 10;
    let wicketkeeping = 10;

    if (role === 'Batsman') {
      batting = rating + (-2 + Math.floor(Math.random() * 7)); // rating -2 to +4
      bowling = 10 + Math.floor(Math.random() * 15);
      wicketkeeping = 10;
    } else if (role === 'Bowler') {
      bowling = rating + (-2 + Math.floor(Math.random() * 7)); // rating -2 to +4
      batting = 10 + Math.floor(Math.random() * 20);
      wicketkeeping = 10;
    } else if (role === 'All-rounder') {
      batting = rating - (1 + Math.floor(Math.random() * 5)); // rating -1 to -5
      bowling = rating - (1 + Math.floor(Math.random() * 5));
      wicketkeeping = 10;
    } else if (role === 'Wicketkeeper') {
      batting = rating - (1 + Math.floor(Math.random() * 5));
      wicketkeeping = rating + (1 + Math.floor(Math.random() * 5));
      bowling = 10;
    }

    // Select image
    let image = "";
    if (role === 'Batsman') {
      image = BATTER_IMAGES[id % BATTER_IMAGES.length];
    } else if (role === 'Wicketkeeper') {
      image = WICKETKEEPER_IMAGES[id % WICKETKEEPER_IMAGES.length];
    } else if (role === 'All-rounder') {
      image = ALLROUNDER_IMAGES[id % ALLROUNDER_IMAGES.length];
    } else if (role === 'Bowler') {
      image = BOWLER_IMAGES[id % BOWLER_IMAGES.length];
    }

    players.push({
      id,
      name,
      role,
      rating,
      batting,
      bowling,
      wicketkeeping,
      basePrice,
      image
    });
  }

  console.log(`Parsed and kept exactly ${players.length} players successfully.`);

  // Write playersData.js (No dynamic generator, strictly 320 players)
  const outputCode = `export const initialPlayers = ${JSON.stringify(players, null, 2)};\n`;

  fs.writeFileSync(outputPath, outputCode, 'utf-8');
  console.log(`Successfully generated ${outputPath}`);

} catch (error) {
  console.error("Error running parser:", error);
}
