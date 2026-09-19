# AccessGuard — imagem do app
FROM node:20-slim

# Diretório de trabalho dentro do contêiner
WORKDIR /app

# Instala só as dependências primeiro (aproveita o cache do Docker)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copia o resto do código
COPY . .

# Onde ficam os tokens das lojas instaladas (monte um volume aqui no deploy)
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

# Porta interna do app (o reverse proxy encaminha para cá)
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
