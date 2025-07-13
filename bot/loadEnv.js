import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Load Twitter credentials from the repository root if available
const rootDir = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootDir, 'twitter.env') });
