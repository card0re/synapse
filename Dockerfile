# Збірка бекенду для Cloud Run. Фронтенд має власний образ — frontend/Dockerfile.

FROM golang:1.26-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

# CGO_ENABLED=0: жоден із залежностей (pgx, gin, redis-клієнт) не потребує cgo,
# статичний бінарник простіше та безпечніше ганяти в мінімальному образі.
RUN CGO_ENABLED=0 GOOS=linux go build -o /api_server ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /api_server /api_server

# Cloud Run сам підставляє PORT — застосунок вже це підтримує (cmd/api/main.go)
ENTRYPOINT ["/api_server"]
