import pool from '../src/config/db';

async function migrate() {
  try {
    console.log('Starting center migration (adding address)...');
    
    // Check if column exists
    const [columns] = await pool.query<any[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'centers' AND COLUMN_NAME = 'address'"
    );

    if (columns.length === 0) {
      await pool.query('ALTER TABLE centers ADD COLUMN address TEXT AFTER city');
      console.log('Address column added.');
    } else {
      console.log('Address column already exists.');
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
