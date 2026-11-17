import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { LRUCache } from "lru-cache";
import type { SessionUser } from "@pong-pong/shared";
import { createRawWsTicket, hashWsTicket, WS_TICKET_TTL_SECONDS } from "./wsTicket.js";

export const GUEST_SESSION_TTL_SECONDS = 2 * 60 * 60;
export const DEFAULT_GUEST_CREATION_LIMIT_PER_MINUTE = 10;
export const DEFAULT_GUEST_CONNECTIONS_PER_IP = 4;
export const DEFAULT_GUEST_CONNECTION_LIMIT = 200;
export const DEFAULT_GUEST_TICKET_LIMIT = 400;
export const DEFAULT_GUEST_TRACKED_IP_LIMIT = 10_000;
export const DEFAULT_GUEST_TICKETS_PER_IP = 4;
export const DEFAULT_GUEST_TICKET_ISSUE_LIMIT_PER_MINUTE = 30;

const CREATION_WINDOW_MS = 60_000;

export type GuestSessionUser = SessionUser & {
  sessionKind: "guest";
};

type GuestPayload = {
  v: 1;
  user: GuestSessionUser;
  ip: string;
  expiresAtMs: number;
};

type GuestAccessOptions = {
  secret: string;
  clock?: () => number;
  creationLimitPerMinute?: number;
  connectionsPerIp?: number;
  connectionLimit?: number;
  ticketLimit?: number;
  trackedIpLimit?: number;
  ticketsPerIp?: number;
  ticketIssueLimitPerMinute?: number;
};

type ConnectionLease = {
  release(): void;
};

export class GuestAccessError extends Error {
  constructor(
    readonly code:
      | "guest_creation_rate_limited"
      | "guest_creation_capacity_reached"
      | "guest_ticket_limit_reached"
      | "guest_ticket_ip_limit_reached"
      | "guest_ticket_rate_limited",
    message: string
  ) {
    super(message);
    this.name = "GuestAccessError";
  }
}

export class GuestAccess {
  private readonly clock: () => number;
  private readonly creationLimitPerMinute: number;
  private readonly connectionsPerIp: number;
  private readonly connectionLimit: number;
  private readonly ticketLimit: number;
  private readonly trackedIpLimit: number;
  private readonly ticketsPerIp: number;
  private readonly ticketIssueLimitPerMinute: number;
  private readonly creationsByIp: LRUCache<string, RollingWindow>;
  private readonly ticketIssuesByIp: LRUCache<string, RollingWindow>;
  private readonly tickets: LRUCache<string, {
    user: GuestSessionUser;
    ip: string;
    expiresAtMs: number;
  }>;
  private readonly ticketHashByGuest = new Map<string, string>();
  private readonly connections = new Map<string, { ip: string; leaseId: string }>();

  constructor(private readonly options: GuestAccessOptions) {
    if (Buffer.byteLength(options.secret, "utf8") < 32) {
      throw new Error("Guest session secret must be at least 32 bytes");
    }
    this.clock = options.clock ?? Date.now;
    this.creationLimitPerMinute = options.creationLimitPerMinute ?? DEFAULT_GUEST_CREATION_LIMIT_PER_MINUTE;
    this.connectionsPerIp = options.connectionsPerIp ?? DEFAULT_GUEST_CONNECTIONS_PER_IP;
    this.connectionLimit = options.connectionLimit ?? DEFAULT_GUEST_CONNECTION_LIMIT;
    this.ticketLimit = options.ticketLimit ?? DEFAULT_GUEST_TICKET_LIMIT;
    this.trackedIpLimit = options.trackedIpLimit ?? DEFAULT_GUEST_TRACKED_IP_LIMIT;
    this.ticketsPerIp = options.ticketsPerIp ?? DEFAULT_GUEST_TICKETS_PER_IP;
    this.ticketIssueLimitPerMinute = options.ticketIssueLimitPerMinute
      ?? DEFAULT_GUEST_TICKET_ISSUE_LIMIT_PER_MINUTE;

    this.creationsByIp = new LRUCache({ max: this.trackedIpLimit + 1 });
    this.ticketIssuesByIp = new LRUCache({ max: this.trackedIpLimit + 1 });
    this.tickets = new LRUCache({
      max: this.ticketLimit + 1,
      dispose: (value, key) => {
        if (this.ticketHashByGuest.get(value.user.id) === key) {
          this.ticketHashByGuest.delete(value.user.id);
        }
      }
    });
  }

