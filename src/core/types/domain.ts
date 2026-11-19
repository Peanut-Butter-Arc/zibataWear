import type { CategoryId, ConditionId, ListingMode } from "../constants/zibata";

export type ListingStatus = "active" | "reserved" | "rented" | "sold" | "paused";

export type OrderType = "buy" | "rent";

export type OrderStatus =
  | "pending"
  | "paid"
  | "demo_paid"
  | "active_rental"
  | "completed"
  | "cancelled"
  | "refunded";

export interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  email_domain: string;
  university: string;
  major: string;
  campus_zone: string;
  bio: string;
  is_student_verified: boolean;
  is_demo: boolean;
  rating: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  brand: string;
  category: CategoryId;
  size: string;
  condition: ConditionId;
  listing_mode: ListingMode;
  sale_price_mxn: number | null;
  rent_price_per_day_mxn: number | null;
  security_deposit_mxn: number;
  original_price_mxn: number | null;
  recommended_sale_price_mxn: number | null;
  recommended_rent_price_mxn: number | null;
  meetup_zone: string;
  images: string[];
  tags: string[];
  status: ListingStatus;
  is_featured: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface ListingWithSeller extends Listing {
  seller: Profile;
}

export interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_text: string;
  last_message_at: string;
  created_at: string;
}

export interface ConversationWithDetails extends Conversation {
  listing: Pick<
    Listing,
    "id" | "title" | "images" | "sale_price_mxn" | "rent_price_per_day_mxn" | "listing_mode" | "meetup_zone" | "status"
  > | null;
  buyer: Profile | null;
  seller: Profile | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  order_type: OrderType;
  status: OrderStatus;
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_days: number | null;
  subtotal_mxn: number;
  deposit_mxn: number;
  service_fee_mxn: number;
  total_mxn: number;
  meetup_zone: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_provider: "stripe" | "stripe_sandbox_demo";
  created_at: string;
  updated_at: string;
}

export interface OrderWithDetails extends Order {
  listing: Pick<Listing, "id" | "title" | "brand" | "images" | "size" | "meetup_zone"> | null;
  buyer?: Profile | null;
  seller?: Profile | null;
}

export interface PriceRecommendationInput {
  category: CategoryId;
  brand: string;
  condition: ConditionId;
  size?: string;
  originalPriceMxn?: number | null;
  meetupZone?: string;
  listingMode?: ListingMode;
}

export interface PriceRecommendation {
  recommendedSalePriceMxn: number;
  quickSalePriceMxn: number;
  maxMarketPriceMxn: number;
  recommendedRentPerDayMxn: number;
  recommendedWeekendPackMxn: number;
  recommendedDepositMxn: number;
  demandScore: number;
  demandLabel: "Alta demanda en Zibatá" | "Demanda constante" | "Nicho curado";
  suggestedTitle: string;
  suggestedDescription: string;
  insights: string[];
}

export interface CheckoutPayload {
  listingId: string;
  orderType: OrderType;
  rentalStartDate?: string;
  rentalEndDate?: string;
  meetupZone?: string;
}

export interface CheckoutResult {
  order: Order;
  checkoutUrl: string;
  mode: "stripe_live_or_test" | "stripe_sandbox_demo";
}
