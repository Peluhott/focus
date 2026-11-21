import { BaseModel, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

/**
 * Base for every model: JSON keys are snake_case, matching the spec's API
 * (`focus_limit`, `alignment_status`, `before_id`).
 */
export default class AppBaseModel extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()
}
