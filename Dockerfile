# Use the official Node.js image as a base image
FROM node:17

# Install necessary dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libnss3 \
    libxss1 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libxrandr2 \
    libxcomposite1 \
    libxdamage1 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libappindicator3-1 \
    libcurl3-gnutls \
    xdg-utils

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the app
CMD ["npm", "run", "dev"]
