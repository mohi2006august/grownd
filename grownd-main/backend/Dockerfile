# API-only image for container hosts (Render, Railway, Fly.io, Cloud Run...). Not needed on Vercel.
# Build from the app folder (the one with vercel.json), because the lockfile lives there:
#   docker build -f backend/Dockerfile -t grownd-api .
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci --omit=dev -w backend && npm cache clean --force

COPY backend/src backend/src

USER node
EXPOSE 4000
CMD ["node", "backend/src/index.js"]
