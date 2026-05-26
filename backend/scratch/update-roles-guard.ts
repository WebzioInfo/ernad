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
            'attendance:view'
          ];`;

const replacementStr = `        if (userRoles.includes('ADMIN')) {
          return true;
        }

        if (userRoles.includes('MANAGER')) {
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
          ];`;

// Normalize line endings to LF for replacement
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  // Restore CRLF line endings if original had them
  const finalContent = content.includes('\r\n') ? updatedContent.replace(/\n/g, '\r\n') : updatedContent;
  fs.writeFileSync(targetPath, finalContent, 'utf8');
  console.log('Successfully updated roles.guard.ts!');
} else {
  console.error('Target string not found in roles.guard.ts!');
}
