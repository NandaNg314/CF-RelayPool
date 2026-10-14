import fs from 'node:fs';

const html = fs.readFileSync('ui.html', 'utf8');

// Escape for embedding inside a JS template literal
const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const out = `export const UI_HTML = \`${escaped}\`;\n`;

fs.writeFileSync('src/ui.ts', out, 'utf8');
console.log(`Wrote src/ui.ts (${out.length} bytes, from ui.html ${html.length} bytes)`);
