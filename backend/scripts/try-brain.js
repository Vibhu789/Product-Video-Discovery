import { resolveProduct } from '../src/services/productResolver.js';
import { analyzeProduct } from '../src/services/brain.js';

const product = await resolveProduct({ url: process.argv[2] });
const { analysis, warnings } = await analyzeProduct(product);
console.log(JSON.stringify({ title: product.title, warnings, analysis }, null, 2));