  get activeConnectionCount(): number {
    return this.connections.size;
  }

  get activeTicketCount(): number {
    this.pruneExpired(this.tickets);
    return this.tickets.size;
  }

  get trackedCreationIpCount(): number {
    this.pruneExpired(this.creationsByIp);
    return this.creationsByIp.size;
  }

  createSession(ip: string): {
    user: GuestSessionUser;
    cookieValue: string;
    expiresInSeconds: number;
  } {
    this.recordCreation(ip);
    const handleSuffix = randomBytes(6).toString("hex");
    const user: GuestSessionUser = {
      id: randomUUID(),
      handle: `guest-${handleSuffix}`,
      displayName: `게스트 ${randomInt(1_000, 10_000)}`,
      avatarKey: "default",
      role: "user",
      status: "active",
      rating: 1_200,
      wins: 0,
      losses: 0,
      online: true,
      isNpc: false,
      email: null,
      sessionKind: "guest"
    };
    const payload: GuestPayload = {
      v: 1,
      user,
      ip,
      expiresAtMs: this.clock() + (GUEST_SESSION_TTL_SECONDS * 1_000)
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return {
      user,
      cookieValue: `${encoded}.${this.sign(encoded)}`,
      expiresInSeconds: GUEST_SESSION_TTL_SECONDS
    };
  }

  authenticate(cookieValue: string | undefined, expectedIp?: string): GuestSessionUser | null {
    if (!cookieValue) return null;
    const separator = cookieValue.lastIndexOf(".");
    if (separator <= 0) return null;
    const encoded = cookieValue.slice(0, separator);
    const signature = cookieValue.slice(separator + 1);
    if (!secureEqual(signature, this.sign(encoded))) return null;

    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GuestPayload;
      if (
        payload.v !== 1
        || payload.user?.sessionKind !== "guest"
        || payload.user.role !== "user"
        || payload.user.status !== "active"
        || !Number.isFinite(payload.expiresAtMs)
        || this.clock() >= payload.expiresAtMs
        || (expectedIp !== undefined && payload.ip !== expectedIp)
      ) {
        return null;
      }
      return payload.user;
    } catch {
      return null;
    }
  }

  issueWsTicket(user: GuestSessionUser, ip: string): string {
    this.pruneExpired(this.tickets);
    this.recordTicketIssue(ip);
    const previousHash = this.ticketHashByGuest.get(user.id);
    if (previousHash) {
      this.tickets.delete(previousHash);
    }
    const pendingForIp = [...this.tickets.values()].filter((ticket) => ticket.ip === ip).length;
    if (pendingForIp >= this.ticketsPerIp) {
      throw new GuestAccessError(
        "guest_ticket_ip_limit_reached",
        "이 네트워크의 게스트 연결 요청이 많습니다. 잠시 후 다시 시도해주세요."
      );
    }
    if (this.tickets.size >= this.ticketLimit) {
      throw new GuestAccessError(
        "guest_ticket_limit_reached",
        "게스트 연결 요청이 많습니다. 잠시 후 다시 시도해주세요."
      );
    }
    const ticket = createRawWsTicket();
    const ticketHash = hashWsTicket(ticket);
    const ttlMs = WS_TICKET_TTL_SECONDS * 1_000;
    this.tickets.set(ticketHash, { user, ip, expiresAtMs: this.clock() + ttlMs });
    this.ticketHashByGuest.set(user.id, ticketHash);
    setTimeout(() => this.pruneExpired(this.tickets), ttlMs).unref();
    return ticket;
  }

