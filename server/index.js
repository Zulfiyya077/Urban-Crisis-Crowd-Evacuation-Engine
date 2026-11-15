import { config } from './config.js';
import { createApp } from './app.js';

const { app } = createApp();
app.listen(config.port, () => {
  console.log(`Urban Crisis Engine: http://localhost:${config.port}`);
  console.log(`Dispetçer paneli: http://localhost:${config.port}/operator`);
});
