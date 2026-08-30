export * from './columns.js';
export * from './restaurants.js';
export * from './locations.js';
export * from './users.js';
export * from './roles.js';
export * from './userLocations.js';
export * from './settings.js';
export * from './auditLogs.js';
export * from './refreshTokens.js';

import { restaurants } from './restaurants.js';
import { locations } from './locations.js';
import { users } from './users.js';
import { roles } from './roles.js';
import { userLocations } from './userLocations.js';
import { settings } from './settings.js';
import { auditLogs } from './auditLogs.js';
import { refreshTokens } from './refreshTokens.js';

export const schema = {
  restaurants,
  locations,
  users,
  roles,
  userLocations,
  settings,
  auditLogs,
  refreshTokens,
};
