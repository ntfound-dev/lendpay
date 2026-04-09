FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY deploy/railway/deploy/docker-entrypoint.sh /usr/local/bin/rollup-entrypoint
COPY deploy/railway/deploy/runtime/bin/ /opt/minitiad/
COPY deploy/railway/deploy/runtime/home-seed/ /opt/lendpay-rollup/home-seed/

RUN chmod +x /usr/local/bin/rollup-entrypoint /opt/minitiad/minitiad

ENV MINITIAD_BIN=/opt/minitiad/minitiad
ENV ROLLUP_HOME=/data/rollup-home
ENV ROLLUP_SEED_HOME=/opt/lendpay-rollup/home-seed

EXPOSE 26656 26657 1317 9090

CMD ["rollup-entrypoint"]
