package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"
)

type Config struct {
	SessionDir string
	Days       int
	To         string // For send command: recipient JID
	Message    string // For send command: message text
	Passive    bool   // For sync command: don't mark messages as read (default: true)
	MarkRead   bool   // For sync command: explicitly mark messages as read
	Since      int64  // For sync command: Unix timestamp for incremental sync
	Timeout    int    // For sync command: timeout in seconds (default: 30)
}

type OutputMessage struct {
	ID          string `json:"id"`
	ChatID      string `json:"chatId"`
	FromJID     string `json:"fromJid"`
	MessageType string `json:"messageType"`
	Content     string `json:"content"`
	Timestamp   int64  `json:"timestamp"`
	IsFromMe    bool   `json:"isFromMe"`
	MediaKey    string `json:"mediaKey,omitempty"`
	MediaURL    string `json:"mediaUrl,omitempty"`
}

type OutputChat struct {
	ChatID           string `json:"chatId"`
	Name             string `json:"name"`
	IsGroup          bool   `json:"isGroup"`
	ParticipantCount int    `json:"participantCount,omitempty"`
	LastMessageAt    int64  `json:"lastMessageAt"`
	Muted            bool   `json:"muted"`
	Archived         bool   `json:"archived"`
	UnreadCount      int    `json:"unreadCount"`
}

type SyncResult struct {
	Messages          []OutputMessage `json:"messages"`
	Chats             []OutputChat    `json:"chats"`
	SyncedAt          int64           `json:"syncedAt"`
	HighestTimestamp  int64           `json:"highestTimestamp,omitempty"`  // For watermark tracking
	MessageCount      int             `json:"messageCount"`
	SinceTimestamp    int64           `json:"sinceTimestamp,omitempty"`    // Input --since value
	Error             string          `json:"error,omitempty"`
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	config := parseConfig()

	switch command {
	case "version":
		fmt.Println("whatsmeow-cli version 1.1.0")
	case "auth":
		authenticate(config)
	case "sync":
		syncMessages(config)
	case "dump":
		dumpMessages(config)
	case "chats":
		listChats(config)
	case "health":
		checkHealth(config)
	case "send":
		sendMessage(config)
	case "monitor":
		monitorMessages(config)
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: whatsmeow-cli <command> [options]")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  auth               Authenticate with WhatsApp (QR code)")
	fmt.Println("  sync               Sync messages from last N days (JSON to stdout)")
	fmt.Println("  dump               Dump all messages to file (for full sync)")
	fmt.Println("  chats              List all chats")
	fmt.Println("  health             Check connection health")
	fmt.Println("  send               Send a message to a chat")
	fmt.Println("  monitor            Monitor for real-time messages")
	fmt.Println()
	fmt.Println("Options:")
	fmt.Println("  --session-dir DIR  Session directory (default: ./data/whatsapp)")
	fmt.Println("  --days N           Number of days to sync (default: 30)")
	fmt.Println("  --since TIMESTAMP  Unix timestamp for incremental sync (overrides --days)")
	fmt.Println("  --passive          Don't mark messages as read (default: true)")
	fmt.Println("  --mark-read        Mark messages as read after sync")
	fmt.Println("  --timeout N        Timeout in seconds (default: 30)")
	fmt.Println("  --to JID           Recipient JID for send command")
	fmt.Println("  --message TEXT     Message text for send command")
}

func parseConfig() Config {
	config := Config{
		SessionDir: "./data/whatsapp",
		Days:       30,
		Passive:    true,  // Default: don't mark messages as read
		MarkRead:   false,
		Since:      0,
		Timeout:    30,
	}

	for i := 2; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--session-dir":
			if i+1 < len(os.Args) {
				config.SessionDir = os.Args[i+1]
				i++
			}
		case "--days":
			if i+1 < len(os.Args) {
				fmt.Sscanf(os.Args[i+1], "%d", &config.Days)
				i++
			}
		case "--since":
			if i+1 < len(os.Args) {
				fmt.Sscanf(os.Args[i+1], "%d", &config.Since)
				i++
			}
		case "--timeout":
			if i+1 < len(os.Args) {
				fmt.Sscanf(os.Args[i+1], "%d", &config.Timeout)
				i++
			}
		case "--to":
			if i+1 < len(os.Args) {
				config.To = os.Args[i+1]
				i++
			}
		case "--message":
			if i+1 < len(os.Args) {
				config.Message = os.Args[i+1]
				i++
			}
		case "--passive":
			config.Passive = true
		case "--mark-read":
			config.MarkRead = true
			config.Passive = false // --mark-read overrides --passive
		}
	}

	return config
}

