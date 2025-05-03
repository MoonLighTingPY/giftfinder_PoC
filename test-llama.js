// test-llama.js
import process from 'process';
import { Llama } from 'node-llama-cpp'; // Use import instead of require

try {
  console.log('Attempting to import Llama...');
  // Import happens at the top level now
  console.log('Llama imported successfully.');

  console.log('Attempting to instantiate Llama...');
  const llama = new Llama();
  console.log('Llama instantiated successfully.'); // Simplified log
} catch (error) {
  console.error('Error during minimal test:', error);
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
}