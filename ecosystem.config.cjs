/**
 * PM2: chạy BE + FE (production).
 *
 * Chuẩn bị:
 *   pnpm install
 *   pnpm build
 *
 * Chạy:
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs
 *   pm2 stop ecosystem.config.cjs
 */
const path = require("path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "rag-tutorial-be",
      cwd: path.join(root, "be"),
      script: "pnpm",
      args: "start",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: { NODE_ENV: "production", PORT: "3080" },
    },
    {
      name: "rag-tutorial-fe",
      cwd: path.join(root, "fe"),
      script: "pnpm",
      args: "start",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: { NODE_ENV: "production" },
    },
  ],
};