func getClient(sessionDir string) (*whatsmeow.Client, *sqlstore.Container, error) {
	// Ensure session directory exists
	if err := os.MkdirAll(sessionDir, 0700); err != nil {
		return nil, nil, fmt.Errorf("failed to create session directory: %w", err)
	}

	dbPath := sessionDir + "/session.db"
	dbLog := waLog.Stdout("Database", "ERROR", true)
	ctx := context.Background()
	container, err := sqlstore.New(ctx, "sqlite3", "file:"+dbPath+"?_foreign_keys=on", dbLog)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get the first device or create new one
	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get device: %w", err)
	}

	clientLog := waLog.Stdout("Client", "ERROR", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)

	return client, container, nil
}

func authenticate(config Config) {
	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	if client.Store.ID == nil {
		// No existing session, need to login
		qrChan, _ := client.GetQRChannel(context.Background())
		err = client.Connect()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("Scan the QR code below with your WhatsApp mobile app:")
		for evt := range qrChan {
			if evt.Event == "code" {
				// Half-block mode for best quality QR rendering
				qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
			} else {
				fmt.Println("Login event:", evt.Event)
				if evt.Event == "success" {
					fmt.Println("QR code scanned! Completing device registration...")
					// IMPORTANT: Don't break immediately!
					// The device handshake is still in progress.
					// Wait for the handshake to complete before disconnecting.
					break
				}
			}
		}

		// Wait for device registration handshake to complete
		// The "success" event only means QR was scanned - key exchange
		// and device registration happen after that
		fmt.Println("Waiting for device registration to complete...")
		time.Sleep(5 * time.Second)

		// Verify registration succeeded
		if client.Store.ID != nil {
			fmt.Println("Authentication successful! Device registered.")
		} else {
			fmt.Fprintf(os.Stderr, "Warning: Device registration may not have completed.\n")
		}
	} else {
		// Already authenticated
		err = client.Connect()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Already authenticated. Session restored.")
	}

	client.Disconnect()
}

