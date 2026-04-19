FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start server
CMD [ "npm", "start" ]
