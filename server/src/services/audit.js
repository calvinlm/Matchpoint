const prisma = require('../lib/prisma');

async function recordAuditLog({ actor, action, resourceType, resourceId, metadata = null }, client = prisma) {
  await client.auditLog.create({
    data: {
      actor,
      action,
      resourceType,
      resourceId,
      metadata,
    },
  });
}

module.exports = {
  recordAuditLog,
};
