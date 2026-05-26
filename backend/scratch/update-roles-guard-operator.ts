import * as fs from 'fs';
import * as path from 'path';

const targetPath = path.join(__dirname, '../src/modules/auth/roles.guard.ts');
let content = fs.readFileSync(targetPath, 'utf8');

const targetStr = `        if (userRoles.includes('MANAGER')) {
          const managerPermissions = [
            'analytics:view', 
            'reports:view', 
            'inventory:view', 
            'inventory:edit',
            'telemetry:log', 
            'production:start', 
            'production:close',
            'forensics:view',
            'forensics:edit',
            'attendance:view',
            'settings:view'
          ];
          if (managerPermissions.includes(p)) {
            return true;
          }
        }`;

const replacementStr = `        if (userRoles.includes('MANAGER')) {
          const managerPermissions = [
            'analytics:view', 
            'reports:view', 
            'inventory:view', 
            'inventory:edit',
            'telemetry:log', 
            'production:start', 
            'production:close',
            'forensics:view',
            'forensics:edit',
            'attendance:view',
            'settings:view'
          ];
          if (managerPermissions.includes(p)) {
            return true;
          }
        }

        // [HARDENED] Operator Role implicit permissions for operations
        if (userRoles.includes('OPERATOR')) {
          const operatorPermissions = [
            'telemetry:log',
            'production:start',
            'settings:view'
          ];
          if (operatorPermissions.includes(p)) {
            return true;
          }
        }`;

// Normalize line endings to LF for replacement
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  // Restore CRLF line endings if original had them
  const finalContent = content.includes('\r\n') ? updatedContent.replace(/\n/g, '\r\n') : updatedContent;
  fs.writeFileSync(targetPath, finalContent, 'utf8');
  console.log('Successfully updated roles.guard.ts with OPERATOR implicit permissions!');
} else {
  console.error('Target string not found in roles.guard.ts!');
}
