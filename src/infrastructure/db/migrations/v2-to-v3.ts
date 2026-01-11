/**
 * Migration: v2 → v3 Schema
 *
 * Migrates from v2 (WhatsApp-coupled) to v3 (refactored model).
 *
 * Phases:
 * 1. Create new tables
 * 2. Migrate data
 * 3. Verify migration
 * 4. (Optional) Drop old tables
 */

import type { Database } from "bun:sqlite";

import {
  defaultChannels,
  defaultRelationshipCategories,
  defaultRelationshipTypes,
} from "../schema/seed";

// =============================================================================
// SQL STATEMENTS
// =============================================================================

const CREATE_TABLES_SQL = `
-- ============================================================================
-- PARTY PATTERN
-- ============================================================================

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  party_type TEXT NOT NULL CHECK (party_type IN ('individual', 'organization')),
  display_name TEXT NOT NULL,
  preferred_name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  notes TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);
CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);
CREATE INDEX IF NOT EXISTS idx_parties_display_name ON parties(display_name);

CREATE TABLE IF NOT EXISTS individuals (
  party_id TEXT PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  given_name TEXT,
  family_name TEXT,
  date_of_birth INTEGER,
  gender TEXT,
  pronouns TEXT,
  languages TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  party_id TEXT PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  legal_name TEXT,
  org_type TEXT CHECK (org_type IN ('company', 'team', 'community', 'family', 'other')),
  industry TEXT,
  size_range TEXT CHECK (size_range IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  website TEXT,
  parent_org_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(org_type);

-- ============================================================================
-- CHANNELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  icon TEXT,
  is_sync_enabled INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  config TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS contact_points (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  value TEXT NOT NULL,
  normalized TEXT,
  label TEXT,
  is_primary INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0,
  verified_at INTEGER,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_contact_points_party ON contact_points(party_id);
CREATE INDEX IF NOT EXISTS idx_contact_points_channel ON contact_points(channel_id);
CREATE INDEX IF NOT EXISTS idx_contact_points_channel_value ON contact_points(channel_id, normalized);

CREATE TABLE IF NOT EXISTS communication_preferences (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  preference_type TEXT DEFAULT 'allowed' CHECK (preference_type IN ('preferred', 'allowed', 'opt_out')),
  preferred_hours TEXT,
  preferred_days TEXT,
  notes TEXT,
  effective_from INTEGER DEFAULT (unixepoch()),
  effective_to INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_communication_preferences_party_channel ON communication_preferences(party_id, channel_id);

-- ============================================================================
-- RELATIONSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS relationship_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS relationship_types (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES relationship_categories(id),
  name TEXT NOT NULL UNIQUE,
  inverse_name TEXT,
  is_symmetric INTEGER DEFAULT 1,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_relationship_types_category ON relationship_types(category_id);

CREATE TABLE IF NOT EXISTS party_relationships (
  id TEXT PRIMARY KEY,
  relationship_type_id TEXT NOT NULL REFERENCES relationship_types(id),
  party_a_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  party_b_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role_a TEXT,
  role_b TEXT,
  strength_score INTEGER DEFAULT 0,
  effective_from INTEGER NOT NULL,
  effective_to INTEGER,
  notes TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_party_relationships_type ON party_relationships(relationship_type_id);
CREATE INDEX IF NOT EXISTS idx_party_relationships_party_a ON party_relationships(party_a_id);
CREATE INDEX IF NOT EXISTS idx_party_relationships_party_b ON party_relationships(party_b_id);
CREATE INDEX IF NOT EXISTS idx_party_relationships_effective ON party_relationships(effective_from, effective_to);

CREATE TABLE IF NOT EXISTS relationship_snapshots (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES party_relationships(id) ON DELETE CASCADE,
  snapshot_date INTEGER NOT NULL,
  period_type TEXT DEFAULT 'weekly' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  health_score INTEGER NOT NULL,
  factors TEXT NOT NULL,
  alerts TEXT,
  event_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_relationship_snapshots_date ON relationship_snapshots(relationship_id, snapshot_date);

CREATE TABLE IF NOT EXISTS engagement_metrics (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES party_relationships(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('streak', 'reciprocity', 'frequency', 'response_time')),
  metric_key TEXT NOT NULL,
  current_value INTEGER DEFAULT 0,
  best_value INTEGER DEFAULT 0,
  avg_value REAL,
  last_activity_at INTEGER,
  broken_at INTEGER,
  metadata TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_relationship ON engagement_metrics(relationship_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_type_key ON engagement_metrics(metric_type, metric_key);

-- ============================================================================
-- COMMUNICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations_v3 (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  external_id TEXT NOT NULL,
  conversation_type TEXT DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group', 'broadcast', 'thread')),
  title TEXT,
  description TEXT,
  is_archived INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  last_activity_at INTEGER,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_conversations_v3_channel_external ON conversations_v3(channel_id, external_id);
CREATE INDEX IF NOT EXISTS idx_conversations_v3_last_activity ON conversations_v3(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_conversations_v3_type ON conversations_v3(conversation_type);

CREATE TABLE IF NOT EXISTS conversation_participants_v3 (
  conversation_id TEXT NOT NULL REFERENCES conversations_v3(id) ON DELETE CASCADE,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY (conversation_id, party_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_v3_conversation ON conversation_participants_v3(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_v3_party ON conversation_participants_v3(party_id);

CREATE TABLE IF NOT EXISTS communication_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations_v3(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('message', 'call', 'meeting', 'reaction', 'system')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_party_id TEXT NOT NULL REFERENCES parties(id),
  channel_id TEXT NOT NULL REFERENCES channels(id),
  external_id TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  is_indexed INTEGER DEFAULT 0,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_communication_events_conversation ON communication_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_occurred_at ON communication_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_communication_events_from_party ON communication_events(from_party_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_channel_external ON communication_events(channel_id, external_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_type ON communication_events(event_type);
CREATE INDEX IF NOT EXISTS idx_communication_events_indexed ON communication_events(is_indexed);

CREATE TABLE IF NOT EXISTS messages_v3 (
  event_id TEXT PRIMARY KEY REFERENCES communication_events(id) ON DELETE CASCADE,
  content TEXT,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact')),
  media_url TEXT,
  media_mime_type TEXT,
  quoted_event_id TEXT REFERENCES communication_events(id),
  forwarded_from_party_id TEXT REFERENCES parties(id),
  reaction_emoji TEXT,
  is_starred INTEGER DEFAULT 0,
  edited_at INTEGER,
  deleted_at INTEGER,
  raw_metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_v3_quoted ON messages_v3(quoted_event_id);
CREATE INDEX IF NOT EXISTS idx_messages_v3_starred ON messages_v3(is_starred);
CREATE INDEX IF NOT EXISTS idx_messages_v3_content_type ON messages_v3(content_type);

CREATE TABLE IF NOT EXISTS calls_v3 (
  event_id TEXT PRIMARY KEY REFERENCES communication_events(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  duration_seconds INTEGER,
  call_status TEXT NOT NULL CHECK (call_status IN ('completed', 'missed', 'declined', 'failed', 'ongoing')),
  participants_count INTEGER DEFAULT 2
);

CREATE TABLE IF NOT EXISTS meetings_v3 (
  event_id TEXT PRIMARY KEY REFERENCES communication_events(id) ON DELETE CASCADE,
  meeting_title TEXT NOT NULL,
  location TEXT,
  duration_minutes INTEGER,
  attendees_count INTEGER,
  meeting_url TEXT,
  calendar_event_id TEXT
);

-- ============================================================================
-- ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_signals (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL UNIQUE REFERENCES parties(id) ON DELETE CASCADE,
  signal_data TEXT NOT NULL,
  sample_size INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  computed_at INTEGER DEFAULT (unixepoch()),
  valid_until INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_behavior_signals_party ON behavior_signals(party_id);
CREATE INDEX IF NOT EXISTS idx_behavior_signals_confidence ON behavior_signals(confidence);

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('party', 'relationship', 'conversation')),
  entity_id TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'forecast', 'recommendation', 'warning', 'milestone')),
  insight_key TEXT NOT NULL,
  insight_data TEXT NOT NULL,
  confidence REAL DEFAULT 0,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  model_version TEXT,
  generated_at INTEGER DEFAULT (unixepoch()),
  valid_until INTEGER,
  is_read INTEGER DEFAULT 0,
  is_dismissed INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_insights(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_key ON ai_insights(insight_key);
CREATE INDEX IF NOT EXISTS idx_ai_insights_generated ON ai_insights(generated_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_unread ON ai_insights(is_read, is_dismissed);

CREATE TABLE IF NOT EXISTS interaction_topics_v3 (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES communication_events(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  confidence REAL NOT NULL,
  extracted_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_interaction_topics_v3_event ON interaction_topics_v3(event_id);
CREATE INDEX IF NOT EXISTS idx_interaction_topics_v3_topic ON interaction_topics_v3(topic);

-- ============================================================================
-- EXTENSIBILITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  icon TEXT,
  description TEXT,
  tag_group TEXT,
  display_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS entity_tags (
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('party', 'relationship', 'conversation', 'event')),
  entity_id TEXT NOT NULL,
  applied_at INTEGER DEFAULT (unixepoch()),
  applied_by TEXT,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag_id);

CREATE TABLE IF NOT EXISTS custom_fields (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('party', 'relationship', 'conversation')),
  options TEXT,
  default_value TEXT,
  is_required INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type ON custom_fields(entity_type);

CREATE TABLE IF NOT EXISTS entity_custom_values (
  field_id TEXT NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('party', 'relationship', 'conversation')),
  entity_id TEXT NOT NULL,
  value TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (field_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_custom_values_entity ON entity_custom_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_custom_values_field ON entity_custom_values(field_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'archive', 'restore')),
  old_values TEXT,
  new_values TEXT,
  changed_fields TEXT,
  changed_by TEXT,
  changed_at INTEGER DEFAULT (unixepoch()),
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ============================================================================
-- SYNC
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_state_v3 (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  cursor TEXT,
  last_sync_at INTEGER,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  synced_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sync_state_v3_channel ON sync_state_v3(channel_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_v3_status ON sync_state_v3(last_sync_status);
`;

