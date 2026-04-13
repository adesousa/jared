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
        time_spec: { type: "string", description: "MUST be absolute clock time (e.g. '8:15 AM', '5:00 PM Friday', '25th'). DO NOT use relative times like 'in 2 minutes' - calculate the real time first." },
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
       
       let parsedTimeSpec = time_spec;
       const relativeMinMatch = time_spec.match(/^(?:in\s+)?(\d+)\s*min(?:ute)?s?/i);
       const relativeHourMatch = time_spec.match(/^(?:in\s+)?(\d+)\s*hour(?:s)?/i);

       if (relativeMinMatch) {
           const mins = parseInt(relativeMinMatch[1], 10);
           const targetDate = new Date(Date.now() + mins * 60000);
           let h = targetDate.getHours();
           let m = targetDate.getMinutes().toString().padStart(2, '0');
           let ampm = h >= 12 ? 'PM' : 'AM';
           let dispH = h % 12 || 12;
           parsedTimeSpec = `${dispH}:${m} ${ampm}`;
       } else if (relativeHourMatch) {
           const hours = parseInt(relativeHourMatch[1], 10);
           const targetDate = new Date(Date.now() + hours * 3600000);
           let h = targetDate.getHours();
           let m = targetDate.getMinutes().toString().padStart(2, '0');
           let ampm = h >= 12 ? 'PM' : 'AM';
           let dispH = h % 12 || 12;
           parsedTimeSpec = `${dispH}:${m} ${ampm}`;
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
                   rewritten.push(`### ${parsedTimeSpec} — ${title}`);
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
           rewritten.push(`### ${parsedTimeSpec} — ${title}`);
           rewritten.push(`- ${task_description}`);
           added = true;
       }
       
       if (!added) {
           rewritten.push(`## ${category}`);
           rewritten.push(`### ${parsedTimeSpec} — ${title}`);
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
