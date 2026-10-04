# API-only image. The frontend is static and belongs on a CDN.
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
