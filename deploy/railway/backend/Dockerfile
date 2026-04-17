FROM golang:1.23-bookworm AS build

WORKDIR /src/backend-go

COPY backend-go/go.mod backend-go/go.sum ./
RUN go mod download

COPY backend-go/cmd ./cmd
COPY backend-go/internal ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/lendpay-backend ./cmd/server

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl tar gzip \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/lendpay-backend /app/lendpay-backend
COPY deploy/railway/backend/docker-entrypoint.sh /usr/local/bin/backend-entrypoint
COPY deploy/railway/deploy/runtime/bin/ /opt/minitiad/

RUN chmod +x /app/lendpay-backend /usr/local/bin/backend-entrypoint \
  && mkdir -p /opt/minitiad /data/rollup-home \
  && if [ -f /opt/minitiad/minitiad ]; then chmod +x /opt/minitiad/minitiad; fi

ENV PORT=8080
ENV MINITIAD_BIN=/opt/minitiad/minitiad
ENV ROLLUP_HOME=/data/rollup-home
ENV ROLLUP_KEYRING_BACKEND=test

EXPOSE 8080

CMD ["backend-entrypoint"]
