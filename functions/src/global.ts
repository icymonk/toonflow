import { setGlobalOptions } from 'firebase-functions/v2'
import { REGION } from '../../shared/region'

setGlobalOptions({ region: REGION, maxInstances: 10 })
