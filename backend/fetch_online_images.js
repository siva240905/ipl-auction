import fs from 'fs';
import { initialPlayers } from './playersData.js';

async function fetchImageForPlayer(player) {
  const name = player.name;
  if (!name) return player.image;
  
  const encodedName = encodeURIComponent(name);
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodedName}&prop=pageimages&format=json&pithumbsize=500&redirects=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId && pageId !== "-1") {
        const thumbnail = pages[pageId].thumbnail?.source;
        if (thumbnail) {
          return thumbnail;
        }
      }
    }
  } catch (error) {
    // Fail silently, fallback to existing image
  }
  return player.image;
}

async function main() {
  console.log(`Starting Wikipedia image fetch for ${initialPlayers.length} players...`);
  const updatedPlayers = [];
  const batchSize = 20;

  for (let i = 0; i < initialPlayers.length; i += batchSize) {
    const batch = initialPlayers.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(initialPlayers.length / batchSize)}...`);
    const promises = batch.map(async (player) => {
      const img = await fetchImageForPlayer(player);
      return { ...player, image: img };
    });
    const results = await Promise.all(promises);
    updatedPlayers.push(...results);
    // Delay to be polite to Wikipedia APIs
    await new Promise(r => setTimeout(r, 150));
  }

  // Write updated players list to playersData.js
  const outputCode = `export const initialPlayers = ${JSON.stringify(updatedPlayers, null, 2)};\n`;
  fs.writeFileSync('./playersData.js', outputCode, 'utf-8');
  console.log(`Successfully fetched images and updated playersData.js!`);
}

main();
