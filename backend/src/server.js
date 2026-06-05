import config from './config/index.js';
import connectDB from './config/db.js';
import app from './app.js';

const start = async () => {
  // Connect to MongoDB
  await connectDB();

  // Start Express server
  app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port} [${config.nodeEnv}]`);
    console.log(`   Frontend: ${config.frontendUrl}`);
    console.log(`   Health:   http://localhost:${config.port}/api/health`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
