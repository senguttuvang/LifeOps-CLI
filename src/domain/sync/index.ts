/**
 * WhatsApp Sync Domain
 *
 * Two-phase sync: dump all → select contacts → import selected.
 *
 * @module domain/sync
 */

// Types
export * from "./types";

// Contact Discovery
export {
  ContactDiscoveryService,
  ContactDiscoveryServiceLive,
  ContactDiscoveryServiceTag,
} from "./contact-discovery.service";

// Dump Adapter (converts raw dump to WhatsAppSyncResult)
export {
  DumpAdapterService,
  DumpAdapterServiceLive,
  DumpAdapterServiceTag,
} from "./dump-adapter.service";
