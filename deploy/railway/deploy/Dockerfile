FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl tar gzip \
  && rm -rf /var/lib/apt/lists/*

COPY deploy/railway/deploy/docker-entrypoint.sh /usr/local/bin/rollup-entrypoint
COPY deploy/railway/deploy/runtime/bin/ /opt/minitiad/
COPY deploy/railway/deploy/runtime/home-seed/ /opt/lendpay-rollup/home-seed/

RUN chmod +x /usr/local/bin/rollup-entrypoint \
  && mkdir -p /opt/minitiad /opt/lendpay-rollup/home-seed \
  && if [ -f /opt/minitiad/minitiad ]; then chmod +x /opt/minitiad/minitiad; fi

ENV MINITIAD_BIN=/opt/minitiad/minitiad
ENV ROLLUP_HOME=/data/rollup-home
ENV ROLLUP_SEED_HOME=/opt/lendpay-rollup/home-seed

EXPOSE 26656 26657 1317 9090

CMD ["rollup-entrypoint"]