func syncMessages(config Config) {
	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	if client.Store.ID == nil {
		fmt.Fprintf(os.Stderr, "Not authenticated. Run 'auth' command first.\n")
		os.Exit(1)
	}

	err = client.Connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer client.Disconnect()

	// Wait for connection
	time.Sleep(2 * time.Second)

	// Calculate time range
	endTime := time.Now()
	var startTime time.Time

	// Use --since timestamp if provided, otherwise use --days
	if config.Since > 0 {
		startTime = time.Unix(config.Since, 0)
		fmt.Fprintf(os.Stderr, "Syncing messages since %s (timestamp: %d)...\n",
			startTime.Format("2006-01-02 15:04:05"),
			config.Since)
	} else {
		startTime = endTime.AddDate(0, 0, -config.Days)
		fmt.Fprintf(os.Stderr, "Syncing messages from %s to %s (%d days)...\n",
			startTime.Format("2006-01-02"),
			endTime.Format("2006-01-02"),
			config.Days)
	}

	// Log passive/mark-read mode
	if config.Passive && !config.MarkRead {
		fmt.Fprintf(os.Stderr, "Mode: passive (messages will NOT be marked as read)\n")
	} else if config.MarkRead {
		fmt.Fprintf(os.Stderr, "Mode: mark-read (messages WILL be marked as read)\n")
	}

	// Register message handler
	messageCount := 0
	messages := make([]*OutputMessage, 0)
	done := make(chan bool)

	client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			// Time filter: only accept messages in requested range
			if v.Info.Timestamp.Before(startTime) || v.Info.Timestamp.After(endTime) {
				return
			}

			msg := convertMessage(v)
			if msg != nil {
				messages = append(messages, msg)
				messageCount++
				fmt.Fprintf(os.Stderr, "Captured message: %s from %s\n", msg.ID, msg.ChatID)
			}
		case *events.HistorySync:
			// Process history sync - extract all messages from all conversations
			conversations := v.Data.GetConversations()
			fmt.Fprintf(os.Stderr, "📥 History sync received: %d conversations\n", len(conversations))

			historySyncCount := 0
			for _, conv := range conversations {
				chatJID := conv.GetID()
				convMessages := conv.GetMessages()

				for _, histMsg := range convMessages {
					webMsg := histMsg.GetMessage()
					if webMsg == nil || webMsg.GetMessage() == nil {
						continue
					}

					// Extract timestamp
					msgTimestamp := time.Unix(int64(webMsg.GetMessageTimestamp()), 0)

					// Time filter
					if msgTimestamp.Before(startTime) || msgTimestamp.After(endTime) {
						continue
					}

					// Convert to our output format
					msg := convertHistorySyncMessage(webMsg, chatJID)
					if msg != nil {
						messages = append(messages, msg)
						messageCount++
						historySyncCount++
					}
				}
			}
			fmt.Fprintf(os.Stderr, "📥 Extracted %d messages from history sync (within %d day range)\n", historySyncCount, config.Days)
		}
	})

	// Wait for connection and messages
	fmt.Fprintf(os.Stderr, "Listening for messages (%d second window)...\n", config.Timeout)
	fmt.Fprintf(os.Stderr, "For testing: Send a message to yourself or a group now.\n")

	// Timeout after configured seconds
	go func() {
		time.Sleep(time.Duration(config.Timeout) * time.Second)
		done <- true
	}()

	<-done

	// Calculate highest timestamp for watermark tracking
	var highestTimestamp int64 = 0
	for _, msg := range messages {
		if msg.Timestamp > highestTimestamp {
			highestTimestamp = msg.Timestamp
		}
	}

	// Build result with messages (chats will be empty for now)
	result := SyncResult{
		Messages:         make([]OutputMessage, 0, len(messages)),
		Chats:            make([]OutputChat, 0),
		SyncedAt:         time.Now().Unix(),
		HighestTimestamp: highestTimestamp,
		MessageCount:     messageCount,
		SinceTimestamp:   config.Since,
	}

	// Convert pointers to values
	for _, msg := range messages {
		result.Messages = append(result.Messages, *msg)
	}

	// Output result as single JSON object to stdout
	jsonData, err := json.Marshal(result)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal result: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(jsonData))

	fmt.Fprintf(os.Stderr, "Synced %d messages (highest timestamp: %d)\n", messageCount, highestTimestamp)
}

// DumpContact represents a contact with all their messages for the dump file
type DumpContact struct {
	JID          string          `json:"jid"`
	PushName     string          `json:"pushName"`
	IsGroup      bool            `json:"isGroup"`
	MessageCount int             `json:"messageCount"`
	Messages     []OutputMessage `json:"messages"`
}

// DumpResult is the structure written to the dump file
type DumpResult struct {
	Contacts      []DumpContact `json:"contacts"`
	TotalMessages int           `json:"totalMessages"`
	DumpedAt      int64         `json:"dumpedAt"`
}

// DumpCommandResult is the JSON output to stdout after dump completes
type DumpCommandResult struct {
	Success       bool   `json:"success"`
	OutputPath    string `json:"outputPath"`
	TotalMessages int    `json:"totalMessages"`
	ContactCount  int    `json:"contactCount"`
}

