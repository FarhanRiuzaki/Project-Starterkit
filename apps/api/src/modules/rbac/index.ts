// Public API of the rbac module: its routes, its tables, the escalation rules and the role reads and grants the users
// module makes.
export { rbacController } from "./controller";
export { checkRoleGrant, inCatalogOrder } from "./rules";
export { permissions, rolePermissions, roles, userRoles } from "./schema";
export { grantRoles, type RoleRef, revokeRoles, rolesByName, rolesOfUser } from "./service";
