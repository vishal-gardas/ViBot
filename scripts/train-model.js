/*
 * Trains the compact classifier used by ViBot. The model is a 2-layer
 * feed-forward neural network: bag-of-words -> ReLU(48) -> softmax intents.
 * It uses no cloud service or external ML package.
 */
const fs = require('fs');
const path = require('path');
const intents = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'intents.json'))).intents;
const stopWords = new Set(['a','an','the','is','it','i','me','my','to','do','you','are','can','how','what','will','be','this','that','with','about','of','for','on','and','we']);
const tokenize = text => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !stopWords.has(w));
const vocabulary = [...new Set(intents.flatMap(i => i.patterns.flatMap(tokenize)))].sort();
const labels = intents.map(i => i.tag);
const samples = intents.flatMap((intent, label) => intent.patterns.map(pattern => ({ x: vectorize(pattern), label })));
function vectorize(text) { const set = new Set(tokenize(text)); return vocabulary.map(word => set.has(word) ? 1 : 0); }
let seed = 14821;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const input = vocabulary.length, hidden = 48, output = labels.length;
const w1 = Array.from({length: hidden}, () => Array.from({length: input}, () => (rand() - .5) * .16));
const b1 = Array(hidden).fill(0);
const w2 = Array.from({length: output}, () => Array.from({length: hidden}, () => (rand() - .5) * .16));
const b2 = Array(output).fill(0);
const forward = x => {
  const hRaw = w1.map((row, j) => b1[j] + row.reduce((s, w, i) => s + w * x[i], 0));
  const h = hRaw.map(n => Math.max(0, n));
  const logits = w2.map((row, j) => b2[j] + row.reduce((s, w, i) => s + w * h[i], 0));
  const max = Math.max(...logits), exp = logits.map(n => Math.exp(n - max));
  const probs = exp.map(n => n / exp.reduce((a,b) => a+b, 0));
  return {hRaw, h, probs};
};
for (let epoch = 0; epoch < 1900; epoch++) {
  const lr = epoch < 1200 ? .055 : .018;
  for (let n = samples.length - 1; n > 0; n--) { const j = Math.floor(rand() * (n + 1)); [samples[n], samples[j]] = [samples[j], samples[n]]; }
  for (const {x, label} of samples) {
    const {hRaw, h, probs} = forward(x); const dz2 = probs.map((p, j) => p - (j === label ? 1 : 0));
    const dh = h.map((_, k) => dz2.reduce((s, d, j) => s + d * w2[j][k], 0));
    for (let j=0;j<output;j++) { for(let k=0;k<hidden;k++) w2[j][k] -= lr * dz2[j] * h[k]; b2[j] -= lr * dz2[j]; }
    for (let k=0;k<hidden;k++) { const dz = hRaw[k] > 0 ? dh[k] : 0; for(let i=0;i<input;i++) w1[k][i] -= lr * dz * x[i]; b1[k] -= lr * dz; }
  }
}
let correct = 0; for (const sample of samples) { const p = forward(sample.x).probs; if (p.indexOf(Math.max(...p)) === sample.label) correct++; }
const responses = intents.map(i => i.responses);
const model = { architecture: 'Bag-of-words → Dense(48, ReLU) → Dense(15, Softmax)', vocabulary, labels, responses, weights: {w1,b1,w2,b2}, training: {samples: samples.length, epochs: 1900, accuracy: correct / samples.length} };
fs.mkdirSync(path.join(__dirname, '..', 'model'), {recursive:true});
fs.writeFileSync(path.join(__dirname, '..', 'model', 'vibot-model.json'), JSON.stringify(model));
console.log(`Trained ${samples.length} examples; accuracy ${(correct / samples.length * 100).toFixed(1)}%; vocabulary ${input}.`);
