import fs from 'fs';

const ocrPath = './players_ocr.txt';
const outputPath = './players.json';

const countries = [
  "New Zealand", "South Africa", "West Indies", "Australia", 
  "India", "Sri Lanka", "England", "Afghanistan", "Bangladesh", 
  "Zimbabwe", "Malaysia", "Ireland"
];

try {
  const content = fs.readFileSync(ocrPath, 'utf-8');
  const lines = content.split('\n');
  const result = [];
  let errorCount = 0;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Parse prefix: list_sr_no, set_no, set_code
    const prefixMatch = line.match(/^(\d+)\s+(\d+)\s+([A-Z0-9]+)\s+/);
    if (!prefixMatch) {
      console.warn(`⚠️ Skipped line (no prefix match): ${line}`);
      errorCount++;
      continue;
    }

    const list_sr_no = parseInt(prefixMatch[1]);
    const set_no = parseInt(prefixMatch[2]);
    const set_code = prefixMatch[3];

    // Find role
    const roleMatch = line.match(/\b(BATTER|ALL-ROUNDER|WICKETKEEPER|BOWLER)\b/);
    if (!roleMatch) {
      console.warn(`⚠️ Skipped line (no role found): ${line}`);
      errorCount++;
      continue;
    }
    const role = roleMatch[1];

    // Parse name and country part
    const prefixLength = line.indexOf(set_code) + set_code.length;
    const roleIndex = line.indexOf(role);
    const nameAndCountryPart = line.substring(prefixLength, roleIndex).trim();

    // Find country
    let country = countries.find(c => nameAndCountryPart.includes(c));
    if (!country) {
      // Fallback check
      console.warn(`⚠️ Country not found in part: "${nameAndCountryPart}" for line: ${line}`);
      country = "India"; // Default fallback
    }

    const namePart = nameAndCountryPart.split(country)[0].trim();

    // Parse price and surname from the end of the line
    // Format: (Capped|Uncapped|Associate) <price> <surname>
    const endMatch = line.match(/(Capped|Uncapped|Associate)\s+(\d+)\s+(.+)$/);
    if (!endMatch) {
      console.warn(`⚠️ Could not parse capping/price/surname at the end for line: ${line}`);
      errorCount++;
      continue;
    }

    const reserve_price_lakh = parseInt(endMatch[2]);
    const surname = endMatch[3].trim();

    // Deduce first name
    let first_name = "";
    if (namePart.endsWith(surname)) {
      first_name = namePart.substring(0, namePart.length - surname.length).trim();
    } else {
      // Fallback if surname is spelled slightly differently or case mismatches
      // Just split by whitespace and take everything except the last token(s)
      const surnameTokens = surname.split(/\s+/);
      const nameTokens = namePart.split(/\s+/);
      if (nameTokens.length > surnameTokens.length) {
        first_name = nameTokens.slice(0, nameTokens.length - surnameTokens.length).join(" ");
      } else {
        first_name = nameTokens[0] || "";
      }
    }

    // Clean up any double spaces or punctuation
    first_name = first_name.trim();

    result.push({
      list_sr_no,
      set_no,
      set_code,
      first_name,
      surname,
      country,
      role,
      reserve_price_lakh
    });
  }

  console.log(`Parsed ${result.length} players successfully.`);
  console.log(`Errors/Skipped lines: ${errorCount}`);

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Successfully generated ${outputPath}`);

} catch (error) {
  console.error("Error executing parser:", error);
}
