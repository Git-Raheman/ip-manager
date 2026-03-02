const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Copy index.html
fs.copyFileSync('src/index.html', 'dist/index.html');
// Copy styles.css - we'll just link it in index.html for simplicity or bundle it. 
// Let's bundle it or copy it. Copying is easier for vanilla CSS.
if (fs.existsSync('src/styles.css')) {
    fs.copyFileSync('src/styles.css', 'dist/styles.css');
}

esbuild.build({
    entryPoints: ['src/index.jsx'],
    bundle: true,
    outfile: 'dist/bundle.js',
    minify: true,
    sourcemap: true,
    loader: { '.js': 'jsx', '.jsx': 'jsx' },
    define: {
        'process.env.NODE_ENV': '"production"'
    }
}).catch(() => process.exit(1));
