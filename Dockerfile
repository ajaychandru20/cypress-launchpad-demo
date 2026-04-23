FROM cypress-launchpad-demo-base:latest

COPY . .

# Ensure required output directories exist
RUN mkdir -p /app/cypress/cucumber-json /app/cypress/downloads /app/reports

CMD ["npx", "cypress", "run", "--headless", "--browser", "chrome"]
