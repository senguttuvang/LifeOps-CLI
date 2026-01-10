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
	ASCII      bool   // For auth command: use ASCII-compatible QR rendering
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
	Messages []OutputMessage `json:"messages"`
	Chats    []OutputChat    `json:"chats"`
	SyncedAt int64           `json:"syncedAt"`
	Error    string          `json:"error,omitempty"`
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
		fmt.Println("whatsmeow-cli version 1.0.0")
	case "auth":
		authenticate(config)
	case "sync":
		syncMessages(config)
	case "chats":
		listChats(config)
	case "health":
		checkHealth(config)
	case "send":
		sendMessage(config)
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
	fmt.Println("  sync               Sync messages from last N days")
	fmt.Println("  chats              List all chats")
	fmt.Println("  health             Check connection health")
	fmt.Println("  send               Send a message to a chat")
	fmt.Println()
	fmt.Println("Options:")
	fmt.Println("  --session-dir DIR  Session directory (default: ./data/whatsapp)")
	fmt.Println("  --days N           Number of days to sync (default: 30)")
	fmt.Println("  --to JID           Recipient JID for send command")
	fmt.Println("  --message TEXT     Message text for send command")
	fmt.Println("  --ascii            Use ASCII-compatible QR rendering (for Claude Code)")
}

func parseConfig() Config {
	config := Config{
		SessionDir: "./data/whatsapp",
		Days:       30,
		ASCII:      false,
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
		case "--ascii":
			config.ASCII = true
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
		if config.ASCII {
			fmt.Println("(Using ASCII mode for compatibility)")
		}
		for evt := range qrChan {
			if evt.Event == "code" {
				if config.ASCII {
					// ASCII mode: uses simple characters that render well in Claude Code
					qrConfig := qrterminal.Config{
						Level:          qrterminal.L,
						Writer:         os.Stdout,
						BlackChar:      "██",
						WhiteChar:      "  ",
						QuietZone:      2,
						HalfBlocks:     false,
						BlackWhiteChar: "▀",
						WhiteBlackChar: "▄",
					}
					qrterminal.GenerateWithConfig(evt.Code, qrConfig)
				} else {
					// Default: half-block mode (best quality in proper terminals)
					qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
				}
			} else {
				fmt.Println("Login event:", evt.Event)
				if evt.Event == "success" {
					fmt.Println("Authentication successful!")
					break
				}
			}
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
	startTime := endTime.AddDate(0, 0, -config.Days)

	fmt.Fprintf(os.Stderr, "Syncing messages from %s to %s (%d days)...\n",
		startTime.Format("2006-01-02"),
		endTime.Format("2006-01-02"),
		config.Days)

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
	fmt.Fprintf(os.Stderr, "Listening for messages (30 second window)...\n")
	fmt.Fprintf(os.Stderr, "For testing: Send a message to yourself or a group now.\n")

	// Timeout after 30 seconds
	go func() {
		time.Sleep(30 * time.Second)
		done <- true
	}()

	<-done

	// Build result with messages (chats will be empty for now)
	result := SyncResult{
		Messages: make([]OutputMessage, 0, len(messages)),
		Chats:    make([]OutputChat, 0),
		SyncedAt: time.Now().Unix(),
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

	fmt.Fprintf(os.Stderr, "Synced %d messages\n", messageCount)
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
