import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "DialForge",
    version: "2.0.0",
    description:
      "DialForge USSD sandbox: forwards simulated USSD traffic to developer callback URLs. No hosted business logic — external backends own menus.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Register",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Error" } },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Token" }, "401": { description: "Unauthorized" } },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Current user",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "User" }, "401": { description: "Unauthorized" } },
      },
    },
    "/api/simulate": {
      post: {
        summary: "Simulate USSD (forward to external callback)",
        tags: ["Simulate"],
        description:
          "Requires `profileId` (JWT) or `callbackUrl` (anonymous if enabled). Returns CON/END text from the external backend.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phoneNumber", "serviceCode"],
                properties: {
                  sessionId: { type: "string" },
                  phoneNumber: { type: "string" },
                  serviceCode: { type: "string" },
                  text: { type: "string" },
                  profileId: { type: "string" },
                  callbackUrl: { type: "string", format: "uri" },
                  httpMethod: { type: "string", enum: ["GET", "POST", "PUT", "PATCH"] },
                  headers: { type: "object", additionalProperties: { type: "string" } },
                  authToken: { type: "string" },
                  provider: { type: "string", enum: ["DIALFORGE", "MTN", "AIRTEL", "NEXEN", "CUSTOM"] },
                  payloadMapping: { type: "object", additionalProperties: { type: "string" } },
                  responseType: { type: "string", enum: ["plain", "json"] },
                  responseJsonPath: { type: "string" },
                  simulation: {
                    type: "object",
                    properties: {
                      delayMs: { type: "integer" },
                      retries: { type: "integer" },
                      timeoutMs: { type: "integer" },
                      duplicate: { type: "boolean" },
                      invalidInput: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Simulate result with inspector" }, "400": { description: "Bad request" } },
      },
    },
    "/api/simulate/replay": {
      post: {
        summary: "Replay a session (multi-step) against a saved profile",
        tags: ["Simulate"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Replay results" } },
      },
    },
    "/api/examples/mock-ussd": {
      post: {
        summary: "Example mock USSD backend (local testing only)",
        tags: ["Examples"],
        responses: { "200": { description: "Plain text CON/END" } },
      },
    },
    "/api/ussd": {
      post: {
        summary: "Legacy path — same as POST /api/simulate",
        tags: ["USSD"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phoneNumber", "serviceCode"],
                properties: {
                  sessionId: { type: "string" },
                  phoneNumber: { type: "string", example: "256700000000" },
                  serviceCode: { type: "string", example: "*182#" },
                  text: { type: "string", example: "1*2" },
                  profileId: { type: "string" },
                  callbackUrl: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "USSD response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    response: { type: "string", description: "CON ... or END ..." },
                    ended: { type: "boolean" },
                    source: { type: "string", enum: ["forward"] },
                    sessionId: { type: "string" },
                    inspector: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/sessions/active": {
      get: {
        summary: "Active Redis sessions",
        tags: ["Sessions"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "List" } },
      },
    },
    "/api/logs": {
      get: {
        summary: "Request / session logs (persisted)",
        tags: ["Logs"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 0 } },
          { name: "take", in: "query", schema: { type: "integer", default: 50 } },
          { name: "failed", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "profileId", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Logs" } },
      },
    },
    "/api/flows": {
      get: {
        summary: "List saved flows",
        tags: ["Flows"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Flows" } },
      },
      post: {
        summary: "Create flow",
        tags: ["Flows"],
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/flows/starter": {
      get: {
        summary: "Built-in starter flow JSON",
        tags: ["Flows"],
        responses: { "200": { description: "Flow" } },
      },
    },
    "/api/flows/{id}": {
      put: {
        summary: "Update flow",
        tags: ["Flows"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        summary: "Delete flow",
        tags: ["Flows"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" } },
      },
    },
    "/api/profiles": {
      get: {
        summary: "List webhook profiles (saved callback configs)",
        tags: ["Profiles"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Profiles" } },
      },
      post: {
        summary: "Create webhook profile",
        tags: ["Profiles"],
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/profiles/{id}": {
      get: {
        summary: "Get profile",
        tags: ["Profiles"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Profile" } },
      },
      put: {
        summary: "Update profile",
        tags: ["Profiles"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        summary: "Delete profile",
        tags: ["Profiles"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
} as const;

export function mountSwagger(app: Express) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec as unknown as object));
}