// =============================================================================
// DATA MIGRATION SQL
// =============================================================================

const MIGRATE_DATA_SQL = `
-- ============================================================================
-- MIGRATE contacts → parties + individuals/organizations
-- ============================================================================

INSERT OR IGNORE INTO parties (id, party_type, display_name, preferred_name, notes, created_at, updated_at)
SELECT
  id,
  CASE
    WHEN type = 'person' THEN 'individual'
    ELSE 'organization'
  END,
  display_name,
  preferred_name,
  notes,
  created_at,
  updated_at
FROM contacts;

INSERT OR IGNORE INTO individuals (party_id, given_name)
SELECT id, display_name
FROM contacts
WHERE type = 'person';

INSERT OR IGNORE INTO organizations (party_id, legal_name, org_type)
SELECT
  id,
  display_name,
  CASE
    WHEN type = 'business' THEN 'company'
    WHEN type = 'group' THEN 'community'
    ELSE 'other'
  END
FROM contacts
WHERE type IN ('business', 'group');

-- ============================================================================
-- MIGRATE contact_identifiers → contact_points
-- ============================================================================

INSERT OR IGNORE INTO contact_points (id, party_id, channel_id, value, normalized, is_primary, is_verified, verified_at, created_at)
SELECT
  id,
  contact_id,
  source,
  identifier,
  identifier,
  is_primary,
  CASE WHEN verified_at IS NOT NULL THEN 1 ELSE 0 END,
  verified_at,
  created_at
FROM contact_identifiers
WHERE source IN ('whatsapp', 'email', 'phone', 'telegram', 'linkedin');

-- ============================================================================
-- MIGRATE conversations → conversations_v3
-- ============================================================================

INSERT OR IGNORE INTO conversations_v3 (id, channel_id, external_id, conversation_type, title, is_archived, is_pinned, last_activity_at, created_at, updated_at)
SELECT
  id,
  source,
  source_conversation_id,
  CASE
    WHEN conversation_type = '1:1' THEN 'direct'
    ELSE conversation_type
  END,
  title,
  is_archived,
  is_pinned,
  last_activity_at,
  created_at,
  updated_at
FROM conversations;

-- ============================================================================
-- MIGRATE conversation_participants → conversation_participants_v3
-- ============================================================================

INSERT OR IGNORE INTO conversation_participants_v3 (conversation_id, party_id, role, joined_at, left_at)
SELECT conversation_id, contact_id, role, joined_at, left_at
FROM conversation_participants;

-- ============================================================================
-- MIGRATE interactions → communication_events
-- ============================================================================

INSERT OR IGNORE INTO communication_events (id, conversation_id, event_type, direction, from_party_id, channel_id, external_id, occurred_at, is_indexed, created_at)
SELECT
  id,
  conversation_id,
  interaction_type,
  direction,
  from_contact_id,
  source,
  source_interaction_id,
  occurred_at,
  is_indexed,
  created_at
FROM interactions;

-- ============================================================================
-- MIGRATE messages → messages_v3
-- ============================================================================

INSERT OR IGNORE INTO messages_v3 (event_id, content, content_type, media_url, media_mime_type, quoted_event_id, forwarded_from_party_id, reaction_emoji, is_starred, edited_at, deleted_at, raw_metadata)
SELECT
  interaction_id,
  content,
  content_type,
  media_url,
  media_mime_type,
  quoted_interaction_id,
  forwarded_from_contact_id,
  reaction_emoji,
  is_starred,
  edited_at,
  deleted_at,
  raw_metadata
FROM messages;

-- ============================================================================
-- MIGRATE calls → calls_v3
-- ============================================================================

INSERT OR IGNORE INTO calls_v3 (event_id, call_type, duration_seconds, call_status, participants_count)
SELECT interaction_id, call_type, duration_seconds, call_status, participants_count
FROM calls;

-- ============================================================================
-- MIGRATE meetings → meetings_v3
-- ============================================================================

INSERT OR IGNORE INTO meetings_v3 (event_id, meeting_title, location, duration_minutes, attendees_count)
SELECT interaction_id, meeting_title, location, duration_minutes, attendees_count
FROM meetings;

-- ============================================================================
-- MIGRATE user_signals → behavior_signals
-- ============================================================================

INSERT OR IGNORE INTO behavior_signals (id, party_id, signal_data, sample_size, confidence, computed_at, created_at, updated_at)
SELECT
  id,
  user_id,
  json_object(
    'avgResponseTimeMinutes', avg_response_time_minutes,
    'responseTimeP50', response_time_p50,
    'responseTimeP95', response_time_p95,
    'initiationRate', initiation_rate,
    'avgMessageLength', avg_message_length,
    'messageLengthStd', message_length_std,
    'medianMessageLength', median_message_length,
    'avgWordsPerMessage', avg_words_per_message,
    'emojiPerMessage', emoji_per_message,
    'emojiVariance', emoji_variance,
    'topEmojis', top_emojis,
    'emojiPosition', emoji_position,
    'exclamationRate', exclamation_rate,
    'questionRate', question_rate,
    'periodRate', period_rate,
    'ellipsisRate', ellipsis_rate,
    'commonGreetings', common_greetings,
    'commonEndings', common_endings,
    'commonPhrases', common_phrases,
    'fillerWords', filler_words,
    'asksFollowupQuestions', asks_followup_questions,
    'usesVoiceNotes', uses_voice_notes,
    'sendsMultipleMessages', sends_multiple_messages,
    'editsMessages', edits_messages,
    'activeHours', active_hours,
    'weekendVsWeekdayDiff', weekend_vs_weekday_diff
  ),
  message_count,
  confidence,
  last_computed_at,
  created_at,
  updated_at
FROM user_signals;

-- ============================================================================
-- MIGRATE interaction_topics → interaction_topics_v3
-- ============================================================================

INSERT OR IGNORE INTO interaction_topics_v3 (id, event_id, topic, confidence, extracted_at)
SELECT id, interaction_id, topic, confidence, extracted_at
FROM interaction_topics;

-- ============================================================================
-- MIGRATE sync_state → sync_state_v3
-- ============================================================================

INSERT OR IGNORE INTO sync_state_v3 (id, channel_id, cursor, last_sync_at, last_sync_status, error_message)
SELECT id, source, cursor, last_sync_at, last_sync_status, error_message
FROM sync_state;
`;

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

