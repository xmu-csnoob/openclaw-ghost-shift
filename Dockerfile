# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine
ARG GO_VERSION=1.24-alpine
ARG ALPINE_VERSION=3.22

FROM node:${NODE_VERSION} AS frontend-builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts eslint.config.js index.html ./
COPY public ./public
COPY src ./src

ARG VITE_PUBLIC_API_BASE=
ENV VITE_PUBLIC_API_BASE=${VITE_PUBLIC_API_BASE}

RUN npm run build

FROM golang:${GO_VERSION} AS backend-builder
WORKDIR /src/server

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server ./

ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
  go build -trimpath -ldflags="-s -w" -o /out/ghost-shift-server .

FROM alpine:${ALPINE_VERSION} AS runtime
RUN apk add --no-cache ca-certificates \
  && addgroup -S ghostshift \
  && adduser -S -G ghostshift ghostshift

WORKDIR /app

COPY --from=backend-builder /out/ghost-shift-server /app/ghost-shift-server
COPY --from=frontend-builder /app/dist /app/dist

ENV BIND_ADDR=0.0.0.0 \
  PORT=3002 \
  STATIC_DIR=/app/dist \
  HOME=/home/ghostshift \
  XDG_CONFIG_HOME=/home/ghostshift/.config

USER ghostshift

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3002/api/status || exit 1

ENTRYPOINT ["/app/ghost-shift-server"]
