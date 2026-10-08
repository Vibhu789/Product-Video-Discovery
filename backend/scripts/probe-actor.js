import fs from 'node:fs';
import { runActor } from '../src/collectors/apifyRunner.js';

const [actorId, inputFile] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const items = await runActor(actorId, input, { limit: 3 });

console.log('\nitems returned:', items.length);
console.log(JSON.stringify(items[0], null, 2)?.slice(0, 3500));