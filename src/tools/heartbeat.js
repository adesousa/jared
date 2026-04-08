import fs from "node:fs";
import path from "node:path";

export default {
  schema: {
    name: "heartbeat",
    description: "Manage tasks in the HEARTBEAT.md schedule for Jared to execute proactively. Categories: 'One Shot Tasks', 'Daily Tasks', 'Weekly Tasks', 'Monthly Tasks'. Actions: add, remove, list.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "remove", "list"] },
        category: { type: "string", enum: ["One Shot Tasks", "Daily Tasks", "Weekly Tasks", "Monthly Tasks"] },
        time_spec: { type: "string", description: "e.g. '8:15 AM', '5:00 PM Friday', '25th'" },
        title: { type: "string", description: "Title of the task to add or remove" },
        task_description: { type: "string", description: "Actionable description of the task (for add action)" }
      },
      required: ["action"]
    }
  },
  execute: async ({ action, category, time_spec, title, task_description }) => {
    const heartbeatPath = path.join(process.cwd(), ".jared", "HEARTBEAT.md");
    if (!fs.existsSync(heartbeatPath)) {
        return "Error: HEARTBEAT.md not found in .jared/ directory.";
    }
    
    let content = fs.readFileSync(heartbeatPath, "utf8");
    const lines = content.split('\n');
    
    if (action === "list") {
        return `Current HEARTBEAT:\n${content}`;
    }
    
    if (action === "add") {
       if (!category || !time_spec || !title || !task_description) {
           return "Error: category, time_spec, title, and task_description required for add.";
       }
       
       let rewritten = [];
       let inCategory = false;
       let added = false;
       
       for (let i = 0; i < lines.length; i++) {
           if (lines[i].trim() === `## ${category}`) {
               inCategory = true;
               rewritten.push(lines[i]);
           } else if (lines[i].startsWith('## ')) {
               if (inCategory && !added) {
                   rewritten.push(`### ${time_spec} — ${title}`);
                   rewritten.push(`- ${task_description}`);
                   added = true;
               }
               inCategory = false;
               rewritten.push(lines[i]);
           } else {
               rewritten.push(lines[i]);
           }
       }
       
       if (inCategory && !added) {
           rewritten.push(`### ${time_spec} — ${title}`);
           rewritten.push(`- ${task_description}`);
           added = true;
       }
       
       if (!added) {
           rewritten.push(`## ${category}`);
           rewritten.push(`### ${time_spec} — ${title}`);
           rewritten.push(`- ${task_description}`);
       }
       
       fs.writeFileSync(heartbeatPath, rewritten.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8');
       return `Added task [${title}] to [${category}] successfully.`;
    }
    
    if (action === "remove") {
       if (!category || !title) return "Error: category and title required for remove.";
       let rewritten = [];
       let inCategory = false;
       let i = 0;
       let removed = false;
       
       while (i < lines.length) {
           let line = lines[i];
           if (line.trim() === `## ${category}`) {
               inCategory = true;
               rewritten.push(line);
               i++;
               continue;
           } else if (line.startsWith('## ')) {
               inCategory = false;
               rewritten.push(line);
               i++;
               continue;
           }
           
           if (inCategory && line.startsWith('### ')) {
               const header = line.substring(4).trim();
               const sepIndex = header.search(/\s+[-—]\s+/);
               let lineTitle = header;
               if (sepIndex !== -1) {
                  lineTitle = header.substring(sepIndex).replace(/^[-—\s]+/, '').trim();
               }
               if (lineTitle === title) {
                   i++;
                   while (i < lines.length && !lines[i].startsWith('##') && !lines[i].startsWith('### ')) {
                       i++;
                   }
                   removed = true;
                   continue;
               }
           }
           rewritten.push(line);
           i++;
       }
       
       if (removed) {
           fs.writeFileSync(heartbeatPath, rewritten.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8');
           return `Removed task [${title}] from [${category}].`;
       } else {
           return `Task [${title}] not found in [${category}].`;
       }
    }
    
    return "Unknown action.";
  }
};
