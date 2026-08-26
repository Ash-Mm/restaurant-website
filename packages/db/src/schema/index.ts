export * from './columns';
export * from './restaurants';
export * from './locations';
export * from './users';
export * from './roles';
export * from './userLocations';
export * from './settings';
export * from './auditLogs';

import { restaurants } from './restaurants';
import { locations } from './locations';
import { users } from './users';
import { roles } from './roles';
import { userLocations } from './userLocations';
import { settings } from './settings';
import { auditLogs } from './auditLogs';

export const schema = {
  restaurants,
  locations,
  users,
  roles,
  userLocations,
  settings,
  auditLogs,
};
