# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Go Backend
# ==========================================
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app/backend

# Enable automatic toolchain downloads if newer version is requested
ENV GOTOOLCHAIN=auto

# Install build tools if needed
RUN apk add --no-cache git ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/sentinel ./cmd/server

# ==========================================
# Stage 3: Minimal Secure Production Image
# ==========================================
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Create persistent storage folder for SQLite
RUN mkdir -p /app/data /host/proc /host/sys /host/etc /host/root

# Copy compiled backend binary
COPY --from=backend-builder /app/sentinel /app/sentinel

# Copy compiled frontend assets
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Default Environment Variables
ENV PORT=28475 \
    DB_PATH=/app/data/sentinel.db \
    STATIC_DIR=/app/frontend/dist \
    GIN_MODE=release \
    HOST_PROC=/host/proc \
    HOST_SYS=/host/sys \
    HOST_ETC=/host/etc \
    HOST_ROOT=/host/root

EXPOSE 28475

VOLUME ["/app/data"]

ENTRYPOINT ["/app/sentinel"]
