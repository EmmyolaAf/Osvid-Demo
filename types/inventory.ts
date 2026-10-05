/**
 * Types for Inventory Ledger & Movements (Work Packet 3)
 */

export type InventoryMovementType =
  | "initial_stock"
  | "restock"
  | "manual_adjustment"
  | "correction"
  | "damaged"
  | "sale"
  | "return"
  | "cancellation"
  | "other";

export interface InventoryMovement {
  id: string; // True deterministic requestId or generated movement ID
  productId: string;
  productName: string;
  sku: string;
  delta: number; // Positive or negative non-zero integer
  previousStock: number;
  newStock: number;
  type: InventoryMovementType;
  reason: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  orderId?: string;
  reference?: string;
  requestId: string; // True idempotency key
  createdAt: any; // Firestore Timestamp
  createdAtIso: string; // ISO 8601 string
}

export interface InventoryAdjustmentRequest {
  productId: string;
  delta: number;
  type: InventoryMovementType;
  reason?: string;
  requestId: string;
  orderId?: string;
  reference?: string;
}

export interface InventoryAdjustmentResponse {
  success: boolean;
  previousStock: number;
  newStock: number;
  movementId: string;
  replayed: boolean;
  message?: string;
}
