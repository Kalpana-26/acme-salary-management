FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
COPY scripts/build.mjs ./scripts/build.mjs
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/acme.sqlite
RUN mkdir /app/data && chown node:node /app/data
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "server/http.js"]
