/**
 * Domain Ports
 *
 * Re-exports infrastructure service Tags for domain use.
 * Domain services should import from here, not directly from infrastructure.
 *
 * This creates an anti-corruption layer between domain and infrastructure,
 * allowing infrastructure implementations to change without affecting domain code.
 *
 * Pattern: Domain → Ports → Infrastructure (dependency inversion)
 */

// WhatsApp adapter port
export { type WhatsAppAdapter, WhatsAppAdapterTag } from "../../infrastructure/adapters/whatsapp/whatsapp.adapter";
// Database port - domain services use this for persistence
export { DatabaseService } from "../../infrastructure/db/client";

// AI service port - domain services use this for LLM operations
export { type AIMessage, type AIProvider, type AIService, AIServiceTag } from "../../infrastructure/llm/ai.service";
// Vector store port - domain services use this for RAG operations
export { type Document, type VectorStore, VectorStoreService } from "../../infrastructure/rag/vector.store";
// WhatsApp service port - domain services use this for WhatsApp operations
export { type WhatsAppService, WhatsAppServiceTag } from "../../infrastructure/whatsapp/whatsapp.client";
// WhatsApp types needed by domain
export type {
  WhatsAppAuthStatus,
  WhatsAppChatData,
  WhatsAppMessageData,
  WhatsAppSyncResult,
} from "../../infrastructure/whatsapp/whatsapp.types";
