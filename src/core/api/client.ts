import type {
  CheckoutPayload,
  CheckoutResult,
  ConversationWithDetails,
  ListingWithSeller,
  Message,
  OrderWithDetails,
  PriceRecommendation,
  PriceRecommendationInput,
  Profile,
} from "../types/domain";

export interface ZibataApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
}

export interface ListingsFilterQuery {
  q?: string;
  category?: string;
  mode?: "all" | "buy" | "rent";
  size?: string;
  zone?: string;
  sort?: "recent" | "price_asc" | "price_desc";
  mine?: boolean;
}

export class ZibataApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ZibataApiError";
    this.status = status;
  }
}

/**
 * Framework-agnostic API client shared by Web, iOS, and Android (React Native / Capacitor).
 * Uses Bearer JWT when `getAccessToken` is provided (mobile) or browser cookies automatically on web.
 */
export class ZibataApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => Promise<string | null>;

  constructor(config: ZibataApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.getAccessToken = config.getAccessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (this.getAccessToken) {
      const token = await this.getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ZibataApiError(
        typeof data?.error === "string" ? data.error : `Request failed (${res.status})`,
        res.status
      );
    }
    return data as T;
  }

  async getListings(filters: ListingsFilterQuery = {}): Promise<{ listings: ListingWithSeller[] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== false && value !== "all") {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    return this.request(`/api/v1/listings${qs ? `?${qs}` : ""}`);
  }

  async getListing(id: string): Promise<{ listing: ListingWithSeller }> {
    return this.request(`/api/v1/listings/${encodeURIComponent(id)}`);
  }

  async recommendPrice(input: PriceRecommendationInput): Promise<{ recommendation: PriceRecommendation }> {
    return this.request("/api/v1/pricing/recommend", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getProfile(): Promise<{ profile: Profile | null }> {
    return this.request("/api/v1/profile");
  }

  async updateProfile(payload: Partial<Profile>): Promise<{ profile: Profile }> {
    return this.request("/api/v1/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getFavorites(): Promise<{ favoriteIds: string[]; listings: ListingWithSeller[] }> {
    return this.request("/api/v1/favorites");
  }

  async toggleFavorite(listingId: string): Promise<{ favorited: boolean }> {
    return this.request("/api/v1/favorites", {
      method: "POST",
      body: JSON.stringify({ listingId }),
    });
  }

  async getConversations(): Promise<{ conversations: ConversationWithDetails[] }> {
    return this.request("/api/v1/conversations");
  }

  async startConversation(listingId: string): Promise<{ conversation: ConversationWithDetails }> {
    return this.request("/api/v1/conversations", {
      method: "POST",
      body: JSON.stringify({ listingId }),
    });
  }

  async getMessages(conversationId: string): Promise<{ messages: Message[] }> {
    return this.request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`);
  }

  async sendMessage(conversationId: string, body: string): Promise<{ message: Message }> {
    return this.request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async createCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
    return this.request("/api/v1/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getOrders(): Promise<{ purchases: OrderWithDetails[]; sales: OrderWithDetails[] }> {
    return this.request("/api/v1/orders");
  }
}
