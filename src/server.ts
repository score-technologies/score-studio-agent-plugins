import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { ScoreStudioApiError, ScoreStudioClient } from "./client.js";

const VERSION = "0.1.2";
export const DEFAULT_SCORESTUDIO_URL = "https://api.scorestudio.ai";

export interface ServerOptions {
  baseUrl?: string;
  token?: string;
  tokenProvider?: () => Promise<string>;
}

function config(options: ServerOptions): { baseUrl: string; token: string | (() => Promise<string>) } {
  const baseUrl = options.baseUrl ?? process.env.SCORESTUDIO_URL ?? DEFAULT_SCORESTUDIO_URL;
  const token = options.tokenProvider ?? options.token ?? process.env.SCORESTUDIO_TOKEN ?? "";
  if (!token) throw new Error("SCORESTUDIO_TOKEN is required");
  return { baseUrl, token };
}

function result(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: { result: payload },
  };
}

function failure(error: unknown) {
  const payload = error instanceof ScoreStudioApiError
    ? { status: error.status, code: error.code, message: error.message, details: error.details }
    : { code: "tool_error", message: error instanceof Error ? error.message : String(error) };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

async function call(fn: () => Promise<unknown>) {
  try {
    return result(await fn());
  } catch (error) {
    return failure(error);
  }
}

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

export function buildServer(options: ServerOptions = {}): McpServer {
  const resolved = config(options);
  const api = new ScoreStudioClient(resolved);
  const server = new McpServer(
    { name: "score-studio", version: VERSION },
    { capabilities: { tools: {} }, instructions: "Use immutable dataset/model/evaluation identifiers and verify evidence before release." },
  );

  server.registerTool("scorestudio_whoami", {
    title: "Get Score Studio identity",
    description: "Return the authenticated Score Studio user and organization memberships.",
    inputSchema: z.object({}),
    annotations: readOnly,
  }, () => call(() => api.request("GET", "/v1/auth/me")));

  server.registerTool("scorestudio_list_datasets", {
    title: "List datasets",
    description: "List versioned datasets in a Score Studio organization.",
    inputSchema: z.object({
      org_slug: z.string().min(1),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
      include_archived: z.boolean().default(false),
    }),
    annotations: readOnly,
  }, ({ org_slug, limit, offset, include_archived }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/datasets`,
    { query: { limit, offset, include_archived } },
  )));

  server.registerTool("scorestudio_get_dataset", {
    title: "Get dataset",
    description: "Get a dataset and its version lineage by organization and slug.",
    inputSchema: z.object({ org_slug: z.string().min(1), dataset_slug: z.string().min(1) }),
    annotations: readOnly,
  }, ({ org_slug, dataset_slug }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/datasets/${encodeURIComponent(dataset_slug)}`,
  )));

  server.registerTool("scorestudio_list_models", {
    title: "List models",
    description: "List models and versions in a Score Studio organization.",
    inputSchema: z.object({
      org_slug: z.string().min(1),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    annotations: readOnly,
  }, ({ org_slug, limit, offset }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/models`, { query: { limit, offset } },
  )));

  server.registerTool("scorestudio_start_training", {
    title: "Start training",
    description: "Start a tracked training job against an immutable dataset version. This may consume compute credits.",
    inputSchema: z.object({
      org_slug: z.string().min(1),
      dataset_slug: z.string().min(2).max(64),
      version_number: z.number().int().min(1).default(1),
      epochs: z.number().int().min(1).max(100).default(2),
      compute: z.enum(["local", "runpod", "lium"]).default("local"),
      preset: z.enum(["quick", "balanced", "accuracy"]).optional(),
      name: z.string().min(2).max(64).optional(),
      existing_model_slug: z.string().optional(),
      project_slug: z.string().optional(),
    }),
    annotations: write,
  }, ({ org_slug, ...body }) => call(() => api.request(
    "POST", `/v1/orgs/${encodeURIComponent(org_slug)}/train`, { body },
  )));

  server.registerTool("scorestudio_list_evaluations", {
    title: "List evaluations",
    description: "List measured evaluation runs and their current states.",
    inputSchema: z.object({ org_slug: z.string().min(1), limit: z.number().int().min(1).max(200).default(50) }),
    annotations: readOnly,
  }, ({ org_slug, limit }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/evals`, { query: { limit } },
  )));

  server.registerTool("scorestudio_start_evaluation", {
    title: "Start evaluation",
    description: "Create an immutable measured evaluation run for a model version and dataset version.",
    inputSchema: z.object({
      org_slug: z.string().min(1),
      model_version_id: z.uuid(),
      dataset_version_id: z.uuid(),
      task_type: z.enum(["detection", "classification", "segmentation"]).optional(),
      random_seed: z.number().int().min(0).max(2_147_483_647).default(0),
      idempotency_key: z.string().min(8).max(190).optional(),
      metric_config: z.record(z.string(), z.unknown()).default({}),
    }),
    annotations: write,
  }, ({ org_slug, ...body }) => call(() => api.request(
    "POST", `/v1/orgs/${encodeURIComponent(org_slug)}/evals`, { body },
  )));

  server.registerTool("scorestudio_get_evaluation_report", {
    title: "Get evaluation report",
    description: "Get metrics, slices, intervals, and evidence for an evaluation run.",
    inputSchema: z.object({ org_slug: z.string().min(1), run_id: z.uuid() }),
    annotations: readOnly,
  }, ({ org_slug, run_id }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/evals/${encodeURIComponent(run_id)}/report`,
  )));

  server.registerTool("scorestudio_list_deployments", {
    title: "List deployments",
    description: "List deployments, revisions, and runtime state in an organization.",
    inputSchema: z.object({
      org_slug: z.string().min(1),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    annotations: readOnly,
  }, ({ org_slug, limit, offset }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/deployments`, { query: { limit, offset } },
  )));

  server.registerTool("scorestudio_verify_deployment", {
    title: "Verify deployment",
    description: "Run and retain deployment health verification evidence without changing the active revision.",
    inputSchema: z.object({ org_slug: z.string().min(1), deployment_slug: z.string().min(1) }),
    annotations: write,
  }, ({ org_slug, deployment_slug }) => call(() => api.request(
    "POST", `/v1/orgs/${encodeURIComponent(org_slug)}/deployments/${encodeURIComponent(deployment_slug)}/verify`,
    { body: {} },
  )));

  server.registerTool("scorestudio_list_workflows", {
    title: "List workflows",
    description: "List typed Score Studio workflow definitions and status.",
    inputSchema: z.object({ org_slug: z.string().min(1) }),
    annotations: readOnly,
  }, ({ org_slug }) => call(() => api.request(
    "GET", `/v1/orgs/${encodeURIComponent(org_slug)}/workflows`,
  )));

  server.registerTool("scorestudio_run_workflow", {
    title: "Run workflow preview",
    description: "Run a workflow against an existing Score Studio image object. The result may report deferred blocks.",
    inputSchema: z.object({
      org_slug: z.string().min(1),
      workflow_slug: z.string().min(1),
      image_object_key: z.string().min(3).max(300),
    }),
    annotations: write,
  }, ({ org_slug, workflow_slug, image_object_key }) => call(() => api.request(
    "POST", `/v1/orgs/${encodeURIComponent(org_slug)}/workflows/${encodeURIComponent(workflow_slug)}/run`,
    { body: { image_object_key } },
  )));

  return server;
}
