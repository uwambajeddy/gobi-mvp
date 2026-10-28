import "dotenv/config";
import logger from "./utils/logger";
import { Server } from "socket.io";

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

import app from "./app";
import { protectSocket } from "./middlewares/authentication";
import {
  addConnectedClient,
  initializeSocketIO,
  shipmentLiveServices,
} from "./utils/socket.io";

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  logger.warn(`\nServer running at http://localhost:${port}\n`);
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

initializeSocketIO(io);

io.use((socket, next) => {
  protectSocket(socket, next);
});

io.on("connection", (client) => {
  const clientId = client.userInfo.id;
  const userInfo = client.userInfo;

  addConnectedClient(clientId, client.id);

  logger.success(`Client connected: ${userInfo.firstName} ${userInfo.lastName} ✅`);

  shipmentLiveServices(client);
});

process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  logger.warn("👋 SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    logger.error("💥 Process terminated!");
  });
});

export default server;