export interface MigrationResult {
  phase: string;
  success: boolean;
  rowsAffected?: number;
  error?: string;
}

/**
 * Run the full migration from v2 to v3
 */
export function runMigration(db: Database): MigrationResult[] {
  const results: MigrationResult[] = [];

  // Phase 1: Create new tables
  try {
    db.exec(CREATE_TABLES_SQL);
    results.push({ phase: "create_tables", success: true });
  } catch (error) {
    results.push({
      phase: "create_tables",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return results; // Stop if table creation fails
  }

  // Phase 2: Seed channels and relationship types
  try {
    const insertChannel = db.prepare(`
      INSERT OR IGNORE INTO channels (id, display_name, icon, is_sync_enabled, is_default)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const channel of defaultChannels) {
      insertChannel.run(
        channel.id,
        channel.displayName,
        channel.icon ?? null,
        channel.isSyncEnabled ? 1 : 0,
        channel.isDefault ? 1 : 0,
      );
    }

    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO relationship_categories (id, name, description, display_order)
      VALUES (?, ?, ?, ?)
    `);

    for (const category of defaultRelationshipCategories) {
      insertCategory.run(
        category.id,
        category.name,
        category.description ?? null,
        category.displayOrder ?? 0,
      );
    }

    const insertType = db.prepare(`
      INSERT OR IGNORE INTO relationship_types (id, category_id, name, inverse_name, is_symmetric, description, icon, color, is_system)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const type of defaultRelationshipTypes) {
      insertType.run(
        type.id,
        type.categoryId ?? null,
        type.name,
        type.inverseName ?? null,
        type.isSymmetric ? 1 : 0,
        type.description ?? null,
        type.icon ?? null,
        type.color ?? null,
        type.isSystem ? 1 : 0,
      );
    }

    results.push({ phase: "seed_data", success: true });
  } catch (error) {
    results.push({
      phase: "seed_data",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Phase 3: Migrate data
  try {
    db.exec(MIGRATE_DATA_SQL);
    results.push({ phase: "migrate_data", success: true });
  } catch (error) {
    results.push({
      phase: "migrate_data",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

/**
 * Verify migration was successful
 */
export function verifyMigration(db: Database): {
  success: boolean;
  counts: Record<string, number>;
  issues: string[];
} {
  const counts: Record<string, number> = {};
  const issues: string[] = [];

  // Count records in new tables
  const tables = [
    "parties",
    "individuals",
    "organizations",
    "contact_points",
    "conversations_v3",
    "communication_events",
    "messages_v3",
    "behavior_signals",
  ];

  for (const table of tables) {
    try {
      const result = db.query(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      counts[table] = result.count;
    } catch {
      counts[table] = -1;
      issues.push(`Could not count ${table}`);
    }
  }

  // Compare with old tables
  const comparisons = [
    { old: "contacts", new: "parties" },
    { old: "contact_identifiers", new: "contact_points" },
    { old: "conversations", new: "conversations_v3" },
    { old: "interactions", new: "communication_events" },
    { old: "messages", new: "messages_v3" },
  ];

  for (const { old: oldTable, new: newTable } of comparisons) {
    try {
      const oldCount = (db.query(`SELECT COUNT(*) as count FROM ${oldTable}`).get() as { count: number }).count;
      const newCount = counts[newTable];

      if (oldCount !== newCount) {
        issues.push(`Mismatch: ${oldTable}(${oldCount}) → ${newTable}(${newCount})`);
      }
    } catch {
      // Old table might not exist
    }
  }

  return {
    success: issues.length === 0,
    counts,
    issues,
  };
}
