import express from "express";
import authRouter from "./auth";
import profileRouter from "./profile";
import organizationsRouter from "./organizations";
import shipmentsRouter from "./shipments";
import vehiclesRouter from "./vehicles";
import driverRouter from "./driver";
import adminRouter from "./admin";

const v1Router = express.Router();

v1Router.use("/auth", authRouter);
v1Router.use("/profile", profileRouter);
v1Router.use("/organizations", organizationsRouter);
v1Router.use("/shipments", shipmentsRouter);
v1Router.use("/vehicles", vehiclesRouter);
v1Router.use("/driver", driverRouter);
v1Router.use("/admin", adminRouter);

export default v1Router;
