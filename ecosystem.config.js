module.exports = {
  apps: [
    {
      name: 'core-app',
      script: 'yarn build:core && yarn start:core:prod',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: 3001,
      },
    },
  ],
};
