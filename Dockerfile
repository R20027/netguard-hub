# ==========================================
# NetGuard Hub - Production Multi-Stage Dockerfile
# ==========================================

# STAGE 1: Build Frontend React + Vite
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# STAGE 2: Build Backend Go Binary
FROM golang:1.22-alpine AS backend-builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=1 go build -ldflags="-s -w" -o /app/netguard-server .

# STAGE 3: Final Production Image
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata sqlite
WORKDIR /app
COPY --from=backend-builder /app/netguard-server /app/netguard-server
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV GIN_MODE=release
ENV PORT=8080
EXPOSE 8080

CMD ["/app/netguard-server"]
