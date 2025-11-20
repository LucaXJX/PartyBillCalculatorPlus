import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('user'))) {
    await knex.schema.createTable('user', table => {
      table.string('id', 64).primary()
      table.string('username', 64).notNullable().unique()
      table.string('email', 255).notNullable().unique()
      table.string('password', 255).notNullable()
      table.string('created_at', 64).notNullable()
    })
  }

  if (!(await knex.schema.hasTable('bill'))) {
    await knex.schema.createTable('bill', table => {
      table.string('id', 64).primary()
      table.string('name', 255).notNullable()
      table.string('date', 64).notNullable()
      table.string('location', 255).nullable()
      table.specificType('tip_percentage', 'real').notNullable()
      table.string('payer_id', 64).unsigned().notNullable().references('user.id')
      table.string('created_by', 64).unsigned().notNullable().references('user.id')
      table.string('payer_receipt_url', 512).nullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('bill_participant'))) {
    await knex.schema.createTable('bill_participant', table => {
      table.string('id', 64).primary()
      table.string('bill_id', 64).unsigned().notNullable().references('bill.id')
      table.string('participant_id', 64).unsigned().notNullable().references('user.id')
      table.string('participant_name', 64).notNullable()
      table.string('created_at', 64).notNullable()
    })
  }

  if (!(await knex.schema.hasTable('item'))) {
    await knex.schema.createTable('item', table => {
      table.string('id', 64).primary()
      table.string('bill_id', 64).unsigned().notNullable().references('bill.id')
      table.string('name', 255).notNullable()
      table.specificType('amount', 'real').notNullable()
      table.integer('is_shared').notNullable()
      table.string('created_at', 64).notNullable()
    })
  }

  if (!(await knex.schema.hasTable('item_participant'))) {
    await knex.schema.createTable('item_participant', table => {
      table.string('id', 64).primary()
      table.string('item_id', 64).unsigned().notNullable().references('item.id')
      table.string('participant_id', 64).unsigned().notNullable().references('user.id')
      table.string('created_at', 64).notNullable()
    })
  }

  if (!(await knex.schema.hasTable('calculation_result'))) {
    await knex.schema.createTable('calculation_result', table => {
      table.string('id', 64).primary()
      table.string('bill_id', 64).unsigned().notNullable().references('bill.id')
      table.string('participant_id', 64).unsigned().notNullable().references('user.id')
      table.specificType('amount', 'real').notNullable()
      table.text('breakdown').nullable()
      table.string('payment_status', 32).notNullable()
      table.string('paid_at', 64).nullable()
      table.integer('confirmed_by_payer').notNullable()
      table.string('receipt_image_url', 512).nullable()
      table.string('rejected_reason', 64).nullable()
      table.string('rejected_at', 64).nullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('message'))) {
    await knex.schema.createTable('message', table => {
      table.string('id', 64).primary()
      table.string('type', 32).notNullable()
      table.string('recipient_id', 64).unsigned().notNullable().references('user.id')
      table.string('sender_id', 64).unsigned().nullable().references('user.id')
      table.string('bill_id', 64).unsigned().notNullable().references('bill.id')
      table.string('bill_name', 255).notNullable()
      table.string('title', 255).notNullable()
      table.text('content').notNullable()
      table.string('image_url', 512).nullable()
      table.text('metadata').nullable()
      table.integer('is_read').notNullable()
      table.string('created_at', 64).notNullable()
      table.string('read_at', 64).nullable()
      table.integer('actionable').notNullable()
      table.string('action_type', 32).nullable()
      table.integer('action_completed').notNullable()
    })
  }

  if (!(await knex.schema.hasTable('session'))) {
    await knex.schema.createTable('session', table => {
      table.string('id', 64).primary()
      table.string('user_id', 64).unsigned().notNullable().references('user.id')
      table.string('session_id', 255).notNullable().unique()
      table.string('expires_at', 64).notNullable()
      table.string('created_at', 64).notNullable()
    })
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('session')
  await knex.schema.dropTableIfExists('message')
  await knex.schema.dropTableIfExists('calculation_result')
  await knex.schema.dropTableIfExists('item_participant')
  await knex.schema.dropTableIfExists('item')
  await knex.schema.dropTableIfExists('bill_participant')
  await knex.schema.dropTableIfExists('bill')
  await knex.schema.dropTableIfExists('user')
}
