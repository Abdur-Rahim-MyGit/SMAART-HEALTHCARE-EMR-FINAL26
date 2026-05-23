/**
 * Automated Dark Mode Class Injector
 * This script adds dark mode Tailwind classes to React components
 * 
 * Usage: node add-dark-mode.js <file-path>
 */

const fs = require('fs');
const path = require('path');

// Dark mode class mappings
const darkModeRules = [
  // Text colors
  { pattern: /className="([^"]*)\btext-gray-900\b([^"]*)"/g, replacement: 'className="$1text-gray-900 dark:text-white$2"' },
  { pattern: /className="([^"]*)\btext-gray-800\b([^"]*)"/g, replacement: 'className="$1text-gray-800 dark:text-gray-200$2"' },
  { pattern: /className="([^"]*)\btext-gray-700\b([^"]*)"/g, replacement: 'className="$1text-gray-700 dark:text-gray-300$2"' },
  { pattern: /className="([^"]*)\btext-gray-600\b([^"]*)"/g, replacement: 'className="$1text-gray-600 dark:text-gray-400$2"' },
  { pattern: /className="([^"]*)\btext-gray-500\b([^"]*)"/g, replacement: 'className="$1text-gray-500 dark:text-gray-400$2"' },
  
  // Backgrounds
  { pattern: /className="([^"]*)\bbg-white\b([^"]*)"/g, replacement: 'className="$1bg-white dark:bg-gray-800$2"' },
  { pattern: /className="([^"]*)\bbg-gray-50\b([^"]*)"/g, replacement: 'className="$1bg-gray-50 dark:bg-gray-700$2"' },
  { pattern: /className="([^"]*)\bbg-gray-100\b([^"]*)"/g, replacement: 'className="$1bg-gray-100 dark:bg-gray-600$2"' },
  
  // Borders
  { pattern: /className="([^"]*)\bborder-gray-200\b([^"]*)"/g, replacement: 'className="$1border-gray-200 dark:border-gray-700$2"' },
  { pattern: /className="([^"]*)\bborder-gray-300\b([^"]*)"/g, replacement: 'className="$1border-gray-300 dark:border-gray-600$2"' },
  
  // Dividers
  { pattern: /className="([^"]*)\bdivide-gray-200\b([^"]*)"/g, replacement: 'className="$1divide-gray-200 dark:divide-gray-700$2"' },
  
  // Hover states
  { pattern: /className="([^"]*)\bhover:bg-gray-50\b([^"]*)"/g, replacement: 'className="$1hover:bg-gray-50 dark:hover:bg-gray-700$2"' },
  { pattern: /className="([^"]*)\bhover:bg-gray-100\b([^"]*)"/g, replacement: 'className="$1hover:bg-gray-100 dark:hover:bg-gray-600$2"' },
  { pattern: /className="([^"]*)\bhover:bg-gray-200\b([^"]*)"/g, replacement: 'className="$1hover:bg-gray-200 dark:hover:bg-gray-600$2"' },
  { pattern: /className="([^"]*)\bhover:text-gray-600\b([^"]*)"/g, replacement: 'className="$1hover:text-gray-600 dark:hover:text-gray-300$2"' },
  { pattern: /className="([^"]*)\bhover:text-gray-700\b([^"]*)"/g, replacement: 'className="$1hover:text-gray-700 dark:hover:text-gray-200$2"' },
  { pattern: /className="([^"]*)\bhover:text-gray-800\b([^"]*)"/g, replacement: 'className="$1hover:text-gray-800 dark:hover:text-gray-200$2"' },
];

function addDarkModeClasses(content) {
  let updatedContent = content;
  let changesCount = 0;
  
  // Skip if already has dark mode classes
  if (content.includes('dark:')) {
    console.log('⚠️  File already contains dark mode classes, skipping...');
    return { content: updatedContent, changesCount: 0 };
  }
  
  darkModeRules.forEach(rule => {
    const matches = updatedContent.match(rule.pattern);
    if (matches) {
      changesCount += matches.length;
      updatedContent = updatedContent.replace(rule.pattern, rule.replacement);
    }
  });
  
  return { content: updatedContent, changesCount };
}

function processFile(filePath) {
  try {
    console.log(`\n📄 Processing: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: updatedContent, changesCount } = addDarkModeClasses(content);
    
    if (changesCount > 0) {
      // Create backup
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content, 'utf8');
      
      // Write updated content
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      
      console.log(`✅ Updated ${changesCount} class${changesCount > 1 ? 'es' : ''}`);
      console.log(`💾 Backup saved to: ${backupPath}`);
    } else {
      console.log('ℹ️  No changes needed');
    }
  } catch (error) {
    console.error(`❌ Error processing file: ${error.message}`);
  }
}

function processDirectory(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
        processFile(fullPath);
      }
    });
  } catch (error) {
    console.error(`❌ Error processing directory: ${error.message}`);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
🌙 Dark Mode Class Injector
============================

Usage:
  node add-dark-mode.js <file-or-directory-path>

Examples:
  node add-dark-mode.js ./frontend/src/components/pages/Appointments.jsx
  node add-dark-mode.js ./frontend/src/components/pages
  node add-dark-mode.js ./frontend/src/components

This script will:
  ✓ Add dark mode Tailwind classes to your components
  ✓ Create .backup files before making changes
  ✓ Skip files that already have dark mode classes
  `);
  process.exit(0);
}

const targetPath = path.resolve(args[0]);
const stat = fs.statSync(targetPath);

console.log('🌙 Starting Dark Mode Class Injection...\n');

if (stat.isDirectory()) {
  console.log(`📁 Processing directory: ${targetPath}`);
  processDirectory(targetPath);
} else {
  processFile(targetPath);
}

console.log('\n✨ Done!\n');
