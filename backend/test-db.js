const { initDb, db } = require('./database');

async function test() {
  try {
    console.log("Initializing database test...");
    await initDb();
    console.log("Database initialized successfully!");
    db.close((err) => {
      if (err) {
        console.error("Error closing database:", err);
        process.exit(1);
      }
      console.log("Database connection closed.");
      process.exit(0);
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

test();
