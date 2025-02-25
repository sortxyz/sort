import * as LabelController from '../../../controllers/label.controller'
import { checkAuthentication, addSchemas } from '../../../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Labels routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [LabelController])

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/labels',
    {
      schema: LabelController.getLabelsByDatabaseSchema,
      onRequest: checkAuthentication('isAccount')
    },
    LabelController.getLabelsByDatabase
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/labels/:label_id',
    {
      schema: LabelController.getLabelSchema,
      onRequest: checkAuthentication('isAccount')
    },
    LabelController.getLabel
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/labels',
    {
      schema: LabelController.createLabelSchema,
      onRequest: checkAuthentication()
    },
    LabelController.createDatabaseLabel
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/labels/:label_id',
    {
      schema: LabelController.updateLabelSchema,
      onRequest: checkAuthentication()
    },
    LabelController.updateDatabaseLabel
  )

  server.delete(
    '/v2/orgs/:org_slug/databases/:db_slug/labels/:label_id',
    {
      schema: LabelController.deleteLabelSchema,
      onRequest: checkAuthentication()
    },
    LabelController.deleteDatabaseLabel
  )
}
