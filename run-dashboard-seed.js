#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🌱 Starting dashboard data seeding...');

try {
  // Run the TypeScript seed script
  const scriptPath = path.join(__dirname, 'src/scripts/seedDashboardData.ts');
  execSync(`npx tsx ${scriptPath}`, { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  
  console.log('✅ Dashboard data seeding completed successfully!');
  console.log('\n📊 Dashboard is now ready with comprehensive test data');
  console.log('\n🔑 Login credentials:');
  console.log('   Admin: admin@school.com / admin123');
  console.log('   Teacher: alice.johnson@school.com / teacher123');
  console.log('   Student: john.doe@school.com / student123');
  console.log('\n🚀 You can now test the dashboard with real data!');
  
} catch (error) {
  console.error('❌ Error running dashboard seed:', error.message);
  process.exit(1);
}
