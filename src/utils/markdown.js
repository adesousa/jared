export function stripLinks(cell) {
  let result = "";
  let i = 0;
  while (i < cell.length) {
    if (cell[i] === '[') {
      let closeBrackIndex = cell.indexOf(']', i);
      if (closeBrackIndex !== -1 && cell[closeBrackIndex + 1] === '(') {
        let closeParenIndex = -1;
        let parenCount = 1;
        for (let p = closeBrackIndex + 2; p < cell.length; p++) {
           if (cell[p] === '(') parenCount++;
           else if (cell[p] === ')') {
              parenCount--;
              if (parenCount === 0) {
                 closeParenIndex = p;
                 break;
              }
           }
        }
        if (closeParenIndex !== -1) {
           const linkText = cell.slice(i + 1, closeBrackIndex);
           result += linkText;
           i = closeParenIndex + 1;
           continue;
        }
      }
    }
    result += cell[i];
    i++;
  }
  return result;
}

export function formatLinks(text, formatLinkFn) {
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      let closeBrackIndex = text.indexOf(']', i);
      if (closeBrackIndex !== -1 && text[closeBrackIndex + 1] === '(') {
        let closeParenIndex = -1;
        let parenCount = 1;
        for (let p = closeBrackIndex + 2; p < text.length; p++) {
           if (text[p] === '(') parenCount++;
           else if (text[p] === ')') {
              parenCount--;
              if (parenCount === 0) {
                 closeParenIndex = p;
                 break;
              }
           }
        }
        if (closeParenIndex !== -1) {
           const linkText = text.slice(i + 1, closeBrackIndex);
           const linkUrl = text.slice(closeBrackIndex + 2, closeParenIndex);
           result += formatLinkFn(linkText, linkUrl);
           i = closeParenIndex + 1;
           continue;
        }
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

export function formatMarkdownTable(lines, {
  formatCell = (cell) => cell,
  getBorders = () => ({
    top: ["┌", "─", "┬", "┐\n"],
    middle: ["├", "─", "┼", "┤\n"],
    bottom: ["└", "─", "┴", "┘"],
    prefix: "│ ",
    separator: " │ ",
    suffix: " │\n"
  })
} = {}) {
  const rows = [];
  let maxCols = 0;
  for (const line of lines) {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.substring(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1);
    const cells = trimmed.split("|").map(c => c.trim());
    maxCols = Math.max(maxCols, cells.length);
    rows.push({ cells });
  }

  let hasSeparator = false;
  if (rows.length > 1) {
    hasSeparator = rows[1].cells.every(c => /^[-: ]+$/.test(c) && c.length > 0);
  }

  const colWidths = new Array(maxCols).fill(0);
  for (let i = 0; i < rows.length; i++) {
    if (hasSeparator && i === 1) continue;
    for (let j = 0; j < rows[i].cells.length; j++) {
      let cell = rows[i].cells[j] || "";
      let cleanCell = stripLinks(cell).replace(/\*\*|\*|`/g, "");
      colWidths[j] = Math.max(colWidths[j] || 0, cleanCell.length);
    }
  }

  const borders = getBorders();
  let resultParts = [];
  
  if (borders.top) {
    resultParts.push(borders.top[0] + colWidths.map(w => borders.top[1].repeat(w + 2)).join(borders.top[2]) + borders.top[3]);
  }

  const prefix = borders.prefix;
  const separator = borders.separator;
  const suffix = borders.suffix;
  const sepBorder = borders.middle 
    ? (borders.middle[0] + colWidths.map(w => borders.middle[1].repeat(w + 2)).join(borders.middle[2]) + borders.middle[3])
    : "";

  for (let i = 0; i < rows.length; i++) {
    if (hasSeparator && i === 1) {
      if (sepBorder) resultParts.push(sepBorder);
      continue;
    }

    let rowParts = [prefix];
    for (let j = 0; j < colWidths.length; j++) {
      let cell = rows[i].cells[j] || "";
      let cleanCell = stripLinks(cell).replace(/\*\*|\*|`/g, "");
      let visibleLen = cleanCell.length;
      let padLen = Math.max(0, colWidths[j] - visibleLen);

      rowParts.push(formatCell(cell, cleanCell));
      if (padLen > 0) rowParts.push(" ".repeat(padLen));

      if (j < colWidths.length - 1) {
        rowParts.push(separator);
      } else {
        rowParts.push(suffix);
      }
    }
    resultParts.push(rowParts.join(""));
  }

  if (borders.bottom) {
    resultParts.push(borders.bottom[0] + colWidths.map(w => borders.bottom[1].repeat(w + 2)).join(borders.bottom[2]) + borders.bottom[3]);
  }

  return resultParts.join("");
}

export function formatWhatsAppLink(text, url) {
  const cleanText = text.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const cleanUrl = url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  
  if (cleanText === cleanUrl || cleanText === "" || url.includes(text)) {
    return url;
  }
  return `${text} (${url})`;
}

export function formatWhatsAppTable(lines) {
  const linksCollected = [];
  for (const line of lines) {
    formatLinks(line, (text, url) => {
      if (!linksCollected.some(l => l.url === url)) {
        linksCollected.push({ text, url });
      }
      return text;
    });
  }

  const tableStr = formatMarkdownTable(lines, {
    formatCell: (cell, cleanCell) => cleanCell,
    getBorders: () => ({
      top: ["┌", "─", "┬", "┐\n"],
      middle: ["├", "─", "┼", "┤\n"],
      bottom: ["└", "─", "┴", "┘"],
      prefix: "│ ",
      separator: " │ ",
      suffix: " │\n"
    })
  });

  let output = "```\n" + tableStr + "\n```";
  if (linksCollected.length > 0) {
    output += "\n\n**Links & Sources:**\n" + linksCollected.map(l => `• **${l.text}**: ${l.url}`).join("\n");
  }
  return output;
}

export function formatWhatsAppMarkdown(text) {
  if (!text) return text;
  let lines = text.split("\n");
  let formattedLines = [];
  let inTable = false;
  let tableLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      inTable = true;
      tableLines.push(line);
      continue;
    } else {
      if (inTable) {
        formattedLines.push(formatWhatsAppTable(tableLines));
        tableLines = [];
        inTable = false;
      }
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const hashes = headerMatch[1].length;
      const title = headerMatch[2];
      formattedLines.push(`**${"■".repeat(hashes)} ${title}**`);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1];
      const content = listMatch[3];
      formattedLines.push(`${indent}• ${content}`);
      continue;
    }

    formattedLines.push(line);
  }

  if (inTable) {
    formattedLines.push(formatWhatsAppTable(tableLines));
  }

  let result = formattedLines.join("\n");

  // Format links
  result = formatLinks(result, formatWhatsAppLink);

  // Italic: *text* (not next to another *) -> _text_
  result = result.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "_$1_");

  // Bold: **text** -> *text*
  result = result.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Inline code: `code` -> ```code```
  result = result.replace(/(?<!`)`([^`\n]+)`(?!`)/g, "```$1```");

  return result;
}
