import { ApiReference } from "@scalar/nextjs-api-reference";

const config = {
  spec: {
    url: "/openapi.json",
  },
  theme: "purple" as const,
  metaData: {
    title: "Tower Developer Public API Reference",
    description: "Interactive API Documentation for Tower Public Developer Endpoints",
  },
};

export const GET = ApiReference(config);
