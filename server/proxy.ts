import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db.js'

export type User = {
  id?: null | string
  username: string
  email: string
  password: string
  created_at: string
}

export type Bill = {
  id?: null | string
  name: string
  date: string
  location: null | string
  tip_percentage: number
  payer_id: string
  payer?: User
  created_by: string
  creator?: User
  payer_receipt_url: null | string
  created_at: string
  updated_at: string
}

export type BillParticipant = {
  id?: null | string
  bill_id: string
  bill?: Bill
  participant_id: string
  participant?: User
  participant_name: string
  created_at: string
}

export type Item = {
  id?: null | string
  bill_id: string
  bill?: Bill
  name: string
  amount: number
  is_shared: number
  created_at: string
}

export type ItemParticipant = {
  id?: null | string
  item_id: string
  item?: Item
  participant_id: string
  participant?: User
  created_at: string
}

export type CalculationResult = {
  id?: null | string
  bill_id: string
  bill?: Bill
  participant_id: string
  participant?: User
  amount: number
  breakdown: null | string
  payment_status: string
  paid_at: null | string
  confirmed_by_payer: number
  receipt_image_url: null | string
  rejected_reason: null | string
  rejected_at: null | string
  created_at: string
  updated_at: string
}

export type Message = {
  id?: null | string
  type: string
  recipient_id: string
  recipient?: User
  sender_id: string
  sender?: User
  bill_id: string
  bill?: Bill
  bill_name: string
  title: string
  content: string
  image_url: null | string
  metadata: null | string
  is_read: number
  created_at: string
  read_at: null | string
  actionable: number
  action_type: null | string
  action_completed: number
}

export type Session = {
  id?: null | string
  user_id: string
  user?: User
  session_id: string
  expires_at: string
  created_at: string
}

export type LlmApiUsage = {
  id?: null | number
  user_id: null | string
  user?: User
  request_type: string
  tokens_used: null | number
  cost: null | number
  success: number
  error_message: null | string
  created_at: string
  updated_at: string
}

export type FoodImages = {
  id?: null | number
  bill_id: string
  bill?: Bill
  user_id: null | string
  user?: User
  original_filename: string
  stored_path: string
  original_path: null | string
  file_size: null | number
  width: null | number
  height: null | number
  recognition_status: number
  recognition_result: null | string
  recognition_error: null | string
  recognition_at: null | string
  created_at: string
  updated_at: string
}

export type FoodApiUsage = {
  id?: null | number
  food_image_id: null | number
  food_image?: FoodImages
  user_id: null | string
  user?: User
  request_type: string
  success: number
  response_data: null | string
  error_message: null | string
  created_at: string
  updated_at: string
}

export type FoodInfo = {
  id?: null | string
  name: string
  name_en: null | string
  country: string
  category: null | string
  calories: null | number
  protein: null | number
  fat: null | number
  carbs: null | number
  ingredients: null | string
  description: null | string
  image_url: null | string
  created_at: string
  updated_at: string
}

export type ModelVersions = {
  id?: null | string
  level: number
  country: null | string
  version: string
  model_path: string
  accuracy: null | number
  training_date: null | string
  is_active: number // default: 0
  created_at: string
}

export type DBProxy = {
  user: User[]
  bill: Bill[]
  bill_participant: BillParticipant[]
  item: Item[]
  item_participant: ItemParticipant[]
  calculation_result: CalculationResult[]
  message: Message[]
  session: Session[]
  llm_api_usage: LlmApiUsage[]
  food_images: FoodImages[]
  food_api_usage: FoodApiUsage[]
  food_info: FoodInfo[]
  model_versions: ModelVersions[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    user: [],
    bill: [
      /* foreign references */
      ['payer', { field: 'payer_id', table: 'user' }],
      ['creator', { field: 'created_by', table: 'user' }],
    ],
    bill_participant: [
      /* foreign references */
      ['bill', { field: 'bill_id', table: 'bill' }],
      ['participant', { field: 'participant_id', table: 'user' }],
    ],
    item: [
      /* foreign references */
      ['bill', { field: 'bill_id', table: 'bill' }],
    ],
    item_participant: [
      /* foreign references */
      ['item', { field: 'item_id', table: 'item' }],
      ['participant', { field: 'participant_id', table: 'user' }],
    ],
    calculation_result: [
      /* foreign references */
      ['bill', { field: 'bill_id', table: 'bill' }],
      ['participant', { field: 'participant_id', table: 'user' }],
    ],
    message: [
      /* foreign references */
      ['recipient', { field: 'recipient_id', table: 'user' }],
      ['sender', { field: 'sender_id', table: 'user' }],
      ['bill', { field: 'bill_id', table: 'bill' }],
    ],
    session: [
      /* foreign references */
      ['user', { field: 'user_id', table: 'user' }],
    ],
    llm_api_usage: [
      /* foreign references */
      ['user', { field: 'user_id', table: 'user' }],
    ],
    food_images: [
      /* foreign references */
      ['bill', { field: 'bill_id', table: 'bill' }],
      ['user', { field: 'user_id', table: 'user' }],
    ],
    food_api_usage: [
      /* foreign references */
      ['food_image', { field: 'food_image_id', table: 'food_images' }],
      ['user', { field: 'user_id', table: 'user' }],
    ],
    food_info: [],
    model_versions: [],
  },
})
