FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Create the upload directories inside the image.
# The named volume will be mounted at /uploads in Compose, so these dirs
# are only needed when running the container without the volume (e.g. local dev).
RUN mkdir -p /uploads/originals /uploads/thumbnails /uploads/medium

EXPOSE 8002

CMD ["node", "src/index.js"]