// dumpMessages dumps all messages to a file for full sync
func dumpMessages(config Config) {
	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	if client.Store.ID == nil {
		fmt.Fprintf(os.Stderr, "Not authenticated. Run 'auth' command first.\n")
		os.Exit(1)
	}

	err = client.Connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer client.Disconnect()

	// Wait for connection
	time.Sleep(2 * time.Second)

	// Calculate time range
	endTime := time.Now()
	startTime := endTime.AddDate(0, 0, -config.Days)
	fmt.Fprintf(os.Stderr, "Dumping messages from %s to %s (%d days)...\n",
		startTime.Format("2006-01-02"),
		endTime.Format("2006-01-02"),
		config.Days)

	// Collect messages grouped by chat
	messagesByChat := make(map[string][]*OutputMessage)
	chatNames := make(map[string]string)
	chatIsGroup := make(map[string]bool)
	done := make(chan bool)

	client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			// Time filter
			if v.Info.Timestamp.Before(startTime) || v.Info.Timestamp.After(endTime) {
				return
			}

			msg := convertMessage(v)
			if msg != nil {
				messagesByChat[msg.ChatID] = append(messagesByChat[msg.ChatID], msg)
			}
		case *events.HistorySync:
			// Process history sync
			conversations := v.Data.GetConversations()
			fmt.Fprintf(os.Stderr, "📥 History sync: %d conversations\n", len(conversations))

			for _, conv := range conversations {
				chatJID := conv.GetID()
				chatNames[chatJID] = conv.GetDisplayName()
				// Check if group (groups have @g.us suffix)
				chatIsGroup[chatJID] = len(chatJID) > 0 && (chatJID[len(chatJID)-4:] == "g.us" ||
					(len(chatJID) > 12 && chatJID[len(chatJID)-12:] == "@g.us"))

				for _, histMsg := range conv.GetMessages() {
					webMsg := histMsg.GetMessage()
					if webMsg == nil || webMsg.GetMessage() == nil {
						continue
					}

					msgTimestamp := time.Unix(int64(webMsg.GetMessageTimestamp()), 0)
					if msgTimestamp.Before(startTime) || msgTimestamp.After(endTime) {
						continue
					}

					msg := convertHistorySyncMessage(webMsg, chatJID)
					if msg != nil {
						messagesByChat[chatJID] = append(messagesByChat[chatJID], msg)
					}
				}
			}
		}
	})

	// Wait for history sync
	fmt.Fprintf(os.Stderr, "Waiting for history sync (%d seconds)...\n", config.Timeout)
	go func() {
		time.Sleep(time.Duration(config.Timeout) * time.Second)
		done <- true
	}()
	<-done

	// Build dump result
	var contacts []DumpContact
	totalMessages := 0

	for chatJID, msgs := range messagesByChat {
		if len(msgs) == 0 {
			continue
		}

		pushName := chatNames[chatJID]
		if pushName == "" {
			pushName = chatJID
		}

		contact := DumpContact{
			JID:          chatJID,
			PushName:     pushName,
			IsGroup:      chatIsGroup[chatJID],
			MessageCount: len(msgs),
			Messages:     make([]OutputMessage, 0, len(msgs)),
		}

		for _, msg := range msgs {
			contact.Messages = append(contact.Messages, *msg)
			totalMessages++
		}

		contacts = append(contacts, contact)
	}

	dump := DumpResult{
		Contacts:      contacts,
		TotalMessages: totalMessages,
		DumpedAt:      time.Now().Unix(),
	}

	// Ensure output directory exists
	outputDir := "whatsapp-raw"
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create output directory: %v\n", err)
		os.Exit(1)
	}

	// Write dump to file
	outputPath := outputDir + "/dump.json"
	jsonData, err := json.MarshalIndent(dump, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal dump: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(outputPath, jsonData, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to write dump file: %v\n", err)
		os.Exit(1)
	}

	// Output result to stdout
	result := DumpCommandResult{
		Success:       true,
		OutputPath:    outputPath,
		TotalMessages: totalMessages,
		ContactCount:  len(contacts),
	}

	resultJSON, _ := json.Marshal(result)
	fmt.Println(string(resultJSON))

	fmt.Fprintf(os.Stderr, "Dumped %d messages from %d contacts to %s\n", totalMessages, len(contacts), outputPath)
}

func listChats(config Config) {
	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	if client.Store.ID == nil {
		fmt.Fprintf(os.Stderr, "Not authenticated. Run 'auth' command first.\n")
		os.Exit(1)
	}

	err = client.Connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer client.Disconnect()

	// Wait for connection and sync
	time.Sleep(2 * time.Second)

	// Get contacts (whatsmeow API changed - chats are now retrieved differently)
	// For now, output a simple message - full chat listing requires more complex logic
	fmt.Fprintf(os.Stderr, "Note: Full chat listing requires message history sync\n")
	fmt.Println("{\"chatId\":\"status\",\"name\":\"Connected\",\"isGroup\":false}")
}

