import type { Knex } from 'knex'
import { dbFile } from './server/db.js'

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: dbFile,
    },
  }
}

export default config
