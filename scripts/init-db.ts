#!/usr/bin/env ts-node
/**
 * Database initialization script
 * Run this to create all required tables in your PostgreSQL database
 * 
 * Usage: npx ts-node scripts/init-db.ts
 */

import { initDatabase } from '../lib/db';

async function main() {
  console.log('Initializing database...');
  try {
    await initDatabase();
    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

main();