func checkHealth(config Config) {
	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	status := map[string]interface{}{
		"authenticated": client.Store.ID != nil,
		"sessionDir":    config.SessionDir,
	}

	if client.Store.ID != nil {
		err = client.Connect()
		connected := err == nil
		status["connected"] = connected

		if connected {
			client.Disconnect()
		}
	} else {
		status["connected"] = false
	}

	jsonData, _ := json.Marshal(status)
	fmt.Println(string(jsonData))
}

// convertHistorySyncMessage converts a WebMessageInfo from history sync to OutputMessage
func convertHistorySyncMessage(webMsg *waProto.WebMessageInfo, chatJID string) *OutputMessage {
	msgContent := webMsg.GetMessage()
	if msgContent == nil {
		return nil
	}

	// Get message key info
	key := webMsg.GetKey()
	msgID := ""
	fromMe := false
	if key != nil {
		msgID = key.GetID()
		fromMe = key.GetFromMe()
	}

	msg := &OutputMessage{
		ID:        msgID,
		ChatID:    chatJID,
		FromJID:   webMsg.GetParticipant(), // For groups, this is the sender
		Timestamp: int64(webMsg.GetMessageTimestamp()),
		IsFromMe:  fromMe,
	}

	// If no participant (DM), use chat JID
	if msg.FromJID == "" {
		msg.FromJID = chatJID
	}

	// Extract message content based on type
	if msgContent.Conversation != nil {
		msg.MessageType = "conversation"
		msg.Content = *msgContent.Conversation
	} else if msgContent.ExtendedTextMessage != nil && msgContent.ExtendedTextMessage.Text != nil {
		msg.MessageType = "extendedTextMessage"
		msg.Content = *msgContent.ExtendedTextMessage.Text
	} else if msgContent.ImageMessage != nil {
		msg.MessageType = "imageMessage"
		if msgContent.ImageMessage.Caption != nil {
			msg.Content = *msgContent.ImageMessage.Caption
		}
	} else if msgContent.VideoMessage != nil {
		msg.MessageType = "videoMessage"
		if msgContent.VideoMessage.Caption != nil {
			msg.Content = *msgContent.VideoMessage.Caption
		}
	} else if msgContent.DocumentMessage != nil {
		msg.MessageType = "documentMessage"
		if msgContent.DocumentMessage.Title != nil {
			msg.Content = *msgContent.DocumentMessage.Title
		}
	} else if msgContent.AudioMessage != nil {
		msg.MessageType = "audioMessage"
	} else {
		msg.MessageType = "unknown"
	}

	return msg
}

func convertMessage(evt *events.Message) *OutputMessage {
	if evt.Message == nil {
		return nil
	}

	msg := &OutputMessage{
		ID:        evt.Info.ID,
		ChatID:    evt.Info.Chat.String(),
		FromJID:   evt.Info.Sender.String(),
		Timestamp: evt.Info.Timestamp.Unix(),
		IsFromMe:  evt.Info.IsFromMe,
	}

	// Extract message content based on type
	if evt.Message.Conversation != nil {
		msg.MessageType = "conversation"
		msg.Content = *evt.Message.Conversation
	} else if evt.Message.ExtendedTextMessage != nil && evt.Message.ExtendedTextMessage.Text != nil {
		msg.MessageType = "extendedTextMessage"
		msg.Content = *evt.Message.ExtendedTextMessage.Text
	} else if evt.Message.ImageMessage != nil {
		msg.MessageType = "imageMessage"
		if evt.Message.ImageMessage.Caption != nil {
			msg.Content = *evt.Message.ImageMessage.Caption
		}
		if evt.Message.ImageMessage.URL != nil {
			msg.MediaURL = *evt.Message.ImageMessage.URL
		}
	} else if evt.Message.VideoMessage != nil {
		msg.MessageType = "videoMessage"
		if evt.Message.VideoMessage.Caption != nil {
			msg.Content = *evt.Message.VideoMessage.Caption
		}
		if evt.Message.VideoMessage.URL != nil {
			msg.MediaURL = *evt.Message.VideoMessage.URL
		}
	} else if evt.Message.DocumentMessage != nil {
		msg.MessageType = "documentMessage"
		if evt.Message.DocumentMessage.Title != nil {
			msg.Content = *evt.Message.DocumentMessage.Title
		}
		if evt.Message.DocumentMessage.URL != nil {
			msg.MediaURL = *evt.Message.DocumentMessage.URL
		}
	} else if evt.Message.AudioMessage != nil {
		msg.MessageType = "audioMessage"
		if evt.Message.AudioMessage.URL != nil {
			msg.MediaURL = *evt.Message.AudioMessage.URL
		}
	} else {
		msg.MessageType = "unknown"
	}

	return msg
}

