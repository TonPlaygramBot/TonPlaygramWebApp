import path from 'path';
import { fileURLToPath } from 'url';
import { writeReceiptPreview } from '../utils/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '../tmp/receipt-preview.png');

await writeReceiptPreview(outPath, {
  title: 'Store Purchase Completed',
  subtitle: 'Receipt preview',
  amount: -1250,
  fromName: 'Alice Sender',
  toName: 'Bob Receiver',
  fromPhoto: '/assets/icons/AlbaniaLeader.webp',
  toPhoto: '/assets/icons/CanadaLeader.webp',
  itemThumbnail: '/store-thumbs/poolRoyale/tableFinish/oakVeneer01.png',
  itemLabel: 'Oak Veneer Table Finish'
});

console.log(`Receipt preview generated at: ${outPath}`);
