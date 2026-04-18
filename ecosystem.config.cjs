module.exports = {
  apps: [
    {
      name: "discordbot",
      cwd: "/var/www/discordbot",
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--require ./.pnp.cjs",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      time: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
