import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sowpodsPath = path.join(__dirname, '..', '..', '..', 'Scrabble', 'scrabble', 'sowpods.txt');
if (!fs.existsSync(sowpodsPath)) {
  sowpodsPath = path.join(process.cwd(), '..', 'Scrabble', 'scrabble', 'sowpods.txt');
}
if (!fs.existsSync(sowpodsPath)) {
  sowpodsPath = path.join(process.cwd(), 'Scrabble', 'scrabble', 'sowpods.txt');
}

const rawData = fs.readFileSync(sowpodsPath, 'utf-8');
const wordList = rawData.split('\n').map(w => w.trim().toLowerCase()).filter(Boolean);
export const wordSet = new Set(wordList);
