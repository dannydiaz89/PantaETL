FROM node:24-bookworm-slim

WORKDIR /workspace

RUN npm install --global pnpm@10.28.2

COPY . .
RUN pnpm install --frozen-lockfile

ARG SERVICE
ENV SERVICE=${SERVICE}

CMD ["sh", "-c", "pnpm --filter ${SERVICE} dev"]