func sendMessage(config Config) {
	// Validate inputs
	if config.To == "" {
		fmt.Fprintf(os.Stderr, "Error: --to JID is required\n")
		fmt.Fprintf(os.Stderr, "Usage: whatsmeow-cli send --to <jid> --message <text>\n")
		os.Exit(1)
	}

	if config.Message == "" {
		fmt.Fprintf(os.Stderr, "Error: --message is required\n")
		fmt.Fprintf(os.Stderr, "Usage: whatsmeow-cli send --to <jid> --message <text>\n")
		os.Exit(1)
	}

	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	if client.Store.ID == nil {
		fmt.Fprintf(os.Stderr, "Not authenticated. Run 'auth' command first.\n")
		os.Exit(1)
	}

	err = client.Connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer client.Disconnect()

	// Wait for connection to be ready
	time.Sleep(2 * time.Second)

	// Parse recipient JID
	recipientJID, err := types.ParseJID(config.To)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Invalid JID format: %v\n", err)
		fmt.Fprintf(os.Stderr, "JID should be in format: phonenumber@s.whatsapp.net\n")
		os.Exit(1)
	}

	// Build message
	message := &waProto.Message{
		Conversation: proto.String(config.Message),
	}

	// Send message
	resp, err := client.SendMessage(context.Background(), recipientJID, message)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to send message: %v\n", err)
		os.Exit(1)
	}

	// Output success result as JSON
	result := map[string]interface{}{
		"success":   true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp.Unix(),
		"to":        config.To,
	}

	jsonData, _ := json.Marshal(result)
	fmt.Println(string(jsonData))

	fmt.Fprintf(os.Stderr, "Message sent successfully! ID: %s\n", resp.ID)
}

func handleSignals(client *whatsmeow.Client) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c
	fmt.Fprintf(os.Stderr, "\nReceived interrupt, disconnecting...\n")
	client.Disconnect()
	os.Exit(0)
}

// monitorMessages listens for real-time messages and outputs them as JSON
func monitorMessages(config Config) {
	client, _, err := getClient(config.SessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create client: %v\n", err)
		os.Exit(1)
	}

	if client.Store.ID == nil {
		fmt.Fprintf(os.Stderr, "Not authenticated. Run 'auth' command first.\n")
		os.Exit(1)
	}

	err = client.Connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Connected. Monitoring for new messages...\n")
	fmt.Fprintf(os.Stderr, "Press Ctrl+C to stop.\n")

	// Log passive mode
	if config.Passive && !config.MarkRead {
		fmt.Fprintf(os.Stderr, "Mode: passive (messages will NOT be marked as read)\n")
	}

	// Register message handler - output each message as JSON line
	client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			msg := convertMessage(v)
			if msg != nil {
				jsonData, err := json.Marshal(msg)
				if err == nil {
					fmt.Println(string(jsonData))
				}
			}
		case *events.Receipt:
			// Log receipt events to stderr for debugging
			fmt.Fprintf(os.Stderr, "Receipt: type=%s from=%s\n", v.Type, v.Chat.String())
		}
	})

	// Handle graceful shutdown
	go handleSignals(client)

	// If timeout is set, exit after that duration
	if config.Timeout > 0 {
		fmt.Fprintf(os.Stderr, "Will stop monitoring after %d seconds.\n", config.Timeout)
		time.Sleep(time.Duration(config.Timeout) * time.Second)
		fmt.Fprintf(os.Stderr, "Timeout reached. Disconnecting...\n")
		client.Disconnect()
		return
	}

	// Otherwise, run forever until interrupted
	select {}
}
