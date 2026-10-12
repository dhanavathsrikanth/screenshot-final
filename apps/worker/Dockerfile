FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @screenshotapi/worker... run build

ENV NODE_ENV=production
USER pwuser
CMD ["pnpm", "--filter", "@screenshotapi/worker", "start"]
