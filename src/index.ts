import express from "express";
import { graphqlHTTP } from "express-graphql";
import { schema } from "./schema";
import { resolvers } from "./resolvers";
import { connectDB } from "./db";
import dotenv from "dotenv";
import { renderPlaygroundPage } from "@apollographql/graphql-playground-html";

dotenv.config();

const app = express();

connectDB();

app.use(
  "/graphql",
  graphqlHTTP({
    schema,
    rootValue: resolvers,
  })
);

app.get("/playground", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(renderPlaygroundPage({ endpoint: "/graphql" }));
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
  console.log(
    `GraphQL Playground available at http://localhost:${PORT}/playground`
  );
});
