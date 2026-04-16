# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy source (go mod tidy needs source files to generate a complete go.sum)
COPY go.mod ./
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o auth-service .

# ── Stage 2: Run ─────────────────────────────────────────────────────────────
# Use a minimal base image — final image is ~15 MB
FROM alpine:3.19

WORKDIR /app
COPY --from=builder /app/auth-service .

EXPOSE 8001
CMD ["./auth-service"]
