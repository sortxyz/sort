import { ChangeExecutionWorker } from './change-execution-worker'
import { SchemaImportWorker } from './schema-import-worker'

process.title = 'sort-worker'

const changeRequestWorker = new ChangeExecutionWorker()
changeRequestWorker.start()

const connectionImportWorker = new SchemaImportWorker()
connectionImportWorker.start()
