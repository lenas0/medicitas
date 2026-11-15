const fs = require('fs');
const path = require('path');
const pool = require('../services/mysql.service');
const mysqlConfig = require('../env/mysqlConfig');

const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

function getConfirmedDatabase() {
  const confirmationIndex = process.argv.indexOf('--confirm-database');
  if (confirmationIndex < 0 || !process.argv[confirmationIndex + 1]) {
    throw new Error('Pass --confirm-database followed by the exact database name from DB_NAME.');
  }

  const confirmedDatabase = process.argv[confirmationIndex + 1];
  if (confirmedDatabase !== mysqlConfig.database) {
    throw new Error('The confirmed database does not match DB_NAME; initialization cancelled.');
  }
  return confirmedDatabase;
}

function readStatements() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8').replace(/--.*$/gm, '');
  return schema
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function initializeDatabase() {
  const confirmedDatabase = getConfirmedDatabase();
  const statements = readStatements();
  const connection = await pool.getConnection();

  try {
    const [[databaseRow]] = await connection.query('SELECT DATABASE() AS databaseName');
    if (databaseRow.databaseName !== confirmedDatabase) {
      throw new Error('The connected database does not match the confirmed database; initialization cancelled.');
    }

    for (const statement of statements) {
      await connection.query(statement);
    }

    const [tables] = await connection.query('SHOW TABLES');
    console.log(`Schema ready in ${confirmedDatabase} (${statements.length} statements, ${tables.length} tables).`);
    console.log(`Tables: ${tables.map((table) => Object.values(table)[0]).join(', ')}`);
  } finally {
    connection.release();
  }
}

initializeDatabase()
  .catch((error) => {
    console.error(`Database initialization failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
