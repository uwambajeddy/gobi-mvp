import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";

export default (app) => {
  if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }
  app.use(compression());
  app.use(cors());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
};
