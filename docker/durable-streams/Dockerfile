# The Durable Streams server (a Caddy build) that keeps the pages' update logs.
# It gets no domain: only Morrow's api process reaches it, through YjsServer.
# To upgrade, take the version and both checksums from the release's
# checksums.txt: https://github.com/durable-streams/durable-streams/releases
FROM alpine:3.22 AS fetch

ARG TARGETARCH
ARG DS_VERSION=0.3.0
ARG DS_SHA256_AMD64=120b03d91ad67adfb265bac72e2d06cae07c333621598b32ee3b0ae21d11acb9
ARG DS_SHA256_ARM64=7e908cb5bac87d7299e9529779993afe3bf223ad1e58b044e6face7e111c3914

RUN set -eu; \
  case "$TARGETARCH" in \
    amd64) sha="$DS_SHA256_AMD64" ;; \
    arm64) sha="$DS_SHA256_ARM64" ;; \
    *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  wget -q -O /tmp/ds.tgz "https://github.com/durable-streams/durable-streams/releases/download/v${DS_VERSION}/durable-streams-server_${DS_VERSION}_linux_${TARGETARCH}.tar.gz"; \
  echo "${sha}  /tmp/ds.tgz" | sha256sum -c -; \
  tar -xzf /tmp/ds.tgz -C /usr/local/bin durable-streams-server

FROM alpine:3.22

RUN addgroup -g 1001 streams && \
  adduser -u 1001 -G streams -D streams && \
  mkdir -p /data/streams /data/caddy && \
  chown -R streams:streams /data

COPY --from=fetch /usr/local/bin/durable-streams-server /usr/local/bin/durable-streams-server
COPY Caddyfile /etc/durable-streams/Caddyfile

# Caddy keeps its own state under XDG_DATA_HOME; keep it on the volume too.
ENV XDG_DATA_HOME=/data/caddy XDG_CONFIG_HOME=/data/caddy
VOLUME /data
USER streams
EXPOSE 4437

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD nc -z 127.0.0.1 4437 || exit 1

CMD ["durable-streams-server", "run", "--config", "/etc/durable-streams/Caddyfile"]
