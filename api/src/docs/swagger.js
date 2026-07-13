import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger.json";

export const setupSwagger = (app) => {
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "Gobi MVP API Docs",
    }),
  );
};
