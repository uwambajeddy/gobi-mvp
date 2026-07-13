import express from "express";
import v1Router from "./api/v1";

const allRoutes = express.Router();

allRoutes.get("/", (req, res) =>
  res.json({
    status: "success",
    message: "Welcome to the Gobi MVP API. See /api/v1/docs for documentation.",
  }),
);

allRoutes.use("/api/v1", v1Router);

export default allRoutes;
