#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Teacher Migration Script');
console.log('=====================================\n');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'basic';

console.log(`📋 Available commands:`);
console.log(`   basic        - Basic migration (add classIds field, remove department)`);
console.log(`   with-classes - Migration with automatic class assignment based on subjects`);
console.log(`   dry-run      - Preview what changes would be made`);
console.log(`\n🎯 Running command: ${command}\n`);

// Run the TypeScript migration script
const scriptPath = path.join(__dirname, 'src', 'scripts', 'migrateTeachersWithClasses.ts');
const child = spawn('npx', ['tsx', scriptPath, command], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n❌ Migration failed with code:', code);
    process.exit(code);
  }
});

child.on('error', (error) => {
  console.error('\n❌ Error running migration:', error);
  process.exit(1);
});
