import path from 'path';
import os from 'os';

function getAppDataDir() {
  const appName = 'com.taskriot.desktop';
  const home = os.homedir();

  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), appName);
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', appName);
    case 'linux':
    default:
      return path.join(home, '.local', 'share', appName);
  }
}

export default {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || path.join(getAppDataDir(), 'dev.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  }
};