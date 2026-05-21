// 호출한 쪽의 요청 때문에 실패한 경우만 이 타입으로 던진다. HTTP 경계가 code를 상태코드로 바꾼다.
// 그 밖의 Error는 저장소 내부 실패로 보고 500으로 남긴다.
export type RepositoryErrorCode = "not_found" | "tournament_full" | "self_friend_request";

export class RepositoryError extends Error {
  constructor(
    readonly code: RepositoryErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
