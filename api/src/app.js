import express from "express";
import globalErrorHandler from "./controllers/error.controller";
import allRoutes from "./routers";
import AppError from "./utils/appError";
import statusCodes from "./utils/statusCodes";
import applyMiddlewares from "./middlewares";
import { setupSwagger } from "./docs/swagger";

const { notFound } = statusCodes;

const app = express();

applyMiddlewares(app);

setupSwagger(app);

app.use(allRoutes);

app.use((req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server.`, notFound));
});

app.use(globalErrorHandler);

export default app;
