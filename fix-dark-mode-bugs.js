/**
 * Dark Mode Bug Fixer
 * Fixes white lines, borders, and hover state issues in dark mode
 * 
 * Usage: node fix-dark-mode-bugs.js <file-or-directory-path>
 */

const fs = require('fs');
const path = require('path');

// Enhanced dark mode rules to fix specific bugs
const bugFixRules = [
  // Fix card/container classes that might have white backgrounds
  { 
    pattern: /className="([^"]*)\bcard\b([^"]*)"/g, 
    replacement: 'className="$1card dark:bg-gray-800 dark:border-gray-700$2"',
    description: 'Adding dark mode to card class'
  },
  
  // Fix plain bg-white that doesn't have dark mode
  { 
    pattern: /className="([^"]*)\bbg-white\b(?!.*dark:bg-)([^"]*)"/g, 
    replacement: 'className="$1bg-white dark:bg-gray-800$2"',
    description: 'Adding dark:bg-gray-800 to bg-white'
  },
  
  // Fix border-white
  { 
    pattern: /className="([^"]*)\bborder-white\b([^"]*)"/g, 
    replacement: 'className="$1border-white dark:border-gray-700$2"',
    description: 'Fixing white borders'
  },
  
  // Fix text-white in places where it should be conditional
  { 
    pattern: /className="([^"]*)\btext-white\b(?!.*dark:)([^"]*)"/g, 
    replacement: 'className="$1text-white dark:text-gray-100$2"',
    description: 'Making text-white conditional'
  },
  
  // Fix hover:bg-white
  { 
    pattern: /className="([^"]*)\bhover:bg-white\b([^"]*)"/g, 
    replacement: 'className="$1hover:bg-white dark:hover:bg-gray-700$2"',
    description: 'Fixing white hover backgrounds'
  },
  
  // Fix border without color that defaults to white
  { 
    pattern: /className="([^"]*)\bborder\b(?!\s*border-(gray|blue|red|green|yellow|indigo|purple|pink))(?!.*dark:border-)([^"]*)"/g, 
    replacement: 'className="$1border dark:border-gray-700$3"',
    description: 'Adding dark border color to plain border'
  },
  
  // Fix divide without color
  { 
    pattern: /className="([^"]*)\bdivide-x\b(?!.*dark:divide-)([^"]*)"/g, 
    replacement: 'className="$1divide-x dark:divide-gray-700$2"',
    description: 'Adding dark divide color'
  },
  { 
    pattern: /className="([^"]*)\bdivide-y\b(?!.*dark:divide-)([^"]*)"/g, 
    replacement: 'className="$1divide-y dark:divide-gray-700$2"',
    description: 'Adding dark divide color'
  },
  
  // Fix ring colors
  { 
    pattern: /className="([^"]*)\bring-white\b([^"]*)"/g, 
    replacement: 'className="$1ring-white dark:ring-gray-700$2"',
    description: 'Fixing white ring colors'
  },
  
  // Fix shadow that might show white
  { 
    pattern: /className="([^"]*)\bshadow-lg\b(?!.*dark:shadow-)([^"]*)"/g, 
    replacement: 'className="$1shadow-lg dark:shadow-gray-900$2"',
    description: 'Adding dark shadow'
  },
  { 
    pattern: /className="([^"]*)\bshadow-xl\b(?!.*dark:shadow-)([^"]*)"/g, 
    replacement: 'className="$1shadow-xl dark:shadow-gray-900$2"',
    description: 'Adding dark shadow'
  },
  
  // Fix placeholder text that might be too light
  { 
    pattern: /className="([^"]*)\bplaceholder-gray-300\b([^"]*)"/g, 
    replacement: 'className="$1placeholder-gray-300 dark:placeholder-gray-500$2"',
    description: 'Fixing placeholder visibility'
  },
  { 
    pattern: /className="([^"]*)\bplaceholder-gray-200\b([^"]*)"/g, 
    replacement: 'className="$1placeholder-gray-200 dark:placeholder-gray-500$2"',
    description: 'Fixing placeholder visibility'
  },
  
  // Fix hover states that hide text
  { 
    pattern: /className="([^"]*)\bhover:text-white\b(?!.*dark:hover:text-)([^"]*)"/g, 
    replacement: 'className="$1hover:text-white dark:hover:text-gray-100$2"',
    description: 'Fixing hover text visibility'
  },
  
  // Fix focus ring that might be white
  { 
    pattern: /className="([^"]*)\bfocus:ring-white\b([^"]*)"/g, 
    replacement: 'className="$1focus:ring-white dark:focus:ring-gray-600$2"',
    description: 'Fixing focus ring color'
  },
  
  // Fix outline colors
  { 
    pattern: /className="([^"]*)\boutline-white\b([^"]*)"/g, 
    replacement: 'className="$1outline-white dark:outline-gray-700$2"',
    description: 'Fixing outline color'
  },
];

function fixDarkModeBugs(content) {
  let updatedContent = content;
  let changesCount = 0;
  const changesLog = [];
  
  bugFixRules.forEach(rule => {
    const beforeMatches = updatedContent.match(rule.pattern);
    if (beforeMatches) {
      updatedContent = updatedContent.replace(rule.pattern, rule.replacement);
      const afterMatches = updatedContent.match(rule.pattern);
      const fixedCount = beforeMatches.length - (afterMatches ? afterMatches.length : 0);
      if (fixedCount > 0) {
        changesCount += fixedCount;
        changesLog.push(`  ✓ ${rule.description}: ${fixedCount} fix${fixedCount > 1 ? 'es' : ''}`);
      }
    }
  });
  
  return { content: updatedContent, changesCount, changesLog };
}

function processFile(filePath) {
  try {
    console.log(`\n📄 Processing: ${path.basename(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: updatedContent, changesCount, changesLog } = fixDarkModeBugs(content);
    
    if (changesCount > 0) {
      // Create backup if it doesn't exist
      const backupPath = filePath + '.bugfix-backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, 'utf8');
      }
      
      // Write updated content
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      
      console.log(`✅ Fixed ${changesCount} bug${changesCount > 1 ? 's' : ''}:`);
      changesLog.forEach(log => console.log(log));
      if (!fs.existsSync(filePath + '.backup')) {
        console.log(`💾 Backup saved to: ${backupPath}`);
      }
    } else {
      console.log('✓ No bugs found');
    }
  } catch (error) {
    console.error(`❌ Error processing file: ${error.message}`);
  }
}

function processDirectory(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      // Skip backup files
      if (file.endsWith('.backup') || file.endsWith('.bugfix-backup')) {
        return;
      }
      
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
🔧 Dark Mode Bug Fixer
======================

Fixes common dark mode issues:
  ✓ White lines and borders
  ✓ Hover states hiding text
  ✓ Missing dark mode classes on borders
  ✓ White backgrounds without dark alternatives
  ✓ Placeholder text visibility
  ✓ Shadow and ring colors

Usage:
  node fix-dark-mode-bugs.js <file-or-directory-path>

Examples:
  node fix-dark-mode-bugs.js ./frontend/src/components/pages
  node fix-dark-mode-bugs.js ./frontend/src/components
  `);
  process.exit(0);
}

const targetPath = path.resolve(args[0]);
const stat = fs.statSync(targetPath);

console.log('🔧 Starting Dark Mode Bug Fixes...\n');

if (stat.isDirectory()) {
  console.log(`📁 Processing directory: ${targetPath}`);
  processDirectory(targetPath);
} else {
  processFile(targetPath);
}

console.log('\n✨ Bug fixes complete!\n');
