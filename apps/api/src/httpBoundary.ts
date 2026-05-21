import type { FastifyReply, FastifyRequest } from "fastify";
import { RepositoryError, type RepositoryErrorCode } from "@pong-pong/db";
import { apiErrorBodySchema, type ApiErrorBody } from "@pong-pong/shared";
import type { ZodType } from "zod";

export class ApiHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

// 요청 때문에 실패한 저장소 오류를 상태코드로 바꾼다. 서버 장애(500)와 구분해야 화면이 원인을 보여 줄 수 있다.
const repositoryErrorResponses: Record<RepositoryErrorCode, { statusCode: number; message: string }> = {
  not_found: { statusCode: 404, message: "요청한 대상을 찾을 수 없습니다." },
  tournament_full: { statusCode: 409, message: "참가 인원이 가득 찬 토너먼트입니다." },
  self_friend_request: { statusCode: 400, message: "자기 자신에게는 친구 요청을 보낼 수 없습니다." }
};

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "request";
    (fieldErrors[field] ??= []).push(issue.message);
  }
  throw new ApiHttpError(
    400,
    "validation_error",
    "입력값을 확인해주세요.",
    Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
  );
}

export function parseHttpRequest<Params, Query, Body>(
  contract: {
    params: ZodType<Params>;
    query: ZodType<Query>;
    body: ZodType<Body>;
  },
  request: FastifyRequest
): { params: Params; query: Query; body: Body } {
  return {
    params: parseInput(contract.params, request.params ?? {}),
    query: parseInput(contract.query, request.query ?? {}),
    body: parseInput(contract.body, request.body ?? {})
  };
}

export function parseOutput<T>(schema: ZodType<T>, output: unknown): T {
  const result = schema.safeParse(output);
  if (result.success) return result.data;

  throw new Error("HTTP response contract validation failed", { cause: result.error });
}

export function sendApiError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      requestId: String(request.id),
      ...(fieldErrors ? { fieldErrors } : {})
    }
  };

  return reply.code(statusCode).send(apiErrorBodySchema.parse(body));
}

export function installHttpErrorBoundary(app: import("fastify").FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    sendApiError(reply, request, 404, "not_found", "요청한 경로를 찾을 수 없습니다.");
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiHttpError) {
      sendApiError(reply, request, error.statusCode, error.code, error.message, error.fieldErrors);
      return;
    }
    if (error instanceof RepositoryError) {
      const response = repositoryErrorResponses[error.code];
      sendApiError(reply, request, response.statusCode, error.code, response.message);
      return;
    }
    // 잘못된 JSON 본문, 지원하지 않는 content-type, 너무 큰 본문처럼 Fastify가 4xx로 표시한 오류는
    // 요청 문제라 그 상태코드를 유지한다. 내부 메시지는 노출하지 않는다.
    const statusCode = clientErrorStatusCode(error);
    if (statusCode !== null) {
      sendApiError(reply, request, statusCode, "bad_request", "요청 형식을 확인해주세요.");
      return;
    }

    request.log.error({ err: error }, "request failed");
    sendApiError(reply, request, 500, "internal_error", "요청을 처리하지 못했습니다.");
  });
}

function clientErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  const { statusCode } = error;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : null;
}

export function unauthorized(): never {
  throw new ApiHttpError(401, "authentication_required", "로그인이 필요합니다.");
}

export function suspended(): never {
  throw new ApiHttpError(403, "account_suspended", "정지된 계정은 이 작업을 수행할 수 없습니다.");
}

export function forbidden(): never {
  throw new ApiHttpError(403, "admin_required", "운영자 권한이 필요합니다.");
}

export function notFound(message: string): never {
  throw new ApiHttpError(404, "not_found", message);
}
