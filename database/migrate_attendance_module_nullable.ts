import pool from '../src/config/db';

async function migrate() {
  try {
    console.log('Starting attendance migration (making module_id nullable)...');
    
    // 1. Drop foreign key first if it exists
    try {
      await pool.query(`ALTER TABLE attendance DROP FOREIGN KEY fk_attendance_module`);
      console.log('Dropped foreign key fk_attendance_module.');
    } catch (e) {
      console.log('Foreign key fk_attendance_module might not exist, skipping drop.');
    }

    // 2. Modify column
    await pool.query(`ALTER TABLE attendance MODIFY module_id CHAR(36) NULL`);
    console.log('Modified module_id to be NULLABLE.');

    // 3. Re-add foreign key
    await pool.query(`
      ALTER TABLE attendance 
      ADD CONSTRAINT fk_attendance_module 
      FOREIGN KEY (module_id) REFERENCES course_modules(id) 
      ON DELETE CASCADE
    `);
    console.log('Re-added foreign key fk_attendance_module.');

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
