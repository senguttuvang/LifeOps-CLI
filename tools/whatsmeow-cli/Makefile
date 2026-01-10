.PHONY: build build-all build-darwin-arm64 build-darwin-amd64 build-linux build-windows clean install install-local deps test check help

# Binary name
BINARY_NAME=whatsmeow-cli
BIN_DIR=bin
PROJECT_BIN=../../bin

# Default target
help:
	@echo "WhatsApp CLI Build System"
	@echo ""
	@echo "Prerequisites:"
	@echo "  - Go 1.21+ (brew install go / apt install golang-go / choco install golang)"
	@echo "  - CGO enabled (required for SQLite)"
	@echo ""
	@echo "Targets:"
	@echo "  make build           Build for current platform"
	@echo "  make build-all       Build for all platforms (macOS, Linux, Windows)"
	@echo "  make install-local   Build and copy to project bin/ directory"
	@echo "  make check           Verify Go installation"
	@echo "  make clean           Remove build artifacts"
	@echo ""
	@echo "Platform-specific builds:"
	@echo "  make build-darwin-arm64   macOS Apple Silicon"
	@echo "  make build-darwin-amd64   macOS Intel"
	@echo "  make build-linux          Linux AMD64"
	@echo "  make build-windows        Windows AMD64"

# Check Go installation
check:
	@echo "Checking prerequisites..."
	@which go > /dev/null || (echo "❌ Go not installed." && echo "  macOS:   brew install go" && echo "  Ubuntu:  sudo apt install golang-go" && echo "  Windows: choco install golang" && exit 1)
	@echo "✅ Go: $$(go version)"
	@echo ""

# Download dependencies
deps: check
	@echo "📦 Downloading dependencies..."
	go mod download
	go mod tidy
	@echo "✅ Dependencies ready"

# Build for current platform
build: deps
	@echo "🔨 Building $(BINARY_NAME) for current platform..."
	@mkdir -p $(BIN_DIR)
	CGO_ENABLED=1 go build -o $(BIN_DIR)/$(BINARY_NAME) main.go
	@echo "✅ Build complete: $(BIN_DIR)/$(BINARY_NAME)"

# Build and install to project bin/ (used by LifeOps CLI)
install-local: build
	@echo "📁 Installing to project bin/ directory..."
	@mkdir -p $(PROJECT_BIN)
	cp $(BIN_DIR)/$(BINARY_NAME) $(PROJECT_BIN)/
	@chmod +x $(PROJECT_BIN)/$(BINARY_NAME)
	@echo "✅ Installed to $(PROJECT_BIN)/$(BINARY_NAME)"

# Cross-platform builds
build-darwin-arm64: deps
	@echo "🍎 Building for macOS Apple Silicon (arm64)..."
	@mkdir -p $(BIN_DIR)
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 go build -o $(BIN_DIR)/$(BINARY_NAME)-darwin-arm64 main.go
	@echo "✅ $(BIN_DIR)/$(BINARY_NAME)-darwin-arm64"

build-darwin-amd64: deps
	@echo "🍎 Building for macOS Intel (amd64)..."
	@mkdir -p $(BIN_DIR)
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=1 go build -o $(BIN_DIR)/$(BINARY_NAME)-darwin-amd64 main.go
	@echo "✅ $(BIN_DIR)/$(BINARY_NAME)-darwin-amd64"

build-linux: deps
	@echo "🐧 Building for Linux (amd64)..."
	@mkdir -p $(BIN_DIR)
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o $(BIN_DIR)/$(BINARY_NAME)-linux-amd64 main.go
	@echo "✅ $(BIN_DIR)/$(BINARY_NAME)-linux-amd64"

build-windows: deps
	@echo "🪟 Building for Windows (amd64)..."
	@mkdir -p $(BIN_DIR)
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o $(BIN_DIR)/$(BINARY_NAME)-windows-amd64.exe main.go
	@echo "✅ $(BIN_DIR)/$(BINARY_NAME)-windows-amd64.exe"

# Build all platforms
build-all: build-darwin-arm64 build-darwin-amd64 build-linux build-windows
	@echo ""
	@echo "✅ All platform builds complete:"
	@ls -la $(BIN_DIR)/

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -rf $(BIN_DIR)
	@echo "✅ Clean complete"

# Install to system (requires sudo)
install: build
	@echo "📥 Installing to /usr/local/bin..."
	sudo cp $(BIN_DIR)/$(BINARY_NAME) /usr/local/bin/
	@echo "✅ Installed to /usr/local/bin/$(BINARY_NAME)"

# Run tests
test:
	go test ./... -v
