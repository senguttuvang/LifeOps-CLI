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

// Database port - domain services use this for persistence
export { DatabaseService } from "../../infrastructure/db/client";

// Vector store port - domain services use this for RAG operations
export { VectorStoreService, type Document, type VectorStore } from "../../infrastructure/rag/vector.store";

// AI service port - domain services use this for LLM operations
export { AIServiceTag, type AIService, type AIMessage, type AIProvider } from "../../infrastructure/llm/ai.service";

// WhatsApp service port - domain services use this for WhatsApp operations
export { WhatsAppServiceTag, type WhatsAppService } from "../../infrastructure/whatsapp/whatsapp.client";

// WhatsApp types needed by domain
export type {
  WhatsAppSyncResult,
  WhatsAppChatData,
  WhatsAppMessageData,
  WhatsAppAuthStatus,
} from "../../infrastructure/whatsapp/whatsapp.types";

// WhatsApp adapter port
export { WhatsAppAdapterTag, type WhatsAppAdapter } from "../../infrastructure/adapters/whatsapp/whatsapp.adapter";
