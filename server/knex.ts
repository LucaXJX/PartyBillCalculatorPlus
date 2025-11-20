import Knex from 'knex'
import configs from '../knexfile.js'

export const knex = Knex(configs.development)
