module.exports = {
  apps: [
    {
      name: "backend-api",
      script: "server.js", // <-- Changed from "./server.js" to "server.js"
      node_args: "--env-file=.env.production",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
