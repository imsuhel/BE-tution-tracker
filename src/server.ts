import app from './app';
import pool from './config/db';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3001;

// Test DB Connection before starting the server
pool.getConnection()
  .then((connection) => {
    console.log('Successfully connected to the MySQL Database.');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to the MySQL Database:', err.message);
    process.exit(1);
  });
