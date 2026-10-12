FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @screenshotapi/api... run build

ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@screenshotapi/api", "start"]