  consumeWsTicket(ticketHash: string): GuestSessionUser | null {
    this.pruneExpired(this.tickets);
    const stored = this.tickets.get(ticketHash);
    this.tickets.delete(ticketHash);
    return stored?.user ?? null;
  }

  acquireConnection(ip: string, guestId: string): ConnectionLease | null {
    const current = this.connections.get(guestId);
    const leaseId = randomUUID();
    if (current) {
      if (current.ip !== ip) {
        const connectionsForIp = [...this.connections.values()]
          .filter((connection) => connection.ip === ip).length;
        if (connectionsForIp >= this.connectionsPerIp) return null;
      }
      this.connections.set(guestId, { ip, leaseId });
      return this.lease(guestId, leaseId);
    }

    const connectionsForIp = [...this.connections.values()].filter((connection) => connection.ip === ip).length;
    if (connectionsForIp >= this.connectionsPerIp || this.connections.size >= this.connectionLimit) {
      return null;
    }
    this.connections.set(guestId, { ip, leaseId });
    return this.lease(guestId, leaseId);
  }

  private recordCreation(ip: string): void {
    this.recordWindowEvent({
      store: this.creationsByIp,
      key: ip,
      limit: this.creationLimitPerMinute,
      capacityCode: "guest_creation_capacity_reached",
      rateCode: "guest_creation_rate_limited",
      capacityMessage: "게스트 생성 요청을 추적할 수 있는 네트워크 수를 초과했습니다.",
      rateMessage: "게스트 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
    });
  }

  private recordTicketIssue(ip: string): void {
    this.recordWindowEvent({
      store: this.ticketIssuesByIp,
      key: ip,
      limit: this.ticketIssueLimitPerMinute,
      capacityCode: "guest_ticket_rate_limited",
      rateCode: "guest_ticket_rate_limited",
      capacityMessage: "게스트 연결 요청이 많습니다. 잠시 후 다시 시도해주세요.",
      rateMessage: "게스트 연결 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요."
    });
  }

  private lease(guestId: string, leaseId: string): ConnectionLease {
    return {
      release: () => {
        if (this.connections.get(guestId)?.leaseId === leaseId) this.connections.delete(guestId);
      }
    };
  }

  private recordWindowEvent(options: {
    store: LRUCache<string, RollingWindow>;
    key: string;
    limit: number;
    capacityCode: GuestAccessError["code"];
    rateCode: GuestAccessError["code"];
    capacityMessage: string;
    rateMessage: string;
  }): void {
    this.pruneExpired(options.store);
    const nowMs = this.clock();
    const existing = options.store.get(options.key);
    const recent = (existing?.timestamps ?? []).filter((createdAt) => createdAt > nowMs - CREATION_WINDOW_MS);
    if (!existing && options.store.size >= this.trackedIpLimit) {
      throw new GuestAccessError(options.capacityCode, options.capacityMessage);
    }
    if (recent.length >= options.limit) {
      throw new GuestAccessError(options.rateCode, options.rateMessage);
    }
    recent.push(nowMs);
    options.store.set(options.key, { timestamps: recent, expiresAtMs: nowMs + CREATION_WINDOW_MS });
    setTimeout(() => this.pruneExpired(options.store), CREATION_WINDOW_MS).unref();
  }

  private pruneExpired<T extends { expiresAtMs: number }>(store: LRUCache<string, T>): void {
    const nowMs = this.clock();
    for (const [key, entry] of store.entries()) {
      if (nowMs >= entry.expiresAtMs) store.delete(key);
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.options.secret).update(payload, "utf8").digest("base64url");
  }
}

type RollingWindow = {
  timestamps: number[];
  expiresAtMs: number;
};

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer);
}
