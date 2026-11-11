# Build context is the repository root: the server imports ../shared.
FROM node:26-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --ignore-scripts
COPY shared /app/shared
COPY server/prisma ./prisma
COPY server/prisma.config.ts server/tsconfig.json ./
COPY server/src ./src
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/server/package.json /app/server/prisma.config.ts ./
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
