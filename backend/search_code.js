import fs from 'fs';
import path from 'path';

const searchTerms = ['320', '600', '620', '369'];
const searchDirs = ['../frontend/src', './'];

function searchInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const term of searchTerms) {
      if (content.includes(term)) {
        console.log(`Found "${term}" in: ${filePath}`);
        // print matching lines
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(term)) {
            console.log(`  L${idx+1}: ${line.trim()}`);
          }
        });
      }
    }
  } catch (e) {
    // Ignore binary/directories
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverse(fullPath);
    } else {
      searchInFile(fullPath);
    }
  }
}

for (const dir of searchDirs) {
  if (fs.existsSync(dir)) {
    traverse(dir);
  }
}
