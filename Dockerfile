# Crooked Shelf — immagine per il self-hosting.
#   docker compose up -d
# I dati (database, immagini, plugin installati) stanno nel volume /data.
#
# Se Docker Hub risponde "Too Many Requests", si può usare un'altra copia dell'immagine di Node:
#   docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm-slim .

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE}
LABEL org.opencontainers.image.title="Crooked Shelf" \
      org.opencontainers.image.description="Self-hosted wiki for tabletop RPG campaigns" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.source="https://github.com/yanez86/crooked-shelf"
ENV NODE_ENV=production \
    PORT=3000 \
    CS_DATA_DIR=/data \
    CS_PLUGINS_BUNDLED=/app/plugins
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY server.js ./
COPY plugins ./plugins
COPY tools/restore.mjs ./tools/restore.mjs
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
