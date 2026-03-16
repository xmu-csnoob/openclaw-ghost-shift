const fs = require('fs');
const path = require('path');

const files = [
  'src/components/AppShell.tsx',
  'src/components/LiveOfficeStage.tsx',
  'src/components/CaseStudyLayer.tsx',
  'src/components/GhostShiftSummaryCard.tsx',
  'src/components/ExperiencePanel.tsx',
  'src/components/SharePanel.tsx',
  'src/components/ProductDashboard.tsx',
];

const englishPatterns = [
  /Home|Live|Replay|Embed|Docs|About|Loading|Error|Connected|Connecting|Disconnected|Settings|Share|Guide|Help|Dashboard/g,
  /Waiting for|Snapshot unavailable|Live snapshot|Offline/g,
  /Why does|Why are|Why is/g,
  /Case Study Layer|Raw gateway|Public snapshot|Product surface/g,
  /Identity|Prompt context|Tool arguments|Model detail/g,
  /Hidden|hidden|not rendered|activity window only/g,
];

let totalIssues = 0;

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    if (line.includes('i18n.') || line.includes('//') || line.includes('*') || line.includes('type ') || line.includes('interface ')) return;
    
    englishPatterns.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches && matches.length > 0) {
        issues.push({
          line: index + 1,
          text: line.trim(),
          matches: matches
        });
        totalIssues += matches.length;
      }
    });
  });
  
  if (issues.length > 0) {
    console.log(`\n${file}:`);
    issues.slice(0, 10).forEach(issue => {
      console.log(`  Line ${issue.line}: ${issue.matches.join(', ')}`);
    });
    if (issues.length > 10) console.log(`  ... and ${issues.length - 10} more`);
  }
});

console.log(`\n总计发现 ${totalIssues} 处英文文本`);
