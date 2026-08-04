FROM node:20-alpine AS build

WORKDIR /app

COPY backend/package*.json ./backend/
COPY packages/rewardly-core/package*.json ./packages/rewardly-core/
RUN cd backend && npm ci

COPY backend ./backend
COPY packages ./packages
RUN cd backend && npm run build

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/backend/package*.json ./backend/
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 5001

CMD ["node", "dist/backend/src/server.js"]
